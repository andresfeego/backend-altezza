/** Local-only soundtrack configuration; preserves all visual modules and guest data. */
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const AUDIO_SRC = '/scrAppaltezza/invitations/bodlauser/music/carla-morrison-eres-tu.mp3';

function configureMusic(modules) {
  if (!Array.isArray(modules)) throw new Error('Lista de módulos inválida.');
  const next = structuredClone(modules);
  const existing = next.filter(item => item.type === 'music_player');
  if (existing.length > 1) throw new Error('Música duplicada.');
  const music = existing[0] || { type: 'music_player', order: Math.max(0, ...next.map(item => Number(item.order) || 0)) + 1 };
  music.enabled = true;
  music.config = { ...music.config, title: 'Nuestra canción', trackLabel: 'Eres tú · Carla Morrison', audioSrc: AUDIO_SRC, autoplay: true, initiallyMuted: false };
  if (!existing.length) next.push(music);
  return next;
}

async function run() {
  const root = path.resolve(__dirname, '../../..');
  require('dotenv').config({ path: path.join(root, '.env'), quiet: true });
  const host = process.env.ALTEZZA_DB_HOST || '127.0.0.1';
  if (!['localhost', '127.0.0.1', '::1'].includes(host)) throw new Error('Solo base local.');
  if (!fs.existsSync(path.join(root, '_local_storage/invitations/bodlauser/music/carla-morrison-eres-tu.mp3'))) throw new Error('Falta el MP3 local.');
  const db = await require('mysql2/promise').createConnection({ host, port: Number(process.env.ALTEZZA_DB_PORT || 3306), user: process.env.ALTEZZA_DB_USER, password: process.env.ALTEZZA_DB_PASS, database: process.env.ALTEZZA_DB_NAME });
  try {
    await db.beginTransaction();
    const [events] = await db.query('SELECT nombre FROM evento WHERE id=? FOR UPDATE', ['bodlauser']);
    if (!['Laura & Sergio', 'Laura y Sergio'].includes(events[0]?.nombre)) throw new Error('Identidad incorrecta.');
    const [rows] = await db.query('SELECT templateKey, modulesJson FROM evento_invitacion_publica WHERE idEvento=? FOR UPDATE', ['bodlauser']);
    if (rows.length !== 1 || rows[0].templateKey !== 'wedding_lemoncello') throw new Error('Plantilla incorrecta.');
    const before = typeof rows[0].modulesJson === 'string' ? rows[0].modulesJson : JSON.stringify(rows[0].modulesJson);
    const modules = configureMusic(JSON.parse(before));
    if (JSON.stringify(JSON.parse(before)) !== JSON.stringify(modules)) {
      const backup = path.join(os.tmpdir(), `bodlauser-before-music-${Date.now()}.json`);
      fs.writeFileSync(backup, before, { mode: 0o600 });
      await db.query('UPDATE evento_invitacion_publica SET modulesJson=?,updatedAt=CURRENT_TIMESTAMP WHERE idEvento=?', [JSON.stringify(modules), 'bodlauser']);
      console.log('Backup:', backup);
    }
    await db.commit();
    console.log(JSON.stringify({ event: 'bodlauser', audioSrc: AUDIO_SRC, autoplay: true }));
  } catch (error) { try { await db.rollback(); } catch {} throw error; }
  finally { await db.end(); }
}
if (require.main === module) run().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { configureMusic, AUDIO_SRC, run };
