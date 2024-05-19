/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('story', table => {
    table.specificType('id', 'INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY');
    table.integer('hn_id').notNullable()
      .unique()
      .index();
    table.text('title');
    table.text('url');
    table.boolean('dead').notNullable();
    table.integer('score').notNullable();
    table.integer('descendants').notNullable();
    table.integer('user_id').notNullable()
      .references('id')
      .inTable('user')
      .index();

    table.enum('story_type', ['story', 'job'], {
      enumName: 'story_type_enum',
      useNative: true,
    }).notNullable().defaultTo('story');

    table.integer('fetch_schedule_id')
      .references('id')
      .inTable('fetch_schedule')
      .index();

    table.timestamps(true, true);
    table.timestamp('deleted_at').index();
  })
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  await knex.schema.dropTable('story');
  await knex.raw('DROP TYPE IF EXISTS story_type_enum');
};