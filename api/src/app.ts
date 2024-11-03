import env from '~/utils/env.js';
import AutoLoad from '@fastify/autoload';
import Cors, { FastifyCorsOptions } from '@fastify/cors';
import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import * as path from 'path';

import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';
import utc from 'dayjs/plugin/utc';
dayjs.extend(utc);
dayjs.extend(duration);

const plugin: FastifyPluginAsyncTypebox = async function (fastify, opts) {
  await fastify.register(Cors, {
    origin: '*',
  } satisfies FastifyCorsOptions);

  await fastify.register(import('fastify-print-routes'), {
    compact: true
  });

  await fastify.register(AutoLoad, {
    dir: path.join(__dirname, 'plugins'),
    options: Object.assign({}, opts),
  });

  await fastify.register(AutoLoad, {
    dir: path.join(__dirname, 'routes'),
    dirNameRoutePrefix: false,
    options: Object.assign({ prefix: env.API_BASE_PATH }, opts),
  });
};

export default plugin;