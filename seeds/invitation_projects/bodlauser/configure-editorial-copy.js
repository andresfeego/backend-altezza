/** Local editorial copy and reserved-white update; keeps all other card fields. */
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

function updateCopy(modules) {
  const next = structuredClone(modules);
  const unique = type => {
    const found = next.filter(m => m.type === type);
    if (found.length !== 1 || !found[0].config) throw new Error(`Módulo ambiguo: ${type}`);
    return found[0].config;
  };
  unique('gift_envelopes').leadText = 'Amamos los niños, pero este evento es exclusivo para adultos.';
  const dress = unique('dresscode');
  dress.title = 'Vestuario · Elegancia fresca';
  dress.avoidedColorsTitle = 'Reservados: amarillo mantequilla, azul cielo y blanco';
  if (!Array.isArray(dress.avoidedColors)) throw new Error('Paleta inválida.');
  if (!dress.avoidedColors.some(item => /^(#fff(?:fff)?|white)$/i.test(typeof item === 'string' ? item : item.color || ''))) {
    dress.avoidedColors.push({ color: '#FFFFFF', label: 'Blanco' });
  }
  return next;
}

async function run() {
  const root = path.resolve(__dirname, '../../..');
  require('dotenv').config({ path: path.join(root, '.env'), quiet: true });
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
    const modules = updateCopy(JSON.parse(before));
    if (JSON.stringify(JSON.parse(before)) !== JSON.stringify(modules)) {
      const backup = path.join(os.tmpdir(), `bodlauser-before-editorial-copy-${Date.now()}.json`);
      fs.writeFileSync(backup, before, { mode: 0o600 });
      await db.query('UPDATE evento_invitacion_publica SET modulesJson=?,updatedAt=CURRENT_TIMESTAMP WHERE idEvento=?', [JSON.stringify(modules), 'bodlauser']);
      console.log('Backup:', backup);
    }
    await db.commit();
    console.log(JSON.stringify({ event: 'bodlauser', modules: ['gift_envelopes', 'dresscode'] }));
  } catch (error) { await db.rollback(); throw error; }
  finally { await db.end(); }
}
if (require.main === module) run().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { updateCopy, run };
