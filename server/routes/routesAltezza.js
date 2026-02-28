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
    const rutaPublica = (BASE_URL_IMAGENES || '') + '/scrAppaltezza/images/eventos' + rutaRelativa;
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
    const user = await usuario.loginUsuario(correo, pass);
    console.log(user);
     return res.status(200).json({
      success: true,
      userId: user.id,
      usuario: user, 
    });
  } catch (err) {
    switch (err) {
      case 404:
        return res.status(200).json({ error: 404, message: 'Verificar credenciales ingresadas.' });
      case 401:
        return res.status(200).json({ error: 401, message: 'Contraseña incorrecta' });
      case 406:
        return res.status(200).json({ error: 406, message: 'Usuario sin contraseña asignada' });
      case 409:
        return res.status(200).json({ error: 409, message: 'Ingreso con contraseña temporal' });
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
        e.imagenPrincipal = `${BASE_URL_IMAGENES}/${e.imagenPrincipal}`;
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
        e.imagenPrincipal = `${BASE_URL_IMAGENES}/${e.imagenPrincipal}`;
      }
    });

    res.json(eventos);
  } catch (e) {
    console.error(e);
    res.sendStatus(500);
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
      evento.imagenPrincipal = `${BASE_URL_IMAGENES}/${evento.imagenPrincipal}`;
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
      evento.imagenPrincipal = `${BASE_URL_IMAGENES}/${evento.imagenPrincipal}`;
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

router.post('/updMensajeInvitacion', async (req, res, next) => {

    try{
        let results = await general.updMensajeInvitacion(req.body.idInvitacion, req.body.mensaje);
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

router.post('/agregarUsuario', async (req, res, next) => {

    try{
        let results = await general.usuariosSistema();
        res.json(results);
    }catch(e){
        console.log(e);
        res.sendStatus(500);
    }

});


module.exports = router;