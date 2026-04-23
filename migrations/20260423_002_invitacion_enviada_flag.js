exports.up = async function up(knex) {
  await knex.schema.alterTable('invitacion', (table) => {
    table.boolean('enviada').notNullable().defaultTo(0);
  });
};

exports.down = async function down(knex) {
  await knex.schema.alterTable('invitacion', (table) => {
    table.dropColumn('enviada');
  });
};
