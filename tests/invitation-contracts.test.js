const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveInvitationLocations } = require('../server/utils/invitationLocations');
const { alignModules } = require('../seeds/invitation_projects/bodmys/align-data');
const { buildDefaultInvitationModules } = require('../server/utils/invitationModuleDefaults');
const { configureCopy } = require('../seeds/invitation_projects/bodmys/configure-copy');
const { replaceWelcomeWithQuote } = require('../seeds/invitation_projects/bodmys/replace-welcome-with-quote');
const { configureEnvelopeVideo } = require('../seeds/invitation_projects/bodmys/configure-envelope-video');

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
