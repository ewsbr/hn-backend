import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import { CommentsSortOrder } from '~/constants/comments-sort';
import { StorySortType } from '~/constants/story-sort-type';
import cachePolicy from '~/plugins/cache-policy';
import pagination from '~/plugins/pagination';
import { CommentService } from '~/services/comment.service';
import { StoryService } from '~/services/story.service';
import { HttpErrors } from '~/utils/custom-errors';
import db from '~/utils/db';

const plugin: FastifyPluginAsyncTypebox = async function (fastify, opts) {
  await fastify.register(pagination);
  await fastify.register(cachePolicy, { maxAge: 10 * 60 });

  for (const sortType of Object.values(StorySortType) as StorySortType[]) {
    fastify.get(`/stories/${sortType}`, {
      handler: async function (req, reply) {
        const { limit, offset } = req.parsePagination();
        return await StoryService.getStories(db, sortType, limit, offset);
      },
    });
  }

  fastify.get('/stories/:id', {
    schema: {
      params: Type.Object({
        id: Type.Integer()
      }),
      querystring: Type.Object({
        order_by: Type.String({ enum: Object.values(CommentsSortOrder), default: CommentsSortOrder.DEFAULT }),
        comment_id: Type.Optional(Type.Integer()),
        search: Type.Optional(Type.String()),
      })
    },
    handler: async function (req, reply) {
      const story = await StoryService.getStoryByHnId(db, req.params.id);
      if (story == null) {
        throw HttpErrors.notFound('story', req.params.id);
      }

      let comments;
      if (req.query.search != null && req.query.search !== '') {
        comments = await CommentService.searchCommentsByStoryId(db, {
          storyId: story.id,
          search: req.query.search,
        });
      } else {
        comments = await CommentService.getCommentsByStoryId(db, {
          sortBy: req.query.order_by as CommentsSortOrder,
          storyHnId: story.id,
          commentHnId: req.query.comment_id,
        });
      }

      return {
        ...story,
        kids: comments,
      };
    },
  });
};

export default plugin;