import { Knex } from 'knex';

function parentByHnId(trx: Knex, hnId: number) {
  return trx('story').select('id').where('hn_id', hnId);
}

function upsertComments(trx: Knex, comments: any[]) {
  return trx('comment').insert(comments)
    .returning(['id', 'hn_id'])
    .onConflict(['hn_id'])
    .merge();
}

async function getCommentsByStoryId(trx: Knex, storyHnId: number) {
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
        0 as depth,
        c.order as parent_order
      FROM
        comment c
      INNER JOIN "user" u ON u.id = c.user_id
      WHERE
        c.story_id = ?
        AND c.parent_id IS NULL
        AND c.deleted_at IS NULL)
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
        cte.depth + 1 AS depth,
        cte.parent_order AS parent_order
      FROM
        comment c
      INNER JOIN cte_story_comments cte ON cte.id = c.parent_id
      INNER JOIN "user" u ON u.id = c.user_id
      WHERE
        c.deleted_at IS NULL
    )
    SELECT * FROM cte_story_comments ORDER BY parent_order, "depth", "order";
  `, [storyHnId]).then((result) => result.rows);

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
        return comment.descendants
      },
      kids: comment.kids
    };
    if (comment.parentId == null) {
      nestedComments.push(formattedComment);
    } else {
      const parent = commentMap.get(comment.parentId);
      parent.kids.push(formattedComment);
      parent.descendants += 1;
    }
  }

  return nestedComments;
}

export const CommentService = {
  parentByHnId,
  upsertComments,
  getCommentsByStoryId
};