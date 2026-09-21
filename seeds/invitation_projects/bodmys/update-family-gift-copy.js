/** Apply the requested family and gift copy only to the local Mayra/Samuel event. */
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

async function main() {
  require('dotenv').config({ path: path.resolve(__dirname, '../../../.env'), quiet: true });
  const host = process.env.ALTEZZA_DB_HOST || '127.0.0.1';
  if (!['localhost', '127.0.0.1', '::1'].includes(host)) throw new Error('Solo se permite una base local.');
  const seed = JSON.parse(fs.readFileSync(path.join(__dirname, 'modules.json'), 'utf8'));
  const changes = [
    { type: 'couple_family', key: 'title', previous: 'Nuestras raíces' },
    { type: 'couple_family', key: 'coupleLabel', previous: 'Con quienes nos han acompañado' },
    { type: 'gift_envelopes', key: 'leadText', previous: '' },
  ];
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
    const after = structuredClone(before);
    for (const { type, key, previous } of changes) {
      const matches = after.filter((module) => module.type === type);
      const desired = seed.find((module) => module.type === type)?.config?.[key];
      if (matches.length !== 1 || typeof desired !== 'string') throw new Error(`Configuración inválida: ${type}.${key}`);
      const current = matches[0].config?.[key];
      if (current !== previous && current !== desired) throw new Error(`Hay una edición posterior en ${type}.${key}; se conserva sin sobrescribir.`);
      matches[0].config[key] = desired;
    }
    if (JSON.stringify(before) === JSON.stringify(after)) {
      await db.rollback();
      console.log('Los textos ya están actualizados.');
      return;
    }
    const backup = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'altezza-bodmys-family-gift-copy-')), 'modules-before.json');
    fs.writeFileSync(backup, JSON.stringify(before, null, 2) + '\n');
    await db.query('UPDATE evento_invitacion_publica SET modulesJson=?, updatedAt=CURRENT_TIMESTAMP WHERE idEvento=?', [JSON.stringify(after), 'bodmys']);
    await db.commit();
    console.log(JSON.stringify({ eventId: 'bodmys', backup, fields: changes.map(({ type, key }) => `${type}.${key}`) }, null, 2));
  } catch (error) { await db.rollback(); throw error; }
  finally { await db.end(); }
}

if (require.main === module) main().catch((error) => { console.error(error.message); process.exitCode = 1; });
