exports.up = async function up(knex) {
  const hasDescription = await knex.schema.hasColumn('mobiliario_producto', 'descripcion');
  const hasMaterial = await knex.schema.hasColumn('mobiliario_producto', 'material');
  if (hasDescription || hasMaterial) {
    await knex.schema.alterTable('mobiliario_producto', (table) => {
      if (hasDescription) table.dropColumn('descripcion');
      if (hasMaterial) table.dropColumn('material');
    });
  }

  const variantColumns = [
    'unidadAlquiler',
    'unidadesPorPaquete',
    'cantidadMinima',
    'precioBase',
    'depositoGarantia',
    'valorReposicion',
  ];
  const existingVariantColumns = [];
  for (const column of variantColumns) {
    if (await knex.schema.hasColumn('mobiliario_variante', column)) existingVariantColumns.push(column);
  }
  if (existingVariantColumns.length) {
    await knex.schema.alterTable('mobiliario_variante', (table) => {
      existingVariantColumns.forEach((column) => table.dropColumn(column));
    });
  }

  if (!(await knex.schema.hasColumn('mobiliario_imagen', 'tipo'))) {
    await knex.schema.alterTable('mobiliario_imagen', (table) => {
      table.enu('tipo', ['producto', 'decoracion']).nullable().after('productoId');
    });

    await knex.raw(`
      UPDATE mobiliario_imagen i
      INNER JOIN (
        SELECT productoId, MIN(id) AS imageId
        FROM mobiliario_imagen
        WHERE activo = 1
        GROUP BY productoId
      ) first_image ON first_image.imageId = i.id
      SET i.tipo = 'producto'
    `);

    await knex.raw(`
      UPDATE mobiliario_imagen i
      INNER JOIN (
        SELECT source.productoId, MIN(source.id) AS imageId
        FROM mobiliario_imagen source
        WHERE source.activo = 1
          AND source.tipo IS NULL
        GROUP BY source.productoId
      ) second_image ON second_image.imageId = i.id
      SET i.tipo = 'decoracion'
    `);

    await knex.schema.alterTable('mobiliario_imagen', (table) => {
      table.unique(['productoId', 'tipo'], 'uq_mob_imagen_producto_tipo');
      table.index(['tipo', 'activo'], 'idx_mob_imagen_tipo_estado');
    });
  }
};

exports.down = async function down(knex) {
  if (await knex.schema.hasColumn('mobiliario_imagen', 'tipo')) {
    await knex.schema.alterTable('mobiliario_imagen', (table) => {
      table.dropUnique(['productoId', 'tipo'], 'uq_mob_imagen_producto_tipo');
      table.dropIndex(['tipo', 'activo'], 'idx_mob_imagen_tipo_estado');
      table.dropColumn('tipo');
    });
  }

  await knex.schema.alterTable('mobiliario_variante', (table) => {
    table.enu('unidadAlquiler', ['unidad', 'juego', 'paquete']).notNullable().defaultTo('unidad');
    table.integer('unidadesPorPaquete').unsigned().notNullable().defaultTo(1);
    table.integer('cantidadMinima').unsigned().notNullable().defaultTo(1);
    table.decimal('precioBase', 12, 2).unsigned().notNullable().defaultTo(0);
    table.decimal('depositoGarantia', 12, 2).unsigned().notNullable().defaultTo(0);
    table.decimal('valorReposicion', 12, 2).unsigned().notNullable().defaultTo(0);
  });

  await knex.schema.alterTable('mobiliario_producto', (table) => {
    table.text('descripcion').nullable();
    table.string('material', 140).nullable();
  });
};
