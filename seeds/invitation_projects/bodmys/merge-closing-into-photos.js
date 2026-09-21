/** Move the saved closing copy into the photo module and reuse the hero relief. */
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

function mergeClosingIntoPhotos(modules) {
  if (!Array.isArray(modules)) throw new Error('Se esperaba una lista de módulos.');
  const one = (type) => {
    const matches = modules.filter((m) => m.type === type);
    if (matches.length !== 1) throw new Error(`Se esperaba un único módulo ${type}.`);
    return matches[0];
  };
  const photos = one('instant_photos');
  const closing = one('closing_message');
  const config = { ...photos.config };
  const message = String(closing.config?.message || '');
  if (closing.enabled !== false && Object.hasOwn(config, 'message') && config.message !== message) throw new Error('Hay un texto diferente en las fotos; se conserva sin sobrescribir.');
  if (!Object.hasOwn(config, 'message')) config.message = message;
  if (!Object.hasOwn(config, 'reliefImageSrc')) {
    config.reliefImageSrc = String(one('hero_image_1').config?.backgroundImage || '');
    if (!config.reliefImageSrc) throw new Error('Falta la imagen de relieve del hero.');
  }
  return modules.map((module) => module === photos ? { ...module, config }
    : module === closing ? { ...module, enabled: false } : module);
}

async function main() {
  const backendRoot = path.resolve(__dirname, '../../..');
  require('dotenv').config({ path: path.join(backendRoot, '.env'), quiet: true });
  const host = process.env.ALTEZZA_DB_HOST || '127.0.0.1';
  if (!['localhost', '127.0.0.1', '::1'].includes(host)) throw new Error('Solo se permite una base local.');
  const db = await require('mysql2/promise').createConnection({ host,
    port: Number(process.env.ALTEZZA_DB_PORT || 3306), user: process.env.ALTEZZA_DB_USER,
    password: process.env.ALTEZZA_DB_PASS, database: process.env.ALTEZZA_DB_NAME, charset: 'utf8mb4',
  });
  try {
    await db.beginTransaction();
    const [[event]] = await db.query('SELECT nombre FROM evento WHERE id=? FOR UPDATE', ['bodmys']);
    const [[row]] = await db.query('SELECT modulesJson FROM evento_invitacion_publica WHERE idEvento=? FOR UPDATE', ['bodmys']);
    if (!row || !['Mayra & Samuel', 'Mayra y Samuel'].includes(event?.nombre)) throw new Error('No se encontró el evento esperado.');
    const before = typeof row.modulesJson === 'string' ? JSON.parse(row.modulesJson) : row.modulesJson;
    const after = mergeClosingIntoPhotos(before);
    if (JSON.stringify(before) === JSON.stringify(after)) {
      await db.rollback();
      console.log('Cierre ya integrado en las fotos; se conservan las ediciones posteriores.');
      return;
    }
    const asset = after.find((m) => m.type === 'instant_photos').config.reliefImageSrc;
    if (!asset.startsWith('/scrAppaltezza/invitations/bodmys/')) throw new Error('Recurso de relieve del evento inválido.');
    fs.accessSync(path.join(backendRoot, '_local_storage', asset.replace('/scrAppaltezza/', '')));
    const backup = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'altezza-bodmys-photo-closing-')), 'modules-before.json');
    fs.writeFileSync(backup, JSON.stringify(before, null, 2) + '\n');
    await db.query('UPDATE evento_invitacion_publica SET modulesJson=?, updatedAt=CURRENT_TIMESTAMP WHERE idEvento=?', [JSON.stringify(after), 'bodmys']);
    await db.commit();
    console.log(JSON.stringify({ eventId: 'bodmys', backup, message: after.find((m) => m.type === 'instant_photos').config.message, closingEnabled: false }, null, 2));
  } catch (error) { await db.rollback(); throw error; }
  finally { await db.end(); }
}

module.exports = { mergeClosingIntoPhotos };
if (require.main === module) main().catch((error) => { console.error(error.message); process.exitCode = 1; });
