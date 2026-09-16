const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env'), quiet: true });

// Explicit opt-in; creates and removes only its own local fixtures.
test('public invitation API: persistence, validation, deadlines and no-deadline compatibility', { skip: process.env.RUN_ALTEZZA_INTEGRATION !== '1' }, async () => {
  assert.ok(['localhost', '127.0.0.1', '::1'].includes(process.env.ALTEZZA_DB_HOST || '127.0.0.1'));
  const pool = require('../server/dbAltezza/connection');
  const db = pool.promise();
  const id = `qa${Date.now().toString(36)}`.slice(-10);
  const guestIds = [];
  const base = 'http://127.0.0.1:3022/api/responseAltezza';
  const send = async (answers) => {
    const response = await fetch(`${base}/public/invitaciones/${id}/confirmacion`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ respuestas: answers }),
    });
    return { status: response.status, body: await response.json() };
  };
  try {
    const [[type]] = await db.query('SELECT id FROM tipo_evento ORDER BY id LIMIT 1');
    const [[country]] = await db.query("SELECT id FROM pais_telefono WHERE iso2='CO' LIMIT 1");
    await db.query('INSERT INTO evento (id,nombre,idTipoEvento,fechaHoraCeremonia,fechaHoraRecepcion,estado) VALUES (?,?,?,?,?,1)', [id, 'QA temporal Oliva', type.id, '2026-11-28 15:00:00', '2026-11-28 16:30:00']);
    await db.query('INSERT INTO invitacion (id,label,mensaje_personalizado) VALUES (?,?,?)', [id, 'QA temporal', '']);
    await db.query('INSERT INTO evento_has_invitacion (idEvento,idInvitacion) VALUES (?,?)', [id,id]);
    for (const name of ['QA uno', 'QA dos']) {
      const [r] = await db.query('INSERT INTO invitado (nombre,telefono,idPaisTelefono) VALUES (?,?,?)', [name,'',country.id]);
      guestIds.push(r.insertId);
      await db.query('INSERT INTO invitacion_has_invitado (idInvitacion,idInvitado) VALUES (?,?)',[id,r.insertId]);
    }
    const read = async () => (await db.query('SELECT id,confirmado FROM invitado WHERE id IN (?,?) ORDER BY id',guestIds))[0];
    const a = guestIds[0], b = guestIds[1];
    assert.equal((await send([{ idInvitado:a, confirmado:1 }, { idInvitado:b, confirmado:2 }])).status, 200);
    assert.deepEqual((await read()).map(g=>g.confirmado), [1,2]);
    assert.equal((await send([{ idInvitado:a, confirmado:3 }, { idInvitado:0, confirmado:1 }])).status, 404);
    assert.deepEqual((await read()).map(g=>g.confirmado), [1,2], 'invalid batch must not partially write');
    assert.equal((await send([{ idInvitado:a, confirmado:99 }])).status, 400);
    const invalidLink = await fetch(`${base}/public/invitaciones/${id}/0`);
    assert.equal(invalidLink.status,404);
    await db.query('UPDATE evento SET fechaHoraLimiteConfirmar=? WHERE id=?', ['2026-11-19 00:00:00',id]);
    const payload = await (await fetch(`${base}/public/invitaciones/${id}/${a}`)).json();
    assert.equal(payload.invitacion.fechaHoraLimiteConfirmar,'2026-11-19T05:00:00.000Z');
    assert.equal(payload.invitacion.fechaHoraCeremonia,'2026-11-28T20:00:00.000Z');
    await db.query('UPDATE evento SET fechaHoraLimiteConfirmar=? WHERE id=?', ['2000-01-01 00:00:00',id]);
    assert.equal((await send([{ idInvitado:a, confirmado:3 }])).status,409);
    assert.deepEqual((await read()).map(g=>g.confirmado),[1,2]);
    const closedPayload = await (await fetch(`${base}/public/invitaciones/${id}/${a}`)).json();
    assert.equal(closedPayload.invitacion.confirmationClosed,true);
    await db.query('UPDATE evento SET fechaHoraLimiteConfirmar=NULL WHERE id=?',[id]);
    assert.equal((await send([{ idInvitado:a, confirmado:3 }])).status,200);
  } finally {
    await db.query('DELETE FROM invitacion_has_invitado WHERE idInvitacion=?',[id]);
    await db.query('DELETE FROM evento_has_invitacion WHERE idInvitacion=?',[id]);
    await db.query('DELETE FROM invitacion WHERE id=?',[id]);
    if (guestIds.length) await db.query('DELETE FROM invitado WHERE id IN (?)',[guestIds]);
    await db.query('DELETE FROM evento WHERE id=?',[id]);
    await db.end();
  }
});
