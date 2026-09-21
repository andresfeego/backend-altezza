/** Add the photo pair after RSVP and remove this event's closing ornament. */
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

function configureInstantPhotos(modules, seed) {
  if (!Array.isArray(modules) || ['attendance_confirm', 'closing_message'].some((type) => modules.filter((m) => m.type === type).length !== 1)) throw new Error('Se esperaba un módulo de asistencia y uno de cierre.');
  if (modules.filter((m) => m.type === 'instant_photos').length > 1 || modules.some((m) => !Number.isFinite(m.order)) || new Set(modules.map((m) => m.order)).size !== modules.length) throw new Error('Hay módulos duplicados o un orden inválido.');
  // Do not overwrite later photo, decoration or placement choices on repeat runs.
  if (modules.some((m) => m.type === 'instant_photos')) return modules;
  const photos = seed.find((m) => m.type === 'instant_photos');
  if (!photos || photos.config?.images?.length !== 2 || photos.config.images.some((image) => !image.imageSrc) || !photos.config.sealImageSrc) throw new Error('Faltan las dos fotografías o el sello en el seed.');
  const ordered = [...modules].sort((a, b) => a.order - b.order);
  ordered.splice(ordered.findIndex((m) => m.type === 'attendance_confirm') + 1, 0, structuredClone(photos));
  return ordered.map((m, index) => ({ ...m, order: index + 1,
    ...(m.type === 'closing_message' ? { config: { ...m.config, showFrame: false } } : {}),
  }));
}

async function main() {
  const backendRoot = path.resolve(__dirname, '../../..');
  require('dotenv').config({ path: path.join(backendRoot, '.env'), quiet: true });
  const host = process.env.ALTEZZA_DB_HOST || '127.0.0.1';
  if (!['localhost', '127.0.0.1', '::1'].includes(host)) throw new Error('Solo se permite una base local.');
  const seed = JSON.parse(fs.readFileSync(path.join(__dirname, 'modules.json'), 'utf8'));
  const config = seed.find((m) => m.type === 'instant_photos')?.config;
  for (const asset of [...(config?.images || []).map((image) => image.imageSrc), config?.sealImageSrc]) {
    if (!asset?.startsWith('/scrAppaltezza/invitations/bodmys/')) throw new Error('Recurso del evento inválido.');
    fs.accessSync(path.join(backendRoot, '_local_storage', asset.replace('/scrAppaltezza/', '')));
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
    const after = configureInstantPhotos(before, seed);
    if (JSON.stringify(before) === JSON.stringify(after)) {
      await db.rollback();
      console.log('Instantáneas ya configuradas; se conserva la configuración actual.');
      return;
    }
    const backup = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'altezza-bodmys-instant-photos-')), 'modules-before.json');
    fs.writeFileSync(backup, JSON.stringify(before, null, 2) + '\n');
    await db.query('UPDATE evento_invitacion_publica SET modulesJson=?, updatedAt=CURRENT_TIMESTAMP WHERE idEvento=?', [JSON.stringify(after), 'bodmys']);
    await db.commit();
    console.log(JSON.stringify({ eventId: 'bodmys', backup, order: after.map(({ type, order }) => ({ type, order })) }, null, 2));
  } catch (error) { await db.rollback(); throw error; }
  finally { await db.end(); }
}

module.exports = { configureInstantPhotos };
if (require.main === module) main().catch((error) => { console.error(error.message); process.exitCode = 1; });
