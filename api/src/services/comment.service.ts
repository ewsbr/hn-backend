import { Knex } from 'knex';
import { CommentsSortOrder } from '~/constants/comments-sort';

const COMMENTS_SORT_MAP = {
  [CommentsSortOrder.DEFAULT]: ['order', 'asc'],
  [CommentsSortOrder.NEWEST]: ['created_at', 'desc'],
  [CommentsSortOrder.OLDEST]: ['created_at', 'asc'],
  [CommentsSortOrder.TOP_USER_KARMA]: ['karma', 'desc'],
  [CommentsSortOrder.LOW_USER_KARMA]: ['karma', 'asc'],
  [CommentsSortOrder.MOST_REPLIES]: ['order', 'desc'],
  [CommentsSortOrder.LEAST_REPLIES]: ['order', 'asc']
} as const;

function parentByHnId(trx: Knex, hnId: number) {
  return trx('story').select('id').where('hn_id', hnId);
}

function upsertComments(trx: Knex, comments: any[]) {
  return trx('comment').insert(comments)
    .returning(['id', 'hn_id'])
    .onConflict(['hn_id'])
    .merge();
}

async function getCommentsByStoryId(trx: Knex, opts: {
  storyHnId: number,
  sortBy: CommentsSortOrder
  commentHnId?: number,
}) {
  const { storyHnId, commentHnId, sortBy } = opts;

  const values = [storyHnId];
  if (commentHnId != null) {
    values.push(commentHnId);
  }

  const [sortColumn, direction] = COMMENTS_SORT_MAP[sortBy];
  const comments = await trx.raw(`
    WITH RECURSIVE cte_story_comments AS (
      (SELECT
        c.id,
        c.hn_id,
        c."text",
        c.parent_id,
        u.username,
        u.karma,
        c.created_at,
        c.order,
        0 AS depth,
        c.order AS parent_order
        FROM comment c
        INNER JOIN "user" u ON u.id = c.user_id
        WHERE c.story_id = ?
        AND c.deleted_at IS NULL
        ${commentHnId == null ? 'AND c.parent_id IS NULL' : ''}
        ${commentHnId != null ? `AND c.hn_id = ?` : ''})
      UNION ALL
      SELECT 
        c.id,
        c.hn_id,
        c."text",
        c.parent_id,
        u.username,
        u.karma,
        c.created_at,
        c.order,
        cte.depth + 1    AS depth,
        cte.parent_order AS parent_order
      FROM comment c
        INNER JOIN cte_story_comments cte ON cte.id = c.parent_id
        INNER JOIN "user" u ON u.id = c.user_id
      WHERE c.deleted_at IS NULL)
    SELECT *
    FROM cte_story_comments
    ORDER BY "depth" DESC, "${sortColumn}" ${direction}, "order"
  `, values).then((result) => result.rows);

  const commentMap = new Map<number, any>();
  for (const comment of comments) {
    comment.kids = [];
    comment.descendants = 0;
    commentMap.set(comment.id, comment);
  }

  const nestedComments = [];
  for (const comment of comments) {
    const formattedComment = {
      id: comment.hnId,
      text: comment.text,
      by: comment.username,
      time: comment.createdAt,
      karma: comment.karma,
      get descendants() {
        return comment.descendants;
      },
      kids: comment.kids,
    };
    if (comment.parentId == null || comment.hnId === commentHnId) {
      nestedComments.push(formattedComment);
    } else {
      const parent = commentMap.get(comment.parentId);
      parent.kids.push(formattedComment);
      parent.descendants += 1 + comment.descendants;
    }
  }

  if (sortBy === CommentsSortOrder.MOST_REPLIES || sortBy === CommentsSortOrder.LEAST_REPLIES) {
    nestedComments.sort((left, right) => {
      return sortBy === 'most_replies' ? right.descendants - left.descendants : left.descendants - right.descendants;
    });
  }

  return nestedComments;
}

async function searchCommentsByStoryId(trx: Knex, opts: {
  storyId: number,
  search: string
}) {
  const { storyId, search } = opts;

  const comments = await trx('comment AS c')
    .select(
      'c.text',
      'c.created_at',
      'c.hn_id',
      'u.karma',
      'u.username',
    )
    .innerJoin('user AS u', 'u.id', 'c.user_id')
    .where('story_id', storyId)
    .where('text', 'ilike', `%${search}%`)
    .whereNull('deleted_at')
    .orderBy('order')

  return comments.map((comment) => ({
    id: comment.hnId,
    text: comment.text,
    by: comment.username,
    time: comment.createdAt,
    karma: comment.karma,
    kids: [],
    descendants: 0,
  }));
}

export const CommentService = {
  parentByHnId,
  upsertComments,
  getCommentsByStoryId,
  searchCommentsByStoryId,
};