import dayjs from 'dayjs';
import { sql } from 'kysely';
import _ from 'lodash';
import { ItemType } from '~/constants/item-type';
import db from '~/db/db';
import logger from '~/logging/logger';
import { CommentService } from '~/services/comment.service';
import { HackerNewsItemWithKids } from '~/services/item-fetch.service';
import { StoryService } from '~/services/story.service';

class ItemPersistService {

  #parentMap: Map<number, number> = new Map();
  #storyIdMap: Map<number, number> = new Map();
  #commentIdMap: Map<number, number> = new Map();

  constructor(
    private userMap: Map<string, number>,
  ) {}

  async #persistStories(stories: HackerNewsItemWithKids[], storyType: ItemType) {
    const storiesToInsert = stories.map((item) => ({
      hnId: item.id,
      title: item.title!,
      url: item.url!,
      text: item.text,
      dead: item.dead ?? false,
      score: item.score ?? 0,
      descendants: item.descendants ?? 0,
      userId: this.userMap.get(item.by)!,
      storyType: storyType as 'job' | 'story',
      createdAt: dayjs.utc(item.time * 1000).toISOString(),
      deletedAt: item.deleted ? dayjs().toISOString() : null
    }));

    const batches = _.chunk(storiesToInsert, 1000);
    const results = await Promise.all(
      batches.map((batch) => StoryService.upsertStories(db, batch)),
    );

    for (const result of results) {
      result.forEach((story) => this.#storyIdMap.set(story.hnId, story.id));
    }
  }

  async #persistComments(comments: HackerNewsItemWithKids[]) {
    const commentsToInsert = comments.map((item, i) => {
      let storyId = this.#storyIdMap.get(this.#parentMap.get(item.id)!)!;
      return {
        hnId: item.id,
        text: item.text ?? undefined,
        parentId: this.#commentIdMap.get(item.parent!) ?? null,
        storyId,
        userId: this.userMap.get(item.by),
        createdAt: dayjs.utc(item.time * 1000).toISOString(),
        deletedAt: item.deleted ? dayjs().toISOString() : null,
        order: i,
      };
    });

    const batches = _.chunk(commentsToInsert, 1000);
    const results = await Promise.all(
      batches.map((batch) => CommentService.upsertComments(db, batch)),
    );

    for (const result of results) {
      result.forEach((comment) => this.#commentIdMap.set(comment.hnId, comment.id));
    }
  }

  async #persistPollOpt(pollOpts: HackerNewsItemWithKids[]) {
    // TODO
  }

  public async persistItems(items: HackerNewsItemWithKids[]) {
    const groupedItems = _.groupBy(items, 'type');
    for (const [type, items] of Object.entries(groupedItems)) {
      logger.info(`Persisting ${items.length} items of type ${type}`);

      if (type === 'story') {
        await this.#persistStories(items, ItemType.STORY);
      } else if (type === 'job') {
        await this.#persistStories(items, ItemType.JOB);
      } else if (type === 'poll') {
        await this.#persistStories(items, ItemType.POLL);
      } else if (type === 'pollopt') {
        logger.info('Skipping pollopt');
      } else if (type === 'comment') {
        await this.#persistComments(items);
      }

      const validItems = items.filter((item) => item.deleted !== true && item.by != null);
      const nextKids = validItems
        .filter(i => i.kids?.length > 0)
        .map(i => i.kids)
        .flat();

      if (nextKids.length === 0) continue;
      for (const item of validItems) {
        if ((item.kids?.length ?? 0) === 0) continue;
        item.kids.forEach(
          (kid) => this.#parentMap.set(kid.id, this.#parentMap.get(item.id) ?? item.id),
        );
      }

      await this.persistItems(nextKids);
    }
  }
}

export {
  ItemPersistService,
};