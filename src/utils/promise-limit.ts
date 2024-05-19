/**
 * This is p-limit, but without yocto-queue
 * It's easier to copy 90 lines than to deal with the esm/cjs mess
 * https://github.com/sindresorhus/p-limit
 */

import { AsyncResource } from 'node:async_hooks';

export type LimitFunction = {
  readonly activeCount: number;
  readonly pendingCount: number;

  clearQueue: () => void;

  <Arguments extends unknown[], ReturnType>(
    fn: (...arguments_: Arguments) => PromiseLike<ReturnType> | ReturnType,
    ...arguments_: Arguments
  ): Promise<ReturnType>;
};

export default function pLimit(concurrency: number): LimitFunction;

export default function pLimit(concurrency: number) {
  if (!((Number.isInteger(concurrency) || concurrency === Number.POSITIVE_INFINITY) && concurrency > 0)) {
    throw new TypeError('Expected `concurrency` to be a number from 1 and up');
  }

  let queue: any[] = [];
  let activeCount = 0;

  const next = () => {
    activeCount--;

    if (queue.length > 0) {
      queue.shift()();
    }
  };

  const run = async (function_: any, resolve: any, arguments_: any) => {
    activeCount++;

    const result = (async () => function_(...arguments_))();

    resolve(result);

    try {
      await result;
    } catch {}

    next();
  };

  const enqueue = (function_: any, resolve: any, arguments_: any) => {
    queue.push(
      AsyncResource.bind(run.bind(undefined, function_, resolve, arguments_)),
    );

    (async () => {
      // This function needs to wait until the next microtask before comparing
      // `activeCount` to `concurrency`, because `activeCount` is updated asynchronously
      // when the run function is dequeued and called. The comparison in the if-statement
      // needs to happen asynchronously as well to get an up-to-date value for `activeCount`.
      await Promise.resolve();

      if (activeCount < concurrency && queue.length > 0) {
        queue.shift()();
      }
    })();
  };

  const generator = (function_: any, ...arguments_: any[]) => new Promise(resolve => {
    enqueue(function_, resolve, arguments_);
  });

  Object.defineProperties(generator, {
    activeCount: {
      get: () => activeCount,
    },
    pendingCount: {
      get: () => queue.length,
    },
    clearQueue: {
      value() {
        queue = [];
      },
    },
  });

  return generator;
}