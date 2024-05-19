import { Knex } from 'knex';
import { ItemType } from '~/types/db';

async function insertStories(trx: Knex, type: ItemType, items: number[]): Promise<void> {
  await trx('top_story').where('type', type).del();
  await trx('top_story').insert(items.map((id, index) => ({ type, hn_id: id, order: index })));
}

export const TopStoriesService = {
  insertStories,
}