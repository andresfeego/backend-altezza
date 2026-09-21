function configureTable(table) {
  table.charset('utf8mb4');
  table.collate('utf8mb4_unicode_ci');
}

exports.up = async function up(knex) {
  if (!(await knex.schema.hasTable('mobiliario_imagen'))) {
    await knex.schema.createTable('mobiliario_imagen', (table) => {
      table.increments('id').primary();
      table.integer('productoId').unsigned().notNullable();
      table.string('publicCode', 64).notNullable().unique();
      table.string('r2KeyOriginal', 500).notNullable();
      table.string('r2KeyThumb', 500).notNullable();
      table.string('mimeType', 100).notNullable().defaultTo('image/webp');
      table.integer('width').unsigned().nullable();
      table.integer('height').unsigned().nullable();
      table.string('altText', 240).nullable();
      table.integer('orden').unsigned().notNullable().defaultTo(0);
      table.boolean('principal').notNullable().defaultTo(false);
      table.boolean('activo').notNullable().defaultTo(true);
      table.timestamp('createdAt').notNullable().defaultTo(knex.fn.now());
      table.timestamp('updatedAt').notNullable().defaultTo(knex.fn.now());
      table.index(['productoId', 'activo', 'orden'], 'idx_mob_imagen_producto');
      table.foreign('productoId').references('id').inTable('mobiliario_producto').onDelete('CASCADE').onUpdate('CASCADE');
      configureTable(table);
    });
  }

  if (!(await knex.schema.hasTable('mobiliario_catalogo_publico'))) {
    await knex.schema.createTable('mobiliario_catalogo_publico', (table) => {
      table.tinyint('id').unsigned().primary();
      table.string('publicCode', 64).notNullable().unique();
      table.boolean('activo').notNullable().defaultTo(true);
      table.integer('createdBy').nullable();
      table.timestamp('createdAt').notNullable().defaultTo(knex.fn.now());
      table.timestamp('updatedAt').notNullable().defaultTo(knex.fn.now());
      table.timestamp('regeneratedAt').nullable();
      table.foreign('createdBy').references('id').inTable('usuariosistema').onDelete('SET NULL').onUpdate('CASCADE');
      configureTable(table);
    });
  }
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('mobiliario_catalogo_publico');
  await knex.schema.dropTableIfExists('mobiliario_imagen');
};
