import { Knex } from 'knex';
import { Tables } from 'knex/types/tables';

function getStories(trx: Knex, limit: number, offset: number) {
  return trx('top_story AS ts')
    .select('s.hn_id AS id', 'u.username AS by', 's.url', 's.title', 's.score', 's.descendants', trx.raw('extract(epoch from s.created_at)::int AS time'))
    .innerJoin('story AS s', 'ts.hn_id', 's.hn_id')
    .innerJoin('user AS u', 'u.id', 's.user_id')
    .limit(limit).offset(offset)
    .orderBy('ts.order')
    .where('s.dead', false)
    .whereNull('s.deleted_at');
}

function upsertStories(trx: Knex, stories: Knex.DbRecordArr<Tables['story']>[]) {
  return trx('story').insert(stories)
    .onConflict(['hnId'])
    .merge()
    .returning(['id', 'hnId']);
}

function getStoryByHnId(trx: Knex, hnId: number) {
  return trx('story')
    .innerJoin('user', 'user.id', 'story.userId')
    .select('story.id', 'hnId', 'title', 'url', 'descendants', 'username AS by', 'story.createdAt AS time')
    .where('hnId', hnId)
    .first();
}

export const StoryService = {
  getStories,
  upsertStories,
  getStoryByHnId,
}