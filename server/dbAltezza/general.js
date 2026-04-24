const pool = require('./connection.js');

let csmDB = {};
const CLIENT_MODULE_CATALOG = [
  { key: 'feed', label: 'Feed del evento', required: true },
  { key: 'datos_evento', label: 'Datos del evento', required: false, defaultEnabled: true },
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

const INVITATION_TEMPLATE_DEFAULT = 'wedding-classic';
const INVITATION_MODULE_TYPE_CATALOG = new Set([
  'envelop_intro',
  'hero_image_1',
  'hero_image_2',
  'simple_image',
  'biblical_quote',
  'countdown_image',
  'parallax_image_date',
  'dresscode',
  'gift_envelopes',
  'closing_message',
  'welcome_message',
  'photo_slider',
  'image_slider_sepia',
  'music_player',
  'countdown',
  'couple_family',
  'save_the_date_calendar',
  'event_details',
  'attendance_confirm',
]);
const SAME_ORIGIN_PUBLIC_ASSET_PREFIXES = [
  '/scrAppaltezza/images/eventos',
  '/scrAppaltezza/invitations',
];

function safeParseJson(value, fallback) {
  if (!value) return fallback;

  try {
    return typeof value === 'string' ? JSON.parse(value) : value;
  } catch (_error) {
    return fallback;
  }
}

function toSameOriginPublicAssetUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return raw;

  if (raw.startsWith('/')) {
    return raw;
  }

  try {
    const parsed = new URL(raw);
    const publicPrefix = SAME_ORIGIN_PUBLIC_ASSET_PREFIXES.find((prefix) => parsed.pathname.startsWith(prefix));
    if (!publicPrefix) return raw;
    return `${parsed.pathname}${parsed.search || ''}${parsed.hash || ''}`;
  } catch (_error) {
    return raw;
  }
}

function normalizeInvitationAssetValue(value) {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeInvitationAssetValue(item));
  }

  if (value && typeof value === 'object') {
    return Object.entries(value).reduce((acc, [key, item]) => {
      acc[key] = normalizeInvitationAssetValue(item);
      return acc;
    }, {});
  }

  return typeof value === 'string' ? toSameOriginPublicAssetUrl(value) : value;
}

function buildGoogleMapsUrl(lat, lng) {
  const latitude = Number(lat);
  const longitude = Number(lng);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
}

function buildDefaultInvitationModules(evento = {}) {
  const isTerracotaTemplate = String(evento?.templateKey || '').trim() === 'wedding_terracota';
  const heroModuleType = isTerracotaTemplate ? 'hero_image_2' : 'hero_image_1';

  return [
    {
      type: 'music_player',
      enabled: true,
      order: 1,
      config: {
        title: 'Nuestra cancion',
        trackLabel: '',
        audioSrc: null,
        autoplay: true,
        initiallyMuted: false,
      },
    },
    {
      type: heroModuleType,
      enabled: true,
      order: 2,
      config: {
        text1: 'Altezza invitaciones',
        imageSrc: evento?.imagenPrincipal || null,
        backgroundImage: evento?.imagenPrincipal || null,
        logoImage: null,
      },
    },
    {
      type: 'simple_image',
      enabled: true,
      order: 3,
      config: {
        imageSrc: evento?.imagenPrincipal || null,
        alt: 'Imagen de la invitacion',
      },
    },
    {
      type: 'biblical_quote',
      enabled: true,
      order: 4,
      config: {
        passageText: 'Y sobre todas estas cosas vestios de amor, que es el vinculo perfecto.',
        passageReference: 'Colosenses 3:14',
      },
    },
    {
      type: 'countdown_image',
      enabled: true,
      order: 5,
      config: {
        title: 'Cuenta regresiva',
        target: 'fechaHoraCeremonia',
        backgroundImage: evento?.imagenPrincipal || null,
      },
    },
    {
      type: 'parallax_image_date',
      enabled: true,
      order: 6,
      config: {
        backgroundImage: evento?.imagenPrincipal || null,
        target: 'fechaHoraCeremonia',
      },
    },
    {
      type: 'welcome_message',
      enabled: true,
      order: 7,
      config: {
        title: evento?.nombre || 'Nuestra invitacion',
        subtitle: 'Queremos celebrar contigo este momento especial.',
      },
    },
    {
      type: 'photo_slider',
      enabled: true,
      order: 8,
      config: {
        images: evento?.imagenPrincipal ? [evento.imagenPrincipal] : [],
      },
    },
    {
      type: 'countdown',
      enabled: true,
      order: 9,
      config: {
        target: 'fechaHoraCeremonia',
        title: 'Cuenta regresiva',
      },
    },
    {
      type: 'couple_family',
      enabled: true,
      order: 10,
      config: {
        coupleLabel: evento?.nombre || '',
        parentsBride: [],
        parentsGroom: [],
        godparents: [],
      },
    },
    ...(isTerracotaTemplate
      ? [{
        type: 'save_the_date_calendar',
        enabled: true,
        order: 11,
        config: {
          message: 'Tenemos el gusto de invitarlos a nuestra boda , esperamos que nos acompañen en este momento inolvidable',
        },
      }]
      : []),
    {
      type: 'event_details',
      enabled: true,
      order: 12,
      config: {
        showCeremony: true,
        showReception: true,
        showDressCode: true,
        showHashtag: true,
        showGiftInfo: true,
        giftLabel: 'Lluvia de sobres',
      },
    },
    {
      type: 'dresscode',
      enabled: true,
      order: 13,
      config: {
        title: 'Dress code',
      },
    },
    {
      type: 'gift_envelopes',
      enabled: true,
      order: 14,
      config: {
        imageSrc: null,
        imageAlt: 'Lluvia de sobres',
      },
    },
    {
      type: 'closing_message',
      enabled: true,
      order: 15,
      config: {
        message: 'Gracias por acompanarnos en este momento tan especial. Nos hara muy felices compartir este dia contigo.',
        frameImage: null,
        frameImageAlt: 'Marco ornamental',
      },
    },
    {
      type: 'attendance_confirm',
      enabled: true,
      order: 16,
      config: {
        title: 'Confirma tu asistencia',
        deadlineMode: 'fechaHoraLimiteConfirmar',
      },
    },
  ];
}

function normalizeInvitationModules(modules, evento = {}) {
  const fallback = buildDefaultInvitationModules(evento);
  if (!Array.isArray(modules) || !modules.length) return fallback;

  const normalized = modules
    .filter((item) => INVITATION_MODULE_TYPE_CATALOG.has(item?.type))
    .map((item, index) => ({
      type: item.type,
      enabled: item.enabled !== false,
      order: Number.isFinite(Number(item.order)) ? Number(item.order) : index + 1,
      config: normalizeInvitationAssetValue(item?.config && typeof item.config === 'object' ? item.config : {}),
    }))
    .sort((a, b) => a.order - b.order);

  return normalized.length ? normalized : fallback;
}

function buildDefaultInvitationSeo(evento = {}) {
  const eventName = String(evento?.nombre || 'Invitacion Altezza').trim();

  return {
    title: `Invitacion ${eventName}`.trim(),
    description: `Acompananos a celebrar ${eventName}.`,
    image: evento?.imagenPrincipal || null,
  };
}

function normalizeInvitationPublicConfig(row = null, evento = {}) {
  const defaultSeo = buildDefaultInvitationSeo(evento);
  const modules = normalizeInvitationModules(safeParseJson(row?.modulesJson, null), evento);

  return {
    idEvento: evento?.id || row?.idEvento || null,
    templateKey: String(row?.templateKey || INVITATION_TEMPLATE_DEFAULT).trim() || INVITATION_TEMPLATE_DEFAULT,
    seoTitle: String(row?.seoTitle || defaultSeo.title).trim(),
    seoDescription: String(row?.seoDescription || defaultSeo.description).trim(),
    seoImage: toSameOriginPublicAssetUrl(String(row?.seoImage || defaultSeo.image || '').trim()) || null,
    published: Boolean(row?.published),
    modules,
  };
}

function buildClientModulesResponse(rows = []) {
  const enabledByKey = rows.reduce((acc, row) => {
    acc[row.moduloKey] = Boolean(row.estado);
    return acc;
  }, {});

  return CLIENT_MODULE_CATALOG.map((moduleDef) => ({
    key: moduleDef.key,
    label: moduleDef.label,
    required: moduleDef.required,
    enabled: moduleDef.required ? true : (Object.prototype.hasOwnProperty.call(enabledByKey, moduleDef.key) ? Boolean(enabledByKey[moduleDef.key]) : Boolean(moduleDef.defaultEnabled)),
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
        lc.latitud AS latitudLugarCeremonia,
        lc.longitud AS longitudLugarCeremonia,
        lr.nombre AS nombreLugarRecepcion,
        lr.latitud AS latitudLugarRecepcion,
        lr.longitud AS longitudLugarRecepcion
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

csmDB.obtenerInvitacionPublicaEvento = (idEvento) => {
  return new Promise((resolve, reject) => {
    pool.query(
      `
      SELECT *
      FROM evento_invitacion_publica
      WHERE idEvento = ?
      LIMIT 1
      `,
      [idEvento],
      async (err, results) => {
        if (err) return reject(err);

        try {
          const eventoRows = await csmDB.detalleEventoCompleto(idEvento);
          const evento = eventoRows?.[0] || null;
          return resolve(normalizeInvitationPublicConfig(results?.[0] || null, evento));
        } catch (innerError) {
          return reject(innerError);
        }
      }
    );
  });
};

csmDB.actualizarInvitacionPublicaEvento = (idEvento, payload = {}) => {
  return new Promise(async (resolve, reject) => {
    try {
      const eventoRows = await csmDB.detalleEventoCompleto(idEvento);
      const evento = eventoRows?.[0] || null;
      if (!evento) return reject(404);

      const normalized = normalizeInvitationPublicConfig({
        idEvento,
        templateKey: payload?.templateKey,
        seoTitle: payload?.seoTitle,
        seoDescription: payload?.seoDescription,
        seoImage: payload?.seoImage,
        published: payload?.published,
        modulesJson: JSON.stringify(payload?.modules || []),
      }, evento);

      pool.query(
        `
        INSERT INTO evento_invitacion_publica
          (idEvento, templateKey, seoTitle, seoDescription, seoImage, published, modulesJson, updatedAt)
        VALUES
          (?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          templateKey = VALUES(templateKey),
          seoTitle = VALUES(seoTitle),
          seoDescription = VALUES(seoDescription),
          seoImage = VALUES(seoImage),
          published = VALUES(published),
          modulesJson = VALUES(modulesJson),
          updatedAt = VALUES(updatedAt)
        `,
        [
          idEvento,
          normalized.templateKey,
          normalized.seoTitle,
          normalized.seoDescription,
          normalized.seoImage,
          normalized.published ? 1 : 0,
          JSON.stringify(normalized.modules),
          new Date(),
        ],
        async (err) => {
          if (err) return reject(err);

          try {
            const config = await csmDB.obtenerInvitacionPublicaEvento(idEvento);
            return resolve(config);
          } catch (innerError) {
            return reject(innerError);
          }
        }
      );
    } catch (error) {
      return reject(error);
    }
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

                        ORDER BY inv.autoinc ASC`, idEvento, (err, results) => {

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
        subquery.label AS Label,
        @prev := subquery.idInvitacion as Id_inivtación_altezza
    FROM (
        SELECT 
            invita.id as idInvitacion, 
            invita.label, 
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
        LEFT JOIN parentesco AS parent ON inv.parentesco = parent.id
        LEFT JOIN grupoEdad AS ge ON inv.grupoEdad = ge.id
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

csmDB.invitadosClienteXevento = (idEvento) => {
  return new Promise((resolve, reject) => {
    pool.query(
      `SELECT
        inv.id,
        ehi.idEvento,
        inv.nombre,
        inv.telefono,
        inv.wp,
        inv.parentesco,
        parent.parentesco AS parentescoLabel,
        inv.grupoEdad,
        ge.grupo AS grupoEdadLabel,
        inv.confirmado AS estadoAsistenciaId,
        conf.confirmado AS estadoAsistenciaLabel,
        inv.principal AS principalInvitacion,
        ihi.idInvitacion,
        invita.label AS labelInvitacion,
        invita.mensaje_personalizado AS mensajePersonalizadoInvitacion,
        NULL AS idMesa
      FROM evento_has_invitado AS ehi
      JOIN invitado AS inv
        ON inv.id = ehi.idInvitado
      LEFT JOIN parentesco AS parent
        ON parent.id = inv.parentesco
      LEFT JOIN grupoEdad AS ge
        ON ge.id = inv.grupoEdad
      LEFT JOIN confirmado AS conf
        ON conf.id = inv.confirmado
      LEFT JOIN invitacion_has_invitado AS ihi
        ON ihi.idInvitado = inv.id
      LEFT JOIN invitacion AS invita
        ON invita.id = ihi.idInvitacion
      WHERE ehi.idEvento = ?
      ORDER BY inv.id DESC`,
      [idEvento],
      (err, results) => {
        if (err) {
          return reject(err);
        }

        return resolve(results);
      }
    );
  });
};

csmDB.addInvitadoEvento = (idEvento, nombre, telefono, wp, parentesco, grupoEdad) => {
  return new Promise((resolve, reject) => {
    pool.query(
      `INSERT INTO invitado (nombre, principal, telefono, wp, parentesco, grupoEdad)
       VALUES (?, 0, ?, ?, ?, ?)`,
      [nombre, telefono || '', wp ? '1' : '0', parentesco, grupoEdad],
      (err, results) => {
        if (err) {
          return reject(err);
        }

        const idInvitado = results.insertId;

        pool.query(
          `INSERT INTO evento_has_invitado (idEvento, idInvitado) VALUES (?, ?)`,
          [idEvento, idInvitado],
          (joinErr) => {
            if (joinErr) {
              return reject(joinErr);
            }

            return resolve({ id: idInvitado, idEvento });
          }
        );
      }
    );
  });
};

csmDB.actualizarInvitadoEvento = (idEvento, idInvitado, nombre, telefono, wp, parentesco, grupoEdad, confirmado = null) => {
  return new Promise((resolve, reject) => {
    pool.query(
      `SELECT 1
       FROM evento_has_invitado
       WHERE idEvento = ? AND idInvitado = ?
       LIMIT 1`,
      [idEvento, idInvitado],
      (checkErr, checkResults) => {
        if (checkErr) {
          return reject(checkErr);
        }

        if (!checkResults?.length) {
          return reject(404);
        }

        const fields = ['nombre = ?', 'telefono = ?', 'wp = ?', 'parentesco = ?', 'grupoEdad = ?'];
        const values = [nombre, telefono || '', wp ? '1' : '0', parentesco, grupoEdad];

        if (confirmado !== null && confirmado !== undefined && confirmado !== '') {
          fields.push('confirmado = ?');
          values.push(confirmado);
        }

        values.push(idInvitado);

        pool.query(
          `UPDATE invitado SET ${fields.join(', ')} WHERE id = ?`,
          values,
          (updateErr, updateResults) => {
            if (updateErr) {
              return reject(updateErr);
            }

            return resolve(updateResults);
          }
        );
      }
    );
  });
};

csmDB.eliminarInvitadoEvento = (idEvento, idInvitado) => {
  return new Promise((resolve, reject) => {
    pool.query(
      `SELECT 1
       FROM evento_has_invitado
       WHERE idEvento = ? AND idInvitado = ?
       LIMIT 1`,
      [idEvento, idInvitado],
      (checkErr, checkResults) => {
        if (checkErr) {
          return reject(checkErr);
        }

        if (!checkResults?.length) {
          return reject(404);
        }

        pool.query(
          `DELETE FROM invitacion_has_invitado WHERE idInvitado = ?`,
          [idInvitado],
          (unlinkInvErr) => {
            if (unlinkInvErr) {
              return reject(unlinkInvErr);
            }

            pool.query(
              `DELETE FROM evento_has_invitado WHERE idEvento = ? AND idInvitado = ?`,
              [idEvento, idInvitado],
              (unlinkEventErr) => {
                if (unlinkEventErr) {
                  return reject(unlinkEventErr);
                }

                pool.query(
                  `DELETE FROM invitado WHERE id = ?`,
                  [idInvitado],
                  (deleteErr, deleteResults) => {
                    if (deleteErr) {
                      return reject(deleteErr);
                    }

                    return resolve(deleteResults);
                  }
                );
              }
            );
          }
        );
      }
    );
  });
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

csmDB.obtenerInvitadoEnInvitacion = (idInvitacion, idInvitado) => {
  return new Promise((resolve, reject) => {
    pool.query(
      `
      SELECT inv.*
      FROM invitado AS inv
      JOIN invitacion_has_invitado AS ihi
        ON ihi.idInvitado = inv.id
      WHERE ihi.idInvitacion = ?
        AND inv.id = ?
      LIMIT 1
      `,
      [idInvitacion, idInvitado],
      (err, results) => {
        if (err) return reject(err);
        return resolve(results?.[0] || null);
      }
    );
  });
};

csmDB.obtenerEventoInvitacionBase = (idInvitacion) => {
  return new Promise((resolve, reject) => {
    pool.query(
      `
      SELECT
        e.id AS idEvento,
        e.nombre AS nombreEvento,
        e.fechaHoraCeremonia,
        e.fechaHoraRecepcion,
        e.fechaHoraLimiteConfirmar,
        e.hashtag,
        e.imagenPrincipal,
        e.idTipoEvento,
        e.idLugarCeremonia,
        e.idLugarRecepcion,
        inv.id AS idInvitacion,
        inv.label,
        inv.mensaje_personalizado
      FROM evento AS e
      JOIN evento_has_invitacion AS ehi
        ON ehi.idEvento = e.id
      JOIN invitacion AS inv
        ON inv.id = ehi.idInvitacion
      WHERE inv.id = ?
      LIMIT 1
      `,
      [idInvitacion],
      (err, results) => {
        if (err) return reject(err);
        return resolve(results?.[0] || null);
      }
    );
  });
};

csmDB.obtenerInvitacionPublicaPorIds = (idInvitacion, idInvitado) => {
  return new Promise(async (resolve, reject) => {
    try {
      const invitacion = await csmDB.obtenerEventoInvitacionBase(idInvitacion);
      if (!invitacion?.idEvento) return reject(404);

      const invitadoActual = await csmDB.obtenerInvitadoEnInvitacion(idInvitacion, idInvitado);
      if (!invitadoActual) return reject(404);

      const config = await csmDB.obtenerInvitacionPublicaEvento(invitacion.idEvento);
      const listaInvitados = await csmDB.invitadosXinvitaciones(idInvitacion);
      const eventoRows = await csmDB.detalleEventoCompleto(invitacion.idEvento);
      const evento = eventoRows?.[0] || invitacion;
      const seoImage = config.seoImage || evento?.imagenPrincipal || null;

      return resolve({
        evento: {
          id: evento?.id || invitacion?.idEvento || null,
          nombre: evento?.nombre || invitacion?.nombre || '',
          tipoEvento: evento?.nombreTipoEvento || '',
          imagenPrincipal: toSameOriginPublicAssetUrl(evento?.imagenPrincipal || null),
          templateKey: config.templateKey,
          seo: {
            title: config.seoTitle,
            description: config.seoDescription,
            image: toSameOriginPublicAssetUrl(seoImage),
          },
        },
        invitacion: {
          id: invitacion.idInvitacion,
          idEvento: invitacion.idEvento,
          label: invitacion.label || '',
          mensajePersonalizado: invitacion.mensaje_personalizado || '',
          fechaHoraCeremonia: invitacion.fechaHoraCeremonia || null,
          fechaHoraRecepcion: invitacion.fechaHoraRecepcion || null,
          fechaHoraLimiteConfirmar: invitacion.fechaHoraLimiteConfirmar || null,
          lugarCeremonia: evento?.nombreLugarCeremonia || '',
          ceremonyMapUrl: buildGoogleMapsUrl(evento?.latitudLugarCeremonia, evento?.longitudLugarCeremonia),
          lugarRecepcion: evento?.nombreLugarRecepcion || '',
          receptionMapUrl: buildGoogleMapsUrl(evento?.latitudLugarRecepcion, evento?.longitudLugarRecepcion),
          hashtag: invitacion.hashtag || '',
          colorReservadoUno: invitacion.colorReservadoUno || null,
          colorReservadoDos: invitacion.colorReservadoDos || null,
          imagenPrincipal: toSameOriginPublicAssetUrl(evento?.imagenPrincipal || null),
          nombreEvento: invitacion.nombre || evento?.nombre || '',
        },
        invitadoActual: {
          id: invitadoActual.id,
          nombre: invitadoActual.nombre,
          principal: Boolean(invitadoActual.principal),
          confirmado: Number(invitadoActual.confirmado || 0),
        },
        listaInvitados: Array.isArray(invitacion.listaInvitados)
          ? invitacion.listaInvitados.map((item) => ({
              id: item.id,
              nombre: item.nombre,
              principal: Boolean(item.principal),
              confirmado: Number(item.confirmado || 0),
            }))
          : Array.isArray(listaInvitados)
          ? listaInvitados.map((item) => ({
              id: item.id,
              nombre: item.nombre,
              principal: Boolean(item.principal),
              confirmado: Number(item.confirmado || 0),
            }))
          : [],
        modules: config.modules,
      });
    } catch (error) {
      return reject(error);
    }
  });
};

csmDB.confirmarInvitacionPublica = (idInvitacion, respuestas = []) => {
  return new Promise(async (resolve, reject) => {
    try {
      const invitados = await csmDB.invitadosXinvitaciones(idInvitacion);
      const allowedIds = new Set((invitados || []).map((item) => Number(item.id)));

      if (!Array.isArray(respuestas) || !respuestas.length) {
        return reject(400);
      }

      const invalidResponse = respuestas.find((item) => !allowedIds.has(Number(item?.idInvitado)));
      if (invalidResponse) {
        return reject(404);
      }

      await Promise.all(
        respuestas.map((item) => csmDB.updConfirmado(Number(item.idInvitado), Number(item.confirmado || 0)))
      );

      const updated = await csmDB.eventoXinvitacion(idInvitacion);
      return resolve(updated);
    } catch (error) {
      return reject(error);
    }
  });
};

csmDB.updLabelInvitacion = (idInvitacion, label) => {

    return new Promise((resolve, reject) => {

        pool.query(`UPDATE invitacion SET invitacion.label = ? WHERE invitacion.id = ?`, [label, idInvitacion], (err, results) => {

            if (err) {
                return reject(err);
            } else {
                return resolve(results);
            }
        });
    })

};

csmDB.updMensajeInvitacion = csmDB.updLabelInvitacion;

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
                                if ((data[obj][inv].label || data[obj][inv].mensaje || '') != '') {
                                    csmDB.updLabelInvitacion(idInvitacion, data[obj][inv].label || data[obj][inv].mensaje)
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


csmDB.addInvitacion = (idEvento, idInvitacion, label = '', mensajePersonalizado = '') => {

    return new Promise((resolve, reject) => {

        pool.query(
          `INSERT INTO invitacion (id, label, mensaje_personalizado) VALUES (?, ?, ?)`,
          [idInvitacion, label || '', mensajePersonalizado || ''],
          (err, results) => {

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


csmDB.crearInvitacionEvento = (idEvento, idInvitacion, label = '', mensajePersonalizado = '') => {

    return new Promise(async (resolve, reject) => {
        try {
            await csmDB.addInvitacion(idEvento, idInvitacion, label, mensajePersonalizado);
            const invitacion = await csmDB.eventoXinvitacion(idInvitacion);
            return resolve(invitacion);
        } catch (error) {
            return reject(error);
        }
    })

};

csmDB.actualizarInvitacionEvento = (idEvento, idInvitacion, label = '', mensajePersonalizado = '', enviada = null) => {

    return new Promise((resolve, reject) => {

        pool.query(`SELECT 1
                    FROM evento_has_invitacion
                    WHERE idEvento = ? AND idInvitacion = ?
                    LIMIT 1`, [idEvento, idInvitacion], (checkErr, checkResults) => {

            if (checkErr) {
                return reject(checkErr);
            }

            if (!checkResults || !checkResults.length) {
                return reject(404);
            }

            pool.query(`UPDATE invitacion
                        SET invitacion.label = ?,
                            invitacion.mensaje_personalizado = ?,
                            invitacion.enviada = COALESCE(?, invitacion.enviada)
                        WHERE invitacion.id = ?`, [label || '', mensajePersonalizado || '', enviada === null ? null : (enviada ? 1 : 0), idInvitacion], (err, results) => {

                if (err) {
                    return reject(err);
                }

                return resolve(results);
            });
        });

    })

};

csmDB.eliminarInvitacionEvento = (idEvento, idInvitacion) => {

    return new Promise((resolve, reject) => {
        pool.query(`SELECT 1
                    FROM evento_has_invitacion
                    WHERE idEvento = ? AND idInvitacion = ?
                    LIMIT 1`, [idEvento, idInvitacion], (checkErr, checkResults) => {
            if (checkErr) {
                return reject(checkErr);
            }

            if (!checkResults || !checkResults.length) {
                return reject(404);
            }

            pool.query(`UPDATE invitado AS inv
                        JOIN invitacion_has_invitado AS ihi
                          ON ihi.idInvitado = inv.id
                        SET inv.principal = 0
                        WHERE ihi.idInvitacion = ?`, [idInvitacion], (resetErr) => {
                if (resetErr) {
                    return reject(resetErr);
                }

                pool.query(`DELETE FROM invitacion_has_invitado WHERE idInvitacion = ?`, [idInvitacion], (unlinkErr) => {
                    if (unlinkErr) {
                        return reject(unlinkErr);
                    }

                    pool.query(`DELETE FROM evento_has_invitacion WHERE idEvento = ? AND idInvitacion = ?`, [idEvento, idInvitacion], (joinErr) => {
                        if (joinErr) {
                            return reject(joinErr);
                        }

                        pool.query(`DELETE FROM invitacion WHERE id = ?`, [idInvitacion], (deleteErr, results) => {
                            if (deleteErr) {
                                return reject(deleteErr);
                            }

                            return resolve(results);
                        });
                    });
                });
            });
        });
    })

};

csmDB.asignarInvitadoEventoAInvitacion = (idEvento, idInvitacion, idInvitado, principal = 0) => {

    return new Promise((resolve, reject) => {

        pool.query(`SELECT 1
                    FROM evento_has_invitado
                    WHERE idEvento = ? AND idInvitado = ?
                    LIMIT 1`, [idEvento, idInvitado], (guestErr, guestResults) => {

            if (guestErr) {
                return reject(guestErr);
            }

            if (!guestResults || !guestResults.length) {
                return reject(404);
            }

            pool.query(`SELECT 1
                        FROM evento_has_invitacion
                        WHERE idEvento = ? AND idInvitacion = ?
                        LIMIT 1`, [idEvento, idInvitacion], (invErr, invResults) => {

                if (invErr) {
                    return reject(invErr);
                }

                if (!invResults || !invResults.length) {
                    return reject(404);
                }

                pool.query(`DELETE FROM invitacion_has_invitado
                            WHERE idInvitado = ?`, [idInvitado], (unlinkErr) => {

                    if (unlinkErr) {
                        return reject(unlinkErr);
                    }

                    const finalizeInsert = () => {
                        pool.query(`INSERT INTO invitacion_has_invitado (idInvitacion, idInvitado) VALUES (?, ?)`, [idInvitacion, idInvitado], (linkErr, linkResults) => {
                            if (linkErr) {
                                return reject(linkErr);
                            }

                            pool.query(`UPDATE invitado SET principal = ? WHERE id = ?`, [principal ? 1 : 0, idInvitado], (principalErr) => {
                                if (principalErr) {
                                    return reject(principalErr);
                                }

                                return resolve(linkResults);
                            });
                        });
                    };

                    if (principal) {
                        pool.query(`UPDATE invitado AS inv
                                    JOIN invitacion_has_invitado AS ihi
                                      ON ihi.idInvitado = inv.id
                                    SET inv.principal = 0
                                    WHERE ihi.idInvitacion = ?`, [idInvitacion], (resetErr) => {
                            if (resetErr) {
                                return reject(resetErr);
                            }

                            finalizeInsert();
                        });
                    } else {
                        finalizeInsert();
                    }
                });
            });
        });

    })

};

csmDB.quitarInvitadoEventoDeInvitacion = (idEvento, idInvitacion, idInvitado) => {

    return new Promise((resolve, reject) => {
        pool.query(`SELECT 1
                    FROM evento_has_invitado
                    WHERE idEvento = ? AND idInvitado = ?
                    LIMIT 1`, [idEvento, idInvitado], (guestErr, guestResults) => {
            if (guestErr) {
                return reject(guestErr);
            }

            if (!guestResults || !guestResults.length) {
                return reject(404);
            }

            pool.query(`DELETE FROM invitacion_has_invitado
                        WHERE idInvitacion = ? AND idInvitado = ?`, [idInvitacion, idInvitado], (unlinkErr, results) => {
                if (unlinkErr) {
                    return reject(unlinkErr);
                }

                pool.query(`UPDATE invitado SET principal = 0 WHERE id = ?`, [idInvitado], (principalErr) => {
                    if (principalErr) {
                        return reject(principalErr);
                    }

                    return resolve(results);
                });
            });
        });
    })

};

csmDB.definirPrincipalInvitacion = (idEvento, idInvitacion, idInvitado) => {

    return new Promise((resolve, reject) => {
        pool.query(`SELECT 1
                    FROM evento_has_invitacion
                    WHERE idEvento = ? AND idInvitacion = ?
                    LIMIT 1`, [idEvento, idInvitacion], (invErr, invResults) => {
            if (invErr) {
                return reject(invErr);
            }

            if (!invResults || !invResults.length) {
                return reject(404);
            }

            pool.query(`SELECT 1
                        FROM invitacion_has_invitado
                        WHERE idInvitacion = ? AND idInvitado = ?
                        LIMIT 1`, [idInvitacion, idInvitado], (memberErr, memberResults) => {
                if (memberErr) {
                    return reject(memberErr);
                }

                if (!memberResults || !memberResults.length) {
                    return reject(404);
                }

                pool.query(`UPDATE invitado AS inv
                            JOIN invitacion_has_invitado AS ihi
                              ON ihi.idInvitado = inv.id
                            SET inv.principal = 0
                            WHERE ihi.idInvitacion = ?`, [idInvitacion], (resetErr) => {
                    if (resetErr) {
                        return reject(resetErr);
                    }

                    pool.query(`UPDATE invitado SET principal = 1 WHERE id = ?`, [idInvitado], (updateErr, results) => {
                        if (updateErr) {
                            return reject(updateErr);
                        }

                        return resolve(results);
                    });
                });
            });
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
