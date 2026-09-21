/** Enable this card's date composition and place its calendar after the countdown. */
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

function configureDateSection(modules, seed) {
  if (!Array.isArray(modules) || ['couple_names', 'countdown'].some((type) => modules.filter((m) => m.type === type).length !== 1)) {
    throw new Error('Se esperaba un módulo de nombres y una cuenta regresiva.');
  }
  if (modules.filter((m) => m.type === 'save_the_date_calendar').length > 1 || modules.some((m) => !Number.isFinite(m.order)) || new Set(modules.map((m) => m.order)).size !== modules.length) {
    throw new Error('Hay módulos duplicados o un orden inválido.');
  }
  const countdown = modules.find((m) => m.type === 'countdown');
  const defaults = seed.find((m) => m.type === 'countdown')?.config;
  const calendarSeed = seed.find((m) => m.type === 'save_the_date_calendar');
  if (!defaults || !calendarSeed) throw new Error('Falta la configuración de fecha y calendario.');
  const config = { ...countdown.config };
  if (!Object.hasOwn(config, 'showDate')) config.showDate = defaults.showDate;
  // Update the previous seed title once; later customer edits are preserved.
  if (config.title === 'Cada vez más cerca') config.title = defaults.title;
  const calendar = modules.find((m) => m.type === 'save_the_date_calendar') || { ...calendarSeed, config: { ...calendarSeed.config } };
  const ordered = modules.filter((m) => !['countdown', 'save_the_date_calendar'].includes(m.type)).sort((a, b) => a.order - b.order);
  ordered.splice(ordered.findIndex((m) => m.type === 'couple_names') + 1, 0, { ...countdown, config }, calendar);
  return ordered.map((m, index) => ({ ...m, order: index + 1 }));
}

async function main() {
  require('dotenv').config({ path: path.resolve(__dirname, '../../../.env'), quiet: true });
  const host = process.env.ALTEZZA_DB_HOST || '127.0.0.1';
  if (!['localhost', '127.0.0.1', '::1'].includes(host)) throw new Error('Solo se permite una base local.');
  const seed = JSON.parse(fs.readFileSync(path.join(__dirname, 'modules.json'), 'utf8'));
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
    const after = configureDateSection(before, seed);
    if (JSON.stringify(before) === JSON.stringify(after)) {
      await db.rollback();
      console.log('Fecha y calendario ya configurados.');
      return;
    }
    const backup = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'altezza-bodmys-date-section-')), 'modules-before.json');
    fs.writeFileSync(backup, JSON.stringify(before, null, 2) + '\n');
    await db.query('UPDATE evento_invitacion_publica SET modulesJson=?, updatedAt=CURRENT_TIMESTAMP WHERE idEvento=?', [JSON.stringify(after), 'bodmys']);
    await db.commit();
    console.log(JSON.stringify({ eventId: 'bodmys', backup, modules: after.filter((m) => ['countdown', 'save_the_date_calendar'].includes(m.type)) }, null, 2));
  } catch (error) { await db.rollback(); throw error; }
  finally { await db.end(); }
}

module.exports = { configureDateSection };
if (require.main === module) main().catch((error) => { console.error(error.message); process.exitCode = 1; });
