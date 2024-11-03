import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

interface CachePolicyOptions {
  maxAge: number;
}

const plugin: FastifyPluginAsyncTypebox<CachePolicyOptions> = async function (fastify, opts) {
  fastify.addHook('onRequest', async (request, reply) => {
    reply.header('Cache-Control', `public, max-age=${opts.maxAge}, must-revalidate`);
  });
};

export default plugin;
export const autoload = false;