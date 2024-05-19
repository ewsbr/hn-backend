import axios from 'axios';
import axiosRetry from 'axios-retry';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import pLimit from 'p-limit';
import db, { rawDb } from './utils/db';
import { allSettledArrays } from './utils/promise';

dayjs.extend(utc)

const axiosClient = axios.create({
  baseURL: 'https://hacker-news.firebaseio.com/v0',
});

axiosRetry(axiosClient, {
  retries: 3,
  retryDelay: (retryCount) => {
    return retryCount * 500;
  },
});

async function main() {
  const lastStoryId = await axiosClient.get('/maxitem.json').then((res) => res.data);

  const limit = pLimit(500);

  const storyPromises = [];
  for (let i = 0; i < 5000; i++) {
    storyPromises.push(limit(() => axiosClient.get(`/item/${lastStoryId - i}.json`)));
  }

  const types: any = {};
  const { fulfilled, rejected } = await allSettledArrays(storyPromises);

  for (const result of fulfilled) {
    if (result.data === null) {
      console.log('No data?', result);
      continue;
    }
    const data = result.data;
    if (!data.type) {
      console.log('No type?', data);
      continue;
    }

    types[data.type] = types[data.type] ? types[data.type] + 1 : 1;
  }

  const users = fulfilled
    .filter((result) => !(result.data.deleted ?? false))
    .map((result) => result.data.by);
  const uniqueUsers = [...new Set(users)].map(username => ({ username }));

  const userIds = await db('user').insert(uniqueUsers)
    .onConflict(['username'])
    .merge({
      username: db.raw('excluded.username'),
    })
    .returning(['id', 'username']);

  const stories = fulfilled
    .filter((result) => result.data.type === 'story')
    .map((result) => result.data)
    .map((story) => ({
      hn_id: story.id,
      title: story.title,
      url: story.url,
      dead: story.dead ?? false,
      score: story.score ?? 0,
      descendants: story.descendants ?? 0,
      user_id: userIds.find((user) => user.username === story.by)?.id ?? 1,
    }));

  const storyIds = await db('story').insert(stories)
    .onConflict(['hn_id'])
    .merge()
    .returning(['id', 'hn_id']);

  console.time()
  const comments = fulfilled
    .filter((result) => result.data.type === 'comment')
    .map((result) => result.data)
    .map((comment) => ({
      hn_id: comment.id,
      text: comment.text,
      parent_id: storyIds.find((story) => story.hn_id === comment.parent)?.id ?? 1,
      user_id: userIds.find((user) => user.username === comment.by)?.id ?? 1,
      time: dayjs.utc(comment.time * 1000)
    }));
  console.timeEnd()

  let old = 0;
  for (const comment of comments) {
    if (comment.time.isBefore(dayjs.utc().subtract(6, 'hour'))) {
      old++;
      console.log('Skipping old comment', comment.hn_id);
    }
  }
  console.log('total', old);

  console.time('insert')
  // await db('comment').insert(comments)
  //   .onConflict(['hn_id'])
  //   .merge();

  // await rawDb.query(`
  //   INSERT INTO comment (hn_id, text, parent_id, user_id)
  //   SELECT
  //     *
  //     (
  //   FROM
  //       SELECT
  //         id,
  //         hn_id,
  //         text,
  //         user_id
  //       FROM
  //         unnest($1::int[], $2::text[], $3::int[], $4::int[]) AS t(id, hn_id, text, user_id)
  //     ) AS k
  //   ON CONFLICT (hn_id) DO UPDATE SET
  //     "text" = EXCLUDED.text,
  //     parent_id = EXCLUDED.parent_id,
  //     user_id = EXCLUDED.user_id;
  // `, [
  //   comments.map((comment) => comment.hn_id),
  //   comments.map((comment) => comment.text),
  //   comments.map((comment) => comment.parent_id),
  //   comments.map((comment) => comment.user_id),
  // ]);
  console.timeEnd('insert')

  await db.destroy();
}

main().then(() => {
  console.log('done');
})
