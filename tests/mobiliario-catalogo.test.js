// Integration test: creates and removes its own isolated database; never writes app data.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const knexFactory = require('knex');
const config = require('../knexfile');

test('catalog codes, migration, concurrent allocations and edition persistence', async () => {
  const database = `altezza_catalog_test_${process.pid}_${Date.now()}`;
  const admin = knexFactory({ ...config, connection: { ...config.connection, database: undefined } });
  let knex, pool, created = false;
  try {
    await admin.raw('CREATE DATABASE ?? CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci', [database]);
    created = true;
    knex = knexFactory({ ...config, connection: { ...config.connection, database } });
    await knex.schema.createTable('usuariosistema', (t) => t.integer('id').primary());
    for (const migration of ['002_mobiliario_catalogo_base', '003_mobiliario_inventario', '004_mobiliario_media_catalogo_publico', '005_simplify_mobiliario_catalog']) {
      await require(`../migrations/20260907_${migration}`).up(knex);
    }
    await knex('mobiliario_producto').insert([
      { publicCode: 'legacy-a', categoriaId: 1, nombre: 'Legado A', slug: 'a', orden: 2 },
      { publicCode: 'legacy-b', categoriaId: 1, nombre: 'Legado B', slug: 'b', orden: 1 },
    ]);
    await knex.raw("SET time_zone = '-05:00'");
    await knex('mobiliario_catalogo_publico').insert({ id: 1, publicCode: 'legacy-catalog', createdAt: '2026-08-31 23:30:00', regeneratedAt: '2026-09-01 00:30:00' });
    await require('../migrations/20260911_006_mobiliario_codigos').up(knex);
    await require('../migrations/20260911_007_mobiliario_catalogo_estilo').up(knex);
    assert.deepEqual((await knex('mobiliario_producto').orderBy('orden')).map((p) => p.codigo), ['1001', '1002']);
    assert.equal((await knex('mobiliario_catalogo_publico').first()).edicion, '2026-09');
    process.env.ALTEZZA_DB_NAME = database;
    pool = require('../server/dbAltezza/connection');
    const api = require('../server/dbAltezza/mobiliario');
    assert.equal(api.catalogEdition(new Date('2026-10-01T04:59:00Z')), '2026-09');
    assert.equal(api.catalogEdition(new Date('2026-10-01T05:00:00Z')), '2026-10');
    let serial = 0;
    const create = (categoriaId = 1) => {
      const key = `test-${++serial}`;
      return api.createProduct({ nombre: key, color: 'Azúl', categoriaId }, null, ['producto', 'decoracion'].map((tipo) => ({ tipo, publicCode: `${key}-${tipo}`, r2KeyOriginal: key, r2KeyThumb: key })));
    };
    const products = await Promise.all(Array.from({ length: 8 }, () => create()));
    assert.equal(new Set(products.map((p) => p.codigo)).size, 8);
    assert.deepEqual(products.map((p) => p.codigo).sort(), Array.from({length: 8}, (_, i) => `10${String(i + 3).padStart(2, '0')}`));
    const beforeOrder = await api.listProductOrder(1);
    const reversedIds = beforeOrder.map((p) => p.id).reverse();
    assert.deepEqual((await api.reorderProducts(1, reversedIds)).map((p) => p.id), reversedIds);
    assert.deepEqual((await api.listProductOrder(1)).map((p) => p.codigo), beforeOrder.map((p) => p.codigo).reverse());
    await assert.rejects(api.reorderProducts(1, [reversedIds[0], reversedIds[0]]), (e) => e.status === 400);
    await assert.rejects(api.reorderProducts(1, reversedIds.slice(1)), (e) => e.status === 409);
    await assert.rejects(api.reorderProducts(2, reversedIds), (e) => e.status === 409);
    await assert.rejects(api.listProductOrder(99999), (e) => e.status === 404);
    assert.deepEqual((await api.listProductOrder(1)).map((p) => p.id), reversedIds);
    const moved = await api.updateProduct(products[0].id, { ...products[0], categoriaId: 2 });
    assert.equal(moved.codigo, '1101');
    const returned = await api.updateProduct(moved.id, { ...moved, categoriaId: 1 });
    assert.equal(returned.codigo, '1011');
    const renamed = await api.updateProduct(returned.id, { ...returned, nombre: 'Ámbar' });
    assert.equal(renamed.codigo, returned.codigo);
    assert.equal((await api.listProducts({ search: 'ambar' })).items[0].id, renamed.id);
    assert.equal((await api.listProducts({ search: renamed.codigo })).items[0].id, renamed.id);
    await knex('mobiliario_secuencia').where({ clave: 'producto:10' }).update({ valor: 98 });
    assert.equal((await create()).codigo, '1099');
    assert.equal((await create()).codigo, '10100');
    const cats = await Promise.all([api.createCategory({nombre:'Extra A'}), api.createCategory({nombre:'Extra B'})]);
    assert.deepEqual(cats.map((c) => c.prefijo).sort(), [19, 20]);
    await api.deleteCategory(cats[0].id);
    assert.equal((await api.createCategory({nombre:'Extra C'})).prefijo, 21);
    await knex('mobiliario_secuencia').where({clave:'categorias'}).update({valor:99});
    await assert.rejects(api.createCategory({nombre:'Sin cupo'}), (e) => e.status === 409);
    await assert.rejects(api.updateCatalogStyle({colorPrimario:'red',colorSecundario:'#ffffff'}), (e) => e.status === 400 && !!e.fields.colorPrimario);
    const colors = { colorPrimario: '#FFFFFF', colorSecundario: '#ABCDEF' };
    await api.updateCatalogStyle(colors);
    await knex('mobiliario_catalogo_publico').where({id:1}).update({edicion:'2025-03'});
    const off = await api.setCatalogState(false);
    assert.equal(off.edicion, '2025-03');
    assert.equal(await api.getPublicCatalog(off.publicCode), null);
    const on = await api.setCatalogState(true);
    assert.equal(on.edicion, '2025-03');
    const empty = await api.getPublicCatalog(on.publicCode);
    assert.deepEqual(empty.config, {...colors, edicion:'2025-03'});
    assert.deepEqual(empty.products, []);
    const regenerated = await api.regenerateCatalog();
    assert.notEqual(regenerated.publicCode, on.publicCode);
    assert.equal(regenerated.edicion, api.catalogEdition());
    assert.equal(regenerated.colorSecundario, colors.colorSecundario);
    assert.equal(await api.getPublicCatalog(on.publicCode), null);
    await knex('mobiliario_producto').where({id:renamed.id}).update({estado:'publicado'});
    await knex('mobiliario_variante').insert({productoId:renamed.id,sku:'PRIVATE-SKU',medidas:'36 cm Ø',activo:1});
    const published = await api.getPublicCatalog(regenerated.publicCode);
    assert.equal(published.products[0].codigo, renamed.codigo);
    assert.deepEqual(published.products[0].variants, [{medidas:'36 cm Ø'}]);
    assert.equal(JSON.stringify(published).includes('PRIVATE-SKU'), false);
    await knex('mobiliario_producto').where({id:products[1].id}).update({estado:'publicado'});
    await knex('mobiliario_variante').insert({productoId:products[1].id,sku:'PRIVATE-SECOND',activo:1});
    const categoryItems = await api.listProductOrder(1);
    const finalIds = [products[1].id, ...categoryItems.map((p) => p.id).filter((id) => id !== products[1].id)];
    await api.reorderProducts(1, finalIds);
    assert.deepEqual((await api.getPublicCatalog(regenerated.publicCode)).products.map((p) => p.codigo), [products[1].codigo, renamed.codigo]);
    await knex('mobiliario_catalogo_publico').del();
    const fresh = await api.generateCatalog(null);
    assert.equal(fresh.edicion, api.catalogEdition());
    assert.equal(fresh.colorPrimario, '#FFF7F7');
  } finally {
    if (pool) await pool.promise().end();
    if (knex) await knex.destroy();
    try { if (created) await admin.raw('DROP DATABASE IF EXISTS ??', [database]); } finally { await admin.destroy(); }
  }
});
