import dayjs from 'dayjs';
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

    const timeUntilFetch = await ItemFetchService.getTimeUntilNextFetch(db, 'top');
    if (timeUntilFetch > 0) {
      logger.info(`Fetching top stories in ${timeUntilFetch.toFixed(2)}m...`)
      await setTimeout(STORY_FETCH_LOOP_DELAY);
      continue;
    }

    await ItemFetchService.insertFetchSchedule(db, 'top');

    const topStoryIds = await ItemFetchService.fetchTopStories().then(stories => stories.slice(0, 500));
    await TopStoriesService.insertStories(db, 'top', topStoryIds);

    logger.info(`Fetching ${topStoryIds.length} stories...`);
    const { stories, totalItems } = await ItemFetchService.fetchStoriesWithCommentsById(topStoryIds);

    logger.info(stories.map(s => s.title), `Fetched ${stories.length} stories and ${totalItems} items in ${Date.now() - then}ms`);
    await fs.writeFile('data.json', JSON.stringify(stories, null, 2))

    await ItemFetchService.finishFetchSchedule(db, 'top', totalItems)

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