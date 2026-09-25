const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeInvitationModuleType, renameImageSliderModules } = require('../server/utils/invitationModuleType');
const { configurePhotos } = require('../seeds/invitation_projects/bodlauser/configure-photos');

test('slider rename preserves configuration, disabled state, order and unrelated modules', () => {
  const before = [{ type: 'hero_image_1', config: { text1: 'Nos casamos' } }, { type: 'image_slider_sepia', order: 9, enabled: false, config: { images: ['/image_slider_sepia/one.jpg', '/two.jpg'], intervalMs: 3300, imageAdjustments: { 'one.jpg': { zoom: 1.2 } } } }];
  const snapshot = structuredClone(before);
  const after = renameImageSliderModules(before);
  assert.deepEqual(before, snapshot);
  assert.deepEqual(after, [before[0], { ...before[1], type: 'image_slider_1' }]);
  assert.deepEqual(renameImageSliderModules(after), after);
  assert.deepEqual(renameImageSliderModules(after, 'image_slider_1', 'image_slider_sepia'), before);
  assert.equal(normalizeInvitationModuleType(' image_slider_sepia '), 'image_slider_1');
  assert.equal(normalizeInvitationModuleType('photo_slider'), 'photo_slider');
});

test('Lemoncello photo configuration prefers the quote and retains all other content', () => {
  const before = [{ type: 'hero_image_1', order: 2, config: { text1: 'Nos casamos' } }, { type: 'welcome_message', order: 3, config: { subtitle: 'Original' } }, { type: 'biblical_quote', enabled: false, order: 4, config: { passageText: 'Frase original' } }];
  const config = { title: '', images: Array.from({ length: 7 }, (_, index) => `/photos/${index}.webp`) };
  const snapshot = structuredClone(before);
  const after = configurePhotos(before, config);
  assert.deepEqual(before, snapshot);
  assert.deepEqual(after.map(m => m.type), ['hero_image_1', 'welcome_message', 'biblical_quote', 'image_slider_1']);
  assert.deepEqual(after.filter(m => m.type !== 'image_slider_1').map(({ order, ...m }) => m), before.map(({ order, ...m }) => m));
  assert.deepEqual(configurePhotos(after, config), after);
  assert.throws(() => configurePhotos([], config));
  assert.throws(() => configurePhotos(before, { images: ['/duplicate', '/duplicate'] }));
  assert.throws(() => configurePhotos([...after, after[3]], config));
  assert.deepEqual(configurePhotos(before.slice(0, 2), config).map(m => m.type), ['hero_image_1', 'welcome_message', 'image_slider_1']);
});

test('Lemoncello corrects the quote scene once, preserving existing text and photos', () => {
  const { configureQuoteScene } = require('../seeds/invitation_projects/bodlauser/configure-quote-scene');
  const before = [
    { type: 'envelop_intro', order: 1, config: { brideName: 'Laura' } },
    { type: 'hero_image_1', order: 2, config: { text1: 'Nos casamos' } },
    { type: 'welcome_message', order: 3, config: { subtitle: 'Wrong contract' } },
    { type: 'image_slider_1', order: 4, config: { images: ['/one.webp', '/two.webp'] } },
    { type: 'biblical_quote', order: 5, enabled: false, config: { passageText: 'Texto original', passageReference: '' } },
  ];
  const snapshot = structuredClone(before);
  const after = configureQuoteScene(before, { passageText: 'Fallback', passageReference: 'Fallback reference' });
  assert.deepEqual(before, snapshot);
  assert.deepEqual(after.map(m => m.type), ['envelop_intro', 'hero_image_1', 'biblical_quote', 'image_slider_1']);
  assert.deepEqual(after[2].config, before[4].config);
  assert.equal(after[2].enabled, true);
  assert.deepEqual(after[3].config, before[3].config);
  assert.deepEqual(configureQuoteScene(after), after);
  assert.throws(() => configureQuoteScene([]));
  assert.throws(() => configureQuoteScene([...before, before[4]]));
  assert.throws(() => configureQuoteScene([...before, before[2]]));
});
