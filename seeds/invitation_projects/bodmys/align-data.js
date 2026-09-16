/** Migrate only the local invitation's module configuration; never reseed guests/events. */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function alignModules(input, eventName) {
  const modules = structuredClone(input).sort((a, b) => Number(a.order) - Number(b.order));
  const hero = modules.find((module) => module.type === 'hero_image_1');
  const family = modules.find((module) => module.type === 'couple_family');
  const details = modules.find((module) => module.type === 'event_details');
  const attendance = modules.find((module) => module.type === 'attendance_confirm');

  if (hero?.config?.message) {
    // The introduction is content in its own existing module, not an expanded hero.
    modules.splice(modules.indexOf(hero) + 1, 0, {
      type: 'welcome_message', enabled: hero.enabled !== false,
      config: { title: 'Una vida en común', subtitle: hero.config.message },
    });
    delete hero.config.message;
  }
  if (hero?.config?.imageSrc) {
    modules.splice(modules.indexOf(hero) + 1, 0, {
      type: 'simple_image', enabled: hero.enabled !== false,
      config: { imageSrc: hero.config.imageSrc, alt: hero.config.imageAlt || eventName },
    });
  }
  if (hero) {
    hero.config ||= {};
    hero.config.text1 ??= 'Nos casamos';
    hero.config.backgroundImage ??= modules.find((module) => module.type === 'envelop_intro')?.config?.backgroundSrc || '';
    for (const key of ['brideName', 'groomName', 'brideFullName', 'groomFullName', 'imageSrc', 'imageAlt']) delete hero.config[key];
  }
  if (family?.config?.message) {
    if (!details) throw new Error('Falta event_details para conservar la frase de ceremonia.');
    details.config ||= {};
    details.config.ceremonyMessage = [details.config.ceremonyMessage, family.config.message].filter(Boolean).join('\n\n');
    delete family.config.message;
  }
  if (family) {
    family.config ||= {};
    family.config.coupleLabel ??= 'Con quienes nos han acompañado';
  }
  if (attendance?.config?.introMessage) {
    attendance.config.helperText = [attendance.config.introMessage, attendance.config.helperText].filter(Boolean).join('\n\n');
    delete attendance.config.introMessage;
  }
  if (!modules.some((module) => module.type === 'closing_message')) {
    modules.push({ type: 'closing_message', enabled: true, config: { message: `Con mucho cariño,\n${eventName}` } });
  }
  return modules.map((module, index) => ({ ...module, order: index + 1 }));
}

async function main() {
  require('dotenv').config({ path: path.resolve(__dirname, '../../../.env'), quiet: true });
  const host = process.env.ALTEZZA_DB_HOST || '127.0.0.1';
  if (!['localhost', '127.0.0.1', '::1'].includes(host)) throw new Error('La alineación solo permite una base local.');
  const db = await require('mysql2/promise').createConnection({
    host, port: Number(process.env.ALTEZZA_DB_PORT || 3306),
    user: process.env.ALTEZZA_DB_USER, password: process.env.ALTEZZA_DB_PASS,
    database: process.env.ALTEZZA_DB_NAME, charset: 'utf8mb4',
  });
  try {
    await db.beginTransaction();
    const [[row]] = await db.query('SELECT modulesJson FROM evento_invitacion_publica WHERE idEvento=? FOR UPDATE', ['bodmys']);
    const [[event]] = await db.query('SELECT nombre FROM evento WHERE id=? FOR UPDATE', ['bodmys']);
    if (!row || !['Mayra & Samuel', 'Mayra y Samuel'].includes(event?.nombre)) throw new Error('No se encontró el evento esperado.');
    const before = typeof row.modulesJson === 'string' ? JSON.parse(row.modulesJson) : row.modulesJson;
    const after = alignModules(before, event.nombre);
    const backup = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'altezza-bodmys-')), 'modules-before.json');
    fs.writeFileSync(backup, JSON.stringify(before, null, 2) + '\n');
    await db.query('UPDATE evento_invitacion_publica SET modulesJson=?, updatedAt=CURRENT_TIMESTAMP WHERE idEvento=?', [JSON.stringify(after), 'bodmys']);
    await db.commit();
    console.log(JSON.stringify({ eventId: 'bodmys', modules: after.map(({ type, enabled }) => ({ type, enabled })), backup }, null, 2));
  } catch (error) {
    await db.rollback();
    throw error;
  } finally { await db.end(); }
}

module.exports = { alignModules };
if (require.main === module) main().catch((error) => { console.error(error.message); process.exitCode = 1; });
