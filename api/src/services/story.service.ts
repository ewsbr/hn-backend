import { Insertable, sql } from 'kysely';
import { StorySortType } from '~/constants/story-sort-type';
import { Database } from '~/db/db';
import { Story } from '~/db/types';

function getStories(trx: Database, sortType: StorySortType, limit: number, offset: number) {
  return trx.selectFrom('topStory as ts')
    .innerJoin('story as s', 'ts.hnId', 's.hnId')
    .innerJoin('user as u', 'u.id', 's.userId')
    .select(['s.hnId as id', 'u.username as by', 's.url', 's.title', 's.score', 's.descendants', 's.createdAt as time'])
    .where('s.dead', '=', false)
    .where('ts.type', '=', sortType)
    .where('s.deletedAt', 'is', null)
    .orderBy('ts.order')
    .limit(limit).offset(offset)
    .execute();
}

function upsertStories(trx: Database, stories: Insertable<Story>[]) {
  return trx
    .insertInto('story')
    .values(stories)
    .onConflict((oc) => oc
      .column('hnId')
      .doUpdateSet({
        'title': (eb) => eb.ref('excluded.title'),
        'dead': (eb) => eb.ref('excluded.dead'),
        'descendants': (eb) => eb.ref('excluded.descendants'),
        'score': (eb) => eb.ref('excluded.score'),
        'text': (eb) => eb.ref('excluded.text'),
        'url': (eb) => eb.ref('excluded.url'),
        'userId': (eb) => eb.ref('excluded.userId'),
        'createdAt': (eb) => eb.ref('excluded.createdAt'),
        'deletedAt': (eb) => eb.ref('excluded.deletedAt'),
        'updatedAt': sql`now()`,
      }),
    )
    .returning(['id', 'hnId'])
    .execute();
}

function getStoryByHnId(trx: Database, hnId: number) {
  return trx.selectFrom('story as s')
    .innerJoin('user as u', 'u.id', 's.userId')
    .select(['s.id', 's.hnId', 's.title', 's.url', 's.score', 's.text', 's.descendants', 'u.username as by', 's.createdAt as time'])
    .where('s.hnId', '=', hnId)
    .executeTakeFirst();
}

export const StoryService = {
  getStories,
  upsertStories,
  getStoryByHnId,
};