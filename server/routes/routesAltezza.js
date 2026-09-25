const express = require('express');
const general = require('../dbAltezza/general');
const usuario = require('../dbAltezza/usuario');
const { publicEventImageUrl } = require('../utils/publicEventImageUrl');


const fs = require('fs');
const path = require('path');
const multer = require('multer');
const sharp = require('sharp');
const QRCode = require('qrcode');
const { GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { getR2Client, getR2Config } = require('../r2Client');
const shareGallery = require('../dbAltezza/shareGallery');
const router = express.Router();
// body parsing is handled at app level (server/index.js)


// Ruta base para local o producción
const isLocal = process.env.NODE_ENV !== 'production';

// Storage layout
const DATA_ROOT = process.env.ALTEZZA_DATA_ROOT || path.resolve(__dirname, '../../data/altezza');
const BASE_DIR = process.env.ALTEZZA_EVENTOS_DIR || path.join(DATA_ROOT, 'images/eventos');

// Public path for event images (served by express in local dev, and by nginx alias in VPS)
const EVENTOS_PUBLIC_PATH = (process.env.ALTEZZA_EVENTOS_PUBLIC_PATH || '/scrAppaltezza/images/eventos').replace(/\/$/, '');

function publicEventoUrl(rutaRelativa) {
  return publicEventImageUrl(rutaRelativa, {
    eventPath: EVENTOS_PUBLIC_PATH,
    invitationPath: process.env.ALTEZZA_INVITATIONS_PUBLIC_PATH || '/scrAppaltezza/invitations',
    templatePath: process.env.ALTEZZA_TEMPLATES_PUBLIC_PATH || '/scrAppaltezza/templates',
  });
}


const userEventStreams = new Map();
const SHARE_GALLERY_COOKIE = 'share_gallery_visitor';
const SHARE_GALLERY_MAX_FILES = 50;
const SHARE_GALLERY_PHOTO_MAX_BYTES = 25 * 1024 * 1024;
const SHARE_GALLERY_VIDEO_MAX_BYTES = 500 * 1024 * 1024;
const SHARE_GALLERY_UPLOAD_EXPIRY_SECONDS = 10 * 60;
const SHARE_GALLERY_READ_EXPIRY_SECONDS = 15 * 60;
const SHARE_GALLERY_ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/heic',
  'image/heif',
  'image/webp',
]);
const SHARE_GALLERY_ALLOWED_VIDEO_TYPES = new Set([
  'video/mp4',
  'video/quicktime',
  'video/webm',
]);

function parseOptionalPositiveInt(value) {
  if (value === null || value === undefined || value === '') return null;

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return NaN;

  return parsed;
}

function parseOptionalBoolean(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'boolean') return value;

  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'si', 'sí', 'yes', 'y'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'n'].includes(normalized)) return false;

  return null;
}

function addUserEventStream(idUsuario, res) {
  const key = String(idUsuario);
  const current = userEventStreams.get(key) || new Set();
  current.add(res);
  userEventStreams.set(key, current);
}

function removeUserEventStream(idUsuario, res) {
  const key = String(idUsuario);
  const current = userEventStreams.get(key);
  if (!current) return;
  current.delete(res);
  if (!current.size) {
    userEventStreams.delete(key);
  }
}

function emitUserEvent(idUsuario, payload) {
  const key = String(idUsuario);
  const current = userEventStreams.get(key);
  if (!current?.size) return;

  const message = `data: ${JSON.stringify(payload)}\n\n`;
  current.forEach((stream) => {
    try {
      stream.write(message);
    } catch (error) {
      console.error('No fue posible emitir el evento SSE del usuario.', error);
    }
  });
}

function getFrontendBaseUrl(req) {
  return (
    process.env.SHARE_GALLERY_FRONTEND_BASE_URL
    || process.env.SHARE_GALLERY_PUBLIC_BASE_URL
    || `${req.protocol}://${req.get('host')}`
  ).replace(/\/$/, '');
}

function getApiBaseUrl(req) {
  const configuredBase = process.env.SHARE_GALLERY_API_BASE_URL;
  if (configuredBase) return configuredBase.replace(/\/$/, '');
  return '';
}

function parseCookies(req) {
  const header = req.headers.cookie || '';
  return header.split(';').reduce((acc, pair) => {
    const index = pair.indexOf('=');
    if (index === -1) return acc;
    const key = pair.slice(0, index).trim();
    const value = pair.slice(index + 1).trim();
    if (!key) return acc;
    acc[key] = decodeURIComponent(value);
    return acc;
  }, {});
}

function setVisitorCookie(req, res, visitorCode) {
  const maxAge = shareGallery.VISITOR_TTL_DAYS * 24 * 60 * 60;
  const secure = req.protocol === 'https' || process.env.NODE_ENV === 'production';
  const parts = [
    `${SHARE_GALLERY_COOKIE}=${encodeURIComponent(visitorCode)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAge}`,
  ];

  if (secure) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

function getCurrentVisitorCode(req) {
  return parseCookies(req)[SHARE_GALLERY_COOKIE] || '';
}

function requireAdminRequest(req, res) {
  const role = Number(req.headers['x-altezza-user-role'] || req.body?.currentUserRole || 0);
  if (role !== 1) {
    res.status(403).json({
      error: 403,
      message: 'Solo un usuario admin puede ejecutar esta accion.',
    });
    return null;
  }

  return {
    idUsuario: Number(req.headers['x-altezza-user-id'] || req.body?.currentUserId || 0) || null,
    role,
  };
}

function sanitizeFilename(value) {
  return String(value || 'archivo')
    .replace(/[^\w.\- ()]/g, '')
    .slice(0, 180) || 'archivo';
}

function getExtensionFromFile(file) {
  const filename = sanitizeFilename(file.originalFilename || file.fileName || '');
  const ext = path.extname(filename).replace('.', '').toLowerCase();
  if (ext) return ext;

  const map = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/heic': 'heic',
    'image/heif': 'heif',
    'image/webp': 'webp',
    'video/mp4': 'mp4',
    'video/quicktime': 'mov',
    'video/webm': 'webm',
  };
  return map[file.mimeType] || 'bin';
}

function validateShareGalleryFile(file) {
  const mimeType = String(file?.mimeType || '').toLowerCase();
  const sizeBytes = Number(file?.sizeBytes || 0);
  const isImage = SHARE_GALLERY_ALLOWED_IMAGE_TYPES.has(mimeType);
  const isVideo = SHARE_GALLERY_ALLOWED_VIDEO_TYPES.has(mimeType);

  if (!isImage && !isVideo) {
    return { ok: false, message: `Tipo de archivo no permitido: ${mimeType || 'desconocido'}` };
  }

  const maxBytes = isImage ? SHARE_GALLERY_PHOTO_MAX_BYTES : SHARE_GALLERY_VIDEO_MAX_BYTES;
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0 || sizeBytes > maxBytes) {
    return {
      ok: false,
      message: isImage
        ? 'Cada foto debe pesar maximo 25 MB.'
        : 'Cada video debe pesar maximo 500 MB.',
    };
  }

  return {
    ok: true,
    mediaType: isImage ? 'image' : 'video',
    mimeType,
  };
}

function buildUploadItems(album, files) {
  if (!Array.isArray(files) || !files.length) {
    const error = new Error('Se requiere al menos un archivo.');
    error.status = 400;
    throw error;
  }

  if (files.length > SHARE_GALLERY_MAX_FILES) {
    const error = new Error(`Solo se permiten ${SHARE_GALLERY_MAX_FILES} archivos por lote.`);
    error.status = 400;
    throw error;
  }

  return files.map((file) => {
    const validation = validateShareGalleryFile(file);
    if (!validation.ok) {
      const error = new Error(validation.message);
      error.status = 400;
      throw error;
    }

    const mediaPublicCode = shareGallery.randomCode(18);
    const extension = getExtensionFromFile({ ...file, mimeType: validation.mimeType });
    const r2KeyOriginal = `${album.r2Prefix}/originals/${mediaPublicCode}.${extension}`;
    const r2KeyThumb = validation.mediaType === 'image' ? `${album.r2Prefix}/thumbs/${mediaPublicCode}.webp` : null;
    const r2KeyPoster = validation.mediaType === 'video' ? `${album.r2Prefix}/posters/${mediaPublicCode}.webp` : null;

    return {
      mediaPublicCode,
      mediaType: validation.mediaType,
      mimeType: validation.mimeType,
      originalFilename: sanitizeFilename(file.originalFilename || file.fileName),
      sizeBytes: Number(file.sizeBytes || 0),
      r2KeyOriginal,
      r2KeyThumb,
      r2KeyPoster,
    };
  });
}

async function signUploadItem(item) {
  const r2 = getR2Client();
  const { bucketName } = getR2Config();

  const originalCommand = new PutObjectCommand({
    Bucket: bucketName,
    Key: item.r2KeyOriginal,
    ContentType: item.mimeType,
  });

  const signed = {
    original: {
      key: item.r2KeyOriginal,
      signedUrl: await getSignedUrl(r2, originalCommand, { expiresIn: SHARE_GALLERY_UPLOAD_EXPIRY_SECONDS }),
      contentType: item.mimeType,
    },
  };

  if (item.r2KeyThumb) {
    const thumbCommand = new PutObjectCommand({
      Bucket: bucketName,
      Key: item.r2KeyThumb,
      ContentType: 'image/webp',
    });
    signed.thumb = {
      key: item.r2KeyThumb,
      signedUrl: await getSignedUrl(r2, thumbCommand, { expiresIn: SHARE_GALLERY_UPLOAD_EXPIRY_SECONDS }),
      contentType: 'image/webp',
    };
  }

  if (item.r2KeyPoster) {
    const posterCommand = new PutObjectCommand({
      Bucket: bucketName,
      Key: item.r2KeyPoster,
      ContentType: 'image/webp',
    });
    signed.poster = {
      key: item.r2KeyPoster,
      signedUrl: await getSignedUrl(r2, posterCommand, { expiresIn: SHARE_GALLERY_UPLOAD_EXPIRY_SECONDS }),
      contentType: 'image/webp',
    };
  }

  return {
    ...item,
    upload: signed,
    internalUrl: `/api/responseAltezza/public/share-gallery/media/${item.mediaPublicCode}`,
  };
}

function keyBelongsToAlbum(album, key) {
  return typeof key === 'string' && key.startsWith(`${album.r2Prefix}/`);
}

function uploadPayloadBelongsToAlbum(album, file) {
  if (!file?.mediaPublicCode || !keyBelongsToAlbum(album, file.r2KeyOriginal)) return false;
  if (file.r2KeyThumb && !keyBelongsToAlbum(album, file.r2KeyThumb)) return false;
  if (file.r2KeyPoster && !keyBelongsToAlbum(album, file.r2KeyPoster)) return false;
  return true;
}

function normalizeUsuarioPayload(user) {
  if (!user) return user;

  const eventosAsignados = Array.isArray(user.eventosAsignados)
    ? user.eventosAsignados.map((evento) => ({
        ...evento,
        imagenPrincipal: evento?.imagenPrincipal ? publicEventoUrl(evento.imagenPrincipal) : null,
      }))
    : [];

  return {
    ...user,
    eventosAsignados,
    idEventoAsignado: eventosAsignados.length === 1 ? eventosAsignados[0].id : null,
  };
}


// Función para generar código aleatorio
function generarCodigo(len = 8) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let code = '';
  for (let i = 0; i < len; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Multer configuración temporal en memoria
const storage = multer.memoryStorage();
const upload = multer({ storage });

generaCodigo = (length) => {
    var result = '';
    var characters = 'abcdefghijklmnopqrstuvwxyz0123456789';
    var charactersLength = characters.length;
    for (var i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}



//________________________________ generales ____________________________


router.get('/parentescos', async (req, res, next) => {

    try{
        let results = await general.parentescos();
        res.json(results);
    }catch(e){
        console.log(e);
        res.sendStatus(500);
    }

});

router.get('/gruposEdad', async (req, res, next) => {

    try{
        let results = await general.gruposEdad();
        res.json(results);
    }catch(e){
        console.log(e);
        res.sendStatus(500);
    }

});

router.get('/paisesTelefono', async (req, res, next) => {
  try {
    const results = await general.paisesTelefono();
    res.json(results);
  } catch (e) {
    console.log(e);
    res.sendStatus(500);
  }
});

router.post('/login', async (req, res) => {
  try {
    const { user, pass } = req.body;
    const results = await general.usuariosistema(user);

    if (!results || results.length === 0) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    const usuario = results[0];
    const passOk = usuario.pass === pass; // texto plano

    if (!passOk) {
      return res.status(401).json({ message: 'Contraseña incorrecta' });
    }

    const { pass: _omit, ...safeUser } = usuario;
    return res.status(200).json({ usuario: safeUser });
  } catch (e) {
    console.error(e);
    return res.sendStatus(500);
  }
});


router.post('/uploadImagenEvento', upload.single('imagen'), async (req, res) => {
  try {
    const { codigoEvento, modulo } = req.body;

    if (!codigoEvento || !modulo) {
      return res.status(400).json({ error: 'Faltan parámetros requeridos (codigoEvento o modulo)' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No se envió ninguna imagen' });
    }

    // Crear carpeta si no existe
    const rutaDestino = path.join(BASE_DIR, codigoEvento, modulo);
    fs.mkdirSync(rutaDestino, { recursive: true });

    // Consultar evento actual
    const eventoResult = await general.detalleEventoCompleto(codigoEvento);
    const evento = eventoResult[0];

    // Eliminar imagen anterior si existe
    if (evento?.imagenPrincipal) {
      const rutaAntigua = path.join(BASE_DIR, evento.imagenPrincipal);
      if (fs.existsSync(rutaAntigua)) {
        fs.unlinkSync(rutaAntigua); // eliminar físicamente la imagen vieja
      }
    }

    // Generar nueva imagen con nombre aleatorio
    const codigoNombre = generarCodigo();
    const nombreFinal = `image_${codigoNombre}.webp`;
    const rutaRelativa = `/${codigoEvento}/${modulo}/${nombreFinal}`;
    const rutaFinal = path.join(BASE_DIR, rutaRelativa);

    // Procesar y guardar imagen
    await sharp(req.file.buffer)
      .resize({ width: 1200 })
      .toFormat('webp')
      .webp({ quality: 70 })
      .toFile(rutaFinal);

    // Actualizar base de datos con nueva ruta
    await general.actualizarImagenEvento(codigoEvento, rutaRelativa);

    // Devolver URL pública
    const rutaPublica = publicEventoUrl(rutaRelativa);
    return res.status(200).json({ url: rutaPublica });

  } catch (err) {
    console.error('[uploadImagenEvento] ❌', err);
    return res.sendStatus(500);
  }
});

router.get('/eventos/:idEvento/fotos-compartidas/albums', async (req, res) => {
  try {
    const { idEvento } = req.params;
    const evento = await general.eventoXid(String(idEvento || '').trim());
    if (!evento?.length) {
      return res.status(404).json({ error: 404, message: 'El evento no existe.' });
    }

    const albums = await shareGallery.listAlbumsByEvent(String(idEvento).trim(), getFrontendBaseUrl(req), getApiBaseUrl(req));
    return res.status(200).json({ idEvento: String(idEvento).trim(), albums });
  } catch (error) {
    console.error('[share-gallery:list-albums]', error);
    return res.status(500).json({ error: 500, message: 'No fue posible cargar los albumes.' });
  }
});

router.post('/eventos/:idEvento/fotos-compartidas/albums', async (req, res) => {
  try {
    const adminUser = requireAdminRequest(req, res);
    if (!adminUser) return null;

    const { idEvento } = req.params;
    const { nombre, descripcion, logoUrl } = req.body || {};
    const cleanNombre = String(nombre || '').trim();
    const cleanLogoUrl = String(logoUrl || '').trim();

    if (!cleanNombre) {
      return res.status(400).json({ error: 400, message: 'El nombre del album es obligatorio.' });
    }

    if (cleanLogoUrl && !/^https?:\/\/\S+$/i.test(cleanLogoUrl)) {
      return res.status(400).json({ error: 400, message: 'La URL del logo debe iniciar con http:// o https://.' });
    }

    const evento = await general.eventoXid(String(idEvento || '').trim());
    if (!evento?.length) {
      return res.status(404).json({ error: 404, message: 'El evento no existe.' });
    }

    const album = await shareGallery.createAlbum({
      idEvento: String(idEvento).trim(),
      nombre: cleanNombre.slice(0, 140),
      descripcion: String(descripcion || '').trim().slice(0, 1000) || null,
      logoUrl: cleanLogoUrl.slice(0, 1000) || null,
      createdBy: adminUser.idUsuario,
      publicBaseUrl: getFrontendBaseUrl(req),
      apiBaseUrl: getApiBaseUrl(req),
    });

    return res.status(201).json({ success: true, album });
  } catch (error) {
    console.error('[share-gallery:create-album]', error);
    return res.status(error.status || 500).json({
      error: error.status || 500,
      message: error.message || 'No fue posible crear el album.',
    });
  }
});

router.get('/eventos/:idEvento/fotos-compartidas/albums/:albumId', async (req, res) => {
  try {
    const { idEvento, albumId } = req.params;
    const album = await shareGallery.getAlbumById(Number(albumId), getFrontendBaseUrl(req), getApiBaseUrl(req));

    if (!album || String(album.idEvento) !== String(idEvento)) {
      return res.status(404).json({ error: 404, message: 'Album no encontrado.' });
    }

    const media = await shareGallery.listMedia({
      albumId: album.id,
      page: req.query.page,
      pageSize: req.query.pageSize,
    });

    return res.status(200).json({ album, media });
  } catch (error) {
    console.error('[share-gallery:album-detail]', error);
    return res.status(500).json({ error: 500, message: 'No fue posible cargar el album.' });
  }
});

router.post('/eventos/:idEvento/fotos-compartidas/albums/:albumId/uploads/sign', async (req, res) => {
  try {
    const adminUser = requireAdminRequest(req, res);
    if (!adminUser) return null;

    const { idEvento, albumId } = req.params;
    const album = await shareGallery.getAlbumById(Number(albumId), getFrontendBaseUrl(req), getApiBaseUrl(req));

    if (!album || String(album.idEvento) !== String(idEvento)) {
      return res.status(404).json({ error: 404, message: 'Album no encontrado.' });
    }

    const uploadItems = buildUploadItems(album, req.body?.files || []);
    const signedItems = await Promise.all(uploadItems.map(signUploadItem));

    return res.status(200).json({
      albumId: album.id,
      expiresIn: SHARE_GALLERY_UPLOAD_EXPIRY_SECONDS,
      uploads: signedItems,
    });
  } catch (error) {
    console.error('[share-gallery:admin-sign]', error);
    return res.status(error.status || 500).json({
      error: error.status || 500,
      message: error.message || 'No fue posible preparar la subida.',
    });
  }
});

router.post('/eventos/:idEvento/fotos-compartidas/albums/:albumId/uploads/finalize', async (req, res) => {
  try {
    const adminUser = requireAdminRequest(req, res);
    if (!adminUser) return null;

    const { idEvento, albumId } = req.params;
    const album = await shareGallery.getAlbumById(Number(albumId), getFrontendBaseUrl(req), getApiBaseUrl(req));

    if (!album || String(album.idEvento) !== String(idEvento)) {
      return res.status(404).json({ error: 404, message: 'Album no encontrado.' });
    }

    const visitor = await shareGallery.ensureVisitor({
      visitorCode: getCurrentVisitorCode(req),
      displayName: req.body?.uploaderName || 'Equipo Altezza',
    });
    setVisitorCookie(req, res, visitor.publicCode);

    const files = Array.isArray(req.body?.files) ? req.body.files : [];
    const created = [];

    for (const file of files) {
      if (!uploadPayloadBelongsToAlbum(album, file)) {
        return res.status(400).json({ error: 400, message: 'La metadata de subida no pertenece al album.' });
      }

      created.push(await shareGallery.createMediaRecord({
        album,
        visitor,
        payload: file,
      }));
    }

    return res.status(201).json({ success: true, media: created });
  } catch (error) {
    console.error('[share-gallery:admin-finalize]', error);
    return res.status(error.status || 500).json({
      error: error.status || 500,
      message: error.message || 'No fue posible registrar los archivos.',
    });
  }
});

router.get('/public/share-gallery/:albumPublicCode', async (req, res) => {
  try {
    const { albumPublicCode } = req.params;
    const album = await shareGallery.getAlbumByPublicCode(albumPublicCode, getFrontendBaseUrl(req), getApiBaseUrl(req));

    if (!album || album.estado !== 'activo') {
      return res.status(404).json({ error: 404, message: 'Album no encontrado.' });
    }

    const currentVisitor = await shareGallery.ensureVisitor({
      visitorCode: getCurrentVisitorCode(req),
    });
    setVisitorCookie(req, res, currentVisitor.publicCode);

    const mine = await shareGallery.listMedia({
      albumId: album.id,
      visitorId: currentVisitor.id,
      page: 1,
      pageSize: 12,
      mineOnly: true,
    });

    const media = await shareGallery.listMedia({
      albumId: album.id,
      visitorId: currentVisitor.id,
      page: req.query.page,
      pageSize: req.query.pageSize,
    });

    return res.status(200).json({
      album,
      visitor: {
        publicCode: currentVisitor.publicCode,
        displayName: currentVisitor.displayName,
      },
      mine,
      media,
    });
  } catch (error) {
    console.error('[share-gallery:public-detail]', error);
    return res.status(500).json({ error: 500, message: 'No fue posible cargar la galeria.' });
  }
});

router.get('/public/share-gallery/:albumPublicCode/qr.svg', async (req, res) => {
  try {
    const { albumPublicCode } = req.params;
    const album = await shareGallery.getAlbumByPublicCode(albumPublicCode, getFrontendBaseUrl(req), getApiBaseUrl(req));

    if (!album || album.estado !== 'activo') {
      return res.status(404).send('Album no encontrado.');
    }

    const svg = await QRCode.toString(album.publicUrl, {
      type: 'svg',
      margin: 1,
      width: 720,
      color: {
        dark: '#2f2529',
        light: '#ffffff',
      },
    });

    res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=300');
    return res.status(200).send(svg);
  } catch (error) {
    console.error('[share-gallery:qr]', error);
    return res.status(500).send('No fue posible generar el QR.');
  }
});

router.post('/public/share-gallery/:albumPublicCode/uploads/sign', async (req, res) => {
  try {
    const { albumPublicCode } = req.params;
    const album = await shareGallery.getAlbumByPublicCode(albumPublicCode, getFrontendBaseUrl(req), getApiBaseUrl(req));

    if (!album || album.estado !== 'activo') {
      return res.status(404).json({ error: 404, message: 'Album no encontrado.' });
    }

    const visitor = await shareGallery.ensureVisitor({
      visitorCode: getCurrentVisitorCode(req),
      displayName: req.body?.uploaderName,
    });
    setVisitorCookie(req, res, visitor.publicCode);

    const uploadItems = buildUploadItems(album, req.body?.files || []);
    const signedItems = await Promise.all(uploadItems.map(signUploadItem));

    return res.status(200).json({
      albumId: album.id,
      visitor: {
        publicCode: visitor.publicCode,
        displayName: visitor.displayName,
      },
      expiresIn: SHARE_GALLERY_UPLOAD_EXPIRY_SECONDS,
      uploads: signedItems,
    });
  } catch (error) {
    console.error('[share-gallery:public-sign]', error);
    return res.status(error.status || 500).json({
      error: error.status || 500,
      message: error.message || 'No fue posible preparar la subida.',
    });
  }
});

router.post('/public/share-gallery/:albumPublicCode/uploads/finalize', async (req, res) => {
  try {
    const { albumPublicCode } = req.params;
    const album = await shareGallery.getAlbumByPublicCode(albumPublicCode, getFrontendBaseUrl(req), getApiBaseUrl(req));

    if (!album || album.estado !== 'activo') {
      return res.status(404).json({ error: 404, message: 'Album no encontrado.' });
    }

    const visitor = await shareGallery.ensureVisitor({
      visitorCode: getCurrentVisitorCode(req),
      displayName: req.body?.uploaderName,
    });
    setVisitorCookie(req, res, visitor.publicCode);

    const files = Array.isArray(req.body?.files) ? req.body.files : [];
    if (!files.length) {
      return res.status(400).json({ error: 400, message: 'No se recibieron archivos para registrar.' });
    }

    const created = [];

    for (const file of files) {
      if (!uploadPayloadBelongsToAlbum(album, file)) {
        return res.status(400).json({ error: 400, message: 'La metadata de subida no pertenece al album.' });
      }

      created.push(await shareGallery.createMediaRecord({
        album,
        visitor,
        payload: {
          ...file,
          uploaderName: req.body?.uploaderName || file.uploaderName,
        },
      }));
    }

    return res.status(201).json({ success: true, media: created });
  } catch (error) {
    console.error('[share-gallery:public-finalize]', error);
    return res.status(error.status || 500).json({
      error: error.status || 500,
      message: error.message || 'No fue posible registrar los archivos.',
    });
  }
});

router.get('/public/share-gallery/media/:mediaPublicCode', async (req, res) => {
  try {
    const media = await shareGallery.getMediaByPublicCode(req.params.mediaPublicCode);

    if (!media || media.status !== 'activo' || media.albumEstado !== 'activo') {
      return res.status(404).json({ error: 404, message: 'Archivo no encontrado.' });
    }

    const variant = String(req.query.variant || 'original');
    const key = variant === 'thumb' && media.r2KeyThumb
      ? media.r2KeyThumb
      : variant === 'poster' && media.r2KeyPoster
        ? media.r2KeyPoster
        : media.r2KeyOriginal;

    const r2 = getR2Client();
    const { bucketName } = getR2Config();
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: key,
    });
    const signedUrl = await getSignedUrl(r2, command, { expiresIn: SHARE_GALLERY_READ_EXPIRY_SECONDS });

    return res.redirect(302, signedUrl);
  } catch (error) {
    console.error('[share-gallery:media]', error);
    return res.status(error.status || 500).json({
      error: error.status || 500,
      message: error.message || 'No fue posible abrir el archivo.',
    });
  }
});


//_________________________________gestion usuario_______________________________-
// routesAltezza.js (endpoint)
router.post('/usuario/loginUsuario', async (req, res) => {
  try {
    const { correo, pass } = req.body;
    const user = normalizeUsuarioPayload(await usuario.loginUsuario(correo, pass));
    return res.status(200).json({
      success: true,
      userId: user.id,
      usuario: user, 
    });
  } catch (err) {
    switch (err) {
      case 404:
        return res.status(404).json({ error: 404, message: 'Verificar credenciales ingresadas.' });
      case 401:
        return res.status(401).json({ error: 401, message: 'Contraseña incorrecta' });
      case 406:
        return res.status(406).json({ error: 406, message: 'Usuario sin contraseña asignada' });
      case 409:
        return res.status(409).json({ error: 409, message: 'Ingreso con contraseña temporal' });
      default:
        console.error(err);
        return res.sendStatus(500);
    }
  }
});


router.get('/usuariosSistema/:idUsuario/sesion', async (req, res) => {
  try {
    const { idUsuario } = req.params;

    if (!idUsuario) {
      return res.status(400).json({ error: 400, message: 'Falta idUsuario.' });
    }

    const user = normalizeUsuarioPayload(await usuario.obtenerUsuarioSesionPorId(Number(idUsuario)));
    if (!user) {
      return res.status(404).json({ error: 404, message: 'El usuario no existe.' });
    }

    return res.status(200).json({
      success: true,
      usuario: user,
    });
  } catch (err) {
    console.error(err);
    return res.sendStatus(500);
  }
});

router.get('/stream/usuarios/:idUsuario', async (req, res) => {
  const { idUsuario } = req.params;

  if (!idUsuario) {
    return res.status(400).json({ error: 400, message: 'Falta idUsuario.' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  if (typeof res.flushHeaders === 'function') {
    res.flushHeaders();
  }

  addUserEventStream(idUsuario, res);
  res.write(`data: ${JSON.stringify({ type: 'connected', idUsuario: Number(idUsuario) })}\n\n`);

  const keepAlive = setInterval(() => {
    try {
      res.write(': keepalive\n\n');
    } catch (error) {
      clearInterval(keepAlive);
    }
  }, 25000);

  req.on('close', () => {
    clearInterval(keepAlive);
    removeUserEventStream(idUsuario, res);
    res.end();
  });
});

router.get('/usuariosSistema', async (req, res) => {
  try {
    const users = await usuario.listarUsuarios();
    return res.status(200).json(users);
  } catch (err) {
    if (err === 404) {
      return res.status(404).json({ error: 404, message: 'El usuario no existe.' });
    }
    if (err === 409) {
      return res.status(409).json({ error: 409, message: 'Solo los usuarios cliente pueden tener eventos asignados.' });
    }
    console.error(err);
    return res.sendStatus(500);
  }
});

router.get('/rolesSistema', async (req, res) => {
  try {
    const roles = await usuario.listarRoles();
    return res.status(200).json(roles);
  } catch (err) {
    console.error(err);
    return res.sendStatus(500);
  }
});

router.post('/usuariosSistema', async (req, res) => {
  try {
    const { nombres, apellidos, user, rol, telefon } = req.body;

    if (!nombres || !apellidos || !user || !rol || !telefon) {
      return res.status(400).json({ error: 400, message: 'Faltan datos requeridos del usuario.' });
    }

    const created = await usuario.crearUsuario({
      nombres: String(nombres).trim(),
      apellidos: String(apellidos).trim(),
      user: String(user).trim(),
      rol: Number(rol),
      telefon: String(telefon).trim(),
    });

    return res.status(201).json({
      success: true,
      usuario: created.usuario,
      tempPassword: created.tempPassword,
    });
  } catch (err) {
    if (err === 409) {
      return res.status(409).json({ error: 409, message: 'Ya existe un usuario con ese identificador.' });
    }
    console.error(err);
    return res.sendStatus(500);
  }
});

router.put('/usuariosSistema/:idUsuario', async (req, res) => {
  try {
    const { idUsuario } = req.params;
    const { nombres, apellidos, user, rol, telefon, estado } = req.body;

    if (!idUsuario || !nombres || !apellidos || !user || !rol || !telefon) {
      return res.status(400).json({ error: 400, message: 'Faltan datos requeridos del usuario.' });
    }

    const updated = await usuario.actualizarUsuario({
      idUsuario: Number(idUsuario),
      nombres: String(nombres).trim(),
      apellidos: String(apellidos).trim(),
      user: String(user).trim(),
      rol: Number(rol),
      telefon: String(telefon).trim(),
      estado: Number(estado ?? 1) ? 1 : 0,
    });

    return res.status(200).json({
      success: true,
      usuario: updated,
    });
  } catch (err) {
    if (err === 409) {
      return res.status(409).json({ error: 409, message: 'Ya existe un usuario con ese identificador.' });
    }
    console.error(err);
    return res.sendStatus(500);
  }
});

router.post('/usuariosSistema/:idUsuario/regenerarPassTemp', async (req, res) => {
  try {
    const { idUsuario } = req.params;

    if (!idUsuario) {
      return res.status(400).json({ error: 400, message: 'Falta idUsuario.' });
    }

    const result = await usuario.regenerarPasswordTemporal({
      idUsuario: Number(idUsuario),
    });

    return res.status(200).json(result);
  } catch (err) {
    if (err === 404) {
      return res.status(404).json({ error: 404, message: 'El usuario no existe.' });
    }
    console.error(err);
    return res.sendStatus(500);
  }
});

router.post('/usuariosSistema/asignarEvento', async (req, res) => {
  try {
    const { idUsuario, idEvento } = req.body;

    if (!idUsuario || !idEvento) {
      return res.status(400).json({ error: 400, message: 'Faltan idUsuario o idEvento.' });
    }

    const result = await usuario.asignarUsuarioAEvento({
      idUsuario: Number(idUsuario),
      idEvento: String(idEvento).trim(),
    });

    const refreshedUser = normalizeUsuarioPayload(await usuario.obtenerUsuarioSesionPorId(Number(idUsuario)));
    emitUserEvent(idUsuario, {
      type: 'usuario_eventos_actualizados',
      idUsuario: Number(idUsuario),
      idEvento: String(idEvento).trim(),
    });

    return res.status(200).json({
      success: true,
      alreadyAssigned: Boolean(result?.alreadyAssigned),
      usuario: refreshedUser,
    });
  } catch (err) {
    if (err === 404) {
      return res.status(404).json({ error: 404, message: 'El usuario no existe.' });
    }
    if (err === 409) {
      return res.status(409).json({ error: 409, message: 'Solo los usuarios cliente pueden tener eventos asignados.' });
    }
    console.error(err);
    return res.sendStatus(500);
  }
});

router.post('/usuariosSistema/quitarEvento', async (req, res) => {
  try {
    const { idUsuario, idEvento } = req.body;

    if (!idUsuario || !idEvento) {
      return res.status(400).json({ error: 400, message: 'Faltan idUsuario o idEvento.' });
    }

    await usuario.quitarUsuarioDeEvento({
      idUsuario: Number(idUsuario),
      idEvento: String(idEvento).trim(),
    });

    const refreshedUser = normalizeUsuarioPayload(await usuario.obtenerUsuarioSesionPorId(Number(idUsuario)));
    emitUserEvent(idUsuario, {
      type: 'usuario_eventos_actualizados',
      idUsuario: Number(idUsuario),
      idEvento: String(idEvento).trim(),
    });

    return res.status(200).json({
      success: true,
      usuario: refreshedUser,
    });
  } catch (err) {
    console.error(err);
    return res.sendStatus(500);
  }
});

router.post('/usuario/cambiarPasswordTemporal', async (req, res) => {
  try {
    const { user, passActual, passNueva } = req.body;

    if (!user || !passActual || !passNueva) {
      return res.status(400).json({ error: 400, message: 'Faltan datos requeridos.' });
    }

    if (String(passNueva).length < 8) {
      return res.status(400).json({ error: 400, message: 'La nueva contraseña debe tener al menos 8 caracteres.' });
    }

    await usuario.cambiarPasswordTemporal({
      user: String(user).trim(),
      passActual: String(passActual),
      passNueva: String(passNueva),
    });

    const loggedUser = normalizeUsuarioPayload(await usuario.loginUsuario(String(user).trim(), String(passNueva)));

    return res.status(200).json({
      success: true,
      userId: loggedUser.id,
      usuario: loggedUser,
    });
  } catch (err) {
    switch (err) {
      case 401:
        return res.status(401).json({ error: 401, message: 'La contraseña temporal es incorrecta.' });
      case 404:
        return res.status(404).json({ error: 404, message: 'El usuario no existe.' });
      case 409:
        return res.status(409).json({ error: 409, message: 'El usuario no tiene un cambio de contraseña temporal pendiente.' });
      default:
        console.error(err);
        return res.sendStatus(500);
    }
  }
});




  
  //____________________________ EVENTOS ___________________________________

router.post('/crearEvento', async (req, res) => {
  try {
    const { id, nombre, idTipoEvento, fechaHoraRecepcion, idLugarRecepcion } = req.body;

    if (!id || !nombre || !idTipoEvento || !fechaHoraRecepcion || !idLugarRecepcion) {
      return res.status(400).json({ error: 'Faltan datos requeridos' });
    }

    const resultado = await general.crearEvento(id, nombre, idTipoEvento, fechaHoraRecepcion, idLugarRecepcion);

    res.status(200).json({ success: true, idEvento: id });
  } catch (e) {
    console.error('❌ Error en /crearEvento:', e);
    res.sendStatus(500);
  }
});


router.get('/tiposEvento', async (req, res) => {
  try {
    const tipos = await general.tiposEvento();
    res.json(tipos);
  } catch (e) {
    console.error('❌ Error en /tiposEvento:', e);
    res.sendStatus(500);
  }
});

router.get('/lugares', async (req, res) => {
  try {
    const lugares = await general.lugares();
    res.json(lugares);
  } catch (e) {
    console.error('❌ Error en /lugares:', e);
    res.sendStatus(500);
  }
});

router.get('/eventos/activos', async (req, res) => {
  try {
    const eventos = await general.eventosActivos();

    eventos.forEach(e => {
      if (e.imagenPrincipal) {
        e.imagenPrincipal = publicEventoUrl(e.imagenPrincipal);
      }
    });

    res.json(eventos);
  } catch (e) {
    console.error(e);
    res.sendStatus(500);
  }
});

router.get('/eventos/inactivos', async (req, res) => {
  try {
    const eventos = await general.eventosInactivos();

    eventos.forEach(e => {
      if (e.imagenPrincipal) {
        e.imagenPrincipal = publicEventoUrl(e.imagenPrincipal);
      }
    });

    res.json(eventos);
  } catch (e) {
    console.error(e);
    res.sendStatus(500);
  }
});

router.get('/eventos/:idEvento/modulos-cliente', async (req, res) => {
  try {
    const { idEvento } = req.params;

    if (!idEvento) {
      return res.status(400).json({ error: 400, message: 'Falta idEvento.' });
    }

    const evento = await general.eventoXid(String(idEvento).trim());
    if (!evento?.length) {
      return res.status(404).json({ error: 404, message: 'El evento no existe.' });
    }

    const modules = await general.obtenerModulosClientePorEvento(String(idEvento).trim());

    return res.status(200).json({
      idEvento: String(idEvento).trim(),
      modules,
    });
  } catch (e) {
    console.error(e);
    return res.sendStatus(500);
  }
});

router.put('/eventos/:idEvento/modulos-cliente', async (req, res) => {
  try {
    const { idEvento } = req.params;
    const { modules } = req.body || {};

    if (!idEvento || !Array.isArray(modules)) {
      return res.status(400).json({ error: 400, message: 'Se requiere idEvento y un arreglo modules.' });
    }

    const evento = await general.eventoXid(String(idEvento).trim());
    if (!evento?.length) {
      return res.status(404).json({ error: 404, message: 'El evento no existe.' });
    }

    const updatedModules = await general.actualizarModulosClientePorEvento(String(idEvento).trim(), modules);
    try {
      const assignedUserIds = await usuario.obtenerIdsUsuariosClientePorEvento(String(idEvento).trim());
      assignedUserIds.forEach((idUsuario) => {
        emitUserEvent(idUsuario, {
          type: 'usuario_eventos_actualizados',
          idUsuario,
          idEvento: String(idEvento).trim(),
          source: 'modulos_cliente_actualizados',
        });
      });
    } catch (notifyError) {
      console.error('No fue posible emitir SSE tras actualizar modulos del evento.', notifyError);
    }

    return res.status(200).json({
      success: true,
      idEvento: String(idEvento).trim(),
      modules: updatedModules,
    });
  } catch (e) {
    console.error(e);
    return res.sendStatus(500);
  }
});

router.get('/eventos/:idEvento/invitacion-publica-config', async (req, res) => {
  try {
    const { idEvento } = req.params;

    if (!idEvento) {
      return res.status(400).json({ error: 400, message: 'Falta idEvento.' });
    }

    const evento = await general.eventoXid(String(idEvento).trim());
    if (!evento?.length) {
      return res.status(404).json({ error: 404, message: 'El evento no existe.' });
    }

    const config = await general.obtenerInvitacionPublicaEvento(String(idEvento).trim());
    return res.status(200).json(config);
  } catch (e) {
    console.error(e);
    return res.sendStatus(500);
  }
});

router.put('/eventos/:idEvento/invitacion-publica-config', async (req, res) => {
  try {
    const { idEvento } = req.params;

    if (!idEvento) {
      return res.status(400).json({ error: 400, message: 'Falta idEvento.' });
    }

    const config = await general.actualizarInvitacionPublicaEvento(String(idEvento).trim(), req.body || {});
    return res.status(200).json(config);
  } catch (e) {
    if (e === 404) {
      return res.status(404).json({ error: 404, message: 'El evento no existe.' });
    }

    console.error(e);
    return res.sendStatus(500);
  }
});

router.get('/public/invitaciones/:idInvitacion/:idInvitado', async (req, res) => {
  try {
    const payload = await general.obtenerInvitacionPublicaPorIds(req.params.idInvitacion, req.params.idInvitado);
    return res.status(200).json(payload);
  } catch (e) {
    if (e === 404) {
      return res.status(404).json({ error: 404, message: 'No encontramos la invitacion solicitada.' });
    }

    console.error(e);
    return res.sendStatus(500);
  }
});

router.put('/public/invitaciones/:idInvitacion/confirmacion', async (req, res) => {
  try {
    const { respuestas } = req.body || {};
    const payload = await general.confirmarInvitacionPublica(req.params.idInvitacion, respuestas);
    return res.status(200).json(payload);
  } catch (e) {
    if (e === 409) {
      return res.status(409).json({ error: 409, message: 'El plazo para confirmar asistencia ha finalizado.' });
    }

    if (e === 400) {
      return res.status(400).json({ error: 400, message: 'Envía respuestas válidas, sin integrantes repetidos.' });
    }

    if (e === 404) {
      return res.status(404).json({ error: 404, message: 'Uno o mas invitados no pertenecen a esta invitacion.' });
    }

    console.error(e);
    return res.sendStatus(500);
  }
});


router.post('/eventoXinvitacion', async (req, res, next) => {

    try{
        let results = await general.eventoXinvitacion(req.body.idInvitacion);
        res.json(results);
    }catch(e){
        console.log(e);
        res.sendStatus(500);
    }

});

router.post('/ideventoXinvitacion', async (req, res, next) => {

    try{
        let results = await general.ideventoXinvitacion(req.body.idInvitacion);
        res.json(results);
    }catch(e){
        console.log(e);
        res.sendStatus(500);
    }

});

router.get('/mesasXevento/:idEvento', async (req, res, next) => {

    try{
        let results = await general.mesasXevento(req.params.idEvento);
        res.json(results);
    }catch(e){
        console.log(e);
        res.sendStatus(500);
    }

});

router.get('/eventoXid/:idEvento', async (req, res, next) => {

    try{
        let results = await general.eventoXid(req.params.idEvento);
        res.json(results[0]);
    }catch(e){
        console.log(e);
        res.sendStatus(500);
    }

});

router.get('/resumenEvento/:idEvento', async (req, res) => {
  try {
    let results = await general.resumenEvento(req.params.idEvento);
    let evento = results[0];

    if (evento.imagenPrincipal) {
      evento.imagenPrincipal = publicEventoUrl(evento.imagenPrincipal);
    }

    res.json(evento);
  } catch (e) {
    console.log(e);
    res.sendStatus(500);
  }
});

router.get('/eventos/detalle_completo/:idEvento', async (req, res) => {
  try {
    let results = await general.detalleEventoCompleto(req.params.idEvento);
    let evento = results[0];

    if (evento.imagenPrincipal) {
      evento.imagenPrincipal = publicEventoUrl(evento.imagenPrincipal);
    }

    res.json(evento);
  } catch (e) {
    console.log(e);
    res.sendStatus(500);
  }
});



router.get('/invitacionesXevento/:idEvento', async (req, res, next) => {

    try{
        let results = await general.invitacionesXevento(req.params.idEvento);
        res.json(results);
    }catch(e){
        console.log(e);
        res.sendStatus(500);
    }

});

router.get('/invitadosXinvitacion/:idInvitacion', async (req, res, next) => {

    try{
        let results = await general.invitadosXinvitaciones(req.params.idInvitacion);
        res.json(results);
    }catch(e){
        console.log(e);
        res.sendStatus(500);
    }

});

router.get('/invitadosXevento/:idEvento', async (req, res, next) => {

    try{
        let results = await general.invitadosXevento(req.params.idEvento);
        res.json(results);
    }catch(e){
        console.log(e);
        res.sendStatus(500);
    }

});

router.get('/eventos/:idEvento/invitados', async (req, res) => {
  try {
    const results = await general.invitadosClienteXevento(req.params.idEvento);
    res.json(results);
  } catch (e) {
    console.log(e);
    res.sendStatus(500);
  }
});

router.post('/eventos/:idEvento/invitados', async (req, res) => {
  try {
    const { nombre, telefono, idPaisTelefono, whatsapp, parentescoId, grupoEdadId } = req.body;

    if (!String(nombre || '').trim()) {
      return res.status(400).json({ message: 'El nombre del invitado es obligatorio.' });
    }

    const parentescoParsed = parseOptionalPositiveInt(parentescoId);
    const grupoEdadParsed = parseOptionalPositiveInt(grupoEdadId);
    const paisTelefonoParsed = parseOptionalPositiveInt(idPaisTelefono);

    if (Number.isNaN(parentescoParsed)) {
      return res.status(400).json({ message: 'parentescoId invalido.' });
    }

    if (Number.isNaN(grupoEdadParsed)) {
      return res.status(400).json({ message: 'grupoEdadId invalido.' });
    }
    if (Number.isNaN(paisTelefonoParsed) || !paisTelefonoParsed) {
      return res.status(400).json({ message: 'idPaisTelefono invalido.' });
    }

    const result = await general.addInvitadoEvento(
      req.params.idEvento,
      String(nombre).trim(),
      telefono,
      paisTelefonoParsed,
      Boolean(whatsapp),
      parentescoParsed,
      grupoEdadParsed
    );

    res.status(201).json(result);
  } catch (e) {
    console.log(e);
    res.sendStatus(500);
  }
});

router.put('/eventos/:idEvento/invitados/:idInvitado', async (req, res) => {
  try {
    const { nombre, telefono, idPaisTelefono, whatsapp, parentescoId, grupoEdadId, estadoAsistenciaId } = req.body;

    if (!String(nombre || '').trim()) {
      return res.status(400).json({ message: 'El nombre del invitado es obligatorio.' });
    }

    const parentescoParsed = parseOptionalPositiveInt(parentescoId);
    const grupoEdadParsed = parseOptionalPositiveInt(grupoEdadId);
    const paisTelefonoParsed = parseOptionalPositiveInt(idPaisTelefono);

    if (Number.isNaN(parentescoParsed)) {
      return res.status(400).json({ message: 'parentescoId invalido.' });
    }

    if (Number.isNaN(grupoEdadParsed)) {
      return res.status(400).json({ message: 'grupoEdadId invalido.' });
    }
    if (Number.isNaN(paisTelefonoParsed) || !paisTelefonoParsed) {
      return res.status(400).json({ message: 'idPaisTelefono invalido.' });
    }

    const result = await general.actualizarInvitadoEvento(
      req.params.idEvento,
      req.params.idInvitado,
      String(nombre).trim(),
      telefono,
      paisTelefonoParsed,
      Boolean(whatsapp),
      parentescoParsed,
      grupoEdadParsed,
      estadoAsistenciaId
    );

    res.json(result);
  } catch (e) {
    if (e === 404) {
      return res.status(404).json({ message: 'El invitado no pertenece al evento.' });
    }

    console.log(e);
    res.sendStatus(500);
  }
});

router.delete('/eventos/:idEvento/invitados/:idInvitado', async (req, res) => {
  try {
    await general.eliminarInvitadoEvento(req.params.idEvento, req.params.idInvitado);
    res.json({ ok: true });
  } catch (e) {
    if (e === 404) {
      return res.status(404).json({ message: 'El invitado no pertenece al evento.' });
    }

    console.log(e);
    res.sendStatus(500);
  }
});

router.get('/eventos/:idEvento/invitaciones', async (req, res) => {

    try {
        const invitaciones = await general.invitacionesXevento(req.params.idEvento);
        const detalle = await Promise.all((invitaciones || []).map((item) => general.eventoXinvitacion(item.id)));
        res.json(detalle);
    } catch (e) {
        console.log(e);
        res.sendStatus(500);
    }

});

router.post('/eventos/:idEvento/invitaciones', async (req, res) => {

    try {
        const label = String(req.body.label || '').trim();
        const mensajePersonalizado = String(req.body.mensajePersonalizado || '').trim();
        const invitacion = await general.crearInvitacionEvento(req.params.idEvento, generaCodigo(10), label, mensajePersonalizado);
        res.status(201).json(invitacion);
    } catch (e) {
        console.log(e);
        res.sendStatus(500);
    }

});

router.put('/eventos/:idEvento/invitaciones/:idInvitacion', async (req, res) => {

    try {
        const label = String(req.body.label || '').trim();
        const mensajePersonalizado = String(req.body.mensajePersonalizado || '').trim();
        const enviada = parseOptionalBoolean(req.body.enviada);
        await general.actualizarInvitacionEvento(req.params.idEvento, req.params.idInvitacion, label, mensajePersonalizado, enviada);
        const invitacion = await general.eventoXinvitacion(req.params.idInvitacion);
        res.json(invitacion);
    } catch (e) {
        if (e === 404) {
            return res.status(404).json({ message: 'La invitacion no pertenece al evento.' });
        }

        console.log(e);
        res.sendStatus(500);
    }

});

router.post('/eventos/:idEvento/invitaciones/:idInvitacion/invitados', async (req, res) => {

    try {
        const { idInvitado, principal } = req.body;

        if (!idInvitado) {
            return res.status(400).json({ message: 'Falta idInvitado.' });
        }

        await general.asignarInvitadoEventoAInvitacion(req.params.idEvento, req.params.idInvitacion, idInvitado, Boolean(principal));
        const invitacion = await general.eventoXinvitacion(req.params.idInvitacion);
        res.json(invitacion);
    } catch (e) {
        if (e === 404) {
            return res.status(404).json({ message: 'El invitado o la invitacion no pertenecen al evento.' });
        }

        console.log(e);
        res.sendStatus(500);
    }

});

router.delete('/eventos/:idEvento/invitaciones/:idInvitacion/invitados/:idInvitado', async (req, res) => {

    try {
        await general.quitarInvitadoEventoDeInvitacion(req.params.idEvento, req.params.idInvitacion, req.params.idInvitado);
        const invitacion = await general.eventoXinvitacion(req.params.idInvitacion);
        res.json(invitacion);
    } catch (e) {
        if (e === 404) {
            return res.status(404).json({ message: 'El invitado no pertenece al evento.' });
        }

        console.log(e);
        res.sendStatus(500);
    }

});

router.put('/eventos/:idEvento/invitaciones/:idInvitacion/principal/:idInvitado', async (req, res) => {

    try {
        await general.definirPrincipalInvitacion(req.params.idEvento, req.params.idInvitacion, req.params.idInvitado);
        const invitacion = await general.eventoXinvitacion(req.params.idInvitacion);
        res.json(invitacion);
    } catch (e) {
        if (e === 404) {
            return res.status(404).json({ message: 'El invitado no hace parte de la invitacion.' });
        }

        console.log(e);
        res.sendStatus(500);
    }

});

router.delete('/eventos/:idEvento/invitaciones/:idInvitacion', async (req, res) => {

    try {
        await general.eliminarInvitacionEvento(req.params.idEvento, req.params.idInvitacion);
        res.json({ ok: true });
    } catch (e) {
        if (e === 404) {
            return res.status(404).json({ message: 'La invitacion no pertenece al evento.' });
        }

        console.log(e);
        res.sendStatus(500);
    }

});

router.post('/addMesa', async (req, res, next) => {

    try{
        let results = await general.addMesa(req.body.idEvento, req.body.numMesa);
        res.json(results);
    }catch(e){
        console.log(e);
        res.sendStatus(500);
    }

});


router.post('/addInvitado', async (req, res, next) => {

    try{
        let results = await general.addInvitado(req.body.idInvitacion, req.body.nombre, req.body.principal, req.body.telefono, req.body.wp, req.body.parentesco, req.body.grupoEdad);
        res.json(results);
    }catch(e){
        console.log(e);
        res.sendStatus(500);
    }

});

router.post('/importInvitacionesExcel', async (req, res, next) => {

    try{
        let results = await general.importInvitacionesExcel(req.body.data, req.body.idEvento);
        res.json(results);
    }catch(e){
        console.log(e);
        res.sendStatus(500);
    }

});

router.post('/updConfirmado', async (req, res, next) => {

    try{
        let results = await general.updConfirmado(req.body.idInvitado, req.body.confirmado);
        res.json(results);
    }catch(e){
        console.log(e);
        res.sendStatus(500);
    }

});

router.post('/updLabelInvitacion', async (req, res, next) => {

    try{
        const label = req.body.label ?? req.body.mensaje;
        let results = await general.updLabelInvitacion(req.body.idInvitacion, label);
        res.json(results);
    }catch(e){
        console.log(e);
        res.sendStatus(500);
    }

});

router.post('/updMensajeInvitacion', async (req, res, next) => {

    try{
        const label = req.body.label ?? req.body.mensaje;
        let results = await general.updLabelInvitacion(req.body.idInvitacion, label);
        res.json(results);
    }catch(e){
        console.log(e);
        res.sendStatus(500);
    }

});

router.post('/delInvitacion', async (req, res, next) => {

    try{
        let results = await general.delInvitacion(req.body.idInvitacion);
        res.json(results);
    }catch(e){
        console.log(e);
        res.sendStatus(500);
    }

});

router.post('/delInvitado', async (req, res, next) => {

    try{
        let results = await general.delInvitado(req.body.idInvitacion, req.body.idInvitado);
        res.json(results);
    }catch(e){
        console.log(e);
        res.sendStatus(500);
    }

});


router.post('/addInvitacion', async (req, res, next) => {

    try{
        let results = await general.addInvitacion(req.body.idEvento, generaCodigo(10));
        res.json(results);
    }catch(e){
        console.log(e);
        res.sendStatus(500);
    }

});

module.exports = router;
