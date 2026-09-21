const test = require('node:test');
const assert = require('node:assert/strict');
const { configureNamesBackground } = require('../seeds/invitation_projects/bodmys/configure-names-background');

test('names background preserves all content and order; repeated runs retain later edits and explicit opt-out', () => {
  const before = [{ type: 'couple_family', order: 5, config: { title: 'Familia' } }, { type: 'couple_names', order: 6, enabled: true, config: { brideName: 'Ana', groomName: 'Luis' } }, { type: 'countdown', order: 7, config: { title: 'Faltan' } }];
  const snapshot = structuredClone(before);
  const background = { imageSrc: '/garden.png', overlayOpacity: .78 };
  const after = configureNamesBackground(before, background);
  assert.deepEqual(before, snapshot);
  assert.deepEqual(after, before.map(m => m.type === 'couple_names' ? { ...m, config: { ...m.config, sectionBackground: background } } : m));
  for (const custom of [null, { imageSrc: '/custom.png', overlayOpacity: 0 }]) {
    after[1].config.sectionBackground = custom;
    assert.deepEqual(configureNamesBackground(after, background), after);
  }
  assert.throws(() => configureNamesBackground([], background));
});
