const express = require('express');
const general = require('../dbAltezza/general');
const usuario = require('../dbAltezza/usuario');


const fs = require('fs');
const path = require('path');
const multer = require('multer');
const sharp = require('sharp');
const router = express.Router();
// body parsing is handled at app level (server/index.js)


// Ruta base para local o producción
const isLocal = process.env.NODE_ENV !== 'production';

// Storage layout
const DATA_ROOT = process.env.ALTEZZA_DATA_ROOT || path.resolve(__dirname, '../../data/altezza');
const BASE_DIR = process.env.ALTEZZA_EVENTOS_DIR || path.join(DATA_ROOT, 'images/eventos');

// Public base (same-origin behind nginx).
const BASE_URL_IMAGENES = (process.env.PUBLIC_BASE_URL || '').replace(/\/$/, '') || '';

// Public path for event images (served by express in local dev, and by nginx alias in VPS)
const EVENTOS_PUBLIC_PATH = (process.env.ALTEZZA_EVENTOS_PUBLIC_PATH || '/scrAppaltezza/images/eventos').replace(/\/$/, '');

function publicEventoUrl(rutaRelativa) {
  const rel = String(rutaRelativa || '');
  if (!rel) return rel;
  const base = (BASE_URL_IMAGENES || '').replace(/\/$/, '');
  const tail = rel.startsWith('/') ? rel : `/${rel}`;
  return `${base}${EVENTOS_PUBLIC_PATH}${tail}`;
}


const userEventStreams = new Map();

function parseOptionalPositiveInt(value) {
  if (value === null || value === undefined || value === '') return null;

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return NaN;

  return parsed;
}

function parseOptionalBoolean(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'boolean') return value;

  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'si', 'sí', 'yes', 'y'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'n'].includes(normalized)) return false;

  return null;
}

function addUserEventStream(idUsuario, res) {
  const key = String(idUsuario);
  const current = userEventStreams.get(key) || new Set();
  current.add(res);
  userEventStreams.set(key, current);
}

function removeUserEventStream(idUsuario, res) {
  const key = String(idUsuario);
  const current = userEventStreams.get(key);
  if (!current) return;
  current.delete(res);
  if (!current.size) {
    userEventStreams.delete(key);
  }
}

function emitUserEvent(idUsuario, payload) {
  const key = String(idUsuario);
  const current = userEventStreams.get(key);
  if (!current?.size) return;

  const message = `data: ${JSON.stringify(payload)}\n\n`;
  current.forEach((stream) => {
    try {
      stream.write(message);
    } catch (error) {
      console.error('No fue posible emitir el evento SSE del usuario.', error);
    }
  });
}

function normalizeUsuarioPayload(user) {
  if (!user) return user;

  const eventosAsignados = Array.isArray(user.eventosAsignados)
    ? user.eventosAsignados.map((evento) => ({
        ...evento,
        imagenPrincipal: evento?.imagenPrincipal ? publicEventoUrl(evento.imagenPrincipal) : null,
      }))
    : [];

  return {
    ...user,
    eventosAsignados,
    idEventoAsignado: eventosAsignados.length === 1 ? eventosAsignados[0].id : null,
  };
}


// Función para generar código aleatorio
function generarCodigo(len = 8) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let code = '';
  for (let i = 0; i < len; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Multer configuración temporal en memoria
const storage = multer.memoryStorage();
const upload = multer({ storage });

generaCodigo = (length) => {
    var result = '';
    var characters = 'abcdefghijklmnopqrstuvwxyz0123456789';
    var charactersLength = characters.length;
    for (var i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}



//________________________________ generales ____________________________


router.get('/parentescos', async (req, res, next) => {

    try{
        let results = await general.parentescos();
        res.json(results);
    }catch(e){
        console.log(e);
        res.sendStatus(500);
    }

});

router.get('/gruposEdad', async (req, res, next) => {

    try{
        let results = await general.gruposEdad();
        res.json(results);
    }catch(e){
        console.log(e);
        res.sendStatus(500);
    }

});

router.post('/login', async (req, res) => {
  try {
    const { user, pass } = req.body;
    const results = await general.usuarioSistema(user);

    if (!results || results.length === 0) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    const usuario = results[0];
    const passOk = usuario.pass === pass; // texto plano

    if (!passOk) {
      return res.status(401).json({ message: 'Contraseña incorrecta' });
    }

    const { pass: _omit, ...safeUser } = usuario;
    return res.status(200).json({ usuario: safeUser });
  } catch (e) {
    console.error(e);
    return res.sendStatus(500);
  }
});


router.post('/uploadImagenEvento', upload.single('imagen'), async (req, res) => {
  try {
    const { codigoEvento, modulo } = req.body;

    if (!codigoEvento || !modulo) {
      return res.status(400).json({ error: 'Faltan parámetros requeridos (codigoEvento o modulo)' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No se envió ninguna imagen' });
    }

    // Crear carpeta si no existe
    const rutaDestino = path.join(BASE_DIR, codigoEvento, modulo);
    fs.mkdirSync(rutaDestino, { recursive: true });

    // Consultar evento actual
    const eventoResult = await general.detalleEventoCompleto(codigoEvento);
    const evento = eventoResult[0];

    // Eliminar imagen anterior si existe
    if (evento?.imagenPrincipal) {
      const rutaAntigua = path.join(BASE_DIR, evento.imagenPrincipal);
      if (fs.existsSync(rutaAntigua)) {
        fs.unlinkSync(rutaAntigua); // eliminar físicamente la imagen vieja
      }
    }

    // Generar nueva imagen con nombre aleatorio
    const codigoNombre = generarCodigo();
    const nombreFinal = `image_${codigoNombre}.webp`;
    const rutaRelativa = `/${codigoEvento}/${modulo}/${nombreFinal}`;
    const rutaFinal = path.join(BASE_DIR, rutaRelativa);

    // Procesar y guardar imagen
    await sharp(req.file.buffer)
      .resize({ width: 1200 })
      .toFormat('webp')
      .webp({ quality: 70 })
      .toFile(rutaFinal);

    // Actualizar base de datos con nueva ruta
    await general.actualizarImagenEvento(codigoEvento, rutaRelativa);

    // Devolver URL pública
    const rutaPublica = publicEventoUrl(rutaRelativa);
    return res.status(200).json({ url: rutaPublica });

  } catch (err) {
    console.error('[uploadImagenEvento] ❌', err);
    return res.sendStatus(500);
  }
});


//_________________________________gestion usuario_______________________________-
// routesAltezza.js (endpoint)
router.post('/usuario/loginUsuario', async (req, res) => {
  try {
    const { correo, pass } = req.body;
    const user = normalizeUsuarioPayload(await usuario.loginUsuario(correo, pass));
    return res.status(200).json({
      success: true,
      userId: user.id,
      usuario: user, 
    });
  } catch (err) {
    switch (err) {
      case 404:
        return res.status(404).json({ error: 404, message: 'Verificar credenciales ingresadas.' });
      case 401:
        return res.status(401).json({ error: 401, message: 'Contraseña incorrecta' });
      case 406:
        return res.status(406).json({ error: 406, message: 'Usuario sin contraseña asignada' });
      case 409:
        return res.status(409).json({ error: 409, message: 'Ingreso con contraseña temporal' });
      default:
        console.error(err);
        return res.sendStatus(500);
    }
  }
});


router.get('/usuariosSistema/:idUsuario/sesion', async (req, res) => {
  try {
    const { idUsuario } = req.params;

    if (!idUsuario) {
      return res.status(400).json({ error: 400, message: 'Falta idUsuario.' });
    }

    const user = normalizeUsuarioPayload(await usuario.obtenerUsuarioSesionPorId(Number(idUsuario)));
    if (!user) {
      return res.status(404).json({ error: 404, message: 'El usuario no existe.' });
    }

    return res.status(200).json({
      success: true,
      usuario: user,
    });
  } catch (err) {
    console.error(err);
    return res.sendStatus(500);
  }
});

router.get('/stream/usuarios/:idUsuario', async (req, res) => {
  const { idUsuario } = req.params;

  if (!idUsuario) {
    return res.status(400).json({ error: 400, message: 'Falta idUsuario.' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  if (typeof res.flushHeaders === 'function') {
    res.flushHeaders();
  }

  addUserEventStream(idUsuario, res);
  res.write(`data: ${JSON.stringify({ type: 'connected', idUsuario: Number(idUsuario) })}\n\n`);

  const keepAlive = setInterval(() => {
    try {
      res.write(': keepalive\n\n');
    } catch (error) {
      clearInterval(keepAlive);
    }
  }, 25000);

  req.on('close', () => {
    clearInterval(keepAlive);
    removeUserEventStream(idUsuario, res);
    res.end();
  });
});

router.get('/usuariosSistema', async (req, res) => {
  try {
    const users = await usuario.listarUsuarios();
    return res.status(200).json(users);
  } catch (err) {
    if (err === 404) {
      return res.status(404).json({ error: 404, message: 'El usuario no existe.' });
    }
    if (err === 409) {
      return res.status(409).json({ error: 409, message: 'Solo los usuarios cliente pueden tener eventos asignados.' });
    }
    console.error(err);
    return res.sendStatus(500);
  }
});

router.get('/rolesSistema', async (req, res) => {
  try {
    const roles = await usuario.listarRoles();
    return res.status(200).json(roles);
  } catch (err) {
    console.error(err);
    return res.sendStatus(500);
  }
});

router.post('/usuariosSistema', async (req, res) => {
  try {
    const { nombres, apellidos, user, rol, telefon } = req.body;

    if (!nombres || !apellidos || !user || !rol || !telefon) {
      return res.status(400).json({ error: 400, message: 'Faltan datos requeridos del usuario.' });
    }

    const created = await usuario.crearUsuario({
      nombres: String(nombres).trim(),
      apellidos: String(apellidos).trim(),
      user: String(user).trim(),
      rol: Number(rol),
      telefon: String(telefon).trim(),
    });

    return res.status(201).json({
      success: true,
      usuario: created.usuario,
      tempPassword: created.tempPassword,
    });
  } catch (err) {
    if (err === 409) {
      return res.status(409).json({ error: 409, message: 'Ya existe un usuario con ese identificador.' });
    }
    console.error(err);
    return res.sendStatus(500);
  }
});

router.put('/usuariosSistema/:idUsuario', async (req, res) => {
  try {
    const { idUsuario } = req.params;
    const { nombres, apellidos, user, rol, telefon, estado } = req.body;

    if (!idUsuario || !nombres || !apellidos || !user || !rol || !telefon) {
      return res.status(400).json({ error: 400, message: 'Faltan datos requeridos del usuario.' });
    }

    const updated = await usuario.actualizarUsuario({
      idUsuario: Number(idUsuario),
      nombres: String(nombres).trim(),
      apellidos: String(apellidos).trim(),
      user: String(user).trim(),
      rol: Number(rol),
      telefon: String(telefon).trim(),
      estado: Number(estado ?? 1) ? 1 : 0,
    });

    return res.status(200).json({
      success: true,
      usuario: updated,
    });
  } catch (err) {
    if (err === 409) {
      return res.status(409).json({ error: 409, message: 'Ya existe un usuario con ese identificador.' });
    }
    console.error(err);
    return res.sendStatus(500);
  }
});

router.post('/usuariosSistema/:idUsuario/regenerarPassTemp', async (req, res) => {
  try {
    const { idUsuario } = req.params;

    if (!idUsuario) {
      return res.status(400).json({ error: 400, message: 'Falta idUsuario.' });
    }

    const result = await usuario.regenerarPasswordTemporal({
      idUsuario: Number(idUsuario),
    });

    return res.status(200).json(result);
  } catch (err) {
    if (err === 404) {
      return res.status(404).json({ error: 404, message: 'El usuario no existe.' });
    }
    console.error(err);
    return res.sendStatus(500);
  }
});

router.post('/usuariosSistema/asignarEvento', async (req, res) => {
  try {
    const { idUsuario, idEvento } = req.body;

    if (!idUsuario || !idEvento) {
      return res.status(400).json({ error: 400, message: 'Faltan idUsuario o idEvento.' });
    }

    const result = await usuario.asignarUsuarioAEvento({
      idUsuario: Number(idUsuario),
      idEvento: String(idEvento).trim(),
    });

    const refreshedUser = normalizeUsuarioPayload(await usuario.obtenerUsuarioSesionPorId(Number(idUsuario)));
    emitUserEvent(idUsuario, {
      type: 'usuario_eventos_actualizados',
      idUsuario: Number(idUsuario),
      idEvento: String(idEvento).trim(),
    });

    return res.status(200).json({
      success: true,
      alreadyAssigned: Boolean(result?.alreadyAssigned),
      usuario: refreshedUser,
    });
  } catch (err) {
    if (err === 404) {
      return res.status(404).json({ error: 404, message: 'El usuario no existe.' });
    }
    if (err === 409) {
      return res.status(409).json({ error: 409, message: 'Solo los usuarios cliente pueden tener eventos asignados.' });
    }
    console.error(err);
    return res.sendStatus(500);
  }
});

router.post('/usuariosSistema/quitarEvento', async (req, res) => {
  try {
    const { idUsuario, idEvento } = req.body;

    if (!idUsuario || !idEvento) {
      return res.status(400).json({ error: 400, message: 'Faltan idUsuario o idEvento.' });
    }

    await usuario.quitarUsuarioDeEvento({
      idUsuario: Number(idUsuario),
      idEvento: String(idEvento).trim(),
    });

    const refreshedUser = normalizeUsuarioPayload(await usuario.obtenerUsuarioSesionPorId(Number(idUsuario)));
    emitUserEvent(idUsuario, {
      type: 'usuario_eventos_actualizados',
      idUsuario: Number(idUsuario),
      idEvento: String(idEvento).trim(),
    });

    return res.status(200).json({
      success: true,
      usuario: refreshedUser,
    });
  } catch (err) {
    console.error(err);
    return res.sendStatus(500);
  }
});

router.post('/usuario/cambiarPasswordTemporal', async (req, res) => {
  try {
    const { user, passActual, passNueva } = req.body;

    if (!user || !passActual || !passNueva) {
      return res.status(400).json({ error: 400, message: 'Faltan datos requeridos.' });
    }

    if (String(passNueva).length < 8) {
      return res.status(400).json({ error: 400, message: 'La nueva contraseña debe tener al menos 8 caracteres.' });
    }

    await usuario.cambiarPasswordTemporal({
      user: String(user).trim(),
      passActual: String(passActual),
      passNueva: String(passNueva),
    });

    const loggedUser = normalizeUsuarioPayload(await usuario.loginUsuario(String(user).trim(), String(passNueva)));

    return res.status(200).json({
      success: true,
      userId: loggedUser.id,
      usuario: loggedUser,
    });
  } catch (err) {
    switch (err) {
      case 401:
        return res.status(401).json({ error: 401, message: 'La contraseña temporal es incorrecta.' });
      case 404:
        return res.status(404).json({ error: 404, message: 'El usuario no existe.' });
      case 409:
        return res.status(409).json({ error: 409, message: 'El usuario no tiene un cambio de contraseña temporal pendiente.' });
      default:
        console.error(err);
        return res.sendStatus(500);
    }
  }
});




  
  //____________________________ EVENTOS ___________________________________

router.post('/crearEvento', async (req, res) => {
  try {
    const { id, nombre, idTipoEvento, fechaHoraRecepcion, idLugarRecepcion } = req.body;

    if (!id || !nombre || !idTipoEvento || !fechaHoraRecepcion || !idLugarRecepcion) {
      return res.status(400).json({ error: 'Faltan datos requeridos' });
    }

    const resultado = await general.crearEvento(id, nombre, idTipoEvento, fechaHoraRecepcion, idLugarRecepcion);

    res.status(200).json({ success: true, idEvento: id });
  } catch (e) {
    console.error('❌ Error en /crearEvento:', e);
    res.sendStatus(500);
  }
});


router.get('/tiposEvento', async (req, res) => {
  try {
    const tipos = await general.tiposEvento();
    res.json(tipos);
  } catch (e) {
    console.error('❌ Error en /tiposEvento:', e);
    res.sendStatus(500);
  }
});

router.get('/lugares', async (req, res) => {
  try {
    const lugares = await general.lugares();
    res.json(lugares);
  } catch (e) {
    console.error('❌ Error en /lugares:', e);
    res.sendStatus(500);
  }
});

router.get('/eventos/activos', async (req, res) => {
  try {
    const eventos = await general.eventosActivos();

    eventos.forEach(e => {
      if (e.imagenPrincipal) {
        e.imagenPrincipal = publicEventoUrl(e.imagenPrincipal);
      }
    });

    res.json(eventos);
  } catch (e) {
    console.error(e);
    res.sendStatus(500);
  }
});

router.get('/eventos/inactivos', async (req, res) => {
  try {
    const eventos = await general.eventosInactivos();

    eventos.forEach(e => {
      if (e.imagenPrincipal) {
        e.imagenPrincipal = publicEventoUrl(e.imagenPrincipal);
      }
    });

    res.json(eventos);
  } catch (e) {
    console.error(e);
    res.sendStatus(500);
  }
});

router.get('/eventos/:idEvento/modulos-cliente', async (req, res) => {
  try {
    const { idEvento } = req.params;

    if (!idEvento) {
      return res.status(400).json({ error: 400, message: 'Falta idEvento.' });
    }

    const evento = await general.eventoXid(String(idEvento).trim());
    if (!evento?.length) {
      return res.status(404).json({ error: 404, message: 'El evento no existe.' });
    }

    const modules = await general.obtenerModulosClientePorEvento(String(idEvento).trim());

    return res.status(200).json({
      idEvento: String(idEvento).trim(),
      modules,
    });
  } catch (e) {
    console.error(e);
    return res.sendStatus(500);
  }
});

router.put('/eventos/:idEvento/modulos-cliente', async (req, res) => {
  try {
    const { idEvento } = req.params;
    const { modules } = req.body || {};

    if (!idEvento || !Array.isArray(modules)) {
      return res.status(400).json({ error: 400, message: 'Se requiere idEvento y un arreglo modules.' });
    }

    const evento = await general.eventoXid(String(idEvento).trim());
    if (!evento?.length) {
      return res.status(404).json({ error: 404, message: 'El evento no existe.' });
    }

    const updatedModules = await general.actualizarModulosClientePorEvento(String(idEvento).trim(), modules);

    return res.status(200).json({
      success: true,
      idEvento: String(idEvento).trim(),
      modules: updatedModules,
    });
  } catch (e) {
    console.error(e);
    return res.sendStatus(500);
  }
});

router.get('/eventos/:idEvento/invitacion-publica-config', async (req, res) => {
  try {
    const { idEvento } = req.params;

    if (!idEvento) {
      return res.status(400).json({ error: 400, message: 'Falta idEvento.' });
    }

    const evento = await general.eventoXid(String(idEvento).trim());
    if (!evento?.length) {
      return res.status(404).json({ error: 404, message: 'El evento no existe.' });
    }

    const config = await general.obtenerInvitacionPublicaEvento(String(idEvento).trim());
    return res.status(200).json(config);
  } catch (e) {
    console.error(e);
    return res.sendStatus(500);
  }
});

router.put('/eventos/:idEvento/invitacion-publica-config', async (req, res) => {
  try {
    const { idEvento } = req.params;

    if (!idEvento) {
      return res.status(400).json({ error: 400, message: 'Falta idEvento.' });
    }

    const config = await general.actualizarInvitacionPublicaEvento(String(idEvento).trim(), req.body || {});
    return res.status(200).json(config);
  } catch (e) {
    if (e === 404) {
      return res.status(404).json({ error: 404, message: 'El evento no existe.' });
    }

    console.error(e);
    return res.sendStatus(500);
  }
});

router.get('/public/invitaciones/:idInvitacion/:idInvitado', async (req, res) => {
  try {
    const payload = await general.obtenerInvitacionPublicaPorIds(req.params.idInvitacion, req.params.idInvitado);
    return res.status(200).json(payload);
  } catch (e) {
    if (e === 404) {
      return res.status(404).json({ error: 404, message: 'No encontramos la invitacion solicitada.' });
    }

    console.error(e);
    return res.sendStatus(500);
  }
});

router.put('/public/invitaciones/:idInvitacion/confirmacion', async (req, res) => {
  try {
    const { respuestas } = req.body || {};
    const payload = await general.confirmarInvitacionPublica(req.params.idInvitacion, respuestas);
    return res.status(200).json(payload);
  } catch (e) {
    if (e === 400) {
      return res.status(400).json({ error: 400, message: 'Debes enviar al menos una respuesta valida.' });
    }

    if (e === 404) {
      return res.status(404).json({ error: 404, message: 'Uno o mas invitados no pertenecen a esta invitacion.' });
    }

    console.error(e);
    return res.sendStatus(500);
  }
});


router.post('/eventoXinvitacion', async (req, res, next) => {

    try{
        let results = await general.eventoXinvitacion(req.body.idInvitacion);
        res.json(results);
    }catch(e){
        console.log(e);
        res.sendStatus(500);
    }

});

router.post('/ideventoXinvitacion', async (req, res, next) => {

    try{
        let results = await general.ideventoXinvitacion(req.body.idInvitacion);
        res.json(results);
    }catch(e){
        console.log(e);
        res.sendStatus(500);
    }

});

router.get('/mesasXevento/:idEvento', async (req, res, next) => {

    try{
        let results = await general.mesasXevento(req.params.idEvento);
        res.json(results);
    }catch(e){
        console.log(e);
        res.sendStatus(500);
    }

});

router.get('/eventoXid/:idEvento', async (req, res, next) => {

    try{
        let results = await general.eventoXid(req.params.idEvento);
        res.json(results[0]);
    }catch(e){
        console.log(e);
        res.sendStatus(500);
    }

});

router.get('/resumenEvento/:idEvento', async (req, res) => {
  try {
    let results = await general.resumenEvento(req.params.idEvento);
    let evento = results[0];

    if (evento.imagenPrincipal) {
      evento.imagenPrincipal = publicEventoUrl(evento.imagenPrincipal);
    }

    res.json(evento);
  } catch (e) {
    console.log(e);
    res.sendStatus(500);
  }
});

router.get('/eventos/detalle_completo/:idEvento', async (req, res) => {
  try {
    let results = await general.detalleEventoCompleto(req.params.idEvento);
    let evento = results[0];

    if (evento.imagenPrincipal) {
      evento.imagenPrincipal = publicEventoUrl(evento.imagenPrincipal);
    }

    res.json(evento);
  } catch (e) {
    console.log(e);
    res.sendStatus(500);
  }
});



router.get('/invitacionesXevento/:idEvento', async (req, res, next) => {

    try{
        let results = await general.invitacionesXevento(req.params.idEvento);
        res.json(results);
    }catch(e){
        console.log(e);
        res.sendStatus(500);
    }

});

router.get('/invitadosXinvitacion/:idInvitacion', async (req, res, next) => {

    try{
        let results = await general.invitadosXinvitaciones(req.params.idInvitacion);
        res.json(results);
    }catch(e){
        console.log(e);
        res.sendStatus(500);
    }

});

router.get('/invitadosXevento/:idEvento', async (req, res, next) => {

    try{
        let results = await general.invitadosXevento(req.params.idEvento);
        res.json(results);
    }catch(e){
        console.log(e);
        res.sendStatus(500);
    }

});

router.get('/eventos/:idEvento/invitados', async (req, res) => {
  try {
    const results = await general.invitadosClienteXevento(req.params.idEvento);
    res.json(results);
  } catch (e) {
    console.log(e);
    res.sendStatus(500);
  }
});

router.post('/eventos/:idEvento/invitados', async (req, res) => {
  try {
    const { nombre, telefono, whatsapp, parentescoId, grupoEdadId } = req.body;

    if (!String(nombre || '').trim()) {
      return res.status(400).json({ message: 'El nombre del invitado es obligatorio.' });
    }

    const parentescoParsed = parseOptionalPositiveInt(parentescoId);
    const grupoEdadParsed = parseOptionalPositiveInt(grupoEdadId);

    if (Number.isNaN(parentescoParsed)) {
      return res.status(400).json({ message: 'parentescoId invalido.' });
    }

    if (Number.isNaN(grupoEdadParsed)) {
      return res.status(400).json({ message: 'grupoEdadId invalido.' });
    }

    const result = await general.addInvitadoEvento(
      req.params.idEvento,
      String(nombre).trim(),
      telefono,
      Boolean(whatsapp),
      parentescoParsed,
      grupoEdadParsed
    );

    res.status(201).json(result);
  } catch (e) {
    console.log(e);
    res.sendStatus(500);
  }
});

router.put('/eventos/:idEvento/invitados/:idInvitado', async (req, res) => {
  try {
    const { nombre, telefono, whatsapp, parentescoId, grupoEdadId, estadoAsistenciaId } = req.body;

    if (!String(nombre || '').trim()) {
      return res.status(400).json({ message: 'El nombre del invitado es obligatorio.' });
    }

    const parentescoParsed = parseOptionalPositiveInt(parentescoId);
    const grupoEdadParsed = parseOptionalPositiveInt(grupoEdadId);

    if (Number.isNaN(parentescoParsed)) {
      return res.status(400).json({ message: 'parentescoId invalido.' });
    }

    if (Number.isNaN(grupoEdadParsed)) {
      return res.status(400).json({ message: 'grupoEdadId invalido.' });
    }

    const result = await general.actualizarInvitadoEvento(
      req.params.idEvento,
      req.params.idInvitado,
      String(nombre).trim(),
      telefono,
      Boolean(whatsapp),
      parentescoParsed,
      grupoEdadParsed,
      estadoAsistenciaId
    );

    res.json(result);
  } catch (e) {
    if (e === 404) {
      return res.status(404).json({ message: 'El invitado no pertenece al evento.' });
    }

    console.log(e);
    res.sendStatus(500);
  }
});

router.delete('/eventos/:idEvento/invitados/:idInvitado', async (req, res) => {
  try {
    await general.eliminarInvitadoEvento(req.params.idEvento, req.params.idInvitado);
    res.json({ ok: true });
  } catch (e) {
    if (e === 404) {
      return res.status(404).json({ message: 'El invitado no pertenece al evento.' });
    }

    console.log(e);
    res.sendStatus(500);
  }
});

router.get('/eventos/:idEvento/invitaciones', async (req, res) => {

    try {
        const invitaciones = await general.invitacionesXevento(req.params.idEvento);
        const detalle = await Promise.all((invitaciones || []).map((item) => general.eventoXinvitacion(item.id)));
        res.json(detalle);
    } catch (e) {
        console.log(e);
        res.sendStatus(500);
    }

});

router.post('/eventos/:idEvento/invitaciones', async (req, res) => {

    try {
        const label = String(req.body.label || '').trim();
        const mensajePersonalizado = String(req.body.mensajePersonalizado || '').trim();
        const invitacion = await general.crearInvitacionEvento(req.params.idEvento, generaCodigo(10), label, mensajePersonalizado);
        res.status(201).json(invitacion);
    } catch (e) {
        console.log(e);
        res.sendStatus(500);
    }

});

router.put('/eventos/:idEvento/invitaciones/:idInvitacion', async (req, res) => {

    try {
        const label = String(req.body.label || '').trim();
        const mensajePersonalizado = String(req.body.mensajePersonalizado || '').trim();
        const enviada = parseOptionalBoolean(req.body.enviada);
        await general.actualizarInvitacionEvento(req.params.idEvento, req.params.idInvitacion, label, mensajePersonalizado, enviada);
        const invitacion = await general.eventoXinvitacion(req.params.idInvitacion);
        res.json(invitacion);
    } catch (e) {
        if (e === 404) {
            return res.status(404).json({ message: 'La invitacion no pertenece al evento.' });
        }

        console.log(e);
        res.sendStatus(500);
    }

});

router.post('/eventos/:idEvento/invitaciones/:idInvitacion/invitados', async (req, res) => {

    try {
        const { idInvitado, principal } = req.body;

        if (!idInvitado) {
            return res.status(400).json({ message: 'Falta idInvitado.' });
        }

        await general.asignarInvitadoEventoAInvitacion(req.params.idEvento, req.params.idInvitacion, idInvitado, Boolean(principal));
        const invitacion = await general.eventoXinvitacion(req.params.idInvitacion);
        res.json(invitacion);
    } catch (e) {
        if (e === 404) {
            return res.status(404).json({ message: 'El invitado o la invitacion no pertenecen al evento.' });
        }

        console.log(e);
        res.sendStatus(500);
    }

});

router.delete('/eventos/:idEvento/invitaciones/:idInvitacion/invitados/:idInvitado', async (req, res) => {

    try {
        await general.quitarInvitadoEventoDeInvitacion(req.params.idEvento, req.params.idInvitacion, req.params.idInvitado);
        const invitacion = await general.eventoXinvitacion(req.params.idInvitacion);
        res.json(invitacion);
    } catch (e) {
        if (e === 404) {
            return res.status(404).json({ message: 'El invitado no pertenece al evento.' });
        }

        console.log(e);
        res.sendStatus(500);
    }

});

router.put('/eventos/:idEvento/invitaciones/:idInvitacion/principal/:idInvitado', async (req, res) => {

    try {
        await general.definirPrincipalInvitacion(req.params.idEvento, req.params.idInvitacion, req.params.idInvitado);
        const invitacion = await general.eventoXinvitacion(req.params.idInvitacion);
        res.json(invitacion);
    } catch (e) {
        if (e === 404) {
            return res.status(404).json({ message: 'El invitado no hace parte de la invitacion.' });
        }

        console.log(e);
        res.sendStatus(500);
    }

});

router.delete('/eventos/:idEvento/invitaciones/:idInvitacion', async (req, res) => {

    try {
        await general.eliminarInvitacionEvento(req.params.idEvento, req.params.idInvitacion);
        res.json({ ok: true });
    } catch (e) {
        if (e === 404) {
            return res.status(404).json({ message: 'La invitacion no pertenece al evento.' });
        }

        console.log(e);
        res.sendStatus(500);
    }

});

router.post('/addMesa', async (req, res, next) => {

    try{
        let results = await general.addMesa(req.body.idEvento, req.body.numMesa);
        res.json(results);
    }catch(e){
        console.log(e);
        res.sendStatus(500);
    }

});


router.post('/addInvitado', async (req, res, next) => {

    try{
        let results = await general.addInvitado(req.body.idInvitacion, req.body.nombre, req.body.principal, req.body.telefono, req.body.wp, req.body.parentesco, req.body.grupoEdad);
        res.json(results);
    }catch(e){
        console.log(e);
        res.sendStatus(500);
    }

});

router.post('/importInvitacionesExcel', async (req, res, next) => {

    try{
        let results = await general.importInvitacionesExcel(req.body.data, req.body.idEvento);
        res.json(results);
    }catch(e){
        console.log(e);
        res.sendStatus(500);
    }

});

router.post('/updConfirmado', async (req, res, next) => {

    try{
        let results = await general.updConfirmado(req.body.idInvitado, req.body.confirmado);
        res.json(results);
    }catch(e){
        console.log(e);
        res.sendStatus(500);
    }

});

router.post('/updLabelInvitacion', async (req, res, next) => {

    try{
        const label = req.body.label ?? req.body.mensaje;
        let results = await general.updLabelInvitacion(req.body.idInvitacion, label);
        res.json(results);
    }catch(e){
        console.log(e);
        res.sendStatus(500);
    }

});

router.post('/updMensajeInvitacion', async (req, res, next) => {

    try{
        const label = req.body.label ?? req.body.mensaje;
        let results = await general.updLabelInvitacion(req.body.idInvitacion, label);
        res.json(results);
    }catch(e){
        console.log(e);
        res.sendStatus(500);
    }

});

router.post('/delInvitacion', async (req, res, next) => {

    try{
        let results = await general.delInvitacion(req.body.idInvitacion);
        res.json(results);
    }catch(e){
        console.log(e);
        res.sendStatus(500);
    }

});

router.post('/delInvitado', async (req, res, next) => {

    try{
        let results = await general.delInvitado(req.body.idInvitacion, req.body.idInvitado);
        res.json(results);
    }catch(e){
        console.log(e);
        res.sendStatus(500);
    }

});


router.post('/addInvitacion', async (req, res, next) => {

    try{
        let results = await general.addInvitacion(req.body.idEvento, generaCodigo(10));
        res.json(results);
    }catch(e){
        console.log(e);
        res.sendStatus(500);
    }

});

module.exports = router;
