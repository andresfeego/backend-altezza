/** Move only Hero/closing references to the shared event-owned monogram. */
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

async function run() {
  const root = path.resolve(__dirname, '../../..');
  require('dotenv').config({ path: path.join(root, '.env'), quiet: true });
  const host = process.env.ALTEZZA_DB_HOST || '127.0.0.1';
  if (!['localhost', '127.0.0.1', '::1'].includes(host)) throw new Error('Solo base local.');
  const image = '/scrAppaltezza/invitations/bodlauser/cover/laura-sergio-monogram.png';
  fs.accessSync(path.join(root, '_local_storage/invitations/bodlauser/cover/laura-sergio-monogram.png'));
  const db = await require('mysql2/promise').createConnection({ host, port: Number(process.env.ALTEZZA_DB_PORT || 3306), user: process.env.ALTEZZA_DB_USER, password: process.env.ALTEZZA_DB_PASS, database: process.env.ALTEZZA_DB_NAME });
  try {
    await db.beginTransaction();
    const [events] = await db.query('SELECT nombre FROM evento WHERE id=? FOR UPDATE', ['bodlauser']);
    if (!['Laura & Sergio', 'Laura y Sergio'].includes(events[0]?.nombre)) throw new Error('Identidad incorrecta.');
    const [rows] = await db.query('SELECT templateKey, modulesJson FROM evento_invitacion_publica WHERE idEvento=? FOR UPDATE', ['bodlauser']);
    if (rows.length !== 1 || rows[0].templateKey !== 'wedding_lemoncello') throw new Error('Plantilla incorrecta.');
    const before = typeof rows[0].modulesJson === 'string' ? rows[0].modulesJson : JSON.stringify(rows[0].modulesJson);
    const modules = JSON.parse(before);
    for (const [type, field] of [['hero_image_1', 'logoImage'], ['closing_message', 'imageSrc']]) {
      const matches = modules.filter(module => module.type === type);
      if (matches.length !== 1) throw new Error(`Módulo ambiguo: ${type}`);
      const config = matches[0].config;
      if (!config || !['/images/invitaciones/bodlauser/laura-sergio-monogram.png', image].includes(config[field])) throw new Error(`Monograma inesperado: ${type}`);
      config[field] = image;
    }
    if (JSON.stringify(JSON.parse(before)) !== JSON.stringify(modules)) {
      const backup = path.join(os.tmpdir(), `bodlauser-before-monogram-storage-${Date.now()}.json`);
      fs.writeFileSync(backup, before, { mode: 0o600 });
      await db.query('UPDATE evento_invitacion_publica SET modulesJson=?,updatedAt=CURRENT_TIMESTAMP WHERE idEvento=?', [JSON.stringify(modules), 'bodlauser']);
      console.log('Backup:', backup);
    }
    await db.commit();
    console.log(JSON.stringify({ event: 'bodlauser', image, modules: ['hero_image_1', 'closing_message'] }));
  } catch (error) { await db.rollback(); throw error; }
  finally { await db.end(); }
}
if (require.main === module) run().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { run };
