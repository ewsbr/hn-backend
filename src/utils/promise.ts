async function allSettledPartitioned<T>(promises: Promise<T>[]): Promise<[T[], any[]]> {
  const results = await Promise.allSettled(promises);

  const fulfilled = results
    .filter((result) => result.status === 'fulfilled')
    .map((result: any) => result.value);
  const rejected = results
    .filter((result) => result.status === 'rejected')
    .map((result: any) => result.reason);

  return [fulfilled, rejected];
}

export {
  allSettledPartitioned
}


// interface AsyncQueueOptions {
//   parallelism: number;
// }
//
// type QueueAsyncTask<T> = () => Promise<T>;
//
// class AsyncQueue {
//
//   #parallelism: number;
//   #runningCount: number = 0;
//   #tasks: QueueAsyncTask<unknown>[] = [];
//
//   constructor(options: AsyncQueueOptions) {
//     this.#parallelism = options.parallelism;
//   }
//
//   public async add<T>(task: QueueAsyncTask<T>) {
//     this.#tasks.push(task);
//     return await this.#tryProcessNext();
//   }
//
//   async #tryProcessNext() {
//     while (this.#runningCount >= this.#parallelism) {
//       await setTimeout();
//     }
//
//     const task = this.#tasks.shift();
//     this.#runningCount += 1;
//
//     if (task == null) {
//       throw new Error('The task is null somehow');
//     }
//
//     const result = await task();
//     this.#runningCount -= 1;
//
//     return result;
//   }
//
// }
//
// const queue = new AsyncQueue({
//   parallelism: 25,
// });