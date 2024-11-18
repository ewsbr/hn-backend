import { StorySortType } from '~/constants/story-sort-type';
import { Database } from '~/db/db';

async function insertStories(trx: Database, type: StorySortType, items: number[]): Promise<void> {
  await trx.deleteFrom('topStory').where('type', '=', type).execute();
  await trx.insertInto('topStory')
    .values(items.map((id, index) => ({ type, hnId: id, order: index })))
    .execute();
}

export const TopStoriesService = {
  insertStories,
}