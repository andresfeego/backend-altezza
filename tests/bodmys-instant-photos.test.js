const test = require('node:test');
const assert = require('node:assert/strict');
const seed = require('../seeds/invitation_projects/bodmys/modules.json');
const { configureInstantPhotos } = require('../seeds/invitation_projects/bodmys/configure-instant-photos');

test('instant photos follow attendance and only the closing decoration changes in existing modules', () => {
  const before = seed.filter((m) => m.type !== 'instant_photos').map((m, index) => ({ ...structuredClone(m), order: index + 1 }));
  delete before.find((m) => m.type === 'closing_message').config.showFrame;
  const snapshot = structuredClone(before);
  const after = configureInstantPhotos(before, seed);
  assert.deepEqual(before, snapshot);
  assert.equal(after.findIndex((m) => m.type === 'instant_photos'), after.findIndex((m) => m.type === 'attendance_confirm') + 1);
  assert.equal(after.find((m) => m.type === 'closing_message').config.showFrame, false);
  const existing = after.filter((m) => m.type !== 'instant_photos');
  assert.deepEqual(existing.map(({ order, ...m }) => m), before.map(({ order, ...m }) => m.type === 'closing_message' ? { ...m, config: { ...m.config, showFrame: false } } : m));
  assert.deepEqual(after, seed);
  assert.deepEqual(configureInstantPhotos(after, seed), after);
  const edited = structuredClone(after);
  edited.find((m) => m.type === 'instant_photos').config.images[0].imageSrc = '/chosen-later.jpeg';
  edited.find((m) => m.type === 'closing_message').config.showFrame = true;
  assert.deepEqual(configureInstantPhotos(edited, seed), edited);
});

test('photo migration refuses ambiguous order, duplicate modules and incomplete media', () => {
  const before = seed.filter((m) => m.type !== 'instant_photos');
  assert.throws(() => configureInstantPhotos([], seed), /asistencia/);
  assert.throws(() => configureInstantPhotos([...seed, seed.find((m) => m.type === 'instant_photos')], seed), /duplicados/);
  assert.throws(() => configureInstantPhotos(before.map((m) => ({ ...m, order: 1 })), seed), /orden/);
  assert.throws(() => configureInstantPhotos(before, []), /fotografías/);
});
