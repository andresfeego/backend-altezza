exports.up = async (knex) => {
  await knex.schema.alterTable('mobiliario_catalogo_publico', (t) => {
    t.string('colorPrimario', 7).notNullable().defaultTo('#FFF7F7');
    t.string('colorSecundario', 7).notNullable().defaultTo('#DDA08D');
    t.string('edicion', 7).nullable();
  });
  // TIMESTAMP is converted by MariaDB in this connection's Colombia time zone.
  await knex.transaction(async (trx) => {
    await trx.raw("SET time_zone = '-05:00'");
    await trx.raw("UPDATE mobiliario_catalogo_publico SET edicion = DATE_FORMAT(COALESCE(regeneratedAt, createdAt), '%Y-%m')");
  });
  await knex.schema.alterTable('mobiliario_catalogo_publico', (t) => { t.string('edicion', 7).notNullable().alter(); });
};
exports.down = async (knex) => {
  await knex.schema.alterTable('mobiliario_catalogo_publico', (t) => { t.dropColumn('colorPrimario'); t.dropColumn('colorSecundario'); t.dropColumn('edicion'); });
};

// MariaDB DDL commits implicitly; only the data backfill uses a transaction.
exports.config = { transaction: false };
