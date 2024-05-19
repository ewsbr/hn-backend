export enum StorySortType {
  TOP = 'top',
  NEW = 'new',
  BEST = 'best',
  ASK = 'ask',
  SHOW = 'show',
  JOB = 'job',
}

export const FetchUrls = Object.freeze({
  [StorySortType.TOP]: '/topstories.json',
  [StorySortType.NEW]: '/newstories.json',
  [StorySortType.BEST]: '/beststories.json',
  [StorySortType.ASK]: '/askstories.json',
  [StorySortType.SHOW]: '/showstories.json',
  [StorySortType.JOB]: '/jobstories.json',
});