exports.up = async function up(knex) {
  await knex.schema.alterTable('invitado', (table) => {
    table.integer('parentesco').nullable().alter();
    table.integer('grupoEdad').nullable().alter();
  });
};

exports.down = async function down(knex) {
  await knex('invitado')
    .whereNull('parentesco')
    .update({ parentesco: 21 });

  await knex('invitado')
    .whereNull('grupoEdad')
    .update({ grupoEdad: 1 });

  await knex.schema.alterTable('invitado', (table) => {
    table.integer('parentesco').notNullable().defaultTo(21).alter();
    table.integer('grupoEdad').notNullable().defaultTo(1).alter();
  });
};
