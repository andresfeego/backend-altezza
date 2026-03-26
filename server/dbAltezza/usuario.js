const pool = require('./connection.js');

let csmDB = {};

function generarCodigo(len = 8) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let code = '';
  for (let i = 0; i < len; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

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
         CASE 
           WHEN uss.rol = 2 THEN (
             SELECT MIN(ehu2.idEvento)
             FROM evento_has_usuario AS ehu2
             WHERE ehu2.idUsuario = uss.id
           )
           ELSE NULL
         END AS idEventoAsignado
       FROM usuarioSistema AS uss
       LEFT JOIN rolSistema AS rs 
         ON rs.id = uss.rol
       WHERE uss.user = ?
       LIMIT 1`,
      [correo],
      (err, results) => {
        if (err) return reject(err);
        if (!results || results.length === 0) return reject(404);

        const usuario = results[0];

        if (!usuario.pass) return reject(406);
        if (usuario.pass !== pass) return reject(401);
        if (usuario.passTemp && usuario.pass === usuario.passTemp) return reject(409);

        const { pass: _omit, passTemp: _omitTemp, ...safeUser } = usuario;
        return resolve(safeUser);
      }
    );
  });
};

csmDB.listarRoles = () => {
  return new Promise((resolve, reject) => {
    pool.query(
      `
      SELECT id, nombre
      FROM rolSistema
      ORDER BY id ASC
      `,
      (err, results) => {
        if (err) return reject(err);
        return resolve(JSON.parse(JSON.stringify(results)));
      }
    );
  });
};

csmDB.listarUsuarios = () => {
  return new Promise((resolve, reject) => {
    pool.query(
      `
      SELECT 
        uss.id,
        uss.nombres,
        uss.apellidos,
        uss.user,
        uss.rol,
        rs.nombre AS rolNombre,
        uss.telefon,
        uss.estado,
        GROUP_CONCAT(ehu.idEvento ORDER BY ehu.idEvento SEPARATOR ',') AS eventosAsignados
      FROM usuarioSistema AS uss
      LEFT JOIN rolSistema AS rs ON rs.id = uss.rol
      LEFT JOIN evento_has_usuario AS ehu ON ehu.idUsuario = uss.id
      GROUP BY uss.id, uss.nombres, uss.apellidos, uss.user, uss.rol, rs.nombre, uss.telefon, uss.estado
      ORDER BY uss.id DESC
      `,
      (err, results) => {
        if (err) {
          console.log(err);
          return reject(err);
        }

        const response = JSON.parse(JSON.stringify(results)).map((user) => ({
          ...user,
          eventosAsignados: user.eventosAsignados ? user.eventosAsignados.split(',') : [],
        }));

        return resolve(response);
      }
    );
  });
};

csmDB.crearUsuario = ({ nombres, apellidos, user, rol, telefon }) => {
  return new Promise((resolve, reject) => {
    const tempPassword = generarCodigo(8);

    pool.query(
      `
      SELECT id
      FROM usuarioSistema
      WHERE user = ?
      LIMIT 1
      `,
      [user],
      (err, existing) => {
        if (err) return reject(err);
        if (existing?.length) return reject(409);

        pool.query(
          `
          INSERT INTO usuarioSistema (nombres, apellidos, user, rol, telefon, pass, passTemp)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          `,
          [nombres, apellidos, user, rol, telefon, tempPassword, tempPassword],
          (insertErr, insertResult) => {
            if (insertErr) return reject(insertErr);

            pool.query(
              `
              SELECT 
                uss.id,
                uss.nombres,
                uss.apellidos,
                uss.user,
                uss.rol,
                rs.nombre AS rolNombre,
                uss.telefon
              FROM usuarioSistema AS uss
              LEFT JOIN rolSistema AS rs ON rs.id = uss.rol
              WHERE uss.id = ?
              LIMIT 1
              `,
              [insertResult.insertId],
              (selectErr, rows) => {
                if (selectErr) return reject(selectErr);

                return resolve({
                  usuario: {
                    ...JSON.parse(JSON.stringify(rows[0] || {})),
                    eventosAsignados: [],
                  },
                  tempPassword,
                });
              }
            );
          }
        );
      }
    );
  });
};

csmDB.actualizarUsuario = ({ idUsuario, nombres, apellidos, user, rol, telefon, estado }) => {
  return new Promise((resolve, reject) => {
    pool.query(
      `
      SELECT id
      FROM usuarioSistema
      WHERE user = ? AND id <> ?
      LIMIT 1
      `,
      [user, idUsuario],
      (err, existing) => {
        if (err) return reject(err);
        if (existing?.length) return reject(409);

        pool.query(
          `
          UPDATE usuarioSistema
          SET nombres = ?, apellidos = ?, user = ?, rol = ?, telefon = ?, estado = ?
          WHERE id = ?
          `,
          [nombres, apellidos, user, rol, telefon, estado, idUsuario],
          (updateErr) => {
            if (updateErr) return reject(updateErr);
            return csmDB.obtenerUsuarioPorId(idUsuario).then(resolve).catch(reject);
          }
        );
      }
    );
  });
};

csmDB.regenerarPasswordTemporal = ({ idUsuario }) => {
  return new Promise((resolve, reject) => {
    const tempPassword = generarCodigo(8);

    pool.query(
      `
      UPDATE usuarioSistema
      SET pass = ?, passTemp = ?
      WHERE id = ?
      `,
      [tempPassword, tempPassword, idUsuario],
      (err, results) => {
        if (err) return reject(err);
        if (!results?.affectedRows) return reject(404);

        return resolve({
          success: true,
          tempPassword,
        });
      }
    );
  });
};

csmDB.asignarUsuarioAEvento = ({ idUsuario, idEvento }) => {
  return new Promise((resolve, reject) => {
    pool.query(
      `
      SELECT idEvento, idUsuario
      FROM evento_has_usuario
      WHERE idEvento = ? AND idUsuario = ?
      LIMIT 1
      `,
      [idEvento, idUsuario],
      (err, existing) => {
        if (err) return reject(err);
        if (existing?.length) return resolve({ alreadyAssigned: true });

        pool.query(
          `
          INSERT INTO evento_has_usuario (idEvento, idUsuario)
          VALUES (?, ?)
          `,
          [idEvento, idUsuario],
          (insertErr) => {
            if (insertErr) return reject(insertErr);
            return resolve({ success: true });
          }
        );
      }
    );
  });
};

csmDB.quitarUsuarioDeEvento = ({ idUsuario, idEvento }) => {
  return new Promise((resolve, reject) => {
    pool.query(
      `
      DELETE FROM evento_has_usuario
      WHERE idEvento = ? AND idUsuario = ?
      `,
      [idEvento, idUsuario],
      (err, results) => {
        if (err) return reject(err);
        return resolve({
          success: true,
          affectedRows: results?.affectedRows || 0,
        });
      }
    );
  });
};

csmDB.obtenerUsuarioPorId = (idUsuario) => {
  return new Promise((resolve, reject) => {
    pool.query(
      `
      SELECT 
        uss.id,
        uss.nombres,
        uss.apellidos,
        uss.user,
        uss.rol,
        rs.nombre AS rolNombre,
        uss.telefon,
        uss.estado,
        GROUP_CONCAT(ehu.idEvento ORDER BY ehu.idEvento SEPARATOR ',') AS eventosAsignados
      FROM usuarioSistema AS uss
      LEFT JOIN rolSistema AS rs ON rs.id = uss.rol
      LEFT JOIN evento_has_usuario AS ehu ON ehu.idUsuario = uss.id
      WHERE uss.id = ?
      GROUP BY uss.id, uss.nombres, uss.apellidos, uss.user, uss.rol, rs.nombre, uss.telefon, uss.estado
      LIMIT 1
      `,
      [idUsuario],
      (err, results) => {
        if (err) return reject(err);
        if (!results?.length) return resolve(null);

        const user = JSON.parse(JSON.stringify(results[0]));
        return resolve({
          ...user,
          eventosAsignados: user.eventosAsignados ? user.eventosAsignados.split(',') : [],
        });
      }
    );
  });
};

csmDB.cambiarPasswordTemporal = ({ user, passActual, passNueva }) => {
  return new Promise((resolve, reject) => {
    pool.query(
      `
      SELECT id, user, pass, passTemp
      FROM usuarioSistema
      WHERE user = ?
      LIMIT 1
      `,
      [user],
      (err, results) => {
        if (err) return reject(err);
        if (!results?.length) return reject(404);

        const usuario = results[0];

        if (!usuario.pass || !usuario.passTemp || usuario.pass !== usuario.passTemp) {
          return reject(409);
        }

        if (usuario.pass !== passActual) {
          return reject(401);
        }

        pool.query(
          `
          UPDATE usuarioSistema
          SET pass = ?, passTemp = NULL
          WHERE id = ?
          `,
          [passNueva, usuario.id],
          (updateErr) => {
            if (updateErr) return reject(updateErr);
            return resolve({ success: true });
          }
        );
      }
    );
  });
};

module.exports = csmDB;
