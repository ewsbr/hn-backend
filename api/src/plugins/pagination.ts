import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import fp from 'fastify-plugin';
import { HttpError } from '~/utils/custom-errors';
import { safeParse } from '~/utils/validation';

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 100;

const schema = Type.Object({
  page: Type.Optional(Type.Integer({ minimum: 1, default: 1 })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: MAX_LIMIT, default: DEFAULT_LIMIT })),
});

const plugin: FastifyPluginAsyncTypebox = async function (fastify, opts) {
  if (fastify.hasRequestDecorator('parsePagination')) return;

  fastify.decorateRequest('parsePagination', function () {
    const query = this.query as PaginationQs;

    const result = safeParse(schema, query);
    if (!result.success) {
      throw HttpError.get('validation_error');
    }

    const { page = 1, limit = DEFAULT_LIMIT } = result.data;
    return {
      offset: (page - 1) * limit,
      limit: Math.min(limit, MAX_LIMIT),
    } satisfies Pagination;
  });
};

export default fp(plugin);
export const autoload = false;

export interface PaginationQs {
  page: number;
  limit: number;
}

export interface Pagination {
  offset: number;
  limit: number;
}

declare module 'fastify' {
  interface FastifyRequest {
    parsePagination(): Pagination;
  }
}