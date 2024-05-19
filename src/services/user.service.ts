import dayjs from 'dayjs';
import { Knex } from 'knex';

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
  console.log('upsertUsers', users.map(u => u.id));
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