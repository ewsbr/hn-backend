import { Knex } from 'knex';
import { StorySortType } from '~/constants/story-sort-type';

async function insertStories(trx: Knex, type: StorySortType, items: number[]): Promise<void> {
  await trx('top_story').where('type', type).del();
  await trx('top_story').insert(items.map((id, index) => ({ type, hn_id: id, order: index })));
}

export const TopStoriesService = {
  insertStories,
}