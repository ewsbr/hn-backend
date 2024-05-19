import 'knex/types/tables';

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