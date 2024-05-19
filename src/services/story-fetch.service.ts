import dayjs from 'dayjs';
import { StorySortType } from '~/constants/story-sort-type';
import logger from '~/logging/logger';
import { ItemFetchService } from '~/services/item-fetch.service';
import { setTimeout } from 'timers/promises';
import fs from 'fs/promises';
import { TopStoriesService } from '~/services/top-stories.service';
import db from '~/utils/db';

const STORY_FETCH_LOOP_DELAY = dayjs.duration(1, 'm').asMilliseconds();

let runningFetchLoop = false;

async function startStoryFetchLoop() {
  logger.info('Starting fetch loop...')

  runningFetchLoop = true;
  while (runningFetchLoop) {
    const then = Date.now();

    for (const storyType of Object.values(StorySortType) as StorySortType[]) {
      const timeUntilFetch = await ItemFetchService.getTimeUntilNextFetch(db, storyType);
      if (timeUntilFetch > 0) {
        logger.info(`Fetching ${storyType} stories in ${timeUntilFetch.toFixed(2)}m...`)
        continue;
      }

      const ids = await ItemFetchService.fetchStoryIds(storyType);
      await db.transaction(async trx => {
        await ItemFetchService.insertFetchSchedule(trx, storyType);
        await TopStoriesService.insertStories(trx, storyType, ids);
      });

      logger.info(`Fetching ${ids.length} ${storyType} stories...`);
      const { stories, totalItems } = await ItemFetchService.fetchStoriesWithCommentsById(ids);

      logger.info(stories.map(s => s.title), `Fetched ${stories.length} ${storyType} stories and ${totalItems} items in ${Date.now() - then}ms`);
      await fs.writeFile(`${storyType}.json`, JSON.stringify(stories, null, 2))

      await ItemFetchService.finishFetchSchedule(db, storyType, totalItems)
    }

    await setTimeout(STORY_FETCH_LOOP_DELAY);
  }
}

async function stopFetchLoop() {
  logger.info('Stopping fetch loop...')
  runningFetchLoop = false;
}

export const StoryFetchService = {
  startStoryFetchLoop,
  stopFetchLoop
};