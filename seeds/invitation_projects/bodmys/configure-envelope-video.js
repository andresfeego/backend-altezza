/** Configure only this event's envelope video, preserving all existing image fallbacks. */
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

function configureEnvelopeVideo(modules, seed) {
  if (!Array.isArray(modules) || modules.filter((module) => module.type === 'envelop_intro').length !== 1) {
    throw new Error('Se esperaba un único módulo de sobre.');
  }
  const backgroundVideoSrc = seed.find((module) => module.type === 'envelop_intro')?.config?.backgroundVideoSrc;
  if (typeof backgroundVideoSrc !== 'string' || !backgroundVideoSrc.trim()) throw new Error('Falta la ruta del video.');
  return modules.map((module) => module.type !== 'envelop_intro' ? module : {
    ...module,
    config: { ...module.config, backgroundVideoSrc: backgroundVideoSrc.trim() },
  });
}

async function main() {
  require('dotenv').config({ path: path.resolve(__dirname, '../../../.env'), quiet: true });
  const host = process.env.ALTEZZA_DB_HOST || '127.0.0.1';
  if (!['localhost', '127.0.0.1', '::1'].includes(host)) throw new Error('Solo se permite una base local.');
  const seed = JSON.parse(fs.readFileSync(path.join(__dirname, 'modules.json'), 'utf8'));
  const videoSrc = seed.find((module) => module.type === 'envelop_intro')?.config?.backgroundVideoSrc;
  const storageRoot = path.resolve(__dirname, '../../../_local_storage');
  const videoFile = path.resolve(storageRoot, String(videoSrc || '').replace(/^\/scrAppaltezza\//, ''));
  if (!videoFile.startsWith(storageRoot + path.sep) || !fs.existsSync(videoFile)) throw new Error('No se encontró el video en almacenamiento local.');
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
    const after = configureEnvelopeVideo(before, seed);
    if (JSON.stringify(before) === JSON.stringify(after)) {
      await db.rollback();
      console.log('El sobre ya tiene configurado este video.');
      return;
    }
    const backup = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'altezza-bodmys-video-')), 'modules-before.json');
    fs.writeFileSync(backup, JSON.stringify(before, null, 2) + '\n');
    await db.query('UPDATE evento_invitacion_publica SET modulesJson=?, updatedAt=CURRENT_TIMESTAMP WHERE idEvento=?', [JSON.stringify(after), 'bodmys']);
    await db.commit();
    console.log(JSON.stringify({ eventId: 'bodmys', backup, backgroundVideoSrc: videoSrc }, null, 2));
  } catch (error) { await db.rollback(); throw error; }
  finally { await db.end(); }
}

module.exports = { configureEnvelopeVideo };
if (require.main === module) main().catch((error) => { console.error(error.message); process.exitCode = 1; });
