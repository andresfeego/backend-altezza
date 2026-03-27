const pool = require('./connection.js');

let csmDB = {};
const CLIENT_MODULE_CATALOG = [
  { key: 'feed', label: 'Feed del evento', required: true },
  { key: 'datos_evento', label: 'Datos del evento', required: true },
  { key: 'calculador_trago', label: 'Calculador de trago', required: false },
  { key: 'fotos_compartidas', label: 'Fotos compartidas', required: false },
  { key: 'inspiracion', label: 'Inspiración', required: false },
  { key: 'invitados', label: 'Invitados', required: false },
  { key: 'invitaciones', label: 'Invitaciones', required: false },
  { key: 'acomodacion', label: 'Acomodación', required: false },
  { key: 'paletas_colores', label: 'Paletas de colores', required: false },
  { key: 'pastel', label: 'Pastel', required: false },
  { key: 'pendientes', label: 'Pendientes', required: false },
  { key: 'timming', label: 'Timming', required: false },
  { key: 'tips_boda', label: 'Tips de boda', required: false },
  { key: 'wedding_day', label: 'Wedding day', required: false },
];

function buildClientModulesResponse(rows = []) {
  const enabledByKey = rows.reduce((acc, row) => {
    acc[row.moduloKey] = Boolean(row.estado);
    return acc;
  }, {});

  return CLIENT_MODULE_CATALOG.map((moduleDef) => ({
    key: moduleDef.key,
    label: moduleDef.label,
    required: moduleDef.required,
    enabled: moduleDef.required ? true : Boolean(enabledByKey[moduleDef.key]),
  }));
}

generaCodigo = (length) => {
    var result = '';
    var characters = 'abcdefghijklmnopqrstuvwxyz0123456789';
    var charactersLength = characters.length;
    for (var i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}


csmDB.eventosActivos = () => {
  return new Promise((resolve, reject) => {
    pool.query(
      `SELECT 
        e.id,
        e.imagenPrincipal,
        e.nombre,
        e.estado,
        e.idTipoEvento,
        t.nombre AS tipoEvento
      FROM evento AS e
      JOIN tipo_evento AS t ON e.idTipoEvento = t.id
      WHERE e.estado = 1`,
      (err, results) => {
        if (err) {
          return reject(err);
        } else {
          return resolve(results);
        }
      }
    );
  });
};

csmDB.eventosInactivos = () => {
  return new Promise((resolve, reject) => {
    pool.query(
      `SELECT 
        e.id,
        e.nombre,
        e.estado,
        e.idTipoEvento,
        t.nombre AS tipoEvento
      FROM evento AS e
      JOIN tipo_evento AS t ON e.idTipoEvento = t.id
      WHERE e.estado = 0`,
      (err, results) => {
        if (err) {
          return reject(err);
        } else {
          return resolve(results);
        }
      }
    );
  });
};



csmDB.parentescos = () => {

    return new Promise((resolve, reject) => {

        pool.query(`SELECT * 

                        FROM parentesco AS  pa

                        ORDER BY pa.id ASC`, (err, results) => {

            if (err) {
                return reject(err);
            } else {


                return resolve(results);
            }
        });

    })

};

csmDB.gruposEdad = () => {

    return new Promise((resolve, reject) => {

        pool.query(`SELECT * 

                        FROM grupoEdad AS  ge

                        ORDER BY ge.id ASC`, (err, results) => {

            if (err) {
                return reject(err);
            } else {


                return resolve(results);
            }
        });

    })

};


csmDB.crearEvento = (id, nombre, idTipoEvento, fechaHoraRecepcion, idLugarRecepcion) => {
  return new Promise((resolve, reject) => {
    pool.query(`
      INSERT INTO evento (
        id,
        nombre,
        idTipoEvento,
        fechaHoraCeremonia,
        fechaHoraRecepcion,
        idLugarRecepcion,
        estado,
        imagenPrincipal
      ) VALUES (?, ?, ?, ?, ?, ?, 1, NULL)
    `,
    [id, nombre, idTipoEvento, fechaHoraRecepcion, fechaHoraRecepcion, idLugarRecepcion],
    (err, results) => {
      if (err) return reject(err);
      return resolve(results);
    });
  });
};




csmDB.tiposEvento = () => {
  return new Promise((resolve, reject) => {
    pool.query(
      `SELECT id, nombre FROM tipo_evento ORDER BY nombre ASC`,
      (err, results) => {
        if (err) return reject(err);
        return resolve(results);
      }
    );
  });
};

csmDB.lugares = () => {
  return new Promise((resolve, reject) => {
    pool.query(
      `SELECT id, nombre FROM lugar ORDER BY nombre ASC`,
      (err, results) => {
        if (err) return reject(err);
        return resolve(results);
      }
    );
  });
};
csmDB.eventoXid = (idEvento) => {

    return new Promise((resolve, reject) => {

        pool.query(`SELECT * 

                        FROM evento AS  ev
                        WHERE ev.id = ?
                        
                        `, idEvento, (err, results) => {

            if (err) {
                return reject(err);
            } else {


                return resolve(results);
            }
        });

    })

};

csmDB.resumenEvento = (idEvento) => {

    return new Promise((resolve, reject) => {

        pool.query(`SELECT 
                    e.nombre AS nombreEvento,
                    e.id AS idEvento, 
                    e.fechaHoraCeremonia AS fechaEvento,
                    e.numeroInvitados,
                    t.nombre AS nombreTipoEvento,
                    lc.nombre AS nombreLugarCeremonia,
                    lr.nombre AS nombreLugarRecepcion
                    FROM evento e
                    LEFT JOIN tipo_evento t ON e.idTipoEvento = t.id
                    LEFT JOIN lugar lc ON e.idLugarCeremonia = lc.id
                    LEFT JOIN lugar lr ON e.idLugarRecepcion = lr.id
                    WHERE e.id = ?;
                        
                        `, idEvento, (err, results) => {

            if (err) {
                return reject(err);
            } else {


                return resolve(results);
            }
        });

    })

};

csmDB.detalleEventoCompleto = (idEvento) => {
  return new Promise((resolve, reject) => {
    pool.query(
      `
      SELECT 
        e.*, 
        t.nombre AS nombreTipoEvento,
        lc.nombre AS nombreLugarCeremonia,
        lr.nombre AS nombreLugarRecepcion
      FROM evento e
      LEFT JOIN tipo_evento t ON e.idTipoEvento = t.id
      LEFT JOIN lugar lc ON e.idLugarCeremonia = lc.id
      LEFT JOIN lugar lr ON e.idLugarRecepcion = lr.id
      WHERE e.id = ?
      `,
      idEvento,
      (err, results) => {
        if (err) {
          return reject(err);
        } else {
          return resolve(results);
        }
      }
    );
  });
};

csmDB.actualizarImagenEvento = (idEvento, rutaRelativa) => {
  return new Promise((resolve, reject) => {
    pool.query(
      'UPDATE evento SET imagenPrincipal = ? WHERE id = ?',
      [rutaRelativa, idEvento],
      (err, results) => {
        if (err) return reject(err);
        resolve(results);
      }
    );
  });
};

csmDB.obtenerModulosClientePorEvento = (idEvento) => {
  return new Promise((resolve, reject) => {
    pool.query(
      `
      SELECT moduloKey, estado
      FROM evento_modulo_cliente
      WHERE idEvento = ?
      `,
      [idEvento],
      (err, results) => {
        if (err) return reject(err);
        return resolve(buildClientModulesResponse(results || []));
      }
    );
  });
};

csmDB.actualizarModulosClientePorEvento = (idEvento, modules = []) => {
  return new Promise((resolve, reject) => {
    const optionalModules = CLIENT_MODULE_CATALOG.filter((moduleDef) => !moduleDef.required);
    const allowedKeys = new Set(optionalModules.map((moduleDef) => moduleDef.key));
    const normalized = modules
      .filter((moduleItem) => allowedKeys.has(moduleItem?.key))
      .map((moduleItem) => [idEvento, moduleItem.key, moduleItem.enabled ? 1 : 0]);

    pool.getConnection((connectionErr, connection) => {
      if (connectionErr) return reject(connectionErr);

      connection.beginTransaction((txErr) => {
        if (txErr) {
          connection.release();
          return reject(txErr);
        }

        connection.query(
          'DELETE FROM evento_modulo_cliente WHERE idEvento = ?',
          [idEvento],
          (deleteErr) => {
            if (deleteErr) {
              return connection.rollback(() => {
                connection.release();
                reject(deleteErr);
              });
            }

            if (!normalized.length) {
              return connection.commit((commitErr) => {
                connection.release();
                if (commitErr) return reject(commitErr);
                return resolve(buildClientModulesResponse([]));
              });
            }

            connection.query(
              `
              INSERT INTO evento_modulo_cliente (idEvento, moduloKey, estado, updatedAt)
              VALUES ?
              `,
              [normalized.map(([evento, key, estado]) => [evento, key, estado, new Date()])],
              (insertErr) => {
                if (insertErr) {
                  return connection.rollback(() => {
                    connection.release();
                    reject(insertErr);
                  });
                }

                return connection.commit((commitErr) => {
                  connection.release();
                  if (commitErr) return reject(commitErr);
                  return resolve(buildClientModulesResponse(normalized.map(([evento, moduloKey, estado]) => ({ idEvento: evento, moduloKey, estado }))));
                });
              }
            );
          }
        );
      });
    });
  });
};



csmDB.mesasXevento = (idEvento) => {

    return new Promise((resolve, reject) => {

        pool.query(`SELECT * 

                        FROM mesa AS  me

                        JOIN evento_has_mesa AS ehm
                        ON ehm.idMesa = me.id

                        WHERE ehm.idEvento = ?

                        ORDER BY me.id ASC`, idEvento, (err, results) => {

            if (err) {
                return reject(err);
            } else {


                return resolve(results);
            }
        });

    })

};

csmDB.login = (usuario, password) => {

    return new Promise((resolve, reject) => {

        pool.query(`SELECT * 

                        FROM mesa AS  me

                        JOIN evento_has_mesa AS ehm
                        ON ehm.idMesa = me.id

                        WHERE ehm.idEvento = ?

                        ORDER BY me.id ASC`, idEvento, (err, results) => {

            if (err) {
                return reject(err);
            } else {


                return resolve(results);
            }
        });

    })

};

csmDB.ideventoXinvitacion = (idInvitacion) => {

    return new Promise((resolve, reject) => {

        pool.query(`SELECT ev.id

                        FROM evento AS  ev

                        JOIN evento_has_invitacion AS ehi
                        ON ehi.idEvento = ev.id

                        JOIN invitacion AS inv
                        ON inv.id = ehi.idInvitacion

                        WHERE ehi.idInvitacion = ?

                        `, idInvitacion, async (err, results) => {

            if (err) {
                return reject(err);
            } else {
                const invitacion = results[0]
                return resolve(invitacion);
            }
        });

    })

};

csmDB.eventoXinvitacion = (idInvitacion) => {

    return new Promise((resolve, reject) => {

        pool.query(`SELECT ev.*, inv.*, ehi.*

                        FROM evento AS  ev

                        JOIN evento_has_invitacion AS ehi
                        ON ehi.idEvento = ev.id

                        JOIN invitacion AS inv
                        ON inv.id = ehi.idInvitacion

                        WHERE ehi.idInvitacion = ?

                        `, idInvitacion, async (err, results) => {

            if (err) {
                return reject(err);
            } else {
                const invitacion = results[0]
                invitacion['listaInvitados'] = await csmDB.invitadosXinvitaciones(idInvitacion)
                return resolve(invitacion);
            }
        });

    })

};

csmDB.invitacionesXevento = (idEvento) => {

    return new Promise((resolve, reject) => {

        pool.query(`SELECT inv.* 

                        FROM invitacion AS  inv
                        
                        JOIN evento_has_invitacion AS ehi
                        ON ehi.idInvitacion = inv.id

                        WHERE ehi.idEvento = ?

                        ORDER BY inv.autoinc DESC`, idEvento, (err, results) => {

            if (err) {
                return reject(err);
            } else {


                return resolve(results);
            }
        });

    })

};

csmDB.invitadosXinvitaciones = (idInvitacion) => {

    return new Promise((resolve, reject) => {

        pool.query(`SELECT inv.* 

                        FROM invitado AS  inv
                        
                        JOIN invitacion_has_invitado AS ihi
                        ON ihi.idInvitado = inv.id

                        WHERE ihi.idInvitacion = ?

                        ORDER BY inv.principal DESC`, idInvitacion, (err, results) => {

            if (err) {
                return reject(err);
            } else {


                return resolve(results);
            }
        });

    })

};

csmDB.invitadosXevento = (idEvento) => {

    return new Promise((resolve, reject) => {

        pool.query(` SELECT 
        @numero := IF(@prev = subquery.idInvitacion, @numero, @numero + 1) AS Id_invitacion,
        subquery.nombre AS Nombre_del_invitado,
        subquery.parentesco AS Parentesco,
        subquery.grupo as Grupo_edad,
        subquery.confirmado as Estado_invitación,
        @prin := IF(subquery.principal = 1, 'Principal', '') AS Principal,
        subquery.mensaje AS Mensaje,
        @prev := subquery.idInvitacion as Id_inivtación_altezza
    FROM (
        SELECT 
            invita.id as idInvitacion, 
            invita.mensaje, 
            inv.id as idInvitado, 
            inv.nombre,
            inv.principal,
            parent.parentesco,
            ge.grupo,
            conf.confirmado
        FROM evento AS eve
        JOIN evento_has_invitacion AS ehi ON ehi.idEvento = eve.id
        JOIN invitacion AS invita ON invita.id = ehi.idInvitacion
        JOIN invitacion_has_invitado AS ihi ON ihi.idInvitacion = invita.id
        JOIN invitado AS inv ON ihi.idInvitado = inv.id
        JOIN parentesco AS parent ON inv.parentesco = parent.id
        JOIN grupoEdad AS ge ON inv.grupoEdad = ge.id
        JOIN confirmado AS conf ON inv.confirmado = conf.id
        WHERE eve.id = ?
        ORDER BY invita.id ASC,
        inv.principal DESC
    ) AS subquery
    CROSS JOIN (SELECT @numero := 0, @prev := '') AS vars;  `, idEvento, (err, results) => {

            if (err) {
                return reject(err);
            } else {


                return resolve(results);
            }
        });

    })

};

csmDB.addMesa = (idEvento, numMesa) => {

    return new Promise((resolve, reject) => {

        pool.query(`INSERT INTO mesa ( numeroMesa ) VALUES (?)`, [numMesa], (err, results) => {

            if (err) {
                return reject(err);
            } else {

                let idMesa = results.insertId

                pool.query(`INSERT INTO evento_has_mesa (idEvento, idMesa) VALUES (?, ?)`, [idEvento, idMesa], (err, results) => {

                    if (err) {
                        return reject(err);
                    } else {
                        resolve(results)
                    }

                });
            }
        });

    })

};


csmDB.updConfirmado = (idInvitado, confirmado) => {

    return new Promise((resolve, reject) => {

        pool.query(`UPDATE invitado SET confirmado = ? WHERE id = ?`, [confirmado, idInvitado], (err, results) => {

            if (err) {
                return reject(err);
            } else {
                return resolve(results);
            }
        });
    })

};

csmDB.updMensajeInvitacion = (idInvitacion, mensaje) => {

    return new Promise((resolve, reject) => {

        pool.query(`UPDATE invitacion SET invitacion.mensaje = ? WHERE invitacion.id = ?`, [mensaje, idInvitacion], (err, results) => {

            if (err) {
                return reject(err);
            } else {
                return resolve(results);
            }
        });
    })

};

csmDB.addInvitado = (idInvitacion, nombre, principal, telefono, wp, parentesco, grupoEdad) => {

    return new Promise((resolve, reject) => {

        pool.query(`INSERT INTO invitado ( nombre, principal, telefono, wp, parentesco, grupoEdad ) VALUES (?,?,?,?,?,?)`, [nombre, principal, telefono, wp, parentesco, grupoEdad], (err, results) => {

            if (err) {
                return reject(err);
            } else {

                let idInvitado = results.insertId

                pool.query(`INSERT INTO invitacion_has_invitado (idInvitacion, idInvitado) VALUES (?, ?)`, [idInvitacion, idInvitado], (err, results) => {

                    if (err) {
                        return reject(err);
                    } else {
                        resolve(results)
                    }

                });
            }
        });

    })

};

csmDB.importInvitacionesExcel = (data, idEvento) => {

    return new Promise((resolve, reject) => {
        return Promise.all(
            Object.keys(data).map(async (obj, i) => {
                try {
                    const idInvitacion = generaCodigo(10)
                    const resultInvitacion = await csmDB.addInvitacion(idEvento, idInvitacion)
                    return Promise.all(
                        Object.keys(data[obj]).map(async (inv, idinv) => {
                            try {
                                if (data[obj][inv].mensaje != '') {
                                    csmDB.updMensajeInvitacion(idInvitacion, data[obj][inv].mensaje)
                                }
                                const results = await csmDB.addInvitado(idInvitacion, data[obj][inv].nombres, data[obj][inv].principal, data[obj][inv].celular, data[obj][inv].celular ? '1' : '0', data[obj][inv].parentesco, data[obj][inv].grupoEdad)
                                return resolve(results);

                            } catch (error) {
                                reject(error)
                            }
                        }
                        )
                    )
                } catch (error) {
                    reject(error)
                }
            }
            )
        )


    })

};


csmDB.addInvitacion = (idEvento, idInvitacion) => {

    return new Promise((resolve, reject) => {

        pool.query(`INSERT INTO invitacion (id) VALUES (?)`, idInvitacion, (err, results) => {

            if (err) {
                return reject(err);
            } else {


                pool.query(`INSERT INTO evento_has_invitacion (idEvento, idInvitacion) VALUES (?, ?)`, [idEvento, idInvitacion], (err, results) => {

                    if (err) {
                        return reject(err);
                    } else {
                        resolve(results)
                    }

                });
            }
        });

    })

};

csmDB.delInvitacion = (idInvitacion) => {

    return new Promise(async (resolve, reject) => {

        const listaInvitados = await csmDB.invitadosXinvitaciones(idInvitacion)
        return Promise.all(



            listaInvitados.map((item) => {

                csmDB.delInvitado(idInvitacion, item.id)
            })

            ,

            pool.query(`DELETE FROM evento_has_invitacion WHERE evento_has_invitacion.idInvitacion = ?`, [idInvitacion], async (err, results) => {

                if (err) {
                    return reject(err);
                } else {
                    pool.query(`DELETE FROM invitacion WHERE invitacion.id = ?`, [idInvitacion], async (err, results) => {

                        if (err) {
                            return reject(err);
                        } else {
                            resolve(results)
                        }

                    })
                }

            })

        )


    })

};

csmDB.delInvitado = (idInvitacion, idInvitado) => {

    return new Promise(async (resolve, reject) => {

        pool.query(`DELETE FROM invitacion_has_invitado WHERE invitacion_has_invitado.idInvitacion = ? AND invitacion_has_invitado.idInvitado = ?`, [idInvitacion, idInvitado], async (err, results) => {

            if (err) {
                return reject(err);
            } else {
                pool.query(`DELETE FROM invitado WHERE invitado.id = ?`, [idInvitado], async (err, results) => {

                    if (err) {
                        return reject(err);
                    } else {
                        resolve(results)
                    }

                });
            }

        });


    })

};

csmDB.tiposDocumento = () => {

    return new Promise((resolve, reject) => {

        pool.query(`SELECT td.id AS value, td.nombre AS label 

                        FROM tipoDocumento AS  td

                        ORDER BY td.id ASC`, (err, results) => {

            if (err) {
                return reject(err);
            } else {


                return resolve(results);
            }
        });

    })

};

csmDB.tiposGenero = () => {

    return new Promise((resolve, reject) => {

        pool.query(`SELECT tg.id AS value, tg.nombre AS label 

                        FROM tipoGenero AS  tg

                        ORDER BY tg.id ASC`, (err, results) => {

            if (err) {
                return reject(err);
            } else {


                return resolve(results);
            }
        });

    })

};

csmDB.usuarioSistema = (user) => {
  return new Promise((resolve, reject) => {
    pool.query(
      `SELECT 
         uss.id,
         uss.nombres,
         uss.apellidos,
         uss.user,
         uss.rol,
         rs.nombre AS rolNombre,
         uss.telefon,
         uss.pass -- solo para verificar en backend
       FROM usuarioSistema AS uss
       LEFT JOIN rolSistema AS rs ON rs.id = uss.rol
       WHERE uss.user = ?
       LIMIT 1`,
      [user],
      (err, results) => {
        if (err) return reject(err);
        resolve(results);
      }
    );
  });
};



csmDB.permisoXIdInterface = (idInterface) => {

    return new Promise((resolve, reject) => {

        pool.query(`SELECT * 

                        FROM permisosInterface AS  pi

                        WHERE pi.id = ?`, idInterface, (err, results) => {

            if (err) {
                return reject(err);
            } else {


                return resolve(results);
            }
        });

    })

};



module.exports = csmDB;
