// Empty editorial slots: only saved event configuration may supply invitation copy.
function buildDefaultInvitationModules(evento = {}) {
  const isTerracotaTemplate = String(evento?.templateKey || '').trim() === 'wedding_terracota';
  const heroModuleType = isTerracotaTemplate ? 'hero_image_2' : 'hero_image_1';

  return [
    {
      type: 'music_player',
      enabled: true,
      order: 1,
      config: {
        title: '',
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
        text1: '',
        imageSrc: evento?.imagenPrincipal || null,
        backgroundImage: null,
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
        passageText: '',
        passageReference: '',
      },
    },
    {
      type: 'countdown_image',
      enabled: true,
      order: 5,
      config: {
        title: '',
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
        title: evento?.nombre || '',
        subtitle: '',
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
        title: '',
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
          message: '',
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
        giftLabel: '',
      },
    },
    {
      type: 'dresscode',
      enabled: true,
      order: 13,
      config: {
        title: '',
      },
    },
    {
      type: 'gift_envelopes',
      enabled: true,
      order: 14,
      config: {
        imageSrc: null,
        imageAlt: '',
      },
    },
    {
      type: 'closing_message',
      enabled: true,
      order: 15,
      config: {
        message: '',
        frameImage: null,
        frameImageAlt: 'Marco ornamental',
      },
    },
    {
      type: 'attendance_confirm',
      enabled: true,
      order: 16,
      config: {
        title: '',
        deadlineMode: 'fechaHoraLimiteConfirmar',
      },
    },
  ];
}

module.exports = { buildDefaultInvitationModules };
