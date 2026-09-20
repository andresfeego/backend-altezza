/** Local-only, repeatable data provisioning; no schema changes. */
const path = require('node:path');
const fs = require('node:fs');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env'), quiet: true });
const mysql = require('mysql2/promise');

async function seed() {
  const host = process.env.ALTEZZA_DB_HOST || '127.0.0.1';
  if (!['127.0.0.1', 'localhost', '::1'].includes(host)) throw new Error('Este seed solo admite una base local.');
  const db = await mysql.createConnection({
    host, port: Number(process.env.ALTEZZA_DB_PORT || 3306),
    user: process.env.ALTEZZA_DB_USER, password: process.env.ALTEZZA_DB_PASS,
    database: process.env.ALTEZZA_DB_NAME, charset: 'utf8mb4', timezone: '-05:00',
  });
  const eventId = 'bodlauser';
  const invitationId = 'lausprueba';
  try {
    await db.query("SET time_zone = '-05:00'");
    await db.beginTransaction();
    const [existing] = await db.query('SELECT nombre FROM evento WHERE id = ? FOR UPDATE', [eventId]);
    if (existing.length && !['Laura & Sergio', 'Laura y Sergio'].includes(existing[0].nombre)) {
      throw new Error('bodlauser pertenece a otro evento. No se modificó.');
    }
    const [types] = await db.query("SELECT id FROM tipo_evento WHERE LOWER(nombre) IN ('boda', 'matrimonio') ORDER BY id LIMIT 1");
    if (!types.length) throw new Error('Falta el tipo de evento Boda/Matrimonio.');
    async function getPlace(name) {
      const [rows] = await db.query('SELECT id FROM lugar WHERE nombre = ? ORDER BY id LIMIT 1', [name]);
      if (rows.length) return rows[0].id;
      const [insert] = await db.query('INSERT INTO lugar (nombre, latitud, longitud) VALUES (?, NULL, NULL)', [name]);
      return insert.insertId;
    }
    const ceremony = await getPlace('Capilla Señora del Rosario del Pantano de Vargas');
    const reception = await getPlace('Villa Germana');
    await db.query(`INSERT INTO evento
      (id, nombre, idTipoEvento, fechaHoraCeremonia, fechaHoraRecepcion, fechaHoraLimiteConfirmar, idLugarCeremonia, idLugarRecepcion, estado)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
      ON DUPLICATE KEY UPDATE id=VALUES(id)`,
      [eventId, 'Laura & Sergio', types[0].id, '2026-12-19 14:30:00', '2026-12-19 16:00:00', null, ceremony, reception]);
    const modules = JSON.parse(fs.readFileSync(path.join(__dirname, 'modules.json'), 'utf8'));
    await db.query(`INSERT INTO evento_invitacion_publica (idEvento, templateKey, seoTitle, seoDescription, seoImage, published, modulesJson)
      VALUES (?, 'wedding_lemoncello', ?, ?, ?, 0, ?)
      ON DUPLICATE KEY UPDATE idEvento=VALUES(idEvento)`,
      [eventId, 'Laura y Sergio | Nuestra boda', '19 de diciembre de 2026 · Paipa.', '', JSON.stringify(modules)]);
    const [priorInvitation] = await db.query('SELECT id FROM invitacion WHERE id = ?', [invitationId]);
    if (priorInvitation.length) {
      const [owners] = await db.query('SELECT idEvento FROM evento_has_invitacion WHERE idInvitacion = ?', [invitationId]);
      if (owners.length !== 1 || owners[0].idEvento !== eventId) throw new Error('La invitación de prueba pertenece a otro evento o no tiene propietario.');
    } else {
      await db.query('INSERT INTO invitacion (id, label, mensaje_personalizado, enviada) VALUES (?, ?, ?, 0)', [invitationId, 'TEST INVITATION TO REPLACE', '']);
      await db.query('INSERT INTO evento_has_invitacion (idEvento, idInvitacion) VALUES (?, ?)', [eventId, invitationId]);
    }
    const [country] = await db.query("SELECT id FROM pais_telefono WHERE iso2 = 'CO' LIMIT 1");
    if (!country.length) throw new Error('Falta Colombia en pais_telefono.');
    const [members] = await db.query('SELECT i.id, i.nombre FROM invitado i JOIN invitacion_has_invitado h ON h.idInvitado=i.id WHERE h.idInvitacion=?', [invitationId]);
    const guestIds = [];
    for (const [index, name] of ['TEST GUEST TO REPLACE'].entries()) {
      let id = members.find((guest) => guest.nombre === name)?.id;
      if (!id) {
        const [insert] = await db.query('INSERT INTO invitado (nombre, principal, confirmado, telefono, idPaisTelefono, wp) VALUES (?, ?, 0, ?, ?, 0)', [name, index === 0 ? 1 : 0, '', country[0].id]);
        id = insert.insertId;
        await db.query('INSERT INTO evento_has_invitado (idEvento, idInvitado) VALUES (?, ?)', [eventId, id]);
        await db.query('INSERT INTO invitacion_has_invitado (idInvitacion, idInvitado) VALUES (?, ?)', [invitationId, id]);
      }
      guestIds.push(id);
    }
    for (const key of ['datos_evento', 'invitados', 'invitaciones']) {
      await db.query('INSERT INTO evento_modulo_cliente (idEvento,moduloKey,estado) VALUES (?,?,1) ON DUPLICATE KEY UPDATE estado=1', [eventId,key]);
    }
    await db.commit();
    console.log(JSON.stringify({ eventId, invitationId, guestIds, url: `http://localhost:3002/invitacion/${invitationId}/${guestIds[0]}` }, null, 2));
  } catch (error) {
    await db.rollback();
    throw error;
  } finally {
    await db.end();
  }
}
seed().catch((error) => { console.error(error.message); process.exitCode = 1; });
