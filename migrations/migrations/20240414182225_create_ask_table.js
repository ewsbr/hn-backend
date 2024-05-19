/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('ask', table => {
    table.specificType('id', 'INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY');
    table.integer('hn_id').notNullable()
      .unique()
      .index();
    table.text('title').notNullable();
    table.text('url');
    table.boolean('dead').notNullable();
    table.integer('score').notNullable();
    table.integer('descendants').notNullable();
    table.integer('user_id').notNullable()
      .references('id')
      .inTable('user')
      .index();

    table.timestamps(true, true);
    table.timestamp('deleted_at').index();
  })
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('ask');
};
