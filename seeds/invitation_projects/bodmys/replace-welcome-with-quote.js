/** Move this event's welcome phrase into the existing optional-reference quote module. */
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

function replaceWelcomeWithQuote(modules) {
  if (!Array.isArray(modules)) throw new Error('La configuración de módulos no es válida.');
  const welcomes = modules.filter((module) => module.type === 'welcome_message');
  const quotes = modules.filter((module) => module.type === 'biblical_quote');
  if (!welcomes.length && quotes.length === 1) return modules;
  if (welcomes.length !== 1 || quotes.length) throw new Error('Se esperaba una bienvenida y ninguna frase bíblica.');
  const welcome = welcomes[0];
  const passageText = welcome.config?.subtitle;
  if (typeof passageText !== 'string' || !passageText.trim()) throw new Error('La bienvenida no tiene una frase para trasladar.');
  return modules.map((module) => module !== welcome ? module : {
    ...module,
    type: 'biblical_quote',
    config: { passageText, passageReference: '' },
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
    const after = replaceWelcomeWithQuote(before);
    if (JSON.stringify(before) === JSON.stringify(after)) {
      await db.rollback();
      console.log('La bienvenida ya fue reemplazada por la frase.');
      return;
    }
    const backup = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'altezza-bodmys-quote-')), 'modules-before.json');
    fs.writeFileSync(backup, JSON.stringify(before, null, 2) + '\n');
    await db.query('UPDATE evento_invitacion_publica SET modulesJson=?, updatedAt=CURRENT_TIMESTAMP WHERE idEvento=?', [JSON.stringify(after), 'bodmys']);
    await db.commit();
    console.log(JSON.stringify({ eventId: 'bodmys', backup, quote: after.find((module) => module.type === 'biblical_quote') }, null, 2));
  } catch (error) { await db.rollback(); throw error; }
  finally { await db.end(); }
}

module.exports = { replaceWelcomeWithQuote };
if (require.main === module) main().catch((error) => { console.error(error.message); process.exitCode = 1; });
