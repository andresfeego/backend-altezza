const test = require('node:test');
const assert = require('node:assert/strict');
const { configureDressCode } = require('../seeds/invitation_projects/bodlauser/configure-dresscode');
const fallback = { type: 'dresscode', config: { title: 'Hospedaje', message: 'Mensaje', imageSrc: '/guests.webp' } };

test('dresscode configuration is repeatable and preserves unrelated modules and settings', () => {
  const original = [{ type: 'hero_image_1', order: 1, config: { text1: 'Keep' } }, { type: 'recommendations', order: 2, config: { showReception: false } }, { type: 'closing_message', order: 3, enabled: false }, { type: 'dresscode', order: 4, enabled: false, config: { title: 'Old', sectionBackground: 'keep' } }];
  const snapshot = structuredClone(original);
  const result = configureDressCode(original, fallback);
  assert.deepEqual(original, snapshot);
  assert.deepEqual(result.map(m => m.type), ['hero_image_1', 'recommendations', 'dresscode', 'closing_message']);
  assert.deepEqual(result.slice(0, 2), original.slice(0, 2));
  assert.deepEqual(result[3], { ...original[2], order: 4 });
  assert.equal(result[2].config.sectionBackground, 'keep');
  assert.equal(result[2].config.message, 'Mensaje');
  assert.equal(result[2].enabled, true);
  assert.deepEqual(configureDressCode(result, fallback), result);
  assert.deepEqual(configureDressCode(original.slice(0, 3), fallback)[2].config, fallback.config);
});
test('dresscode configuration rejects missing anchors, duplicates and absent image', () => {
  const anchor = { type: 'recommendations' };
  assert.throws(() => configureDressCode([], fallback));
  assert.throws(() => configureDressCode([anchor, anchor], fallback));
  assert.throws(() => configureDressCode([anchor, fallback, fallback], fallback));
  assert.throws(() => configureDressCode([anchor], { type: 'dresscode', config: {} }));
});
