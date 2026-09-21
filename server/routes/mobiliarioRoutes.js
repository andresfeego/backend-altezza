const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const { DeleteObjectCommand, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const mobiliario = require('../dbAltezza/mobiliario');
const { getR2Client, getR2Config } = require('../r2Client');

const router = express.Router();
const IMAGE_MAX_BYTES = 10 * 1024 * 1024;
const IMAGE_FORMATS = new Set(['jpeg', 'png', 'webp']);
const IMAGE_TYPES = new Set(['producto', 'decoracion']);
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: IMAGE_MAX_BYTES, files: 2 } });

function requireAdminRequest(req, res) {
  const role = Number(req.headers['x-altezza-user-role'] || req.body?.currentUserRole || 0);
  if (role !== 1) {
    res.status(403).json({ error: 403, message: 'Solo un usuario admin puede ejecutar esta accion.' });
    return null;
  }
  return { idUsuario: Number(req.headers['x-altezza-user-id'] || req.body?.currentUserId || 0) || null, role };
}

function frontendBaseUrl(req) {
  return (
    process.env.MOBILIARIO_FRONTEND_BASE_URL
    || process.env.SHARE_GALLERY_FRONTEND_BASE_URL
    || process.env.PUBLIC_BASE_URL
    || `${req.protocol}://${req.get('host')}`
  ).replace(/\/$/, '');
}

function sendError(res, error, fallback) {
  const status = Number(error?.status) || (error?.code === 'LIMIT_FILE_SIZE' ? 413 : 500);
  if (status >= 500) console.error('[mobiliario]', error);
  return res.status(status).json({
    error: status,
    message: error?.code === 'LIMIT_FILE_SIZE' ? 'La imagen supera el limite de 10 MB.' : error?.message || fallback,
    ...(error?.fields ? { fields: error.fields } : {}),
  });
}

async function processImage(file, { tipo, productCode, altText }) {
  if (!file?.buffer) throw mobiliario.appError(400, 'Selecciona las dos imagenes.', { [`imagen${tipo === 'producto' ? 'Producto' : 'Decoracion'}`]: 'La imagen es obligatoria.' });
  const metadata = await sharp(file.buffer).metadata().catch(() => null);
  if (!metadata || !IMAGE_FORMATS.has(metadata.format)) {
    throw mobiliario.appError(415, 'Usa imagenes JPEG, PNG o WebP.', { [`imagen${tipo === 'producto' ? 'Producto' : 'Decoracion'}`]: 'Formato no permitido.' });
  }
  const publicCode = mobiliario.randomCode();
  const baseKey = `mobiliario/${productCode}/${tipo}/${publicCode}`;
  const r2KeyOriginal = `${baseKey}/full.webp`;
  const r2KeyThumb = `${baseKey}/preview.webp`;
  const fullBuffer = await sharp(file.buffer)
    .rotate()
    .resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 84 })
    .toBuffer();
  const previewBuffer = await sharp(file.buffer)
    .rotate()
    .resize({ width: 640, height: 640, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();
  const outputMetadata = await sharp(fullBuffer).metadata();
  return {
    record: {
      tipo, publicCode, r2KeyOriginal, r2KeyThumb,
      width: outputMetadata.width, height: outputMetadata.height, altText,
    },
    objects: [
      { Key: r2KeyOriginal, Body: fullBuffer },
      { Key: r2KeyThumb, Body: previewBuffer },
    ],
  };
}

async function uploadObjects(objects) {
  const r2 = getR2Client();
  const { bucketName } = getR2Config();
  await Promise.all(objects.map(({ Key, Body }) => r2.send(new PutObjectCommand({
    Bucket: bucketName, Key, Body, ContentType: 'image/webp', CacheControl: 'private, max-age=31536000, immutable',
  }))));
}

async function deleteObjects(keys) {
  if (!keys.filter(Boolean).length) return;
  const r2 = getR2Client();
  const { bucketName } = getR2Config();
  await Promise.all(keys.filter(Boolean).map((Key) => r2.send(new DeleteObjectCommand({ Bucket: bucketName, Key }))));
}

router.get('/mobiliario/categorias', async (req, res) => {
  if (!requireAdminRequest(req, res)) return;
  try {
    const items = await mobiliario.listCategories();
    return res.json({
      items,
      pagination: { page: 1, pageSize: items.length, total: items.length },
      summary: { total: items.length, activas: items.filter((item) => item.activo).length, inactivas: items.filter((item) => !item.activo).length },
    });
  } catch (error) { return sendError(res, error, 'No fue posible cargar las categorias.'); }
});

router.post('/mobiliario/categorias', async (req, res) => {
  if (!requireAdminRequest(req, res)) return;
  try { return res.status(201).json({ success: true, item: await mobiliario.createCategory(req.body) }); }
  catch (error) { return sendError(res, error, 'No fue posible crear la categoria.'); }
});

router.put('/mobiliario/categorias/orden', async (req, res) => {
  if (!requireAdminRequest(req, res)) return;
  try { return res.json({ success: true, item: await mobiliario.reorderCategories(req.body?.ids) }); }
  catch (error) { return sendError(res, error, 'No fue posible guardar el orden.'); }
});

router.put('/mobiliario/categorias/:id', async (req, res) => {
  if (!requireAdminRequest(req, res)) return;
  try { return res.json({ success: true, item: await mobiliario.updateCategory(Number(req.params.id), req.body) }); }
  catch (error) { return sendError(res, error, 'No fue posible actualizar la categoria.'); }
});

router.delete('/mobiliario/categorias/:id', async (req, res) => {
  if (!requireAdminRequest(req, res)) return;
  try { await mobiliario.deleteCategory(Number(req.params.id)); return res.json({ success: true, item: null }); }
  catch (error) { return sendError(res, error, 'No fue posible eliminar la categoria.'); }
});

router.get('/mobiliario/categorias/:id/productos/orden', async (req, res) => {
  if (!requireAdminRequest(req, res)) return;
  try { return res.json({ items: await mobiliario.listProductOrder(Number(req.params.id)) }); }
  catch (error) { return sendError(res, error, 'No fue posible cargar el orden de productos.'); }
});

router.put('/mobiliario/categorias/:id/productos/orden', async (req, res) => {
  if (!requireAdminRequest(req, res)) return;
  try { return res.json({ success: true, items: await mobiliario.reorderProducts(Number(req.params.id), req.body?.ids) }); }
  catch (error) { return sendError(res, error, 'No fue posible guardar el orden de productos.'); }
});

router.get('/mobiliario/productos', async (req, res) => {
  if (!requireAdminRequest(req, res)) return;
  try { return res.json(await mobiliario.listProducts(req.query)); }
  catch (error) { return sendError(res, error, 'No fue posible cargar el inventario.'); }
});

router.post('/mobiliario/productos', (req, res) => {
  upload.fields([{ name: 'imagenProducto', maxCount: 1 }, { name: 'imagenDecoracion', maxCount: 1 }])(req, res, async (uploadError) => {
    const admin = requireAdminRequest(req, res);
    if (!admin) return;
    if (uploadError) return sendError(res, uploadError, 'No fue posible recibir las imagenes.');
    const uploadedKeys = [];
    try {
      const fields = {};
      if (!req.files?.imagenProducto?.[0]) fields.imagenProducto = 'La imagen del producto es obligatoria.';
      if (!req.files?.imagenDecoracion?.[0]) fields.imagenDecoracion = 'La imagen de decoracion es obligatoria.';
      if (Object.keys(fields).length) throw mobiliario.appError(400, 'Agrega las dos imagenes del producto.', fields);
      const productCode = mobiliario.randomCode();
      const [productImage, decorImage] = await Promise.all([
        processImage(req.files.imagenProducto[0], { tipo: 'producto', productCode, altText: req.body?.nombre }),
        processImage(req.files.imagenDecoracion[0], { tipo: 'decoracion', productCode, altText: `Decoracion con ${req.body?.nombre || 'mobiliario'}` }),
      ]);
      const imageResults = [productImage, decorImage];
      const objects = imageResults.flatMap((item) => item.objects);
      uploadedKeys.push(...objects.map((item) => item.Key));
      await uploadObjects(objects);
      const item = await mobiliario.createProduct(
        { ...req.body, publicCode: productCode }, admin.idUsuario, imageResults.map((result) => result.record)
      );
      return res.status(201).json({ success: true, item });
    } catch (error) {
      if (uploadedKeys.length) {
        try { await deleteObjects(uploadedKeys); } catch (cleanupError) { console.error('[mobiliario:create-cleanup]', cleanupError); }
      }
      return sendError(res, error, 'No fue posible crear el producto.');
    }
  });
});

router.get('/mobiliario/productos/:id', async (req, res) => {
  if (!requireAdminRequest(req, res)) return;
  try {
    const item = await mobiliario.getProduct(Number(req.params.id));
    if (!item) return res.status(404).json({ error: 404, message: 'Producto no encontrado.' });
    return res.json({ item });
  } catch (error) { return sendError(res, error, 'No fue posible cargar el producto.'); }
});

router.put('/mobiliario/productos/:id', async (req, res) => {
  if (!requireAdminRequest(req, res)) return;
  try { return res.json({ success: true, item: await mobiliario.updateProduct(Number(req.params.id), req.body) }); }
  catch (error) { return sendError(res, error, 'No fue posible actualizar el producto.'); }
});

router.patch('/mobiliario/productos/:id/estado', async (req, res) => {
  if (!requireAdminRequest(req, res)) return;
  try { return res.json({ success: true, item: await mobiliario.setProductState(Number(req.params.id), req.body?.estado) }); }
  catch (error) { return sendError(res, error, 'No fue posible cambiar el estado.'); }
});

router.post('/mobiliario/productos/:id/variantes', async (req, res) => {
  const admin = requireAdminRequest(req, res);
  if (!admin) return;
  try { return res.status(201).json({ success: true, item: await mobiliario.createVariant(Number(req.params.id), req.body, admin.idUsuario) }); }
  catch (error) { return sendError(res, error, 'No fue posible crear la presentacion.'); }
});

router.put('/mobiliario/productos/:id/variantes/:variantId', async (req, res) => {
  if (!requireAdminRequest(req, res)) return;
  try { return res.json({ success: true, item: await mobiliario.updateVariant(Number(req.params.id), Number(req.params.variantId), req.body) }); }
  catch (error) { return sendError(res, error, 'No fue posible actualizar la presentacion.'); }
});

router.patch('/mobiliario/productos/:id/variantes/:variantId/estado', async (req, res) => {
  if (!requireAdminRequest(req, res)) return;
  try {
    const activo = req.body?.activo === true || req.body?.activo === 1 || req.body?.activo === '1';
    return res.json({ success: true, item: await mobiliario.setVariantState(Number(req.params.id), Number(req.params.variantId), activo) });
  } catch (error) { return sendError(res, error, 'No fue posible cambiar el estado de la presentacion.'); }
});

router.get('/mobiliario/variantes/:id/movimientos', async (req, res) => {
  if (!requireAdminRequest(req, res)) return;
  try {
    const items = await mobiliario.listMovements(Number(req.params.id));
    return res.json({ items, pagination: { page: 1, pageSize: items.length, total: items.length }, summary: { total: items.length } });
  } catch (error) { return sendError(res, error, 'No fue posible cargar los movimientos.'); }
});

router.post('/mobiliario/variantes/:id/movimientos', async (req, res) => {
  const admin = requireAdminRequest(req, res);
  if (!admin) return;
  try { return res.status(201).json({ success: true, ...(await mobiliario.createMovement(Number(req.params.id), req.body, admin.idUsuario)) }); }
  catch (error) { return sendError(res, error, 'No fue posible registrar el movimiento.'); }
});

router.put('/mobiliario/productos/:id/imagenes/:tipo', (req, res) => {
  upload.single('imagen')(req, res, async (uploadError) => {
    const admin = requireAdminRequest(req, res);
    if (!admin) return;
    if (uploadError) return sendError(res, uploadError, 'No fue posible recibir la imagen.');
    const tipo = String(req.params.tipo || '');
    const uploadedKeys = [];
    try {
      if (!IMAGE_TYPES.has(tipo)) throw mobiliario.appError(400, 'Tipo de imagen invalido.');
      const product = await mobiliario.getProduct(Number(req.params.id));
      if (!product) throw mobiliario.appError(404, 'Producto no encontrado.');
      const result = await processImage(req.file, {
        tipo, productCode: product.publicCode,
        altText: tipo === 'producto' ? product.nombre : `Decoracion con ${product.nombre}`,
      });
      uploadedKeys.push(...result.objects.map((object) => object.Key));
      await uploadObjects(result.objects);
      const replaced = await mobiliario.replaceImage(Number(req.params.id), tipo, result.record);
      if (replaced.previous) {
        try { await deleteObjects([replaced.previous.r2KeyOriginal, replaced.previous.r2KeyThumb]); }
        catch (cleanupError) { console.error('[mobiliario:replace-old-cleanup]', cleanupError); }
      }
      return res.json({ success: true, item: replaced.item });
    } catch (error) {
      if (uploadedKeys.length) {
        try { await deleteObjects(uploadedKeys); } catch (cleanupError) { console.error('[mobiliario:replace-cleanup]', cleanupError); }
      }
      return sendError(res, error, 'No fue posible reemplazar la imagen.');
    }
  });
});

router.get('/mobiliario/catalogo-publico', async (req, res) => {
  if (!requireAdminRequest(req, res)) return;
  try { return res.json({ item: await mobiliario.getCatalogConfig(frontendBaseUrl(req)) }); }
  catch (error) { return sendError(res, error, 'No fue posible cargar la URL publica.'); }
});

router.patch('/mobiliario/catalogo-publico/estilo', async (req, res) => {
  if (!requireAdminRequest(req, res)) return;
  try { return res.json({ success: true, item: await mobiliario.updateCatalogStyle(req.body, frontendBaseUrl(req)) }); }
  catch (error) { return sendError(res, error, 'No fue posible guardar los colores.'); }
});

router.post('/mobiliario/catalogo-publico/generar', async (req, res) => {
  const admin = requireAdminRequest(req, res);
  if (!admin) return;
  try { return res.status(201).json({ success: true, item: await mobiliario.generateCatalog(admin.idUsuario, frontendBaseUrl(req)) }); }
  catch (error) { return sendError(res, error, 'No fue posible generar la URL.'); }
});

router.patch('/mobiliario/catalogo-publico/estado', async (req, res) => {
  if (!requireAdminRequest(req, res)) return;
  try {
    const activo = req.body?.activo === true || req.body?.activo === 1 || req.body?.activo === '1';
    return res.json({ success: true, item: await mobiliario.setCatalogState(activo, frontendBaseUrl(req)) });
  } catch (error) { return sendError(res, error, 'No fue posible cambiar el estado del catalogo.'); }
});

router.post('/mobiliario/catalogo-publico/regenerar', async (req, res) => {
  if (!requireAdminRequest(req, res)) return;
  try { return res.json({ success: true, item: await mobiliario.regenerateCatalog(frontendBaseUrl(req)) }); }
  catch (error) { return sendError(res, error, 'No fue posible regenerar la URL.'); }
});

router.get('/public/mobiliario/catalogo/:publicCode', async (req, res) => {
  try {
    const catalog = await mobiliario.getPublicCatalog(String(req.params.publicCode || ''));
    if (!catalog) return res.status(404).json({ error: 404, message: 'Catalogo no disponible.' });
    // Configuration and link revocation must be visible on the next catalog load.
    res.setHeader('Cache-Control', 'no-store');
    return res.json(catalog);
  } catch (error) { return sendError(res, error, 'No fue posible cargar el catalogo.'); }
});

router.get('/public/mobiliario/media/:imagePublicCode', async (req, res) => {
  try {
    const image = await mobiliario.findImageByPublicCode(String(req.params.imagePublicCode || ''));
    if (!image || !image.activo || image.productoEstado === 'archivado') return res.status(404).json({ error: 404, message: 'Imagen no encontrada.' });
    const key = String(req.query.variant || '') === 'preview' ? image.r2KeyThumb : image.r2KeyOriginal;
    const r2 = getR2Client();
    const { bucketName } = getR2Config();
    const signedUrl = await getSignedUrl(r2, new GetObjectCommand({ Bucket: bucketName, Key: key }), { expiresIn: 15 * 60 });
    res.setHeader('Cache-Control', 'public, max-age=300');
    return res.redirect(302, signedUrl);
  } catch (error) { return sendError(res, error, 'No fue posible abrir la imagen.'); }
});

module.exports = router;
