import dayjs from 'dayjs';
import { QueryBuilder } from 'knex';
import _ from 'lodash';
import { ItemType } from '~/constants/item-type';
import logger from '~/logging/logger';
import { CommentService } from '~/services/comment.service';
import { HackerNewsItemWithKids } from '~/services/item-fetch.service';
import { StoryService } from '~/services/story.service';
import db from '~/utils/db';

class ItemPersistService {

  #parentMap: Map<number, number> = new Map();
  #storyIdMap: Map<number, number> = new Map();
  #commentIdMap: Map<number, number> = new Map();

  constructor (
    private userMap: Map<string, number>,
  ) {}

  async #persistStories(stories: HackerNewsItemWithKids[], storyType: ItemType) {
    const insertedStories = await StoryService.upsertStories(db, stories.map((item) => ({
      hnId: item.id,
      title: item.title!,
      url: item.url!,
      dead: item.dead ?? false,
      score: item.score ?? 0,
      descendants: item.descendants ?? 0,
      userId: this.userMap.get(item.by)!,
      storyType,
      createdAt: dayjs.utc(item.time * 1000).toDate(),
      updatedAt: db.fn.now(),
      deletedAt: item.deleted ? db.fn.now() : null,
    })));
    insertedStories.forEach((story) => this.#storyIdMap.set(story.hnId, story.id));
  }

  async #persistComments(comments: HackerNewsItemWithKids[]) {
    const insertedComments = await CommentService.upsertComments(db, comments.map((item, i) => {
      let storyId: QueryBuilder | number | undefined = this.#storyIdMap.get(this.#parentMap.get(item.id)!);
      if (storyId == null) {
        storyId = db.select('id').from('story').where('hn_id', this.#parentMap.get(item.id)!).first();
        logger.warn([...this.#storyIdMap.entries()], `Story ID not found for comment ${item.id}, parent ${item.parent}, story ${this.#parentMap.get(item.id)}}`);
      }

      return {
        hn_id: item.id,
        text: item.text ?? undefined,
        parent_id: this.#commentIdMap.get(item.parent!) ?? null,
        story_id: storyId,
        user_id: this.userMap.get(item.by),
        created_at: dayjs.utc(item.time * 1000),
        updated_at: db.fn.now(),
        deleted_at: item.deleted ? db.fn.now() : null,
        order: i,
      }
    }));
    insertedComments.forEach((comment) => this.#commentIdMap.set(comment.hnId, comment.id));
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
        logger.info('Skipping pollopt')
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
          (kid) => this.#parentMap.set(kid.id, this.#parentMap.get(item.id) ?? item.id)
        );
      }

      await this.persistItems(nextKids);
    }
  }
}

export {
  ItemPersistService
}