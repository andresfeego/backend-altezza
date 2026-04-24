SET @idEvento := 'bodcatyand';
SET @idInvitacion := 'catyand001';
SET @idInvitado1 := 910001;
SET @idInvitado2 := 910002;

SET @idTipoEvento := (
  SELECT id
  FROM tipo_evento
  WHERE LOWER(TRIM(nombre)) = 'boda'
  LIMIT 1
);

INSERT INTO lugar (
  nombre,
  latitud,
  longitud
)
SELECT
  'Finca la Sildana',
  5.7408934,
  -72.9252005
WHERE NOT EXISTS (
  SELECT 1
  FROM lugar
  WHERE LOWER(TRIM(nombre)) = 'finca la sildana'
);

SET @idLugarFincaSildana := (
  SELECT id
  FROM lugar
  WHERE LOWER(TRIM(nombre)) = 'finca la sildana'
  ORDER BY id DESC
  LIMIT 1
);

INSERT INTO evento (
  id,
  nombre,
  idTipoEvento,
  fechaHoraCeremonia,
  fechaHoraRecepcion,
  fechaHoraLimiteConfirmar,
  idLugarCeremonia,
  idLugarRecepcion,
  hashtag,
  estado,
  imagenPrincipal
) VALUES (
  @idEvento,
  'Catalina & Andres',
  @idTipoEvento,
  '2026-06-20 11:00:00',
  '2026-06-20 12:00:00',
  '2026-06-11 18:00:00',
  @idLugarFincaSildana,
  @idLugarFincaSildana,
  '',
  1,
  '/scrAppaltezza/invitations/bodcatyand/cover/seo_cover.webp'
) AS new_event
ON DUPLICATE KEY UPDATE
  nombre = new_event.nombre,
  idTipoEvento = new_event.idTipoEvento,
  fechaHoraCeremonia = new_event.fechaHoraCeremonia,
  fechaHoraRecepcion = new_event.fechaHoraRecepcion,
  fechaHoraLimiteConfirmar = new_event.fechaHoraLimiteConfirmar,
  idLugarCeremonia = new_event.idLugarCeremonia,
  idLugarRecepcion = new_event.idLugarRecepcion,
  hashtag = new_event.hashtag,
  estado = new_event.estado,
  imagenPrincipal = new_event.imagenPrincipal;

INSERT INTO invitacion (
  id,
  label,
  mensaje_personalizado
) VALUES (
  @idInvitacion,
  'Invitacion de prueba Catalina & Andres',
  'Nos encantaria compartir este dia contigo.'
) AS new_inv
ON DUPLICATE KEY UPDATE
  label = new_inv.label,
  mensaje_personalizado = new_inv.mensaje_personalizado;

INSERT IGNORE INTO evento_has_invitacion (
  idEvento,
  idInvitacion
) VALUES (
  @idEvento,
  @idInvitacion
);

DELETE FROM invitacion_has_invitado
WHERE idInvitacion = 'catyand001'
  AND idInvitado IN (@idInvitado1, @idInvitado2);

DELETE FROM invitado
WHERE id IN (@idInvitado1, @idInvitado2);

INSERT INTO invitado (
  id,
  nombre,
  principal,
  telefono,
  wp,
  parentesco,
  grupoEdad,
  confirmado
) VALUES (
  @idInvitado1,
  'Invitado Prueba 1',
  1,
  '3000000001',
  '1',
  17,
  1,
  0
) AS new_guest_1
ON DUPLICATE KEY UPDATE
  nombre = new_guest_1.nombre,
  principal = new_guest_1.principal,
  telefono = new_guest_1.telefono,
  wp = new_guest_1.wp,
  parentesco = new_guest_1.parentesco,
  grupoEdad = new_guest_1.grupoEdad,
  confirmado = new_guest_1.confirmado;

INSERT INTO invitacion_has_invitado (
  idInvitacion,
  idInvitado
) VALUES (
  @idInvitacion,
  @idInvitado1
);

INSERT INTO invitado (
  id,
  nombre,
  principal,
  telefono,
  wp,
  parentesco,
  grupoEdad,
  confirmado
) VALUES (
  @idInvitado2,
  'Invitada Prueba 2',
  0,
  '3000000002',
  '1',
  20,
  1,
  0
) AS new_guest_2
ON DUPLICATE KEY UPDATE
  nombre = new_guest_2.nombre,
  principal = new_guest_2.principal,
  telefono = new_guest_2.telefono,
  wp = new_guest_2.wp,
  parentesco = new_guest_2.parentesco,
  grupoEdad = new_guest_2.grupoEdad,
  confirmado = new_guest_2.confirmado;

INSERT INTO invitacion_has_invitado (
  idInvitacion,
  idInvitado
) VALUES (
  @idInvitacion,
  @idInvitado2
);

INSERT INTO evento_invitacion_publica (
  idEvento,
  templateKey,
  seoTitle,
  seoDescription,
  seoImage,
  published,
  modulesJson,
  createdAt,
  updatedAt
) VALUES (
  @idEvento,
  'wedding_terracota',
  'Catalina & Andres | 20 de junio de 2026',
  'Altezza Eventos',
  '/scrAppaltezza/invitations/bodcatyand/message/logo3.png',
  1,
  JSON_ARRAY(
    JSON_OBJECT(
      'type', 'envelop_intro',
      'enabled', true,
      'order', 0,
      'config', JSON_OBJECT(
        'brideName', 'Catalina',
        'groomName', 'Andres'
      )
    ),
    JSON_OBJECT(
      'type', 'music_player',
      'enabled', true,
      'order', 1,
      'config', JSON_OBJECT(
        'title', 'Nuestra cancion',
        'trackLabel', 'Fonseca - Prometo',
        'audioSrc', '/scrAppaltezza/invitations/bodcatyand/audio/background_track.mp3',
        'autoplay', false,
        'initiallyMuted', true
      )
    ),
    JSON_OBJECT(
      'type', 'hero_image_2',
      'enabled', true,
      'order', 2,
      'config', JSON_OBJECT(
        'logoImage', '/scrAppaltezza/invitations/bodcatyand/hero_image_2/logo.png',
        'imageSrc', '/scrAppaltezza/invitations/bodcatyand/hero_image_2/image_01.jpeg',
        'imageAlt', 'Foto principal de Catalina y Andres',
        'coupleNames', 'Catalina & Andres'
      )
    ),
    JSON_OBJECT(
      'type', 'biblical_quote',
      'enabled', true,
      'order', 4,
      'config', JSON_OBJECT(
        'passageText', 'El verdadero amor no se encuentra. Se construye',
        'passageReference', ''
      )
    ),
    JSON_OBJECT(
      'type', 'couple_family',
      'enabled', true,
      'order', 5,
      'config', JSON_OBJECT(
        'godparents', JSON_ARRAY(),
        'coupleLabel', 'Con nuestro amor, con la presencia de Dios entre nosotros y la bendicion de nuestros padres',
        'parentsBride', JSON_ARRAY(
          JSON_OBJECT(
            'name', 'Rebeca Rincon',
            'isDeceased', false
          ),
          JSON_OBJECT(
            'name', 'Carlos Beltran',
            'isDeceased', false
          )
        ),
        'parentsGroom', JSON_ARRAY(
          JSON_OBJECT(
            'name', 'Mariela Moreno',
            'isDeceased', false
          ),
          JSON_OBJECT(
            'name', 'Marco Fidel Acevedo',
            'isDeceased', false
          )
        )
      )
    ),
    JSON_OBJECT(
      'type', 'save_the_date_calendar',
      'enabled', true,
      'order', 6,
      'config', JSON_OBJECT(
        'message', 'Tenemos el gusto de invitarlos a nuestra boda , esperamos que nos acompañen en este momento inolvidable'
      )
    ),
    JSON_OBJECT(
      'type', 'event_details',
      'enabled', true,
      'order', 7,
      'config', JSON_OBJECT(
        'giftLabel', 'Lluvia de sobres',
        'showHashtag', true,
        'showCeremony', true,
        'showGiftInfo', true,
        'showReception', true,
        'backgroundVideo', '/scrAppaltezza/invitations/bodcatyand/motion/hero_background.mp4'
      )
    ),
    JSON_OBJECT(
      'type', 'dresscode',
      'enabled', true,
      'order', 9,
      'config', JSON_OBJECT(
        'imageAlt', 'Referencia visual de dress code',
        'imageSrc', '/scrAppaltezza/invitations/bodcatyand/dresscode/dresscode.png',
        'attireLabel', 'Formal',
        'avoidedColors', JSON_ARRAY(
          '#FFFFFF',
          '#E0CDB2',
          '#F4EFE5'
        ),
        'suggestedColors', JSON_ARRAY(
          '#747D45',
          '#BB4D14',
          '#DCB184',
          '#76291D',
          '#8D190F'
        )
      )
    ),
    JSON_OBJECT(
      'type', 'image_slider_sepia',
      'enabled', true,
      'order', 10,
      'config', JSON_OBJECT(
        'images', JSON_ARRAY(
          '/scrAppaltezza/invitations/bodcatyand/image_slider_sepia/slide_01.jpeg',
          '/scrAppaltezza/invitations/bodcatyand/image_slider_sepia/slide_02.jpeg',
          '/scrAppaltezza/invitations/bodcatyand/image_slider_sepia/slide_03.jpeg',
          '/scrAppaltezza/invitations/bodcatyand/image_slider_sepia/slide_04.jpeg',
          '/scrAppaltezza/invitations/bodcatyand/image_slider_sepia/slide_05.jpeg',
          '/scrAppaltezza/invitations/bodcatyand/image_slider_sepia/slide_06.jpeg',
          '/scrAppaltezza/invitations/bodcatyand/image_slider_sepia/slide_07.jpeg',
          '/scrAppaltezza/invitations/bodcatyand/image_slider_sepia/slide_08.jpeg',
          '/scrAppaltezza/invitations/bodcatyand/image_slider_sepia/slide_09.jpeg'
        ),
        'intervalMs', 4000,
        'imageAdjustments', JSON_OBJECT(
          'slide_01.jpeg', JSON_OBJECT('positionX', 50, 'positionY', 50, 'zoom', 1.1),
          'slide_02.jpeg', JSON_OBJECT('positionX', 50, 'positionY', 50, 'zoom', 1),
          'slide_03.jpeg', JSON_OBJECT('positionX', 50, 'positionY', 50, 'zoom', 1),
          'slide_04.jpeg', JSON_OBJECT('positionX', 50, 'positionY', 50, 'zoom', 1),
          'slide_05.jpeg', JSON_OBJECT('positionX', 50, 'positionY', 50, 'zoom', 1),
          'slide_06.jpeg', JSON_OBJECT('positionX', 50, 'positionY', 50, 'zoom', 1),
          'slide_07.jpeg', JSON_OBJECT('positionX', 50, 'positionY', 0, 'zoom', 1),
          'slide_08.jpeg', JSON_OBJECT('positionX', 50, 'positionY', 50, 'zoom', 1),
          'slide_09.jpeg', JSON_OBJECT('positionX', 50, 'positionY', 50, 'zoom', 1.1)
        )
      )
    ),
    JSON_OBJECT(
      'type', 'gift_envelopes',
      'enabled', true,
      'order', 11,
      'config', JSON_OBJECT(
        'imageAlt', 'Lluvia de sobres',
        'imageSrc', '/scrAppaltezza/invitations/bodcatyand/gift_envelopes/lluvia_sobres.png'
      )
    ),
    JSON_OBJECT(
      'type', 'attendance_confirm',
      'enabled', true,
      'order', 13,
      'config', JSON_OBJECT(
        'title', 'Confirma tu asistencia antes del 11 de junio',
        'helperText', 'Selecciona la respuesta de cada integrante de esta invitacion.',
        'deadlineMode', 'fechaHoraLimiteConfirmar',
        'customMessages', JSON_OBJECT(
          'maybe', 'Avisanos cuando lo tengas claro, nos encantara contar contigo.',
          'decline', 'Piensalo por fis, sera un placer contar contigo.',
          'attending', 'Que bien, te esperamos.'
        ),
        'useCustomMessages', true
      )
    )
  ),
  NOW(),
  NOW()
) AS new_values
ON DUPLICATE KEY UPDATE
  templateKey = new_values.templateKey,
  seoTitle = new_values.seoTitle,
  seoDescription = new_values.seoDescription,
  seoImage = new_values.seoImage,
  published = new_values.published,
  modulesJson = new_values.modulesJson,
  updatedAt = NOW();
