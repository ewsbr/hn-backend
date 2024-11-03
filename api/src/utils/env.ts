import { Type } from '@sinclair/typebox';
import { parse } from '~/utils/validation';

const envSchema = Type.Object({
  NODE_ENV: Type.String(),
  PORT: Type.Number(),
  HOST: Type.String({
    format: 'hostname',
  }),

  LOG_LEVEL: Type.String(),
  LOG_PATH: Type.String(),
  LOG_ENABLE_AXIOM: Type.Boolean(),
  LOG_AXIOM_DATASET: Type.String(),
  LOG_AXIOM_TOKEN: Type.String(),

  API_NAME: Type.String(),
  API_BASE_PATH: Type.String(),
  API_BASE_URL: Type.String(),

  FRONTEND_BASE_URL: Type.String(),

  DB_HOST: Type.String(),
  DB_PORT: Type.Number(),
  DB_USER: Type.String(),
  DB_PASSWORD: Type.String(),
  DB_DATABASE: Type.String(),
});

export default parse(envSchema, process.env);