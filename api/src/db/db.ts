import { CamelCasePlugin, Kysely, PostgresDialect } from 'kysely';
import { Pool } from 'pg';
import { DB } from '~/db/types';

const dialect = new PostgresDialect({
  pool: new Pool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    keepAlive: true,
    statement_timeout: 10000,
    idle_in_transaction_session_timeout: 10000,
    query_timeout: 10000,
    application_name: process.env.API_NAME,
    min: 2,
    max: 20,
  }),
});

const db = new Kysely<DB>({
  dialect,
  plugins: [new CamelCasePlugin()],
});

export default db;
export type Database = Kysely<DB>;