/** Repeatable, local-only content correction. No schema or RSVP changes. */
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env'), quiet: true });
const mysql = require('mysql2/promise');
const phrase = 'Celebramos nuestro amor y queremos compartirlo con nuestras personas favoritas.';

async function run() {
  const host = process.env.ALTEZZA_DB_HOST || '127.0.0.1';
  if (!['127.0.0.1', 'localhost', '::1'].includes(host)) throw new Error('Solo base local.');
  const db = await mysql.createConnection({ host, port: Number(process.env.ALTEZZA_DB_PORT || 3306), user: process.env.ALTEZZA_DB_USER, password: process.env.ALTEZZA_DB_PASS, database: process.env.ALTEZZA_DB_NAME });
  try {
    await db.beginTransaction();
    const [event] = await db.query('SELECT nombre FROM evento WHERE id=? FOR UPDATE', ['bodlauser']);
    if (!['Laura & Sergio', 'Laura y Sergio'].includes(event[0]?.nombre)) throw new Error('Identidad de evento incorrecta.');
    const [rows] = await db.query('SELECT templateKey, modulesJson FROM evento_invitacion_publica WHERE idEvento=? FOR UPDATE', ['bodlauser']);
    if (rows[0]?.templateKey !== 'wedding_lemoncello') throw new Error('Plantilla distinta: revisar antes de modificar.');
    const before = typeof rows[0].modulesJson === 'string' ? rows[0].modulesJson : JSON.stringify(rows[0].modulesJson);
    const modules = JSON.parse(before);
    for (const type of ['envelop_intro', 'hero_image_1', 'biblical_quote']) if (modules.filter(m => m.type === type).length !== 1) throw new Error('Módulo ausente o duplicado: ' + type);
    const hero = modules.find(m => m.type === 'hero_image_1');
    const quote = modules.find(m => m.type === 'biblical_quote');
    const envelope = modules.find(m => m.type === 'envelop_intro');
    // Follow the current card seed instead of reverting later Hero design updates.
    const seededHero = JSON.parse(fs.readFileSync(path.join(__dirname, 'modules.json'), 'utf8')).find(module => module.type === 'hero_image_1');
    hero.config = { ...hero.config, ...seededHero.config };
    quote.config = { ...quote.config, passageText: phrase, passageReference: '' };
    // Use the canonical per-invitation label; retain any deliberate custom override.
    if (envelope.config?.invitationLabel === 'INVITATION LABEL TO REPLACE') delete envelope.config.invitationLabel;
    const next = JSON.stringify(modules);
    if (JSON.stringify(JSON.parse(before)) !== next) {
      const backup = path.join(os.tmpdir(), `bodlauser-before-envelope-${Date.now()}.json`);
      fs.writeFileSync(backup, before);
      await db.query('UPDATE evento_invitacion_publica SET modulesJson=?,updatedAt=CURRENT_TIMESTAMP WHERE idEvento=?', [next, 'bodlauser']);
      console.log('Backup:', backup);
    }
    await db.commit();
    console.log('bodlauser: frase corregida; label y fecha usan el contrato compartido.');
  } catch (error) { await db.rollback(); throw error; }
  finally { await db.end(); }
}
run().catch(error => { console.error(error.message); process.exitCode = 1; });
