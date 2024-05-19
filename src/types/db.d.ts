import 'knex/types/tables';

export type ItemType = 'top' | 'new' | 'best' | 'ask' | 'show' | 'job';

interface AuditColumns {
  createdAt: Date;
  updatedAt: Date;
}

declare module 'knex/types/tables' {
  interface Tables {
    story: {
      id: number;
      hnId: number;
      title: string;
      url: string;
      dead: boolean;
      score: number;
      descendants: number;
      userId: number;
    } & AuditColumns;
    user: {
      id: number;
      username: string;
    } & AuditColumns;
  }
}