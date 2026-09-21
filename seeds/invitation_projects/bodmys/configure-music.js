/** Connect the uploaded song to the existing local Mayra/Samuel music module. */
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

async function main() {
  const backendRoot = path.resolve(__dirname, '../../..');
  require('dotenv').config({ path: path.join(backendRoot, '.env'), quiet: true });
  const host = process.env.ALTEZZA_DB_HOST || '127.0.0.1';
  if (!['localhost', '127.0.0.1', '::1'].includes(host)) throw new Error('Solo se permite una base local.');
  const seed = JSON.parse(fs.readFileSync(path.join(__dirname, 'modules.json'), 'utf8'));
  const { audioSrc, trackLabel } = seed.find((module) => module.type === 'music_player').config;
  fs.accessSync(path.join(backendRoot, '_local_storage', decodeURIComponent(audioSrc.replace('/scrAppaltezza/', ''))));
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
    const after = structuredClone(before);
    const matches = after.filter((module) => module.type === 'music_player');
    if (matches.length !== 1) throw new Error('Se esperaba un único módulo music_player.');
    const music = matches[0];
    if (music.config?.audioSrc && music.config.audioSrc !== audioSrc) throw new Error('Hay otra canción configurada; se conserva sin sobrescribir.');
    music.enabled = true;
    music.config = { ...music.config, audioSrc, trackLabel };
    if (JSON.stringify(before) === JSON.stringify(after)) {
      await db.rollback();
      console.log('La canción ya está configurada.');
      return;
    }
    const backup = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'altezza-bodmys-music-')), 'modules-before.json');
    fs.writeFileSync(backup, JSON.stringify(before, null, 2) + '\n');
    await db.query('UPDATE evento_invitacion_publica SET modulesJson=?, updatedAt=CURRENT_TIMESTAMP WHERE idEvento=?', [JSON.stringify(after), 'bodmys']);
    await db.commit();
    console.log(JSON.stringify({ eventId: 'bodmys', backup, music }, null, 2));
  } catch (error) { await db.rollback(); throw error; }
  finally { await db.end(); }
}

if (require.main === module) main().catch((error) => { console.error(error.message); process.exitCode = 1; });
