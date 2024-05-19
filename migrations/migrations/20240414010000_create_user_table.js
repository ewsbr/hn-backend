/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('user', table => {
    table.specificType('id', 'INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY');
    table.text('username')
      .notNullable()
      .unique();
    table.text('about');
    table.integer('karma');

    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('user');
};
