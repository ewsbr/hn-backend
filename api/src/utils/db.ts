import knex from 'knex'
import postgres from 'postgres';
import { deepCamelKeys, snakeCase } from 'string-ts';

const db = knex({
  client: 'pg-native',
  connection: {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    compress: true,
    keepAlive: true,
    pool: {
      min: 2,
      max: 50,
    },
    statement_timeout: 10000,
    idle_in_transaction_session_timeout: 10000,
    query_timeout: 10000,
    application_name: process.env.API_NAME,
  },
  postProcessResponse(result) {
    return deepCamelKeys(result);
  },
  wrapIdentifier(value, origImpl) {
    if (value === '*') return value;
    const matched = value.match(/(.*?)(\[[0-9]\])/);
    if (matched) return origImpl(matched[1]) + matched[2];
    return origImpl(snakeCase(value));
  }
});

const db2 = postgres({
  host: process.env.DB_HOST,
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  port: 5432,
  ssl: false,
  idle_timeout: 10,
  max: 20,
})

function close() {
  db2.end()
  return db.destroy();
}

export default db;
export { db2, close };