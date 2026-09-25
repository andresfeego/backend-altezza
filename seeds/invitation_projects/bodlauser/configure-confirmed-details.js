/** Confirmed event details, with a local transaction and no changes to other weddings. */
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const RECEPTION_TIME = '2026-12-19 16:30:00';
const RECEPTION_PLACE = 'Villa Germana Paipa';
const CHAPEL_URL = 'https://maps.app.goo.gl/ULysqgZLGN33vxTv9?g_st=ic';
const RECEPTION_URL = 'https://www.google.com/maps/search/?api=1&query=5.7550716,-73.0934421';

function confirmDetails(modules) {
  if (!Array.isArray(modules) || modules.filter(m => m.type === 'event_details').length !== 1) throw new Error('Se requieren detalles únicos.');
  const next = structuredClone(modules);
  const details = next.find(m => m.type === 'event_details');
  details.config = { ...details.config, receptionMessage: '', ceremonyMapUrl: CHAPEL_URL, receptionMapUrl: RECEPTION_URL };
  return next;
}

async function run() {
  const root = path.resolve(__dirname, '../../..');
  require('dotenv').config({ path: path.join(root, '.env'), quiet: true });
  const host = process.env.ALTEZZA_DB_HOST || '127.0.0.1';
  if (!['localhost', '127.0.0.1', '::1'].includes(host)) throw new Error('Solo base local.');
  const db = await require('mysql2/promise').createConnection({ host, port: Number(process.env.ALTEZZA_DB_PORT || 3306), user: process.env.ALTEZZA_DB_USER, password: process.env.ALTEZZA_DB_PASS, database: process.env.ALTEZZA_DB_NAME, dateStrings: true });
  try {
    await db.beginTransaction();
    const [events] = await db.query('SELECT * FROM evento WHERE id=? FOR UPDATE', ['bodlauser']);
    const event = events[0];
    if (!['Laura & Sergio', 'Laura y Sergio'].includes(event?.nombre)) throw new Error('Identidad incorrecta.');
    if (!String(event.fechaHoraRecepcion).startsWith('2026-12-19')) throw new Error('La fecha del evento cambió; revisar antes de ajustar la hora.');
    const [cards] = await db.query('SELECT templateKey, modulesJson FROM evento_invitacion_publica WHERE idEvento=? FOR UPDATE', ['bodlauser']);
    if (cards.length !== 1 || cards[0].templateKey !== 'wedding_lemoncello') throw new Error('Plantilla incorrecta.');
    const before = typeof cards[0].modulesJson === 'string' ? JSON.parse(cards[0].modulesJson) : cards[0].modulesJson;
    const after = confirmDetails(before);
    const [places] = await db.query('SELECT * FROM lugar WHERE id=?', [event.idLugarRecepcion]);
    const originalPlace = places[0];
    if (!['Villa Germana', RECEPTION_PLACE].includes(originalPlace?.nombre)) throw new Error('Lugar de recepción inesperado.');
    const changed = event.fechaHoraRecepcion !== RECEPTION_TIME || originalPlace.nombre !== RECEPTION_PLACE || JSON.stringify(before) !== JSON.stringify(after);
    if (changed) {
      const backup = path.join(os.tmpdir(), `bodlauser-before-confirmed-details-${Date.now()}.json`);
      fs.writeFileSync(backup, JSON.stringify({ event, originalPlace, modules: before }, null, 2), { mode: 0o600 });
      console.log('Backup:', backup);
      const [matches] = await db.query('SELECT id FROM lugar WHERE nombre=? ORDER BY id', [RECEPTION_PLACE]);
      if (matches.length > 1) throw new Error('Lugar de recepción ambiguo.');
      let placeId = matches[0]?.id;
      if (!placeId) {
        // Villa Germana is shared by another wedding; give this event its own display name.
        const [insert] = await db.query('INSERT INTO lugar (nombre,latitud,longitud,imagen) VALUES (?,?,?,?)', [RECEPTION_PLACE, originalPlace.latitud, originalPlace.longitud, originalPlace.imagen]);
        placeId = insert.insertId;
      }
      await db.query('UPDATE evento SET fechaHoraRecepcion=?,idLugarRecepcion=? WHERE id=?', [RECEPTION_TIME, placeId, 'bodlauser']);
      await db.query('UPDATE evento_invitacion_publica SET modulesJson=?,updatedAt=CURRENT_TIMESTAMP WHERE idEvento=?', [JSON.stringify(after), 'bodlauser']);
    }
    await db.commit();
    console.log(JSON.stringify({ event: 'bodlauser', changed, receptionTime: RECEPTION_TIME, receptionPlace: RECEPTION_PLACE, ceremonyMapUrl: CHAPEL_URL }));
  } catch (error) { await db.rollback(); throw error; }
  finally { await db.end(); }
}
module.exports = { confirmDetails, run };
if (require.main === module) run().catch(error => { console.error(error.message); process.exitCode = 1; });
