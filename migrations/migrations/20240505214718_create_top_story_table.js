/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('top_story', table => {
    table.integer('hn_id').notNullable().primary()
    table.enum('type', ['top', 'new', 'best', 'ask', 'show', 'job'], {
      enumName: 'top_story_type_enum',
      useNative: true,
    }).notNullable();
    table.integer('order').notNullable().defaultTo(0).index();

    table.unique(['type', 'order']);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  await knex.raw('DROP TYPE IF EXISTS top_story_type_enum');
  return knex.schema.dropTable('top_story');
};
