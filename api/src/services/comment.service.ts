import { Insertable, sql } from 'kysely';
import { CommentsSortOrder } from '~/constants/comments-sort';
import { Comment } from '~/db/types'
import { Database } from '~/db/db';

const COMMENTS_SORT_MAP = {
  [CommentsSortOrder.DEFAULT]: ['order', 'asc'],
  [CommentsSortOrder.NEWEST]: ['created_at', 'desc'],
  [CommentsSortOrder.OLDEST]: ['created_at', 'asc'],
  [CommentsSortOrder.TOP_USER_KARMA]: ['karma', 'desc'],
  [CommentsSortOrder.LOW_USER_KARMA]: ['karma', 'asc'],
  [CommentsSortOrder.MOST_REPLIES]: ['order', 'desc'],
  [CommentsSortOrder.LEAST_REPLIES]: ['order', 'asc']
} as const;

function upsertComments(trx: Database, comments: Insertable<Comment>[]) {
  return trx.insertInto('comment')
    .values(comments)
    .onConflict((oc) => oc
      .column('hnId')
      .doUpdateSet({
        'text': (eb) => eb.ref('excluded.text'),
        'createdAt': (eb) => eb.ref('excluded.createdAt'),
        'deletedAt': (eb) => eb.ref('excluded.deletedAt'),
        'updatedAt': sql`now()`,
      })
    )
    .returning(['id', 'hnId'])
    .execute();
}

async function getCommentsByStoryId(trx: Database, opts: {
  storyHnId: number,
  sortBy: CommentsSortOrder
  commentHnId?: number,
}) {
  const { storyHnId, commentHnId, sortBy } = opts;
  const commentSql = commentHnId == null ? sql`AND c.parent_id IS NULL` : sql`AND c.hn_id = ${commentHnId}`;

  const [sortColumn, direction] = COMMENTS_SORT_MAP[sortBy];
  const comments = await sql`
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
        WHERE c.story_id = ${storyHnId}
        AND c.deleted_at IS NULL
        ${commentSql})
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
    ORDER BY "depth" DESC, ${sql.ref(sortColumn)} ${sql.raw(direction)}, "order"
  `.execute(trx).then((r) => r.rows as any[]);

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

async function searchCommentsByStoryId(trx: Database, opts: {
  storyId: number,
  search: string
}) {
  const { storyId, search } = opts;

  const comments = await trx.selectFrom('comment as c')
    .innerJoin('user as u', 'u.id', 'c.userId')
    .select([
      'c.text',
      'c.createdAt',
      'c.hnId',
      'u.karma',
      'u.username',
    ])
    .where('c.storyId', '=', storyId)
    .where('c.text', 'ilike', `%${search}%`)
    .where('c.deletedAt', 'is', null)
    .orderBy('c.order')
    .execute();

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
  upsertComments,
  getCommentsByStoryId,
  searchCommentsByStoryId,
};