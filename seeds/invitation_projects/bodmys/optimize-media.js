/** Versioned derivatives for Mayra & Samuel; originals and verified backups are retained. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const backend = path.resolve(__dirname, '../../..');
const frontend = path.resolve(backend, '../altezza');
const manifestFile = path.join(__dirname, 'media-optimized.json');
const hash = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const prefix = '/scrAppaltezza/invitations/bodmys/';

function rewriteMedia(value, replacements) {
  if (typeof value === 'string') return replacements[value] || value;
  if (Array.isArray(value)) return value.map((item) => rewriteMedia(item, replacements));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, rewriteMedia(item, replacements)]));
  return value;
}

function locations() {
  require('dotenv').config({ path: path.join(backend, '.env'), quiet: true });
  const storage = path.resolve(backend, process.env.ALTEZZA_DATA_ROOT || 'data/altezza');
  return { storage, invitation: path.resolve(backend, process.env.ALTEZZA_INVITATIONS_DIR || path.join(storage, 'invitations')), frontend };
}

function verifyManifest(manifest, roots) {
  for (const item of manifest.assets) {
    const root = item.root === 'frontend' ? frontend : roots.invitation;
    if (hash(path.join(root, item.original)) !== item.originalSha256) throw new Error(`El original cambió: ${item.original}`);
    if (hash(path.join(root, item.optimized)) !== item.optimizedSha256) throw new Error(`El derivado cambió: ${item.optimized}`);
  }
}

async function prepare() {
  const roots = locations();
  if (fs.existsSync(manifestFile)) {
    verifyManifest(JSON.parse(fs.readFileSync(manifestFile)), roots);
    console.log('Los derivados ya existen y sus hashes coinciden.');
    return;
  }
  const sharp = require('sharp');
  const ffmpeg = process.env.FFMPEG_BIN || 'ffmpeg';
  execFileSync(ffmpeg, ['-version'], { stdio: 'pipe' });
  const modulesFile = path.join(__dirname, 'modules.json');
  const modules = JSON.parse(fs.readFileSync(modulesFile));
  const sources = new Map();
  const visit = (value) => {
    if (typeof value === 'string' && value.startsWith(prefix)) {
      const relative = `bodmys/${decodeURIComponent(value.slice(prefix.length))}`;
      if (relative.includes('..') || relative.includes('\\')) throw new Error('Ruta de recurso no válida.');
      sources.set(relative, { root: 'storage', original: relative, url: value });
    } else if (value && typeof value === 'object') Object.values(value).forEach(visit);
  };
  modules.filter((module) => module.enabled !== false).forEach((module) => visit(module.config));
  for (const name of ['sello-lacre-abrir-v1.png', 'rsvp-flower-mask-v1.png', 'quote-floral-corner-mask-v1.png', 'cotton-paper-v1.png']) {
    const original = `components/invitaciones-publicas/templates/wedding-oliva/assets/images/${name}`;
    sources.set(original, { root: 'frontend', original });
  }
  const backupParent = path.join(roots.storage, '_backups');
  fs.mkdirSync(backupParent, { recursive: true });
  const backup = fs.mkdtempSync(path.join(backupParent, 'bodmys-media-20260922-'));
  const manifest = { version: 1, eventId: 'bodmys', assets: [] };
  // Back up every source before producing the first derivative.
  for (const item of sources.values()) {
    const source = path.join(item.root === 'frontend' ? frontend : roots.invitation, item.original);
    const target = path.join(backup, item.root, item.original);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(source, target, fs.constants.COPYFILE_EXCL);
    item.originalBytes = fs.statSync(source).size;
    item.originalSha256 = hash(source);
    if (hash(target) !== item.originalSha256) throw new Error('La copia de seguridad no coincide.');
  }
  fs.copyFileSync(modulesFile, path.join(backup, 'seed-modules-before.json'));
  fs.writeFileSync(path.join(backup, 'originals.json'), JSON.stringify([...sources.values()], null, 2));
  for (const item of sources.values()) {
    const root = item.root === 'frontend' ? frontend : roots.invitation;
    const source = path.join(root, item.original);
    const ext = path.extname(source).toLowerCase();
    const mask = /mask|monograma|floral-relief/.test(source);
    const keep = ['.webp', '.jpeg', '.jpg'].includes(ext) && item.originalBytes < 100000;
    item.optimized = keep ? item.original : item.original.replace(/\.[^.]+$/, `-web-v1${ext === '.mp4' ? '.mp4' : ext === '.mp3' ? '.mp3' : '.webp'}`);
    const target = path.join(root, item.optimized);
    if (!keep) {
      if (fs.existsSync(target)) throw new Error(`No se sobrescribe un derivado existente: ${target}`);
      if (ext === '.mp4' || ext === '.mp3') {
        const options = ext === '.mp4'
          ? ['-map', '0:v:0', '-an', '-c:v', 'libx264', '-preset', 'slow', '-crf', '24', '-pix_fmt', 'yuv420p', '-movflags', '+faststart']
          : ['-map', '0:a:0', '-vn', '-c:a', 'libmp3lame', '-b:a', '160k'];
        execFileSync(ffmpeg, ['-nostdin', '-n', '-v', 'error', '-i', source, ...options, '-map_metadata', '-1', target], { stdio: 'pipe', timeout: 180000 });
        execFileSync(ffmpeg, ['-nostdin', '-v', 'error', '-i', target, '-f', 'null', '-'], { stdio: 'pipe', timeout: 60000 });
        item.profile = ext === '.mp4' ? 'h264-crf24-slow-no-audio-faststart' : 'mp3-160kbps';
      } else {
        const metadata = await sharp(source).metadata();
        let transform = sharp(source).rotate();
        const resized = !mask && (metadata.width > 2000 || metadata.height > 2000);
        if (resized) transform = transform.resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true });
        await transform.webp(mask ? { lossless: true, effort: 6 } : { quality: 90, alphaQuality: 100, effort: 6, smartSubsample: true }).toFile(target);
        if (metadata.hasAlpha && !resized) {
          const before = await sharp(source).extractChannel('alpha').raw().toBuffer();
          const after = await sharp(target).extractChannel('alpha').raw().toBuffer();
          if (!before.equals(after)) throw new Error(`Cambió la transparencia: ${source}`);
          item.alphaUnchanged = true;
        }
        const result = await sharp(target).metadata();
        item.dimensions = [result.width, result.height];
        item.profile = mask ? 'webp-lossless' : 'webp-q90';
      }
    } else item.profile = 'keep-existing';
    item.optimizedBytes = fs.statSync(target).size;
    item.optimizedSha256 = hash(target);
    if (item.url) item.optimizedUrl = prefix + item.optimized.slice('bodmys/'.length).split('/').map(encodeURIComponent).join('/');
    manifest.assets.push(item);
    console.log(`${path.basename(source)}: ${item.originalBytes} → ${item.optimizedBytes} bytes`);
  }
  verifyManifest(manifest, roots);
  fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2) + '\n');
  fs.writeFileSync(path.join(backup, 'media-optimized.json'), JSON.stringify(manifest, null, 2) + '\n');
  console.log(JSON.stringify({ backup, before: manifest.assets.reduce((sum, x) => sum + x.originalBytes, 0), after: manifest.assets.reduce((sum, x) => sum + x.optimizedBytes, 0) }));
}

async function apply() {
  const roots = locations();
  const manifest = JSON.parse(fs.readFileSync(manifestFile));
  verifyManifest(manifest, roots);
  const replacements = Object.fromEntries(manifest.assets.filter((x) => x.url).map((x) => [x.url, x.optimizedUrl]));
  const host = process.env.ALTEZZA_DB_HOST || '127.0.0.1';
  if (!['localhost', '127.0.0.1', '::1'].includes(host)) throw new Error('Solo se permite la base local.');
  const db = await require('mysql2/promise').createConnection({ host, port: Number(process.env.ALTEZZA_DB_PORT || 3306), user: process.env.ALTEZZA_DB_USER, password: process.env.ALTEZZA_DB_PASS, database: process.env.ALTEZZA_DB_NAME, charset: 'utf8mb4' });
  try {
    await db.beginTransaction();
    const [[event]] = await db.query('SELECT nombre FROM evento WHERE id=? FOR UPDATE', ['bodmys']);
    const [[before]] = await db.query('SELECT * FROM evento_invitacion_publica WHERE idEvento=? FOR UPDATE', ['bodmys']);
    if (!before || !['Mayra & Samuel', 'Mayra y Samuel'].includes(event?.nombre)) throw new Error('Evento inesperado.');
    const modules = typeof before.modulesJson === 'string' ? JSON.parse(before.modulesJson) : before.modulesJson;
    const after = rewriteMedia(modules, replacements);
    if (JSON.stringify(after) !== JSON.stringify(modules)) {
      const backupParent = path.join(roots.storage, '_backups');
      fs.mkdirSync(backupParent, { recursive: true });
      const backup = fs.mkdtempSync(path.join(backupParent, 'bodmys-media-config-'));
      fs.writeFileSync(path.join(backup, 'event-before.json'), JSON.stringify(before, null, 2), { mode: 0o600 });
      await db.query('UPDATE evento_invitacion_publica SET modulesJson=?, updatedAt=CURRENT_TIMESTAMP WHERE idEvento=?', [JSON.stringify(after), 'bodmys']);
      const [[verified]] = await db.query('SELECT * FROM evento_invitacion_publica WHERE idEvento=?', ['bodmys']);
      const unpack = (value) => typeof value === 'string' ? JSON.parse(value) : value;
      if (JSON.stringify(unpack(verified.modulesJson)) !== JSON.stringify(after)) throw new Error('La configuración no coincide.');
      for (const key of Object.keys(before).filter((key) => !['modulesJson', 'updatedAt'].includes(key))) {
        if (JSON.stringify(before[key]) !== JSON.stringify(verified[key])) throw new Error(`Cambió otro campo: ${key}`);
      }
      await db.commit();
      console.log(`Configuración actualizada; respaldo: ${backup}`);
    } else { await db.rollback(); console.log('La configuración ya utiliza los derivados.'); }
    const seedFile = path.join(__dirname, 'modules.json');
    const seed = JSON.parse(fs.readFileSync(seedFile));
    fs.writeFileSync(seedFile, JSON.stringify(rewriteMedia(seed, replacements), null, 2) + '\n');
  } catch (error) { await db.rollback(); throw error; }
  finally { await db.end(); }
}

module.exports = { rewriteMedia, verifyManifest };
if (require.main === module) {
  const action = process.argv[2];
  (action === '--prepare' ? prepare() : action === '--apply' ? apply() : Promise.reject(new Error('Usa --prepare o --apply.'))).catch((error) => { console.error(error.message); process.exitCode = 1; });
}
