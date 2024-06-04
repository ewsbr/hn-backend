/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('fetch_schedule', table => {
    table.specificType('id', 'INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY');
    table.enum('type', ['top', 'new', 'best', 'ask', 'show', 'job', 'updates'], {
      enumName: 'fetch_schedule_type_enum',
      useNative: true,
    }).notNullable();
    table.integer('total_items');

    table.timestamps(true, true);
    table.timestamp('finished_at').index();

    table.unique(['type'], {
      predicate: knex.whereRaw('finished_at IS NULL')
    })
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('fetch_schedule');
};
