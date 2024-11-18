import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import { sql } from 'kysely';
import { Database } from '~/db/db';

dayjs.extend(utc);

export interface HackerNewsUser {
  id: string;
  created: number;
  karma: number;
  about: string;
  submitted: number[];
}

async function upsertUsers(trx: Database, users: HackerNewsUser[]) {
  return await trx
    .insertInto('user')
    .values(users.map(user => ({
      username: user.id,
      createdAt: dayjs.utc(user.created * 1000).toDate(),
      karma: user.karma,
      about: user.about,
    })))
    .onConflict(oc => oc
      .column('username')
      .doUpdateSet({
        createdAt: sql`excluded.created_at`,
        karma: sql`excluded.karma`,
        about: sql`excluded.about`,
      }),
    )
    .returning(['id', 'username'])
    .execute();
}

export const UserService = {
  upsertUsers,
};