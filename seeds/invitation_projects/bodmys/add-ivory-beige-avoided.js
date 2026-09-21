/** Add ivory and beige fabric swatches to the local Mayra/Samuel dress code. */
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

async function main() {
  const backendRoot = path.resolve(__dirname, '../../..');
  require('dotenv').config({ path: path.join(backendRoot, '.env'), quiet: true });
  const host = process.env.ALTEZZA_DB_HOST || '127.0.0.1';
  if (!['localhost', '127.0.0.1', '::1'].includes(host)) throw new Error('Solo se permite una base local.');
  const additions = [
    { label: 'Marfil', imageSrc: '/scrAppaltezza/invitations/bodmys/dresscode/tela-marfil-v1.webp', crop: { x: 25, y: 25, width: 50, height: 50 } },
    { label: 'Beige', imageSrc: '/scrAppaltezza/invitations/bodmys/dresscode/tela-beige-v1.webp' },
  ];
  const title = 'Evita blanco, marfil y beige';
  for (const item of additions) {
    fs.accessSync(path.join(backendRoot, '_local_storage/invitations/bodmys/dresscode', path.basename(item.imageSrc)));
  }
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
    const matches = after.filter((module) => module.type === 'dresscode');
    if (matches.length !== 1 || !Array.isArray(matches[0].config?.avoidedColors)) throw new Error('Configuración de vestuario inválida.');
    const config = matches[0].config;
    if (!['Solo evita el blanco', title].includes(config.avoidedColorsTitle)) throw new Error('El título cambió; no se sobrescribe.');
    for (const addition of additions) {
      const existing = config.avoidedColors.find((item) => item?.label === addition.label || item?.imageSrc === addition.imageSrc);
      if (!existing) config.avoidedColors.push(addition);
      else if (existing.imageSrc !== addition.imageSrc || existing.label !== addition.label) throw new Error('La muestra cambió; no se sobrescribe.');
    }
    config.avoidedColorsTitle = title;
    if (JSON.stringify(before) === JSON.stringify(after)) {
      await db.rollback();
      console.log('Marfil y beige ya están configurados.');
      return;
    }
    const backup = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'altezza-bodmys-ivory-beige-')), 'modules-before.json');
    fs.writeFileSync(backup, JSON.stringify(before, null, 2) + '\n');
    await db.query('UPDATE evento_invitacion_publica SET modulesJson=?, updatedAt=CURRENT_TIMESTAMP WHERE idEvento=?', [JSON.stringify(after), 'bodmys']);
    await db.commit();
    console.log(JSON.stringify({ eventId: 'bodmys', backup, avoidedColors: config.avoidedColors }, null, 2));
  } catch (error) { await db.rollback(); throw error; }
  finally { await db.end(); }
}

if (require.main === module) main().catch((error) => { console.error(error.message); process.exitCode = 1; });
