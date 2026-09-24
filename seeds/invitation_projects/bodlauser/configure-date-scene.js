/** Add the shared countdown/calendar after photos, preserving all event data. */
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const DATE_TYPES = ['countdown', 'save_the_date_calendar'];

function configureDateScene(modules, dateModules) {
  if (!Array.isArray(modules) || modules.filter(m => m.type === 'image_slider_1').length !== 1) throw new Error('Se requiere un módulo de fotos.');
  if (!Array.isArray(dateModules) || DATE_TYPES.some(type => dateModules.filter(m => m.type === type).length !== 1)) throw new Error('Configuración de fecha incompleta.');
  if (DATE_TYPES.some(type => modules.filter(m => m.type === type).length > 1)) throw new Error('Módulos de fecha duplicados.');
  const next = modules.filter(m => !DATE_TYPES.includes(m.type)).sort((a, b) => a.order - b.order);
  const pair = DATE_TYPES.map(type => {
    const fallback = dateModules.find(m => m.type === type);
    const current = modules.find(m => m.type === type);
    return { ...fallback, ...current, enabled: true, config: { ...fallback.config, ...current?.config, ...(type === 'countdown' ? { showDate: true } : {}) } };
  });
  next.splice(next.findIndex(m => m.type === 'image_slider_1') + 1, 0, ...pair);
  return next.map((module, index) => ({ ...module, order: index + 1 }));
}

async function run() {
  require('dotenv').config({ path: path.resolve(__dirname, '../../../.env'), quiet: true });
  const host = process.env.ALTEZZA_DB_HOST || '127.0.0.1';
  if (!['localhost', '127.0.0.1', '::1'].includes(host)) throw new Error('Solo base local.');
  const db = await require('mysql2/promise').createConnection({ host, port: Number(process.env.ALTEZZA_DB_PORT || 3306), user: process.env.ALTEZZA_DB_USER, password: process.env.ALTEZZA_DB_PASS, database: process.env.ALTEZZA_DB_NAME });
  try {
    await db.beginTransaction();
    const [events] = await db.query('SELECT nombre FROM evento WHERE id=? FOR UPDATE', ['bodlauser']);
    if (!['Laura & Sergio', 'Laura y Sergio'].includes(events[0]?.nombre)) throw new Error('Identidad incorrecta.');
    const [rows] = await db.query('SELECT templateKey, modulesJson FROM evento_invitacion_publica WHERE idEvento=? FOR UPDATE', ['bodlauser']);
    if (rows.length !== 1 || rows[0].templateKey !== 'wedding_lemoncello') throw new Error('Plantilla incorrecta.');
    const before = typeof rows[0].modulesJson === 'string' ? rows[0].modulesJson : JSON.stringify(rows[0].modulesJson);
    const defaults = JSON.parse(fs.readFileSync(path.join(__dirname, 'modules.json'), 'utf8')).filter(m => DATE_TYPES.includes(m.type));
    const after = configureDateScene(JSON.parse(before), defaults);
    if (JSON.stringify(JSON.parse(before)) !== JSON.stringify(after)) {
      const backup = path.join(os.tmpdir(), `bodlauser-before-date-scene-${Date.now()}.json`);
      fs.writeFileSync(backup, before, { mode: 0o600 });
      await db.query('UPDATE evento_invitacion_publica SET modulesJson=?,updatedAt=CURRENT_TIMESTAMP WHERE idEvento=?', [JSON.stringify(after), 'bodlauser']);
      console.log('Backup:', backup);
    }
    await db.commit();
    console.log(JSON.stringify({ event: 'bodlauser', modules: after.map(({ type, order }) => ({ type, order })), date: after.filter(m => DATE_TYPES.includes(m.type)) }));
  } catch (error) { await db.rollback(); throw error; }
  finally { await db.end(); }
}
module.exports = { configureDateScene, run };
if (require.main === module) run().catch(error => { console.error(error.message); process.exitCode = 1; });
