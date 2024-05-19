import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import pagination from '~/plugins/pagination';
import { CommentService } from '~/services/comment.service';
import { StoryService } from '~/services/story.service';
import { HttpError, HttpErrors } from '~/utils/custom-errors';
import db from '~/utils/db';

const plugin: FastifyPluginAsyncTypebox = async function (fastify, opts) {
  await fastify.register(pagination);

  fastify.get('/stories', {
    handler: async function (req, reply) {
      const { limit, offset } = req.parsePagination();
      return await StoryService.getStories(db, limit, offset);
    }
  })

  fastify.get('/stories/:id', {
    schema: {
      params: Type.Object({
        id: Type.Integer(),
      })
    },
    handler: async function (req, reply) {
      const story = await StoryService.getStoryByHnId(db, req.params.id);
      if (story == null) {
        throw HttpErrors.notFound('story', req.params.id);
      }

      const comments = await CommentService.getCommentsByStoryId(db, story.id);
      return {
        ...story,
        kids: comments,
      }
    }
  });
}

export default plugin;