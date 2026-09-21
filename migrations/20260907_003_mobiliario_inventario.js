function configureTable(table) {
  table.charset('utf8mb4');
  table.collate('utf8mb4_unicode_ci');
}

exports.up = async function up(knex) {
  if (!(await knex.schema.hasTable('mobiliario_movimiento'))) {
    await knex.schema.createTable('mobiliario_movimiento', (table) => {
      table.bigIncrements('id').primary();
      table.integer('varianteId').unsigned().notNullable();
      table.enu('tipo', [
        'inventario_inicial',
        'entrada',
        'retiro',
        'fuera_servicio',
        'reincorporacion',
        'correccion',
      ]).notNullable();
      table.integer('cantidad').unsigned().notNullable();
      table.integer('existenciaAntes').unsigned().notNullable();
      table.integer('existenciaDespues').unsigned().notNullable();
      table.integer('fueraServicioAntes').unsigned().notNullable();
      table.integer('fueraServicioDespues').unsigned().notNullable();
      table.string('motivo', 500).notNullable();
      table.integer('createdBy').nullable();
      table.timestamp('createdAt').notNullable().defaultTo(knex.fn.now());
      table.index(['varianteId', 'createdAt'], 'idx_mob_movimiento_variante_fecha');
      table.foreign('varianteId').references('id').inTable('mobiliario_variante').onDelete('RESTRICT').onUpdate('CASCADE');
      table.foreign('createdBy').references('id').inTable('usuariosistema').onDelete('SET NULL').onUpdate('CASCADE');
      configureTable(table);
    });
  }
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('mobiliario_movimiento');
};
