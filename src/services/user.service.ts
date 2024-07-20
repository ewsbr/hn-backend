import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import { Knex } from 'knex';

dayjs.extend(utc);

export interface HackerNewsUser {
  id: string;
  created: number;
  karma: number;
  about: string;
  submitted: number[];
}

function userByAlias(trx: Knex, username: string) {
  return trx('user').select('id').where('username', username);
}

function upsertUsers(trx: Knex, users: HackerNewsUser[]) {
  return trx('user').insert(users.map(user => ({
    username: user.id,
    created_at: dayjs.utc(user.created * 1000).toDate(),
    karma: user.karma,
    about: user.about,
  })))
    .returning(['id', 'username'])
    .onConflict(['username'])
    .merge();
}

export const UserService = {
  userByAlias,
  upsertUsers
}