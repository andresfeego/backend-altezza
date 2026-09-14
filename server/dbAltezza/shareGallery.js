const crypto = require('crypto');
const pool = require('./connection.js');

const MODULE_FOLDER = 'mod_share_gallery';
const VISITOR_TTL_DAYS = 30;

function db() {
  return pool.promise();
}

function randomCode(bytes = 18) {
  return crypto.randomBytes(bytes).toString('base64url');
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function toMysqlDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

function buildFrontendAlbumUrl(publicBaseUrl, publicCode) {
  return `${String(publicBaseUrl || '').replace(/\/$/, '')}/share-gallery/${publicCode}`;
}

function buildQrUrl(apiBaseUrl, publicCode) {
  return `${String(apiBaseUrl || '').replace(/\/$/, '')}/api/responseAltezza/public/share-gallery/${publicCode}/qr.svg`;
}

function normalizeAlbum(row) {
  if (!row) return null;
  return {
    id: row.id,
    idEvento: row.idEvento,
    nombre: row.nombre,
    descripcion: row.descripcion,
    logoUrl: row.logoUrl,
    publicCode: row.publicCode,
    publicUrl: row.publicUrl,
    r2Prefix: row.r2Prefix,
    qrUrl: row.qrUrl,
    estado: row.estado,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    mediaCount: Number(row.mediaCount || 0),
    photoCount: Number(row.photoCount || 0),
    videoCount: Number(row.videoCount || 0),
  };
}

function normalizeMedia(row, currentVisitorId = null) {
  if (!row) return null;
  return {
    id: row.id,
    albumId: row.albumId,
    publicCode: row.publicCode,
    uploaderName: row.uploaderName,
    mediaType: row.mediaType,
    mimeType: row.mimeType,
    originalFilename: row.originalFilename,
    sizeBytes: Number(row.sizeBytes || 0),
    internalUrl: row.internalUrl,
    thumbUrl: row.r2KeyThumb ? `${row.internalUrl}?variant=thumb` : null,
    posterUrl: row.r2KeyPoster ? `${row.internalUrl}?variant=poster` : null,
    capturedAt: row.capturedAt,
    fileLastModifiedAt: row.fileLastModifiedAt,
    uploadedAt: row.uploadedAt,
    width: row.width,
    height: row.height,
    durationSeconds: row.durationSeconds === null || row.durationSeconds === undefined ? null : Number(row.durationSeconds),
    status: row.status,
    isMine: currentVisitorId ? Number(row.visitorId) === Number(currentVisitorId) : false,
  };
}

async function uniqueCode(tableName, columnName = 'publicCode', bytes = 18) {
  for (let i = 0; i < 8; i += 1) {
    const code = randomCode(bytes);
    const [rows] = await db().query(`SELECT ${columnName} FROM ${tableName} WHERE ${columnName} = ? LIMIT 1`, [code]);
    if (!rows.length) return code;
  }
  throw new Error(`No fue posible generar codigo unico para ${tableName}.`);
}

async function createAlbum({ idEvento, nombre, descripcion = null, logoUrl = null, createdBy = null, publicBaseUrl = '', apiBaseUrl = '' }) {
  const publicCode = await uniqueCode('evento_album_fotos', 'publicCode', 18);
  const r2Prefix = `${idEvento}/${MODULE_FOLDER}/${publicCode}`;
  const qrUrl = buildQrUrl(apiBaseUrl, publicCode);

  const [result] = await db().query(
    `
    INSERT INTO evento_album_fotos
      (idEvento, nombre, descripcion, logoUrl, publicCode, r2Prefix, qrUrl, estado, createdBy)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'activo', ?)
    `,
    [idEvento, nombre, descripcion || null, logoUrl || null, publicCode, r2Prefix, qrUrl, createdBy || null]
  );

  return getAlbumById(result.insertId, publicBaseUrl, apiBaseUrl);
}

async function listAlbumsByEvent(idEvento, publicBaseUrl = '', apiBaseUrl = '') {
  const [rows] = await db().query(
    `
    SELECT
      a.*,
      COUNT(m.id) AS mediaCount,
      SUM(CASE WHEN m.mediaType = 'image' THEN 1 ELSE 0 END) AS photoCount,
      SUM(CASE WHEN m.mediaType = 'video' THEN 1 ELSE 0 END) AS videoCount
    FROM evento_album_fotos AS a
    LEFT JOIN evento_album_media AS m
      ON m.albumId = a.id AND m.status = 'activo'
    WHERE a.idEvento = ?
    GROUP BY a.id
    ORDER BY a.createdAt DESC, a.id DESC
    `,
    [idEvento]
  );

  return rows.map((row) => normalizeAlbum({
    ...row,
    publicUrl: buildFrontendAlbumUrl(publicBaseUrl, row.publicCode),
    qrUrl: buildQrUrl(apiBaseUrl, row.publicCode),
  }));
}

async function getAlbumById(albumId, publicBaseUrl = '', apiBaseUrl = '') {
  const [rows] = await db().query(
    `
    SELECT
      a.*,
      COUNT(m.id) AS mediaCount,
      SUM(CASE WHEN m.mediaType = 'image' THEN 1 ELSE 0 END) AS photoCount,
      SUM(CASE WHEN m.mediaType = 'video' THEN 1 ELSE 0 END) AS videoCount
    FROM evento_album_fotos AS a
    LEFT JOIN evento_album_media AS m
      ON m.albumId = a.id AND m.status = 'activo'
    WHERE a.id = ?
    GROUP BY a.id
    LIMIT 1
    `,
    [albumId]
  );

  const row = rows[0];
  if (!row) return null;
  return normalizeAlbum({
    ...row,
    publicUrl: buildFrontendAlbumUrl(publicBaseUrl, row.publicCode),
    qrUrl: buildQrUrl(apiBaseUrl, row.publicCode),
  });
}

async function getAlbumByPublicCode(publicCode, publicBaseUrl = '', apiBaseUrl = '') {
  const [rows] = await db().query(
    `
    SELECT
      a.*,
      COUNT(m.id) AS mediaCount,
      SUM(CASE WHEN m.mediaType = 'image' THEN 1 ELSE 0 END) AS photoCount,
      SUM(CASE WHEN m.mediaType = 'video' THEN 1 ELSE 0 END) AS videoCount
    FROM evento_album_fotos AS a
    LEFT JOIN evento_album_media AS m
      ON m.albumId = a.id AND m.status = 'activo'
    WHERE a.publicCode = ?
    GROUP BY a.id
    LIMIT 1
    `,
    [publicCode]
  );

  const row = rows[0];
  if (!row) return null;
  return normalizeAlbum({
    ...row,
    publicUrl: buildFrontendAlbumUrl(publicBaseUrl, row.publicCode),
    qrUrl: buildQrUrl(apiBaseUrl, row.publicCode),
  });
}

async function getVisitorByPublicCode(publicCode) {
  if (!publicCode) return null;
  const [rows] = await db().query(
    'SELECT * FROM evento_album_visitante WHERE publicCode = ? LIMIT 1',
    [publicCode]
  );
  return rows[0] || null;
}

async function ensureVisitor({ visitorCode, displayName = null }) {
  const now = new Date();
  const expiresAt = addDays(now, VISITOR_TTL_DAYS);
  const cleanDisplayName = String(displayName || '').trim().slice(0, 140) || null;

  if (visitorCode) {
    const existing = await getVisitorByPublicCode(visitorCode);
    if (existing) {
      await db().query(
        `
        UPDATE evento_album_visitante
        SET lastSeenAt = NOW(),
            expiresAt = ?,
            displayName = COALESCE(?, displayName)
        WHERE id = ?
        `,
        [toMysqlDate(expiresAt), cleanDisplayName, existing.id]
      );
      return {
        ...existing,
        displayName: cleanDisplayName || existing.displayName,
        expiresAt,
      };
    }
  }

  const publicCode = await uniqueCode('evento_album_visitante', 'publicCode', 18);
  const [result] = await db().query(
    `
    INSERT INTO evento_album_visitante
      (publicCode, displayName, firstSeenAt, lastSeenAt, expiresAt)
    VALUES (?, ?, NOW(), NOW(), ?)
    `,
    [publicCode, cleanDisplayName, toMysqlDate(expiresAt)]
  );

  return {
    id: result.insertId,
    publicCode,
    displayName: cleanDisplayName,
    expiresAt,
  };
}

async function listMedia({ albumId, visitorId = null, page = 1, pageSize = 24, mineOnly = false }) {
  const safePage = Math.max(1, Number(page) || 1);
  const safePageSize = Math.min(60, Math.max(1, Number(pageSize) || 24));
  const offset = (safePage - 1) * safePageSize;
  const params = [albumId];
  let where = 'WHERE albumId = ? AND status = "activo"';

  if (mineOnly && visitorId) {
    where += ' AND visitorId = ?';
    params.push(visitorId);
  }

  const [countRows] = await db().query(
    `SELECT COUNT(*) AS total FROM evento_album_media ${where}`,
    params
  );

  const [rows] = await db().query(
    `
    SELECT *
    FROM evento_album_media
    ${where}
    ORDER BY uploadedAt DESC, id DESC
    LIMIT ? OFFSET ?
    `,
    [...params, safePageSize, offset]
  );

  const total = Number(countRows[0]?.total || 0);
  return {
    page: safePage,
    pageSize: safePageSize,
    total,
    hasMore: offset + rows.length < total,
    items: rows.map((row) => normalizeMedia(row, visitorId)),
  };
}

async function createMediaRecord({ album, visitor, payload }) {
  const mediaPublicCode = payload.mediaPublicCode;
  const internalUrl = `/api/responseAltezza/public/share-gallery/media/${mediaPublicCode}`;

  const [result] = await db().query(
    `
    INSERT INTO evento_album_media
      (
        albumId,
        visitorId,
        publicCode,
        uploaderName,
        mediaType,
        mimeType,
        originalFilename,
        sizeBytes,
        r2KeyOriginal,
        r2KeyThumb,
        r2KeyPoster,
        internalUrl,
        capturedAt,
        fileLastModifiedAt,
        uploadedAt,
        width,
        height,
        durationSeconds,
        status
      )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?, 'activo')
    `,
    [
      album.id,
      visitor?.id || null,
      mediaPublicCode,
      String(payload.uploaderName || visitor?.displayName || '').trim().slice(0, 140) || null,
      payload.mediaType,
      payload.mimeType,
      String(payload.originalFilename || '').slice(0, 255) || null,
      Number(payload.sizeBytes || 0),
      payload.r2KeyOriginal,
      payload.r2KeyThumb || null,
      payload.r2KeyPoster || null,
      internalUrl,
      toMysqlDate(payload.capturedAt),
      toMysqlDate(payload.fileLastModifiedAt),
      Number.isFinite(Number(payload.width)) ? Number(payload.width) : null,
      Number.isFinite(Number(payload.height)) ? Number(payload.height) : null,
      Number.isFinite(Number(payload.durationSeconds)) ? Number(payload.durationSeconds) : null,
    ]
  );

  const [rows] = await db().query(
    'SELECT * FROM evento_album_media WHERE id = ? LIMIT 1',
    [result.insertId]
  );

  return normalizeMedia(rows[0], visitor?.id || null);
}

async function getMediaByPublicCode(publicCode) {
  const [rows] = await db().query(
    `
    SELECT m.*, a.r2Prefix, a.estado AS albumEstado
    FROM evento_album_media AS m
    INNER JOIN evento_album_fotos AS a ON a.id = m.albumId
    WHERE m.publicCode = ?
    LIMIT 1
    `,
    [publicCode]
  );

  return rows[0] || null;
}

module.exports = {
  MODULE_FOLDER,
  VISITOR_TTL_DAYS,
  randomCode,
  createAlbum,
  listAlbumsByEvent,
  getAlbumById,
  getAlbumByPublicCode,
  ensureVisitor,
  listMedia,
  createMediaRecord,
  getMediaByPublicCode,
};
