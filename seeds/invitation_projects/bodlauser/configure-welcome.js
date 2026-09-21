/** Repeatable local update: insert the shared welcome module immediately after Hero. */
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env'), quiet: true });
const mysql = require('mysql2/promise');

async function run() {
  const host = process.env.ALTEZZA_DB_HOST || '127.0.0.1';
  if (!['127.0.0.1', 'localhost', '::1'].includes(host)) throw new Error('Solo base local.');
  const db = await mysql.createConnection({ host, port: Number(process.env.ALTEZZA_DB_PORT || 3306), user: process.env.ALTEZZA_DB_USER, password: process.env.ALTEZZA_DB_PASS, database: process.env.ALTEZZA_DB_NAME });
  try {
    await db.beginTransaction();
    const [events] = await db.query('SELECT nombre FROM evento WHERE id=? FOR UPDATE', ['bodlauser']);
    if (!['Laura & Sergio', 'Laura y Sergio'].includes(events[0]?.nombre)) throw new Error('Identidad de evento incorrecta.');
    const [rows] = await db.query('SELECT templateKey, modulesJson FROM evento_invitacion_publica WHERE idEvento=? FOR UPDATE', ['bodlauser']);
    if (rows.length !== 1 || rows[0].templateKey !== 'wedding_lemoncello') throw new Error('Configuración o plantilla distinta.');
    const before = typeof rows[0].modulesJson === 'string' ? rows[0].modulesJson : JSON.stringify(rows[0].modulesJson);
    const modules = JSON.parse(before).sort((a, b) => a.order - b.order);
    if (modules.filter(module => module.type === 'welcome_message').length > 1) throw new Error('Bienvenida duplicada.');
    const seed = JSON.parse(fs.readFileSync(path.join(__dirname, 'modules.json'), 'utf8')).find(module => module.type === 'welcome_message');
    if (!seed) throw new Error('Falta configuración de bienvenida.');
    const existing = modules.find(module => module.type === 'welcome_message');
    const nextModules = modules.filter(module => module.type !== 'welcome_message');
    const hero = nextModules.findIndex(module => module.type === 'hero_image_1');
    if (hero < 0) throw new Error('Hero ausente.');
    nextModules.splice(hero + 1, 0, { ...seed, ...existing, enabled: true, config: { ...existing?.config, ...seed.config } });
    nextModules.forEach((module, index) => { module.order = index + 1; });
    const next = JSON.stringify(nextModules);
    if (JSON.stringify(JSON.parse(before)) !== next) {
      const backup = path.join(os.tmpdir(), `bodlauser-before-welcome-${Date.now()}.json`);
      fs.writeFileSync(backup, before);
      await db.query('UPDATE evento_invitacion_publica SET modulesJson=?,updatedAt=CURRENT_TIMESTAMP WHERE idEvento=?', [next, 'bodlauser']);
      console.log('Backup:', backup);
    }
    await db.commit();
    console.log(JSON.stringify({ event: 'bodlauser', modules: nextModules.map(({ type, order }) => ({ type, order })), welcome: seed.config }));
  } catch (error) { await db.rollback(); throw error; }
  finally { await db.end(); }
}
run().catch(error => { console.error(error.message); process.exitCode = 1; });
