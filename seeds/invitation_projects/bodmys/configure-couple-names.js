/** Add the names-only section after this event's family module. */
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

function configureCoupleNames(modules, config) {
  if (!Array.isArray(modules) || modules.filter((module) => module.type === 'couple_family').length !== 1) {
    throw new Error('Se esperaba un único módulo de familia.');
  }
  if (!['brideName', 'groomName'].every((key) => typeof config?.[key] === 'string' && config[key].trim())) {
    throw new Error('Se necesitan los dos nombres de esta boda.');
  }
  const existing = modules.filter((module) => module.type === 'couple_names');
  if (existing.length > 1 || modules.some((module) => !Number.isFinite(module.order)) || new Set(modules.map((module) => module.order)).size !== modules.length) {
    throw new Error('Hay módulos duplicados o un orden inválido.');
  }
  const ordered = modules.filter((module) => module.type !== 'couple_names').sort((a, b) => a.order - b.order);
  const familyIndex = ordered.findIndex((module) => module.type === 'couple_family');
  // Preserve an existing customer's names/settings if this migration is repeated.
  ordered.splice(familyIndex + 1, 0, existing[0] || {
    type: 'couple_names', enabled: true,
    config: { brideName: config.brideName.trim(), groomName: config.groomName.trim() },
  });
  return ordered.map((module, index) => ({ ...module, order: index + 1 }));
}

async function main() {
  require('dotenv').config({ path: path.resolve(__dirname, '../../../.env'), quiet: true });
  const host = process.env.ALTEZZA_DB_HOST || '127.0.0.1';
  if (!['localhost', '127.0.0.1', '::1'].includes(host)) throw new Error('Solo se permite una base local.');
  const seed = JSON.parse(fs.readFileSync(path.join(__dirname, 'modules.json'), 'utf8'));
  const config = seed.find((module) => module.type === 'couple_names')?.config;
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
    const after = configureCoupleNames(before, config);
    if (JSON.stringify(before) === JSON.stringify(after)) {
      await db.rollback();
      console.log('Los nombres ya están configurados después de la familia.');
      return;
    }
    const backup = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'altezza-bodmys-names-')), 'modules-before.json');
    fs.writeFileSync(backup, JSON.stringify(before, null, 2) + '\n');
    await db.query('UPDATE evento_invitacion_publica SET modulesJson=?, updatedAt=CURRENT_TIMESTAMP WHERE idEvento=?', [JSON.stringify(after), 'bodmys']);
    await db.commit();
    console.log(JSON.stringify({ eventId: 'bodmys', backup, names: after.find((module) => module.type === 'couple_names') }, null, 2));
  } catch (error) { await db.rollback(); throw error; }
  finally { await db.end(); }
}

module.exports = { configureCoupleNames };
if (require.main === module) main().catch((error) => { console.error(error.message); process.exitCode = 1; });
