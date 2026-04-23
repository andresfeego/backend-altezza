async function tableExists(knex, tableName) {
  return knex.schema.hasTable(tableName);
}

exports.up = async function up(knex) {
  const hasEvento = await tableExists(knex, 'evento');
  if (!hasEvento) {
    throw new Error('La tabla `evento` debe existir antes de crear `evento_invitacion_publica`.');
  }

  const hasTable = await tableExists(knex, 'evento_invitacion_publica');
  if (hasTable) return;

  await knex.schema.createTable('evento_invitacion_publica', (table) => {
    table.increments('id').primary();
    table.string('idEvento', 20).notNullable().unique();
    table.string('templateKey', 80).notNullable().defaultTo('wedding-classic');
    table.string('seoTitle', 180).nullable();
    table.text('seoDescription').nullable();
    table.text('seoImage').nullable();
    table.boolean('published').notNullable().defaultTo(false);
    table.json('modulesJson').nullable();
    table.timestamp('createdAt').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updatedAt').notNullable().defaultTo(knex.fn.now());
  });
};

exports.down = async function down() {
  throw new Error('Rollback no soportado para evento_invitacion_publica. Crea una migracion compensatoria si necesitas revertir este cambio.');
};
