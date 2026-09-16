/** Persist this event's previously fixed copy; other events never receive it. */
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const COPY_FIELDS = {
  couple_family: ['title'],
  event_details: ['title'],
  countdown: ['message', 'completedMessage'],
};

function configureCopy(modules, seed) {
  return modules.map((module) => {
    const defaults = seed.find((item) => item.type === module.type)?.config || {};
    const config = { ...module.config };
    for (const key of COPY_FIELDS[module.type] || []) {
      // An explicit empty string is the customer's choice to hide this text.
      if (!Object.prototype.hasOwnProperty.call(config, key) && typeof defaults[key] === 'string') config[key] = defaults[key];
    }
    return { ...module, config };
  });
}

async function main() {
  require('dotenv').config({ path: path.resolve(__dirname, '../../../.env'), quiet: true });
  const host = process.env.ALTEZZA_DB_HOST || '127.0.0.1';
  if (!['localhost', '127.0.0.1', '::1'].includes(host)) throw new Error('Solo se permite una base local.');
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
    const after = configureCopy(before, JSON.parse(fs.readFileSync(path.join(__dirname, 'modules.json'), 'utf8')));
    const backup = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'altezza-bodmys-copy-')), 'modules-before.json');
    fs.writeFileSync(backup, JSON.stringify(before, null, 2) + '\n');
    await db.query('UPDATE evento_invitacion_publica SET modulesJson=?, updatedAt=CURRENT_TIMESTAMP WHERE idEvento=?', [JSON.stringify(after), 'bodmys']);
    await db.commit();
    console.log(JSON.stringify({ eventId: 'bodmys', backup, copyFields: COPY_FIELDS }, null, 2));
  } catch (error) { await db.rollback(); throw error; }
  finally { await db.end(); }
}

module.exports = { configureCopy };
if (require.main === module) main().catch((error) => { console.error(error.message); process.exitCode = 1; });
