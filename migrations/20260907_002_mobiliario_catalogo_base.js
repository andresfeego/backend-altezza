const CATEGORIES = [
  ['menaje-de-lujo', 'Menaje de lujo'],
  ['backings', 'Backings'],
  ['centros-de-mesa', 'Centros de mesa'],
  ['portavelas', 'Portavelas'],
  ['bases-florales', 'Bases florales'],
  ['mesas', 'Mesas'],
  ['torteras', 'Torteras'],
  ['accesorios', 'Accesorios'],
  ['sillas', 'Sillas'],
];

function configureTable(table) {
  table.charset('utf8mb4');
  table.collate('utf8mb4_unicode_ci');
}

exports.up = async function up(knex) {
  if (!(await knex.schema.hasTable('mobiliario_categoria'))) {
    await knex.schema.createTable('mobiliario_categoria', (table) => {
      table.increments('id').primary();
      table.string('nombre', 120).notNullable();
      table.string('slug', 140).notNullable().unique();
      table.text('descripcion').nullable();
      table.integer('orden').unsigned().notNullable().defaultTo(0);
      table.boolean('activo').notNullable().defaultTo(true);
      table.timestamp('createdAt').notNullable().defaultTo(knex.fn.now());
      table.timestamp('updatedAt').notNullable().defaultTo(knex.fn.now());
      table.index(['activo', 'orden'], 'idx_mob_categoria_estado_orden');
      configureTable(table);
    });
  }

  for (let index = 0; index < CATEGORIES.length; index += 1) {
    const [slug, nombre] = CATEGORIES[index];
    await knex.raw(
      `INSERT IGNORE INTO mobiliario_categoria (nombre, slug, orden, activo)
       VALUES (?, ?, ?, 1)`,
      [nombre, slug, index + 1]
    );
  }

  if (!(await knex.schema.hasTable('mobiliario_producto'))) {
    await knex.schema.createTable('mobiliario_producto', (table) => {
      table.increments('id').primary();
      table.string('publicCode', 64).notNullable().unique();
      table.integer('categoriaId').unsigned().notNullable();
      table.string('nombre', 160).notNullable();
      table.string('slug', 180).notNullable();
      table.text('descripcion').nullable();
      table.string('material', 140).nullable();
      table.string('color', 140).nullable();
      table.integer('orden').unsigned().notNullable().defaultTo(0);
      table.enu('estado', ['borrador', 'publicado', 'archivado']).notNullable().defaultTo('borrador');
      table.integer('createdBy').nullable();
      table.timestamp('createdAt').notNullable().defaultTo(knex.fn.now());
      table.timestamp('updatedAt').notNullable().defaultTo(knex.fn.now());
      table.unique(['categoriaId', 'slug'], 'uq_mob_producto_categoria_slug');
      table.index(['estado', 'categoriaId', 'orden'], 'idx_mob_producto_catalogo');
      table.foreign('categoriaId').references('id').inTable('mobiliario_categoria').onDelete('RESTRICT').onUpdate('CASCADE');
      table.foreign('createdBy').references('id').inTable('usuariosistema').onDelete('SET NULL').onUpdate('CASCADE');
      configureTable(table);
    });
  }

  if (!(await knex.schema.hasTable('mobiliario_variante'))) {
    await knex.schema.createTable('mobiliario_variante', (table) => {
      table.increments('id').primary();
      table.integer('productoId').unsigned().notNullable();
      table.string('sku', 40).notNullable().unique();
      table.string('nombre', 140).nullable();
      table.string('medidas', 240).nullable();
      table.enu('unidadAlquiler', ['unidad', 'juego', 'paquete']).notNullable().defaultTo('unidad');
      table.integer('unidadesPorPaquete').unsigned().notNullable().defaultTo(1);
      table.integer('cantidadMinima').unsigned().notNullable().defaultTo(1);
      table.decimal('precioBase', 12, 2).unsigned().notNullable().defaultTo(0);
      table.decimal('depositoGarantia', 12, 2).unsigned().notNullable().defaultTo(0);
      table.decimal('valorReposicion', 12, 2).unsigned().notNullable().defaultTo(0);
      table.integer('existenciaTotal').unsigned().notNullable().defaultTo(0);
      table.integer('fueraServicio').unsigned().notNullable().defaultTo(0);
      table.integer('orden').unsigned().notNullable().defaultTo(0);
      table.boolean('activo').notNullable().defaultTo(true);
      table.timestamp('createdAt').notNullable().defaultTo(knex.fn.now());
      table.timestamp('updatedAt').notNullable().defaultTo(knex.fn.now());
      table.index(['productoId', 'activo', 'orden'], 'idx_mob_variante_producto');
      table.foreign('productoId').references('id').inTable('mobiliario_producto').onDelete('CASCADE').onUpdate('CASCADE');
      configureTable(table);
    });
  }
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('mobiliario_variante');
  await knex.schema.dropTableIfExists('mobiliario_producto');
  await knex.schema.dropTableIfExists('mobiliario_categoria');
};
