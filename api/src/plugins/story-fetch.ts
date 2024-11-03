import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { StoryFetchService } from '~/services/story-fetch.service';

const plugin: FastifyPluginAsyncTypebox = async function (fastify, opts) {
  StoryFetchService.startStoryFetchLoop();

  fastify.addHook('onClose', () => {
    StoryFetchService.stopFetchLoop();
  })
};

export default plugin;