const BASE = ['menaje-de-lujo', 'backings', 'centros-de-mesa', 'portavelas', 'bases-florales', 'mesas', 'torteras', 'accesorios', 'sillas'];

exports.up = async (knex) => {
  const categories = await knex('mobiliario_categoria').orderBy('orden').orderBy('id');
  if (categories.filter((c) => !BASE.includes(c.slug)).length > 81) throw new Error('No hay suficientes prefijos de categoría (10–99).');
  await knex.schema.createTable('mobiliario_secuencia', (t) => {
    t.string('clave', 40).primary();
    t.integer('valor').unsigned().notNullable().defaultTo(0);
    t.charset('utf8mb4'); t.collate('utf8mb4_unicode_ci');
  });
  await knex.schema.alterTable('mobiliario_categoria', (t) => { t.integer('prefijo').unsigned().nullable().unique(); });
  await knex.schema.alterTable('mobiliario_producto', (t) => {
    t.integer('consecutivo').unsigned().nullable();
    t.string('codigo', 12).nullable().unique();
  });
  await knex.transaction(async (trx) => {
    let lastPrefix = 18;
    for (const category of categories) {
      const baseIndex = BASE.indexOf(category.slug);
      const prefijo = baseIndex >= 0 ? baseIndex + 10 : ++lastPrefix;
      await trx('mobiliario_categoria').where({ id: category.id }).update({ prefijo });
      const products = await trx('mobiliario_producto').where({ categoriaId: category.id }).orderBy('orden').orderBy('id');
      for (let index = 0; index < products.length; index += 1) {
        const consecutivo = index + 1;
        await trx('mobiliario_producto').where({ id: products[index].id }).update({ consecutivo, codigo: `${prefijo}${String(consecutivo).padStart(2, '0')}` });
      }
      await trx('mobiliario_secuencia').insert({ clave: `producto:${prefijo}`, valor: products.length });
    }
    await trx('mobiliario_secuencia').insert({ clave: 'categorias', valor: lastPrefix });
  });
  await knex.schema.alterTable('mobiliario_categoria', (t) => { t.integer('prefijo').unsigned().notNullable().alter(); });
  await knex.schema.alterTable('mobiliario_producto', (t) => {
    t.integer('consecutivo').unsigned().notNullable().alter();
    t.string('codigo', 12).notNullable().alter();
  });
};

exports.down = async (knex) => {
  await knex.schema.alterTable('mobiliario_producto', (t) => { t.dropColumn('codigo'); t.dropColumn('consecutivo'); });
  await knex.schema.alterTable('mobiliario_categoria', (t) => { t.dropColumn('prefijo'); });
  await knex.schema.dropTable('mobiliario_secuencia');
};

// MariaDB DDL commits implicitly; only the data backfill uses a transaction.
exports.config = { transaction: false };
