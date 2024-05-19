/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.schema.createTable('comment', table => {
    table.specificType('id', 'INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY');
    table.integer('hn_id').notNullable()
      .unique()
      .index();
    table.text('text');
    table.integer('parent_id')
      .references('id')
      .inTable('comment')
      .index();
    table.integer('story_id').notNullable()
      .references('id')
      .inTable('story')
      .index();
    table.integer('user_id')
      .references('id')
      .inTable('user')
      .index();
    table.integer('order').notNullable().defaultTo(0).index();

    table.timestamps(true, true);
    table.timestamp('deleted_at').index();
  })
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex.schema.dropTable('comment');
};
