/** Reduce names overlay transparency from 22% to 17%. */
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

function configureNamesBackground(modules, background) {
  if (!Array.isArray(modules) || modules.filter((m) => m.type === 'couple_names').length !== 1) throw new Error('Se esperaba un módulo de nombres.');
  if (!background?.imageSrc || typeof background.overlayOpacity !== 'number' || background.overlayOpacity < 0 || background.overlayOpacity > 1) throw new Error('Fondo inválido.');
  return modules.map((module) => {
    if (module.type !== 'couple_names') return module;
    const current = module.config?.sectionBackground;
    if (current?.overlayOpacity === background.overlayOpacity) return module;
    if (current?.overlayOpacity !== .78 || current.imageSrc !== background.imageSrc) throw new Error('El fondo cambió; no se sobrescribe.');
    return { ...module, config: { ...module.config, sectionBackground: structuredClone(background) } };
  });
}

async function main() {
  const backendRoot = path.resolve(__dirname, '../../..');
  require('dotenv').config({ path: path.join(backendRoot, '.env'), quiet: true });
  const host = process.env.ALTEZZA_DB_HOST || '127.0.0.1';
  if (!['localhost', '127.0.0.1', '::1'].includes(host)) throw new Error('Solo se permite una base local.');
  fs.accessSync(path.join(backendRoot, '_local_storage/invitations/bodmys/couple_names/jardin-luz-natural-v1.png'));
  const seed = JSON.parse(fs.readFileSync(path.join(__dirname, 'modules.json'), 'utf8'));
  const background = { ...seed.find((m) => m.type === 'couple_names')?.config?.sectionBackground, overlayOpacity: .83 };
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
    const after = configureNamesBackground(before, background);
    if (JSON.stringify(before) === JSON.stringify(after)) {
      await db.rollback();
      console.log('El fondo ya está configurado; se conserva la configuración actual.');
      return;
    }
    const backup = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'altezza-bodmys-names-opacity-')), 'modules-before.json');
    fs.writeFileSync(backup, JSON.stringify(before, null, 2) + '\n');
    await db.query('UPDATE evento_invitacion_publica SET modulesJson=?, updatedAt=CURRENT_TIMESTAMP WHERE idEvento=?', [JSON.stringify(after), 'bodmys']);
    await db.commit();
    console.log(JSON.stringify({ eventId: 'bodmys', backup, background }, null, 2));
  } catch (error) { await db.rollback(); throw error; }
  finally { await db.end(); }
}

module.exports = { configureNamesBackground };
if (require.main === module) main().catch((error) => { console.error(error.message); process.exitCode = 1; });
