/** Local, repeatable Hero content update; keeps the common module contract. */
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
    const [event] = await db.query('SELECT nombre FROM evento WHERE id=? FOR UPDATE', ['bodlauser']);
    if (!['Laura & Sergio', 'Laura y Sergio'].includes(event[0]?.nombre)) throw new Error('Identidad de evento incorrecta.');
    const [rows] = await db.query('SELECT templateKey, modulesJson FROM evento_invitacion_publica WHERE idEvento=? FOR UPDATE', ['bodlauser']);
    if (rows.length !== 1 || rows[0].templateKey !== 'wedding_lemoncello') throw new Error('Configuración o plantilla distinta.');
    const before = typeof rows[0].modulesJson === 'string' ? rows[0].modulesJson : JSON.stringify(rows[0].modulesJson);
    const modules = JSON.parse(before);
    const heroes = modules.filter(module => module.type === 'hero_image_1');
    if (heroes.length !== 1) throw new Error('Hero ausente o duplicado.');
    const seeded = JSON.parse(fs.readFileSync(path.join(__dirname, 'modules.json'), 'utf8')).find(module => module.type === 'hero_image_1');
    heroes[0].config = { ...heroes[0].config, text1: seeded.config.text1, logoImage: seeded.config.logoImage };
    const next = JSON.stringify(modules);
    if (JSON.stringify(JSON.parse(before)) !== next) {
      const backup = path.join(os.tmpdir(), `bodlauser-before-hero-${Date.now()}.json`);
      fs.writeFileSync(backup, before);
      await db.query('UPDATE evento_invitacion_publica SET modulesJson=?,updatedAt=CURRENT_TIMESTAMP WHERE idEvento=?', [next, 'bodlauser']);
      console.log('Backup:', backup);
    }
    await db.commit();
    console.log(JSON.stringify({ event: 'bodlauser', hero: heroes[0].config }));
  } catch (error) { await db.rollback(); throw error; }
  finally { await db.end(); }
}
run().catch(error => { console.error(error.message); process.exitCode = 1; });
