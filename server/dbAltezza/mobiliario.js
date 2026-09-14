const crypto = require('crypto');
const pool = require('./connection');

const db = () => pool.promise();
const PRODUCT_STATES = new Set(['borrador', 'publicado', 'archivado']);
const IMAGE_TYPES = new Set(['producto', 'decoracion']);
const MOVEMENT_TYPES = new Set(['entrada', 'retiro', 'fuera_servicio', 'reincorporacion', 'correccion']);

function appError(status, message, fields) {
  const error = new Error(message);
  error.status = status;
  if (fields) error.fields = fields;
  return error;
}

function randomCode(bytes = 18) {
  return crypto.randomBytes(bytes).toString('hex');
}

function slugify(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 170);
}

function asNumber(value) {
  if (value === null || value === undefined || value === '') return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function asInteger(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : fallback;
}

function normalizeVariant(row) {
  if (!row) return null;
  return {
    ...row,
    activo: Boolean(row.activo),
    existenciaTotal: asNumber(row.existenciaTotal),
    fueraServicio: asNumber(row.fueraServicio),
    disponible: Math.max(0, asNumber(row.existenciaTotal) - asNumber(row.fueraServicio)),
  };
}

function imageUrls(publicCode) {
  const base = `/api/responseAltezza/public/mobiliario/media/${publicCode}`;
  return { url: base, previewUrl: `${base}?variant=preview`, thumbUrl: `${base}?variant=preview` };
}

function normalizeImage(row) {
  if (!row) return null;
  return { ...row, activo: Boolean(row.activo), ...imageUrls(row.publicCode) };
}

function imageFromProductRow(row, prefix) {
  const publicCode = row[`${prefix}PublicCode`];
  if (!publicCode) return null;
  return {
    publicCode,
    tipo: prefix === 'imagenProducto' ? 'producto' : 'decoracion',
    altText: row[`${prefix}AltText`] || row.nombre,
    ...imageUrls(publicCode),
  };
}

function normalizeProduct(row) {
  if (!row) return null;
  const imagenProducto = imageFromProductRow(row, 'imagenProducto');
  const imagenDecoracion = imageFromProductRow(row, 'imagenDecoracion');
  return {
    ...row,
    categoriaActiva: Boolean(row.categoriaActiva),
    variantCount: asNumber(row.variantCount),
    imageCount: asNumber(row.imageCount),
    existenciaTotal: asNumber(row.existenciaTotal),
    fueraServicio: asNumber(row.fueraServicio),
    disponible: asNumber(row.disponible),
    imagenProducto,
    imagenDecoracion,
    imagenPrincipal: imagenProducto,
  };
}

async function listCategories() {
  const [rows] = await db().query(
    `SELECT c.*,
       (SELECT COUNT(*) FROM mobiliario_producto p WHERE p.categoriaId = c.id AND p.estado <> 'archivado') AS productCount
     FROM mobiliario_categoria c
     ORDER BY c.orden ASC, c.nombre ASC`
  );
  return rows.map((row) => ({ ...row, activo: Boolean(row.activo), productCount: asNumber(row.productCount) }));
}

async function nextSequence(connection, clave, max = 4294967295) {
  const [[row]] = await connection.query('SELECT valor FROM mobiliario_secuencia WHERE clave = ? FOR UPDATE', [clave]);
  if (!row) throw appError(500, 'No se encontró la secuencia de numeración.');
  if (Number(row.valor) >= max) throw appError(409, 'Se agotó la numeración disponible.');
  const value = Number(row.valor) + 1;
  await connection.query('UPDATE mobiliario_secuencia SET valor = ? WHERE clave = ?', [value, clave]);
  return value;
}

async function allocateProductCode(connection, categoryId) {
  const [[category]] = await connection.query('SELECT prefijo FROM mobiliario_categoria WHERE id = ? LOCK IN SHARE MODE', [categoryId]);
  if (!category) throw appError(400, 'La categoría seleccionada no existe.', { categoriaId: 'Selecciona una categoría válida.' });
  const consecutivo = await nextSequence(connection, `producto:${category.prefijo}`);
  return { consecutivo, codigo: `${category.prefijo}${String(consecutivo).padStart(2, '0')}` };
}

async function createCategory({ nombre, descripcion }) {
  const cleanName = String(nombre || '').trim().slice(0, 120);
  const slug = slugify(cleanName);
  if (!cleanName || !slug) throw appError(400, 'El nombre de la categoria es obligatorio.', { nombre: 'Escribe un nombre valido.' });
  const connection = await db().getConnection();
  try {
    await connection.beginTransaction();
    const prefijo = await nextSequence(connection, 'categorias', 99);
    const [[position]] = await connection.query('SELECT COALESCE(MAX(orden), 0) + 1 AS nextOrder FROM mobiliario_categoria');
    const [result] = await connection.query(
      'INSERT INTO mobiliario_categoria (nombre, slug, descripcion, orden, activo, prefijo) VALUES (?, ?, ?, ?, 1, ?)',
      [cleanName, slug, String(descripcion || '').trim().slice(0, 1000) || null, position.nextOrder, prefijo]
    );
    await connection.query('INSERT INTO mobiliario_secuencia (clave, valor) VALUES (?, 0)', [`producto:${prefijo}`]);
    const [[row]] = await connection.query('SELECT * FROM mobiliario_categoria WHERE id = ?', [result.insertId]);
    await connection.commit();
    return { ...row, activo: Boolean(row.activo), productCount: 0 };
  } catch (error) {
    await connection.rollback();
    if (error.code === 'ER_DUP_ENTRY') throw appError(409, 'Ya existe una categoria con ese nombre.', { nombre: 'Usa un nombre diferente.' });
    throw error;
  } finally { connection.release(); }
}

async function updateCategory(id, { nombre, descripcion, activo }) {
  const cleanName = String(nombre || '').trim().slice(0, 120);
  const slug = slugify(cleanName);
  if (!cleanName || !slug) throw appError(400, 'El nombre de la categoria es obligatorio.', { nombre: 'Escribe un nombre valido.' });
  const [[current]] = await db().query('SELECT id FROM mobiliario_categoria WHERE id = ?', [id]);
  if (!current) throw appError(404, 'Categoria no encontrada.');
  try {
    await db().query(
      'UPDATE mobiliario_categoria SET nombre = ?, slug = ?, descripcion = ?, activo = ?, updatedAt = NOW() WHERE id = ?',
      [cleanName, slug, String(descripcion || '').trim().slice(0, 1000) || null, activo === false || Number(activo) === 0 ? 0 : 1, id]
    );
    const [[row]] = await db().query('SELECT * FROM mobiliario_categoria WHERE id = ?', [id]);
    return { ...row, activo: Boolean(row.activo) };
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') throw appError(409, 'Ya existe una categoria con ese nombre.', { nombre: 'Usa un nombre diferente.' });
    throw error;
  }
}

async function reorderCategories(ids) {
  const cleanIds = [...new Set((Array.isArray(ids) ? ids : []).map(Number).filter(Number.isInteger))];
  const [rows] = await db().query('SELECT id FROM mobiliario_categoria ORDER BY orden, id');
  if (cleanIds.length !== rows.length || rows.some((row) => !cleanIds.includes(row.id))) {
    throw appError(400, 'El orden debe incluir todas las categorias exactamente una vez.');
  }
  const connection = await db().getConnection();
  try {
    await connection.beginTransaction();
    for (let index = 0; index < cleanIds.length; index += 1) {
      await connection.query('UPDATE mobiliario_categoria SET orden = ?, updatedAt = NOW() WHERE id = ?', [index + 1, cleanIds[index]]);
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
  return listCategories();
}

async function deleteCategory(id) {
  const [[row]] = await db().query(
    `SELECT c.*, (SELECT COUNT(*) FROM mobiliario_producto p WHERE p.categoriaId = c.id) AS productCount
     FROM mobiliario_categoria c WHERE c.id = ?`,
    [id]
  );
  if (!row) throw appError(404, 'Categoria no encontrada.');
  if (asNumber(row.productCount) > 0) throw appError(409, 'No puedes eliminar una categoria con productos asociados. Desactivala en su lugar.');
  await db().query('DELETE FROM mobiliario_categoria WHERE id = ?', [id]);
}

const PRODUCT_SELECT = `
  SELECT p.*, c.nombre AS categoriaNombre, c.slug AS categoriaSlug, c.activo AS categoriaActiva,
    (SELECT COUNT(*) FROM mobiliario_variante v WHERE v.productoId = p.id AND v.activo = 1) AS variantCount,
    (SELECT COUNT(*) FROM mobiliario_imagen i WHERE i.productoId = p.id AND i.activo = 1 AND i.tipo IN ('producto', 'decoracion')) AS imageCount,
    (SELECT COALESCE(SUM(v.existenciaTotal), 0) FROM mobiliario_variante v WHERE v.productoId = p.id AND v.activo = 1) AS existenciaTotal,
    (SELECT COALESCE(SUM(v.fueraServicio), 0) FROM mobiliario_variante v WHERE v.productoId = p.id AND v.activo = 1) AS fueraServicio,
    (SELECT COALESCE(SUM(v.existenciaTotal - v.fueraServicio), 0) FROM mobiliario_variante v WHERE v.productoId = p.id AND v.activo = 1) AS disponible,
    (SELECT i.publicCode FROM mobiliario_imagen i WHERE i.productoId = p.id AND i.tipo = 'producto' AND i.activo = 1 LIMIT 1) AS imagenProductoPublicCode,
    (SELECT i.altText FROM mobiliario_imagen i WHERE i.productoId = p.id AND i.tipo = 'producto' AND i.activo = 1 LIMIT 1) AS imagenProductoAltText,
    (SELECT i.publicCode FROM mobiliario_imagen i WHERE i.productoId = p.id AND i.tipo = 'decoracion' AND i.activo = 1 LIMIT 1) AS imagenDecoracionPublicCode,
    (SELECT i.altText FROM mobiliario_imagen i WHERE i.productoId = p.id AND i.tipo = 'decoracion' AND i.activo = 1 LIMIT 1) AS imagenDecoracionAltText
  FROM mobiliario_producto p
  INNER JOIN mobiliario_categoria c ON c.id = p.categoriaId`;

async function listProducts({ search = '', categoryId, status = '', page = 1, pageSize = 50 } = {}) {
  const safePage = Math.max(1, asInteger(page, 1));
  const safePageSize = Math.min(100, Math.max(1, asInteger(pageSize, 50)));
  const where = [];
  const params = [];
  const cleanSearch = String(search || '').trim();
  if (cleanSearch) {
    where.push('(p.nombre LIKE ? OR p.color LIKE ? OR p.codigo LIKE ? OR EXISTS (SELECT 1 FROM mobiliario_variante sv WHERE sv.productoId = p.id AND (sv.sku LIKE ? OR sv.medidas LIKE ?)))');
    const term = `%${cleanSearch}%`;
    params.push(term, term, term, term, term);
  }
  if (Number(categoryId)) { where.push('p.categoriaId = ?'); params.push(Number(categoryId)); }
  if (PRODUCT_STATES.has(status)) { where.push('p.estado = ?'); params.push(status); }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const [[countRow]] = await db().query(`SELECT COUNT(*) AS total FROM mobiliario_producto p ${clause}`, params);
  const [rows] = await db().query(
    `${PRODUCT_SELECT} ${clause} ORDER BY c.orden, p.orden, p.nombre LIMIT ? OFFSET ?`,
    [...params, safePageSize, (safePage - 1) * safePageSize]
  );
  const [[summary]] = await db().query(
    `SELECT COUNT(*) AS productos, SUM(estado = 'publicado') AS publicados,
       COALESCE((SELECT SUM(existenciaTotal - fueraServicio) FROM mobiliario_variante WHERE activo = 1), 0) AS disponibles,
       COALESCE((SELECT SUM(fueraServicio) FROM mobiliario_variante WHERE activo = 1), 0) AS fueraServicio
     FROM mobiliario_producto WHERE estado <> 'archivado'`
  );
  return {
    items: rows.map(normalizeProduct),
    pagination: { page: safePage, pageSize: safePageSize, total: asNumber(countRow.total) },
    summary: {
      productos: asNumber(summary.productos), publicados: asNumber(summary.publicados),
      disponibles: asNumber(summary.disponibles), fueraServicio: asNumber(summary.fueraServicio),
    },
  };
}

async function listProductOrder(categoryId) {
  const [[category]] = await db().query('SELECT id FROM mobiliario_categoria WHERE id = ?', [categoryId]);
  if (!category) throw appError(404, 'Categoría no encontrada.');
  const [rows] = await db().query(
    'SELECT id, nombre, codigo, estado, orden FROM mobiliario_producto WHERE categoriaId = ? ORDER BY orden, nombre, id', [categoryId]
  );
  return rows;
}

async function reorderProducts(categoryId, ids) {
  if (!Array.isArray(ids) || ids.some((id) => !Number.isSafeInteger(id) || id <= 0) || new Set(ids).size !== ids.length) {
    throw appError(400, 'El orden debe contener identificadores de producto válidos, sin duplicados.');
  }
  const connection = await db().getConnection();
  try {
    await connection.beginTransaction();
    const [[category]] = await connection.query('SELECT id FROM mobiliario_categoria WHERE id = ?', [categoryId]);
    if (!category) throw appError(404, 'Categoría no encontrada.');
    const [rows] = await connection.query('SELECT id FROM mobiliario_producto WHERE categoriaId = ? ORDER BY id FOR UPDATE', [categoryId]);
    const expected = new Set(rows.map((row) => row.id));
    if (ids.length !== expected.size || ids.some((id) => !expected.has(id))) {
      throw appError(409, 'Los productos de la categoría cambiaron. Recarga la lista antes de guardar.');
    }
    for (let index = 0; index < ids.length; index += 1) {
      await connection.query('UPDATE mobiliario_producto SET orden = ?, updatedAt = NOW() WHERE id = ? AND categoriaId = ?', [index + 1, ids[index], categoryId]);
    }
    await connection.commit();
  } catch (error) { await connection.rollback(); throw error; }
  finally { connection.release(); }
  return listProductOrder(categoryId);
}

async function getProduct(id) {
  const [[row]] = await db().query(`${PRODUCT_SELECT} WHERE p.id = ? LIMIT 1`, [id]);
  if (!row) return null;
  const [variants] = await db().query('SELECT * FROM mobiliario_variante WHERE productoId = ? ORDER BY orden, id', [id]);
  const [images] = await db().query("SELECT * FROM mobiliario_imagen WHERE productoId = ? AND activo = 1 AND tipo IN ('producto', 'decoracion') ORDER BY tipo", [id]);
  return { ...normalizeProduct(row), variants: variants.map(normalizeVariant), images: images.map(normalizeImage) };
}

function cleanProductPayload(payload = {}) {
  const values = {
    nombre: String(payload.nombre || '').trim().slice(0, 160),
    categoriaId: Number(payload.categoriaId),
    color: String(payload.color || '').trim().slice(0, 140),
  };
  const fields = {};
  if (!values.nombre) fields.nombre = 'El nombre es obligatorio.';
  if (!values.categoriaId) fields.categoriaId = 'Selecciona una categoria.';
  if (!values.color) fields.color = 'El color es obligatorio.';
  if (Object.keys(fields).length) throw appError(400, 'Completa la ficha del producto.', fields);
  return values;
}

async function createProduct(payload, createdBy, imageRecords) {
  const values = cleanProductPayload(payload);
  const images = Array.isArray(imageRecords) ? imageRecords : [];
  const fields = {};
  if (!images.some((image) => image.tipo === 'producto')) fields.imagenProducto = 'La imagen del producto es obligatoria.';
  if (!images.some((image) => image.tipo === 'decoracion')) fields.imagenDecoracion = 'La imagen de decoracion es obligatoria.';
  if (Object.keys(fields).length) throw appError(400, 'Agrega las dos imagenes del producto.', fields);
  const connection = await db().getConnection();
  try {
    await connection.beginTransaction();
    const { consecutivo, codigo } = await allocateProductCode(connection, values.categoriaId);
    const [[position]] = await connection.query('SELECT COALESCE(MAX(orden), 0) + 1 AS nextOrder FROM mobiliario_producto WHERE categoriaId = ?', [values.categoriaId]);
    const productCode = String(payload.publicCode || randomCode());
    const [result] = await connection.query(
      `INSERT INTO mobiliario_producto (publicCode, categoriaId, nombre, slug, color, orden, estado, createdBy, consecutivo, codigo)
       VALUES (?, ?, ?, ?, ?, ?, 'borrador', ?, ?, ?)`,
      [productCode, values.categoriaId, values.nombre, slugify(values.nombre), values.color, position.nextOrder, createdBy || null, consecutivo, codigo]
    );
    for (const image of images) {
      await connection.query(
        `INSERT INTO mobiliario_imagen
         (productoId, tipo, publicCode, r2KeyOriginal, r2KeyThumb, mimeType, width, height, altText, orden, principal, activo)
         VALUES (?, ?, ?, ?, ?, 'image/webp', ?, ?, ?, 0, ?, 1)`,
        [result.insertId, image.tipo, image.publicCode, image.r2KeyOriginal, image.r2KeyThumb,
          image.width || null, image.height || null, image.altText || values.nombre, image.tipo === 'producto' ? 1 : 0]
      );
    }
    await connection.commit();
    return getProduct(result.insertId);
  } catch (error) {
    await connection.rollback();
    if (error.code === 'ER_DUP_ENTRY') throw appError(409, 'Ya existe un producto con ese nombre en la categoria.', { nombre: 'Usa un nombre diferente.' });
    throw error;
  } finally {
    connection.release();
  }
}

async function updateProduct(id, payload) {
  const values = cleanProductPayload(payload);
  const connection = await db().getConnection();
  try {
    await connection.beginTransaction();
    const [[current]] = await connection.query('SELECT * FROM mobiliario_producto WHERE id = ? FOR UPDATE', [id]);
    if (!current) throw appError(404, 'Producto no encontrado.');
    const code = Number(current.categoriaId) === Number(values.categoriaId)
      ? current : await allocateProductCode(connection, values.categoriaId);
    await connection.query(
      'UPDATE mobiliario_producto SET categoriaId = ?, nombre = ?, slug = ?, color = ?, consecutivo = ?, codigo = ?, updatedAt = NOW() WHERE id = ?',
      [values.categoriaId, values.nombre, slugify(values.nombre), values.color, code.consecutivo, code.codigo, id]
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    if (error.code === 'ER_DUP_ENTRY') throw appError(409, 'Ya existe un producto con ese nombre en la categoria.', { nombre: 'Usa un nombre diferente.' });
    throw error;
  } finally { connection.release(); }
  return getProduct(id);
}

async function setProductState(id, estado) {
  if (!PRODUCT_STATES.has(estado)) throw appError(400, 'Estado de producto invalido.', { estado: 'Selecciona un estado valido.' });
  const product = await getProduct(id);
  if (!product) throw appError(404, 'Producto no encontrado.');
  if (estado === 'publicado') {
    const fields = {};
    if (!product.categoriaActiva) fields.categoriaId = 'La categoria debe estar activa.';
    if (!product.imagenProducto) fields.imagenProducto = 'Agrega la imagen del producto.';
    if (!product.imagenDecoracion) fields.imagenDecoracion = 'Agrega la imagen de decoracion.';
    if (!product.variants.some((variant) => variant.activo)) fields.presentaciones = 'Agrega al menos una presentacion.';
    if (Object.keys(fields).length) throw appError(409, 'Completa el producto antes de publicarlo.', fields);
  }
  await db().query('UPDATE mobiliario_producto SET estado = ?, updatedAt = NOW() WHERE id = ?', [estado, id]);
  return getProduct(id);
}

function cleanVariantPayload(payload = {}) {
  const values = {
    medidas: String(payload.medidas || '').trim().slice(0, 240) || null,
    existenciaInicial: asInteger(payload.existenciaInicial, 0),
  };
  if (!values.medidas) throw appError(400, 'Indica las medidas de la presentacion.', { medidas: 'Las medidas son obligatorias.' });
  if (values.existenciaInicial < 0) throw appError(400, 'Revisa el inventario inicial.', { existenciaInicial: 'No puede ser negativo.' });
  return values;
}

async function createVariant(productId, payload, createdBy) {
  const values = cleanVariantPayload(payload);
  const connection = await db().getConnection();
  try {
    await connection.beginTransaction();
    const [[product]] = await connection.query('SELECT id FROM mobiliario_producto WHERE id = ? FOR UPDATE', [productId]);
    if (!product) throw appError(404, 'Producto no encontrado.');
    const [[position]] = await connection.query(
      'SELECT COALESCE(MAX(orden), 0) + 1 AS nextOrder, COUNT(*) + 1 AS nextSequence FROM mobiliario_variante WHERE productoId = ?',
      [productId]
    );
    const sku = `MOB-${String(productId).padStart(6, '0')}-V${String(position.nextSequence).padStart(2, '0')}`;
    const [result] = await connection.query(
      `INSERT INTO mobiliario_variante (productoId, sku, nombre, medidas, existenciaTotal, fueraServicio, orden, activo)
       VALUES (?, ?, NULL, ?, ?, 0, ?, 1)`,
      [productId, sku, values.medidas, values.existenciaInicial, position.nextOrder]
    );
    if (values.existenciaInicial > 0) {
      await connection.query(
        `INSERT INTO mobiliario_movimiento
         (varianteId, tipo, cantidad, existenciaAntes, existenciaDespues, fueraServicioAntes, fueraServicioDespues, motivo, createdBy)
         VALUES (?, 'inventario_inicial', ?, 0, ?, 0, 0, 'Inventario inicial', ?)`,
        [result.insertId, values.existenciaInicial, values.existenciaInicial, createdBy || null]
      );
    }
    await connection.commit();
    const [[row]] = await db().query('SELECT * FROM mobiliario_variante WHERE id = ?', [result.insertId]);
    return normalizeVariant(row);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function updateVariant(productId, variantId, payload) {
  const medidas = String(payload.medidas || '').trim().slice(0, 240) || null;
  if (!medidas) throw appError(400, 'Indica las medidas de la presentacion.', { medidas: 'Las medidas son obligatorias.' });
  const [[current]] = await db().query('SELECT id FROM mobiliario_variante WHERE id = ? AND productoId = ?', [variantId, productId]);
  if (!current) throw appError(404, 'Presentacion no encontrada.');
  await db().query('UPDATE mobiliario_variante SET medidas = ?, updatedAt = NOW() WHERE id = ? AND productoId = ?', [medidas, variantId, productId]);
  const [[row]] = await db().query('SELECT * FROM mobiliario_variante WHERE id = ?', [variantId]);
  return normalizeVariant(row);
}

async function setVariantState(productId, variantId, activo) {
  const [[current]] = await db().query('SELECT id FROM mobiliario_variante WHERE id = ? AND productoId = ?', [variantId, productId]);
  if (!current) throw appError(404, 'Presentacion no encontrada.');
  if (!activo) {
    const [[product]] = await db().query('SELECT estado FROM mobiliario_producto WHERE id = ?', [productId]);
    const [[count]] = await db().query('SELECT COUNT(*) AS total FROM mobiliario_variante WHERE productoId = ? AND activo = 1', [productId]);
    if (product?.estado === 'publicado' && asNumber(count.total) <= 1) throw appError(409, 'Un producto publicado debe conservar al menos una presentacion activa.');
  }
  await db().query('UPDATE mobiliario_variante SET activo = ?, updatedAt = NOW() WHERE id = ?', [activo ? 1 : 0, variantId]);
  const [[row]] = await db().query('SELECT * FROM mobiliario_variante WHERE id = ?', [variantId]);
  return normalizeVariant(row);
}

async function listMovements(variantId) {
  const [rows] = await db().query(
    `SELECT m.*, CONCAT(COALESCE(u.nombres, ''), ' ', COALESCE(u.apellidos, '')) AS usuarioNombre
     FROM mobiliario_movimiento m LEFT JOIN usuariosistema u ON u.id = m.createdBy
     WHERE m.varianteId = ? ORDER BY m.createdAt DESC, m.id DESC`,
    [variantId]
  );
  return rows;
}

async function createMovement(variantId, payload, createdBy) {
  const tipo = String(payload.tipo || '');
  if (!MOVEMENT_TYPES.has(tipo)) throw appError(400, 'Tipo de movimiento invalido.', { tipo: 'Selecciona un tipo valido.' });
  const motivo = String(payload.motivo || '').trim().slice(0, 500);
  if (!motivo) throw appError(400, 'El motivo es obligatorio.', { motivo: 'Explica el ajuste de inventario.' });
  const connection = await db().getConnection();
  try {
    await connection.beginTransaction();
    const [[variant]] = await connection.query('SELECT * FROM mobiliario_variante WHERE id = ? FOR UPDATE', [variantId]);
    if (!variant) throw appError(404, 'Presentacion no encontrada.');
    const beforeTotal = asNumber(variant.existenciaTotal);
    const beforeOut = asNumber(variant.fueraServicio);
    let afterTotal = beforeTotal;
    let afterOut = beforeOut;
    let quantity = asInteger(payload.cantidad, 0);
    if (tipo === 'correccion') {
      afterTotal = asInteger(payload.existenciaTotal, -1);
      afterOut = asInteger(payload.fueraServicio, -1);
      if (afterTotal < 0 || afterOut < 0) throw appError(400, 'La correccion requiere existencias validas.', { existenciaTotal: 'Usa cero o un valor positivo.', fueraServicio: 'Usa cero o un valor positivo.' });
      quantity = Math.abs(afterTotal - beforeTotal) + Math.abs(afterOut - beforeOut);
      if (!quantity) throw appError(400, 'La correccion no cambia el inventario.');
    } else {
      if (quantity <= 0) throw appError(400, 'La cantidad debe ser mayor que cero.', { cantidad: 'Usa una cantidad mayor que cero.' });
      if (tipo === 'entrada') afterTotal += quantity;
      if (tipo === 'retiro') afterTotal -= quantity;
      if (tipo === 'fuera_servicio') afterOut += quantity;
      if (tipo === 'reincorporacion') afterOut -= quantity;
    }
    if (afterTotal < 0) throw appError(409, 'El movimiento dejaria existencias negativas.');
    if (afterOut < 0) throw appError(409, 'No hay suficientes unidades fuera de servicio para reincorporar.');
    if (afterOut > afterTotal) throw appError(409, 'Las unidades fuera de servicio no pueden superar la existencia total.');
    await connection.query('UPDATE mobiliario_variante SET existenciaTotal = ?, fueraServicio = ?, updatedAt = NOW() WHERE id = ?', [afterTotal, afterOut, variantId]);
    const [result] = await connection.query(
      `INSERT INTO mobiliario_movimiento
       (varianteId, tipo, cantidad, existenciaAntes, existenciaDespues, fueraServicioAntes, fueraServicioDespues, motivo, createdBy)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [variantId, tipo, quantity, beforeTotal, afterTotal, beforeOut, afterOut, motivo, createdBy || null]
    );
    await connection.commit();
    const [[movement]] = await db().query('SELECT * FROM mobiliario_movimiento WHERE id = ?', [result.insertId]);
    const [[updated]] = await db().query('SELECT * FROM mobiliario_variante WHERE id = ?', [variantId]);
    return { movement, variant: normalizeVariant(updated) };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function replaceImage(productId, tipo, imageRecord) {
  if (!IMAGE_TYPES.has(tipo)) throw appError(400, 'Tipo de imagen invalido.');
  const connection = await db().getConnection();
  try {
    await connection.beginTransaction();
    const [[product]] = await connection.query('SELECT id FROM mobiliario_producto WHERE id = ? FOR UPDATE', [productId]);
    if (!product) throw appError(404, 'Producto no encontrado.');
    const [[previous]] = await connection.query('SELECT * FROM mobiliario_imagen WHERE productoId = ? AND tipo = ? FOR UPDATE', [productId, tipo]);
    if (previous) {
      await connection.query(
        `UPDATE mobiliario_imagen SET publicCode = ?, r2KeyOriginal = ?, r2KeyThumb = ?, mimeType = 'image/webp',
         width = ?, height = ?, altText = ?, activo = 1, updatedAt = NOW() WHERE id = ?`,
        [imageRecord.publicCode, imageRecord.r2KeyOriginal, imageRecord.r2KeyThumb, imageRecord.width || null,
          imageRecord.height || null, imageRecord.altText || null, previous.id]
      );
    } else {
      await connection.query(
        `INSERT INTO mobiliario_imagen
         (productoId, tipo, publicCode, r2KeyOriginal, r2KeyThumb, mimeType, width, height, altText, orden, principal, activo)
         VALUES (?, ?, ?, ?, ?, 'image/webp', ?, ?, ?, 0, ?, 1)`,
        [productId, tipo, imageRecord.publicCode, imageRecord.r2KeyOriginal, imageRecord.r2KeyThumb,
          imageRecord.width || null, imageRecord.height || null, imageRecord.altText || null, tipo === 'producto' ? 1 : 0]
      );
    }
    await connection.commit();
    const [[current]] = await db().query('SELECT * FROM mobiliario_imagen WHERE productoId = ? AND tipo = ?', [productId, tipo]);
    return { item: normalizeImage(current), previous: previous || null };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function findImageByPublicCode(publicCode) {
  const [[row]] = await db().query(
    `SELECT i.*, p.estado AS productoEstado FROM mobiliario_imagen i
     INNER JOIN mobiliario_producto p ON p.id = i.productoId WHERE i.publicCode = ? LIMIT 1`,
    [publicCode]
  );
  return row || null;
}

function buildCatalogUrl(frontendBaseUrl, publicCode) {
  return `${String(frontendBaseUrl || '').replace(/\/$/, '')}/catalogo-mobiliario/${publicCode}`;
}

function catalogEdition(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit' }).formatToParts(date);
  return `${parts.find((p) => p.type === 'year').value}-${parts.find((p) => p.type === 'month').value}`;
}

async function updateCatalogStyle(payload, frontendBaseUrl) {
  const fields = {};
  const colors = {};
  for (const key of ['colorPrimario', 'colorSecundario']) {
    if (typeof payload?.[key] !== 'string' || !/^#[0-9a-f]{6}$/i.test(payload[key])) fields[key] = 'Usa un color hexadecimal de seis dígitos (#RRGGBB).';
    else colors[key] = payload[key].toUpperCase();
  }
  if (Object.keys(fields).length) throw appError(400, 'Revisa los colores del catálogo.', fields);
  if (!await getCatalogConfig(frontendBaseUrl)) throw appError(404, 'Primero genera la URL del catálogo.');
  await db().query('UPDATE mobiliario_catalogo_publico SET colorPrimario = ?, colorSecundario = ?, updatedAt = NOW() WHERE id = 1', [colors.colorPrimario, colors.colorSecundario]);
  return getCatalogConfig(frontendBaseUrl);
}

async function getCatalogConfig(frontendBaseUrl) {
  const [[row]] = await db().query('SELECT * FROM mobiliario_catalogo_publico WHERE id = 1 LIMIT 1');
  if (!row) return null;
  return { ...row, activo: Boolean(row.activo), publicUrl: buildCatalogUrl(frontendBaseUrl, row.publicCode) };
}

async function generateCatalog(createdBy, frontendBaseUrl) {
  const existing = await getCatalogConfig(frontendBaseUrl);
  if (existing) return existing;
  try {
    await db().query('INSERT INTO mobiliario_catalogo_publico (id, publicCode, activo, createdBy, edicion) VALUES (1, ?, 1, ?, ?)', [randomCode(), createdBy || null, catalogEdition()]);
  } catch (error) {
    if (error.code !== 'ER_DUP_ENTRY') throw error;
  }
  return getCatalogConfig(frontendBaseUrl);
}

async function setCatalogState(activo, frontendBaseUrl) {
  const existing = await getCatalogConfig(frontendBaseUrl);
  if (!existing) throw appError(404, 'Primero genera la URL del catalogo.');
  await db().query('UPDATE mobiliario_catalogo_publico SET activo = ?, updatedAt = NOW() WHERE id = 1', [activo ? 1 : 0]);
  return getCatalogConfig(frontendBaseUrl);
}

async function regenerateCatalog(frontendBaseUrl) {
  const existing = await getCatalogConfig(frontendBaseUrl);
  if (!existing) throw appError(404, 'Primero genera la URL del catalogo.');
  await db().query('UPDATE mobiliario_catalogo_publico SET publicCode = ?, activo = 1, edicion = ?, regeneratedAt = NOW(), updatedAt = NOW() WHERE id = 1', [randomCode(), catalogEdition()]);
  return getCatalogConfig(frontendBaseUrl);
}

async function getPublicCatalog(publicCode) {
  const [[config]] = await db().query('SELECT colorPrimario, colorSecundario, edicion FROM mobiliario_catalogo_publico WHERE id = 1 AND publicCode = ? AND activo = 1 LIMIT 1', [publicCode]);
  if (!config) return null;
  const [categories] = await db().query(
    `SELECT DISTINCT c.id, c.nombre, c.slug, c.descripcion, c.orden FROM mobiliario_categoria c
     INNER JOIN mobiliario_producto p ON p.categoriaId = c.id AND p.estado = 'publicado'
     WHERE c.activo = 1
       AND EXISTS (SELECT 1 FROM mobiliario_variante v WHERE v.productoId = p.id AND v.activo = 1)
       AND EXISTS (SELECT 1 FROM mobiliario_imagen i WHERE i.productoId = p.id AND i.tipo = 'producto' AND i.activo = 1)
       AND EXISTS (SELECT 1 FROM mobiliario_imagen i WHERE i.productoId = p.id AND i.tipo = 'decoracion' AND i.activo = 1)
     ORDER BY c.orden, c.nombre`
  );
  const [products] = await db().query(
    `SELECT p.publicCode, p.codigo, p.nombre, p.slug, p.color, p.orden,
       c.id AS categoriaId, c.nombre AS categoriaNombre, c.slug AS categoriaSlug
     FROM mobiliario_producto p INNER JOIN mobiliario_categoria c ON c.id = p.categoriaId AND c.activo = 1
     WHERE p.estado = 'publicado'
       AND EXISTS (SELECT 1 FROM mobiliario_variante v WHERE v.productoId = p.id AND v.activo = 1)
       AND EXISTS (SELECT 1 FROM mobiliario_imagen i WHERE i.productoId = p.id AND i.tipo = 'producto' AND i.activo = 1)
       AND EXISTS (SELECT 1 FROM mobiliario_imagen i WHERE i.productoId = p.id AND i.tipo = 'decoracion' AND i.activo = 1)
     ORDER BY c.orden, p.orden, p.nombre`
  );
  if (!products.length) return { config, categories: [], products: [] };
  const codes = products.map((product) => product.publicCode);
  const placeholders = codes.map(() => '?').join(',');
  const [variants] = await db().query(
    `SELECT p.publicCode AS productoPublicCode, v.medidas FROM mobiliario_variante v
     INNER JOIN mobiliario_producto p ON p.id = v.productoId
     WHERE p.publicCode IN (${placeholders}) AND v.activo = 1 ORDER BY v.orden, v.id`,
    codes
  );
  const [images] = await db().query(
    `SELECT p.publicCode AS productoPublicCode, i.tipo, i.publicCode, i.altText
     FROM mobiliario_imagen i INNER JOIN mobiliario_producto p ON p.id = i.productoId
     WHERE p.publicCode IN (${placeholders}) AND i.activo = 1 AND i.tipo IN ('producto', 'decoracion')`,
    codes
  );
  return {
    config,
    categories,
    products: products.map((product) => {
      const productImages = images.filter((image) => image.productoPublicCode === product.publicCode);
      const mapImage = (tipo) => {
        const image = productImages.find((item) => item.tipo === tipo);
        return image ? { publicCode: image.publicCode, altText: image.altText || product.nombre, ...imageUrls(image.publicCode) } : null;
      };
      return {
        ...product,
        variants: variants.filter((variant) => variant.productoPublicCode === product.publicCode).map(({ productoPublicCode: _omit, ...variant }) => variant),
        imagenProducto: mapImage('producto'),
        imagenDecoracion: mapImage('decoracion'),
      };
    }),
  };
}

module.exports = {
  appError, randomCode, listCategories, createCategory, updateCategory, reorderCategories, deleteCategory,
  listProductOrder, reorderProducts, listProducts, getProduct, createProduct, updateProduct, setProductState,
  createVariant, updateVariant, setVariantState, listMovements, createMovement,
  replaceImage, findImageByPublicCode,
  catalogEdition, updateCatalogStyle, getCatalogConfig, generateCatalog, setCatalogState, regenerateCatalog, getPublicCatalog,
};
