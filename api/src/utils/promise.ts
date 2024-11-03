async function allSettledPartitioned<T, R = any>(promises: Promise<T>[]): Promise<[T[], R[]]> {
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