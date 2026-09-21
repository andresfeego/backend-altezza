const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveInvitationLocations } = require('../server/utils/invitationLocations');
const { alignModules } = require('../seeds/invitation_projects/bodmys/align-data');
const { buildDefaultInvitationModules } = require('../server/utils/invitationModuleDefaults');
const { configureCopy } = require('../seeds/invitation_projects/bodmys/configure-copy');
const { replaceWelcomeWithQuote } = require('../seeds/invitation_projects/bodmys/replace-welcome-with-quote');
const { configureEnvelopeVideo } = require('../seeds/invitation_projects/bodmys/configure-envelope-video');
const { configureCoupleNames } = require('../seeds/invitation_projects/bodmys/configure-couple-names');
const { configureDateSection } = require('../seeds/invitation_projects/bodmys/configure-date-section');

test('date section migration preserves customer content, inserts calendar once and retains explicit choices', () => {
  const seed = [
    { type: 'countdown', config: { showDate: true, title: 'Faltan' } },
    { type: 'save_the_date_calendar', enabled: true, config: { message: 'El gran día' } },
  ];
  const before = [
    { type: 'couple_names', order: 1, config: { brideName: 'Ana', groomName: 'Luis' } },
    { type: 'event_details', order: 2, config: { title: 'Lugares elegidos' } },
    { type: 'countdown', enabled: true, order: 3, config: { title: 'Cada vez más cerca', message: 'Mensaje elegido', target: 'fechaHoraCeremonia' } },
  ];
  const snapshot = structuredClone(before);
  const after = configureDateSection(before, seed);
  assert.deepEqual(before, snapshot);
  assert.deepEqual(after.map(m => m.type), ['couple_names', 'countdown', 'save_the_date_calendar', 'event_details']);
  assert.deepEqual(after[1].config, { ...before[2].config, showDate: true, title: 'Faltan' });
  assert.deepEqual(configureDateSection(after, seed), after);
  const customized = after.map(m => m.type === 'countdown' ? { ...m, config: { ...m.config, showDate: false, title: 'Nuestro título' } } : m.type === 'save_the_date_calendar' ? { ...m, enabled: false, config: { message: '' } } : m);
  assert.deepEqual(configureDateSection(customized, seed), customized);
  assert.throws(() => configureDateSection([...before, { ...before[2], order: 4 }], seed));
});

test('names migration places one module after family, preserves other data and is repeatable', () => {
  const before = [
    { type: 'hero_image_1', enabled: true, order: 1, config: { logoImage: '/original.png' } },
    { type: 'couple_family', enabled: true, order: 2, config: { title: 'Familia' } },
    { type: 'event_details', enabled: true, order: 3, config: { title: 'Lugares' } },
  ];
  const snapshot = structuredClone(before);
  const names = { brideName: 'Ana', groomName: 'Luis' };
  const after = configureCoupleNames(before, names);
  assert.deepEqual(before, snapshot);
  assert.deepEqual(after.map((m) => m.type), ['hero_image_1', 'couple_family', 'couple_names', 'event_details']);
  assert.deepEqual(after.filter((m) => m.type !== 'couple_names').map(({ order, ...m }) => m), before.map(({ order, ...m }) => m));
  assert.deepEqual(configureCoupleNames(after, names), after);
  const customized = after.map((m) => m.type === 'couple_names' ? { ...m, enabled: false, config: { brideName: 'Elegida', groomName: 'Elegido' } } : m);
  assert.deepEqual(configureCoupleNames(customized, names), customized);
  assert.throws(() => configureCoupleNames(before.filter((m) => m.type !== 'couple_family'), names));
  assert.throws(() => configureCoupleNames(before, { brideName: 'Ana' }));
  assert.throws(() => configureCoupleNames([...after, { ...after[2], order: 99 }], names));
});

test('envelope video migration changes only its source and preserves images, text and module order', () => {
  const before = [{ type: 'envelop_intro', enabled: true, order: 1, config: { backgroundSrc: '/portrait.jpg', backgroundDesktopSrc: '/wide.jpg', invitationLabel: 'Familia', monogramSrc: '/ms.png' } }, { type: 'biblical_quote', order: 3, config: { passageText: 'Frase', passageReference: '' } }];
  const snapshot = structuredClone(before);
  const seed = [{ type: 'envelop_intro', config: { backgroundVideoSrc: '/loop.mp4' } }];
  const after = configureEnvelopeVideo(before, seed);
  assert.deepEqual(before, snapshot);
  assert.deepEqual(after, [{ ...before[0], config: { ...before[0].config, backgroundVideoSrc: '/loop.mp4' } }, before[1]]);
  assert.deepEqual(configureEnvelopeVideo(after, seed), after);
  assert.throws(() => configureEnvelopeVideo([], seed));
  assert.throws(() => configureEnvelopeVideo([before[0], before[0]], seed));
  assert.throws(() => configureEnvelopeVideo(before, []));
});

test('quote migration preserves the phrase, module placement and unrelated configuration; repeat runs are safe', () => {
  const before = [
    { type: 'hero_image_1', order: 2, config: { logoImage: '/logo.png' } },
    { type: 'welcome_message', enabled: false, order: 3, config: { title: 'Título anterior', subtitle: 'Frase del cliente\nSegunda línea.' } },
    { type: 'attendance_confirm', enabled: true, order: 7, config: { helperText: 'Asistencia' } },
  ];
  const snapshot = structuredClone(before);
  const after = replaceWelcomeWithQuote(before);
  assert.deepEqual(before, snapshot);
  assert.deepEqual(after[0], before[0]);
  assert.deepEqual(after[2], before[2]);
  assert.deepEqual(after[1], { type: 'biblical_quote', enabled: false, order: 3, config: { passageText: before[1].config.subtitle, passageReference: '' } });
  assert.deepEqual(replaceWelcomeWithQuote(after), after);
  assert.throws(() => replaceWelcomeWithQuote([...before, { type: 'biblical_quote', config: { passageText: 'Otra frase' } }]));
  assert.throws(() => replaceWelcomeWithQuote([{ type: 'welcome_message', config: { subtitle: '  ' } }]));
});

test('maps: coordinates win; stored links and addresses survive without coordinates', () => {
  const modules = [{ type: 'event_details', config: { ceremonyMapUrl: 'https://maps.example/c', receptionMapUrl: 'https://maps.example/r', ceremonyAddress: 'Dirección C' } }];
  assert.equal(resolveInvitationLocations({}, modules).ceremonyMapUrl, 'https://maps.example/c');
  assert.equal(resolveInvitationLocations({}, modules).ceremonyAddress, 'Dirección C');
  const resolved = resolveInvitationLocations({ latitudLugarCeremonia: 0, longitudLugarCeremonia: 1 }, modules);
  assert.equal(resolved.ceremonyMapUrl, 'https://www.google.com/maps/search/?api=1&query=0,1');
  assert.equal(resolved.receptionMapUrl, 'https://maps.example/r');
  assert.equal(resolveInvitationLocations({ latitudLugarCeremonia: 'invalid', longitudLugarCeremonia: 1 }).ceremonyMapUrl, null);
  assert.equal(resolveInvitationLocations().receptionMapUrl, null);
});

test('alignment preserves copy/media/settings and is idempotent', () => {
  const before = [
    { type: 'envelop_intro', order: 1, config: { monogramSrc: '/ms.png' } },
    { type: 'hero_image_1', order: 2, config: { brideName: 'Mayra', groomName: 'Samuel', message: 'Historia', imageSrc: '/foto.png' } },
    { type: 'couple_family', order: 3, config: { message: 'Ceremonia', parentsBride: ['Madre'], coupleLabel: 'Familia' } },
    { type: 'event_details', order: 4, config: { ceremonyMapUrl: 'https://maps.example/c', receptionMessage: 'Recepción' } },
    { type: 'attendance_confirm', order: 5, config: { introMessage: 'Asistencia', helperText: 'Instrucciones', customMessages: { attending: 'Gracias' } } },
    { type: 'music_player', order: 6, enabled: false, config: { audioSrc: '/song.mp3' } },
  ];
  const snapshot = structuredClone(before);
  const after = alignModules(before, 'Mayra & Samuel');
  const config = (type) => after.find((module) => module.type === type).config;
  assert.deepEqual(before, snapshot);
  assert.deepEqual(alignModules(after, 'Mayra & Samuel'), after);
  assert.deepEqual(after[0], before[0]);
  assert.equal(config('welcome_message').subtitle, 'Historia');
  assert.equal(config('simple_image').imageSrc, '/foto.png');
  assert.equal(config('event_details').ceremonyMessage, 'Ceremonia');
  assert.equal(config('event_details').receptionMessage, 'Recepción');
  assert.equal(config('attendance_confirm').helperText, 'Asistencia\n\nInstrucciones');
  assert.deepEqual(config('attendance_confirm').customMessages, { attending: 'Gracias' });
  assert.equal(config('hero_image_1').brideName, undefined);
  assert.equal(config('hero_image_1').message, undefined);
  assert.equal(config('couple_family').message, undefined);
  assert.equal(after.find((module) => module.type === 'music_player').enabled, false);
  assert.ok(config('closing_message').message.includes('Mayra & Samuel'));
});

test('events without saved copy do not inherit wedding prose or religious passages', () => {
  for (const templateKey of ['wedding_classic', 'wedding_terracota', 'wedding_oliva']) {
    const modules = buildDefaultInvitationModules({ nombre: 'Evento del cliente', templateKey });
    for (const module of modules) {
      for (const field of ['text1', 'message', 'subtitle', 'passageText', 'passageReference', 'giftLabel']) {
        if (field in module.config) assert.equal(module.config[field], '');
      }
    }
  }
});

test('copy migration preserves custom and intentionally empty values', () => {
  const original = [
    { type: 'couple_family', config: { title: '' } },
    { type: 'event_details', config: { title: 'Elegido' } },
    { type: 'countdown', config: { target: 'fechaHoraRecepcion' } },
  ];
  const seed = [
    { type: 'couple_family', config: { title: 'Otro' } },
    { type: 'event_details', config: { title: 'Otro' } },
    { type: 'countdown', config: { message: 'Guardado para este evento' } },
  ];
  const updated = configureCopy(original, seed);
  assert.deepEqual(updated.slice(0, 2), original.slice(0, 2));
  assert.deepEqual(updated[2].config, { target: 'fechaHoraRecepcion', message: 'Guardado para este evento' });
  assert.deepEqual(configureCopy(updated, seed), updated);
  assert.equal(original[2].config.message, undefined);
});
