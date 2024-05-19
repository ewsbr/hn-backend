import logger, { unproxiedLogger } from '~/logging/logger';
import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { clsProxifyFastifyPlugin } from 'cls-proxify/integration/fastify';
import fp from 'fastify-plugin';
import { randomUUID } from 'node:crypto';

const plugin: FastifyPluginAsyncTypebox = async function (fastify, opts) {
  if (fastify.hasRequestDecorator('meta')) return;
  fastify.decorateRequest('meta', null);

  fastify.addHook('onRequest', async (req, reply) => {
    const meta = {
      requestId: randomUUID(),
      requestTimestamp: process.hrtime.bigint(),
      get timeDelta() {
        return Number(process.hrtime.bigint() - this.requestTimestamp) / 1e6;
      },
    };

    req.meta = meta;
    reply.header('X-Request-Id', meta.requestId);
    reply.header('X-Timestamp', meta.requestTimestamp);
  });

  fastify.addHook('onResponse', async (req, reply) => {
    const meta = req.meta;
    logger.info(`Request with ID ${meta.requestId} completed`);
  });

  fastify.register(clsProxifyFastifyPlugin, {
    proxify: (req, reply) => {
      const meta = req.meta;

      return unproxiedLogger.child({
        meta: {
          requestId: meta.requestId,
          requestTimestamp: meta.requestTimestamp,
          timeDelta: meta.timeDelta,
        },
      });
    },
  });
};

export default fp(plugin);

declare module 'fastify' {
  interface FastifyRequest {
    meta: {
      requestId: string
      requestTimestamp: bigint,
      timeDelta: number,
    };
  }
}