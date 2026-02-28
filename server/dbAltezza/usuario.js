const pool = require('./connection.js');

let csmDB = {};



csmDB.loginUsuario = (correo, pass) => {
  return new Promise((resolve, reject) => {
    if (!pass) return reject(404);

    pool.query(
      `SELECT 
         uss.id,
         uss.nombres,
         uss.apellidos,
         uss.user,
         uss.rol,
         rs.nombre AS rolNombre,
         uss.telefon,
         uss.pass,
         uss.passTemp,
         -- Solo clientes (rol = 2) reciben idEventoAsignado
         CASE 
           WHEN uss.rol = 2 THEN ehu.idEvento
           ELSE NULL
         END AS idEventoAsignado
       FROM usuariosistema AS uss
       LEFT JOIN rolSistema AS rs 
         ON rs.id = uss.rol
       LEFT JOIN evento_has_usuario AS ehu
         ON ehu.idUsuario = uss.id
       WHERE uss.user = ?
       LIMIT 1`,
      [correo],
      (err, results) => {
        if (err) return reject(err);
        if (!results || results.length === 0) return reject(404);

        const usuario = results[0];

        // Sin contraseña asignada en DB
        if (!usuario.pass) return reject(406);

        // Contraseña incorrecta
        if (usuario.pass !== pass) return reject(401);

        // Contraseña temporal en uso
        if (usuario.passTemp && usuario.pass === usuario.passTemp) return reject(409);

        // Respuesta segura al front (sin pass/passTemp)
        const { pass: _omit, passTemp: _omitTemp, ...safeUser } = usuario;
        // safeUser ahora incluye: idEventoAsignado (solo clientes), además de id, nombres, rol, etc.
        return resolve(safeUser);
      }
    );
  });
};



csmDB.listarUsuarios = () => {
  return new Promise((resolve, reject) => {
    pool.query(`
      SELECT id, nombre, correo, estado
      FROM usuario
      ORDER BY id DESC
    `, (err, results) => {
      if (err) {
        console.log(err);
        return reject(err);
      }

      const response = JSON.parse(JSON.stringify(results));
      return resolve(response);
    });
  });
};


module.exports = csmDB;