const test = require('node:test');
const assert = require('node:assert/strict');
const { mergeClosingIntoPhotos } = require('../seeds/invitation_projects/bodmys/merge-closing-into-photos');
const seed = require('../seeds/invitation_projects/bodmys/modules.json');

function previous() {
  const modules = structuredClone(seed);
  const photos = modules.find((m) => m.type === 'instant_photos');
  delete photos.config.message;
  delete photos.config.reliefImageSrc;
  modules.find((m) => m.type === 'closing_message').enabled = true;
  return modules;
}

test('photo closing moves saved copy exactly once and preserves photos, seal, order and all other modules', () => {
  const before = previous();
  const snapshot = structuredClone(before);
  const after = mergeClosingIntoPhotos(before);
  assert.deepEqual(before, snapshot);
  assert.deepEqual(after, seed);
  const photos = after.find((m) => m.type === 'instant_photos');
  assert.equal(photos.config.message, before.find((m) => m.type === 'closing_message').config.message);
  assert.equal(photos.config.reliefImageSrc, before.find((m) => m.type === 'hero_image_1').config.backgroundImage);
  assert.deepEqual(after.map(({ type, order }) => ({ type, order })), before.map(({ type, order }) => ({ type, order })));
  assert.deepEqual(after.filter((m) => !['instant_photos', 'closing_message'].includes(m.type)), before.filter((m) => !['instant_photos', 'closing_message'].includes(m.type)));
  const { message, reliefImageSrc, ...media } = photos.config;
  assert.deepEqual(media, before.find((m) => m.type === 'instant_photos').config);
  assert.deepEqual(mergeClosingIntoPhotos(after), after);
  photos.config.message = '';
  photos.config.reliefImageSrc = '';
  assert.deepEqual(mergeClosingIntoPhotos(after), after);
});

test('photo closing preserves custom copy and refuses conflicting or ambiguous modules', () => {
  const before = previous();
  before.find((m) => m.type === 'closing_message').config.message = 'Un mensaje propio\nCon otra línea';
  assert.equal(mergeClosingIntoPhotos(before).find((m) => m.type === 'instant_photos').config.message, 'Un mensaje propio\nCon otra línea');
  before.find((m) => m.type === 'instant_photos').config.message = 'Texto diferente';
  assert.throws(() => mergeClosingIntoPhotos(before), /texto diferente/);
  assert.throws(() => mergeClosingIntoPhotos([]), /instant_photos/);
  assert.throws(() => mergeClosingIntoPhotos([...seed, seed.find((m) => m.type === 'closing_message')]), /closing_message/);
});
