import axios from 'axios';
import axiosRetry from 'axios-retry';
import dayjs from 'dayjs';
import { Knex, QueryBuilder } from 'knex';
import _ from 'lodash';
import { ValueOf } from 'type-fest';
import { StorySortType, FetchUrls } from '~/constants/story-sort-type';
import logger from '~/logging/logger';
import { CommentService } from '~/services/comment.service';
import { ItemPersistService } from '~/services/item-persist.service';
import { StoryService } from '~/services/story.service';
import { HackerNewsUser, UserService } from '~/services/user.service';
import { ItemType } from '~/types/db';
import db from '~/utils/db';
import { allSettledPartitioned } from '~/utils/promise';
import pLimit from '~/utils/promise-limit';

const FETCH_INTERVAL_MINUTES = 15;

export interface HackerNewsItem {
  id: number;
  deleted?: boolean;
  type: 'job' | 'story' | 'comment' | 'poll' | 'pollopt';
  by: string;
  time: number;
  text?: string;
  dead?: boolean;
  parent?: number;
  poll?: number;
  kids?: number[];
  url?: string;
  score?: number;
  title?: string;
  parts?: number[];
  descendants?: number;
}

export interface HackerNewsItemWithKids extends Omit<HackerNewsItem, 'kids'> {
  kids: HackerNewsItemWithKids[];
}

const axiosClient = axios.create({
  baseURL: 'https://hacker-news.firebaseio.com/v0',
  timeout: 2500,
});

axiosRetry(axiosClient, {
  retries: 3,
  retryDelay: (retryCount) => {
    return 200 * 2 ** (retryCount - 1);
  },
  shouldResetTimeout: true,
});

const limit = pLimit(250);
const limitComments = pLimit(1250);

async function fetchTopStories(): Promise<number[]> {
  return await axiosClient.get('/topstories.json').then(({ data }) => data);
}

async function fetchAllStoryIds() {
  const storyIds = await Promise.all(Object.values(FetchUrls).map(fetchStoryIds));
  return _.zipObject(Object.keys(FetchUrls), storyIds);
}

async function fetchStoryIds(storyFetchUrl: ValueOf<typeof FetchUrls>): Promise<number> {
  return await axiosClient.get(storyFetchUrl).then(({ data }) => data);
}

async function fetchItemById(itemId: number) {
  return await axiosClient.get(`/item/${itemId}.json`).then(({ data }) => data);
}

async function fetchUserById(userId: string) {
  return await axiosClient.get(`/user/${userId}.json`).then(({ data }) => data);
}

async function fetchItemRecursively(storyId: number): Promise<any> {
  const parent = await fetchItemById(storyId);
  const children: number[] = parent.kids ?? [];

  if (children.length === 0) {
    return parent;
  }

  const [fulfilled, rejected] = await allSettledPartitioned(
    children.map(
      (itemId) => limitComments(() => fetchItemRecursively(itemId)),
    ),
  );

  if (rejected.length > 0) {
    logger.warn(rejected, `Failed to fetch some comments for story ${storyId}`);
  }

  return {
    ...parent,
    kids: fulfilled,
  };
}

async function fetchItemsRecursivelyTwo(storyId: number, promises: Promise<any>[]): Promise<void> {
  promises.push(limitComments(() => fetchItemById(storyId)));
  const parent = await promises.at(-1);
  const children: number[] = parent.kids ?? [];

  if (children.length === 0) {
    return;
  }

  await Promise.all(children.map(
    (child) => fetchItemsRecursivelyTwo(child, promises),
  ));
}

async function fetchItemsRecursivelyThree(storyId: number): Promise<any> {
  const parent = await limitComments(() => fetchItemById(storyId));
  const childrenIds: number[] = parent.kids ?? [];

  if (childrenIds.length === 0) {
    return parent;
  }

  const children = await Promise.all(childrenIds.map(
    (childId) => fetchItemsRecursivelyThree(childId),
  ));
  return {
    ...parent,
    kids: children,
  };
}

async function fetchItemsRecursivelyFour(storyId: number): Promise<any> {
  const parent = await limitComments(() => fetchItemById(storyId));
  const childrenIds: number[] = parent.kids ?? [];

  await StoryService.upsertStories(db, [{
    hnId: parent.id,
    title: parent.title,
    url: parent.url,
    dead: parent.dead ?? false,
    score: parent.score ?? 0,
    descendants: parent.descendants ?? 0,
    userId: UserService.userByAlias(db, parent.by),
  }]);

  if (childrenIds.length === 0) {
    return parent;
  }

  const children = await Promise.all(childrenIds.map(
    (childId) => fetchItemsRecursivelyFour(childId),
  ));

  const comments = children.map((comment) => ({
    hn_id: comment.id,
    text: comment.text,
    parent_id: parent.id,
    user_id: UserService.userByAlias(db, comment.by),
    time: dayjs.utc(comment.time * 1000),
  }));

  await CommentService.upsertComments(db, comments);
}

async function fetchStoriesById(storyIds: number[]) {
  const [fulfilled, rejected] = await allSettledPartitioned(
    storyIds.map(
      (storyId) => limit(() => fetchItemById(storyId)),
    ),
  );

  if (rejected.length > 0) {
    logger.warn(rejected, 'Failed to fetch some stories');
  }

  return fulfilled;
}

async function persistItems(
  items: HackerNewsItemWithKids[],
  userMap: Map<string, number> = new Map(),
  parentMap: Map<number, number> = new Map(),
  storyIdMap: Map<number, number> = new Map(),
  commentIdMap: Map<number, number> = new Map(),
) {
  const groupedItems = _.groupBy(items, 'type');
  for (const [type, items] of Object.entries(groupedItems)) {
    logger.info(`Persisting ${items.length} items of type ${type}`);

    if (type === 'story') {
      const stories = await StoryService.upsertStories(db, items.map((item) => ({
        hn_id: item.id,
        title: item.title,
        url: item.url,
        dead: item.dead ?? false,
        score: item.score ?? 0,
        descendants: item.descendants ?? 0,
        user_id: userMap.get(item.by),
        created_at: dayjs.utc(item.time * 1000),
        updated_at: db.fn.now(),
        deleted_at: item.deleted ? db.fn.now() : null,
      })));
      stories.forEach((story) => storyIdMap.set(story.hnId, story.id));
    } else if (type === 'comment') {
      const comments = await CommentService.upsertComments(db, items.map((item, i) => {
        let storyId: QueryBuilder | number | undefined = storyIdMap.get(parentMap.get(item.id)!);
        if (storyId == null) {
          storyId = db.select('id').from('story').where('hn_id', parentMap.get(item.id)!).first();
          logger.warn([...storyIdMap.entries()], `Story ID not found for comment ${item.id}, parent ${item.parent}, story ${parentMap.get(item.id)}}`);
        }

        return {
          hn_id: item.id,
          text: item.text ?? undefined,
          parent_id: commentIdMap.get(item.parent!) ?? null,
          story_id: storyId,
          user_id: userMap.get(item.by),
          created_at: dayjs.utc(item.time * 1000),
          updated_at: db.fn.now(),
          deleted_at: item.deleted ? db.fn.now() : null,
          order: i,
        }
      }));
      comments.forEach((comment) => commentIdMap.set(comment.hnId, comment.id));
    }

    const validItems = items.filter((item) => item.deleted !== true && item.by != null);
    const nextKids = validItems
      .filter(i => i.kids?.length > 0)
      .map(i => i.kids)
      .flat();

    if (nextKids.length === 0) continue;
    validItems
      .filter(i => i.kids?.length > 0)
      .forEach((item) => {
        item.kids.forEach((kid) => parentMap.set(kid.id, parentMap.get(item.id) ?? item.id));
      });
    await persistItems(nextKids, userMap, parentMap, storyIdMap, commentIdMap);
  }
}

async function fetchUsers(userIds: string[]): Promise<HackerNewsUser[]> {
  const [fulfilled, rejected] = await allSettledPartitioned(
    userIds.map(
      (userId) => limit(() => fetchUserById(userId)),
    ),
  );

  if (rejected.length > 0) {
    logger.warn(rejected, 'Failed to fetch some users');
  }

  return fulfilled;
}

function extractUserIds(items: HackerNewsItemWithKids[], userIds = new Set<string>()) {
  for (const item of items) {
    userIds.add(item.by);

    if ((item.kids?.length ?? 0) === 0) continue;
    extractUserIds(item.kids, userIds);
  }

  return Array.from(userIds);
}

function extractTotalItems(items: HackerNewsItemWithKids[], totalItems = 0) {
  totalItems += items.length;
  for (const item of items) {
    if ((item.kids?.length ?? 0) === 0) continue;
    totalItems += extractTotalItems(item.kids);
  }

  return totalItems;
}

async function fetchStoriesWithCommentsById(storyIds: number[]) {
  const [fulfilled, rejected] = await allSettledPartitioned(
    storyIds.map(
      (storyId) => limit(() => fetchItemsRecursivelyThree(storyId)),
    ),
  );

  if (rejected.length > 0) {
    logger.warn(rejected, 'Failed to fetch some stories');
  }

  const users = await fetchUsers(extractUserIds(fulfilled));
  const usersWithIds = await UserService.upsertUsers(db, users);

  const userMap = new Map<string, number>();
  usersWithIds.forEach((user) => userMap.set(user.username, user.id));

  const then = Date.now();
  const totalItems = extractTotalItems(fulfilled);

  const persistService = new ItemPersistService(userMap);
  await persistService.persistItems(fulfilled);
  logger.info(`Persisted ${totalItems} items in ${Date.now() - then}ms`);

  return {
    stories: fulfilled,
    totalItems
  };
}

async function getTimeUntilNextFetch(trx: Knex, type: 'top' | 'new' | 'best' | 'ask' | 'show' | 'job'): Promise<number> {
  const lastSchedule = await trx('fetch_schedule')
    .select('created_at', 'finished_at')
    .where('type', type)
    .orderBy('created_at', 'desc')
    .first();

  if (lastSchedule == null) {
    return 0;
  }

  const diff = dayjs().diff(dayjs(lastSchedule.createdAt), 'minute', true);
  if (lastSchedule.finishedAt == null) { // Last fetch failed halfway through, wait a bit more
    return Math.max(0, FETCH_INTERVAL_MINUTES * 2 - diff);
  }

  return Math.max(0, FETCH_INTERVAL_MINUTES - diff);
}

async function shouldExecuteNextSchedule(trx: Knex, type: ItemType) {
  const lastSchedule = await trx('fetch_schedule')
    .select('finished_at')
    .where('type', type)
    .orderBy('created_at', 'desc')
    .first();

  if (lastSchedule == null) {
    return true;
  }

  if (lastSchedule.finishedAt == null) {
    return dayjs().diff(dayjs(lastSchedule.createdAt), 'minute') > (FETCH_INTERVAL_MINUTES * 2);
  }

  return dayjs().diff(dayjs(lastSchedule.finishedAt), 'minute') > FETCH_INTERVAL_MINUTES;
}

async function insertFetchSchedule(trx: Knex, type: ItemType) {
  return trx('fetch_schedule').insert({
    type
  }).onConflict().ignore()
}

async function finishFetchSchedule(trx: Knex, type: ItemType, totalItems: number) {
  return trx('fetch_schedule')
    .where('type', type)
    .andWhere('finished_at', null)
    .update({
      total_items: totalItems,
      finished_at: db.fn.now()
    });
}

export const ItemFetchService = {
  fetchTopStories,
  fetchAllStoryIds,
  fetchItemById,
  fetchItemRecursively,
  fetchStoriesWithCommentsById,
  fetchStoriesById,
  shouldExecuteNextSchedule,
  getTimeUntilNextFetch,
  insertFetchSchedule,
  finishFetchSchedule
};

