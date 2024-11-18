import dayjs from 'dayjs';
import { sql } from 'kysely';

import { Agent, RetryAgent, setGlobalDispatcher } from 'undici';
import { FetchUrls, StorySortType } from '~/constants/story-sort-type';
import { Database } from '~/db/db';
import logger from '~/logging/logger';
import { ItemPersistService } from '~/services/item-persist.service';
import { HackerNewsUser, UserService } from '~/services/user.service';
import { allSettledPartitioned } from '~/utils/promise';
import db from '~/db/db';
import pLimit from '~/utils/promise-limit';

const FETCH_INTERVAL_MINUTES = 30;

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

const agent = new RetryAgent(new Agent({
  allowH2: true,
  keepAliveTimeout: 30000,
  pipelining: 10,
  connections: 50,
  headersTimeout: 10000,
  bodyTimeout: 10000,
}), {
  maxRetries: 2,
  minTimeout: 200,
  maxTimeout: 2000,
});
setGlobalDispatcher(agent);
// const pool = new Pool('https://hacker-news.firebaseio.com');

const limit = pLimit(250);
const limitComments = pLimit(500);

async function fetchStoryIds(storyFetchUrl: keyof typeof FetchUrls): Promise<number[]> {
  return await agent.request({
    method: 'GET',
    origin: 'https://hacker-news.firebaseio.com',
    path: `/v0/${FetchUrls[storyFetchUrl]}`,
    throwOnError: true,
  }).then((response) => response.body.json()) as number[];
}

async function fetchItemById(itemId: number): Promise<HackerNewsItem> {
  return await agent.request({
    method: 'GET',
    origin: 'https://hacker-news.firebaseio.com',
    path: `/v0/item/${itemId}.json`,
    throwOnError: true,
  }).then((response) => response.body.json()) as HackerNewsItem;
}

async function fetchUserById(userId: string) {
  return await agent.request({
    method: 'GET',
    origin: 'https://hacker-news.firebaseio.com',
    path: `/v0/user/${userId}.json`,
    throwOnError: true,
  }).then((response) => response.body.json()) as HackerNewsUser;
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
    logger.warn(rejected.map(r => r.message), 'Failed to fetch some stories');
  }

  const users = await fetchUsers(extractUserIds(fulfilled));
  const usersWithIds = await UserService.upsertUsers(db, users);

  if (usersWithIds.length !== users.length) {
    throw new Error('Failed to upsert all users');
  }

  const userMap = new Map<string, number>();
  usersWithIds.forEach((user) => userMap.set(user.username, user.id));

  const then = Date.now();
  const totalItems = extractTotalItems(fulfilled);

  const persistService = new ItemPersistService(userMap);
  await persistService.persistItems(fulfilled);
  logger.info(`Persisted ${totalItems} items in ${Date.now() - then}ms`);

  return {
    stories: fulfilled,
    totalItems,
  };
}

async function getTimeUntilNextFetch(trx: Database, type: StorySortType): Promise<number> {
  const lastSchedule = await trx.selectFrom('fetchSchedule')
    .select(['createdAt', 'finishedAt'])
    .where('type', '=', type)
    .orderBy('createdAt', 'desc')
    .limit(1)
    .executeTakeFirst();

  if (lastSchedule == null) {
    return 0;
  }

  const diff = dayjs().diff(dayjs(lastSchedule.createdAt), 'minute', true);
  if (lastSchedule.finishedAt == null) { // Last fetch failed halfway through, wait a bit more
    return Math.max(0, FETCH_INTERVAL_MINUTES * 2 - diff);
  }

  return Math.max(0, FETCH_INTERVAL_MINUTES - diff);
}

async function insertFetchSchedule(trx: Database, type: StorySortType) {
  return trx.insertInto('fetchSchedule')
    .values({
      type,
    })
    .onConflict((oc) => oc.doNothing())
    .execute();
}

async function finishFetchSchedule(trx: Database, type: StorySortType, totalItems: number) {
  return trx.updateTable('fetchSchedule')
    .set({
      totalItems,
      finishedAt: sql`now()`,
    })
    .where('type', '=', type)
    .where('finishedAt', 'is', null)
    .execute();
}

export const ItemFetchService = {
  fetchStoryIds,
  fetchStoriesWithCommentsById,
  getTimeUntilNextFetch,
  insertFetchSchedule,
  finishFetchSchedule,
};

