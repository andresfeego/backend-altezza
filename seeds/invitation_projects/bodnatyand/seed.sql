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
  'bodnatyand',
  'wedding-classic',
  'Natalia & Andres | 20 de junio de 2026',
  'Te invitamos a celebrar nuestra boda en Villa Germana y compartir con nosotros un dia inolvidable.',
  '/scrAppaltezza/invitations/bodnatyand/cover/seo_cover.webp',
  1,
  JSON_ARRAY(
    JSON_OBJECT(
      'type', 'music_player',
      'enabled', true,
      'order', 1,
      'config', JSON_OBJECT(
        'title', 'Nuestra cancion',
        'trackLabel', 'Matteo Bocelli ft. Leonel Garcia - Que eres tu',
        'audioSrc', '/scrAppaltezza/invitations/bodnatyand/audio/background_track.mp3',
        'autoplay', true,
        'initiallyMuted', false
      )
    ),
    JSON_OBJECT(
      'type', 'simple_image',
      'enabled', true,
      'order', 2,
      'config', JSON_OBJECT(
        'imageSrc', '/scrAppaltezza/invitations/bodnatyand/simple_image/image_01.jpg',
        'alt', 'Imagen editorial de la invitacion'
      )
    ),
    JSON_OBJECT(
      'type', 'biblical_quote',
      'enabled', true,
      'order', 3,
      'config', JSON_OBJECT(
        'passageText', 'Y sobre todas estas cosas vestios de amor, que es el vinculo perfecto.',
        'passageReference', 'Colosenses 3:14'
      )
    ),
    JSON_OBJECT(
      'type', 'welcome_message',
      'enabled', true,
      'order', 4,
      'config', JSON_OBJECT(
        'title', 'Natalia & Andres',
        'subtitle', 'Con muchisima alegria queremos invitarte a celebrar nuestro matrimonio en Villa Germana.'
      )
    ),
    JSON_OBJECT(
      'type', 'photo_slider',
      'enabled', true,
      'order', 5,
      'config', JSON_OBJECT(
        'images', JSON_ARRAY(
          '/scrAppaltezza/invitations/bodnatyand/photo_slider/slide_01.jpg',
          '/scrAppaltezza/invitations/bodnatyand/photo_slider/slide_02.jpg',
          '/scrAppaltezza/invitations/bodnatyand/photo_slider/slide_03.jpg',
          '/scrAppaltezza/invitations/bodnatyand/photo_slider/slide_04.jpg'
        )
      )
    ),
    JSON_OBJECT(
      'type', 'countdown',
      'enabled', true,
      'order', 6,
      'config', JSON_OBJECT(
        'target', 'fechaHoraCeremonia',
        'title', 'Cuenta regresiva para nuestro gran dia'
      )
    ),
    JSON_OBJECT(
      'type', 'couple_family',
      'enabled', true,
      'order', 7,
      'config', JSON_OBJECT(
        'coupleLabel', 'Natalia & Andres',
        'parentsBride', JSON_ARRAY('Martha Ruiz', 'Carlos Moreno'),
        'parentsGroom', JSON_ARRAY('Claudia Perez', 'Javier Torres'),
        'godparents', JSON_ARRAY('Paula y Esteban', 'Marcela y Juan David')
      )
    ),
    JSON_OBJECT(
      'type', 'event_details',
      'enabled', true,
      'order', 8,
      'config', JSON_OBJECT(
        'showCeremony', true,
        'showReception', true,
        'showDressCode', true,
        'showHashtag', true,
        'showGiftInfo', true,
        'giftLabel', 'Lluvia de sobres'
      )
    ),
    JSON_OBJECT(
      'type', 'attendance_confirm',
      'enabled', true,
      'order', 9,
      'config', JSON_OBJECT(
        'title', 'Confirma tu asistencia antes del 5 de junio',
        'deadlineMode', 'fechaHoraLimiteConfirmar'
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
