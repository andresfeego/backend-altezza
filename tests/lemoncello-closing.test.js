const test = require('node:test');
const assert = require('node:assert/strict');
const { configureClosing } = require('../seeds/invitation_projects/bodlauser/configure-closing');
const fallback = { type: 'closing_message', config: { message: 'Te esperamos', imageSrc: '/monogram.png' } };

test('closing configuration is repeatable and preserves unrelated modules and settings', () => {
  const original = [{ type: 'hero_image_1', order: 1, config: { text1: 'Keep' } }, { type: 'attendance_confirm', order: 2, config: { showReception: false } }, { type: 'welcome_message', order: 3, enabled: false }, { type: 'closing_message', order: 4, enabled: false, config: { title: 'Old', sectionBackground: 'keep' } }];
  const snapshot = structuredClone(original);
  const result = configureClosing(original, fallback);
  assert.deepEqual(original, snapshot);
  assert.deepEqual(result.map(m => m.type), ['hero_image_1', 'attendance_confirm', 'closing_message', 'welcome_message']);
  assert.deepEqual(result.slice(0, 2), original.slice(0, 2));
  assert.deepEqual(result[3], { ...original[2], order: 4 });
  assert.equal(result[2].config.sectionBackground, 'keep');
  assert.equal(result[2].config.message, 'Te esperamos');
  assert.equal(result[2].enabled, true);
  assert.deepEqual(configureClosing(result, fallback), result);
  assert.deepEqual(configureClosing(original.slice(0, 3), fallback)[2].config, fallback.config);
});
test('closing configuration rejects missing anchors, duplicates and absent copy', () => {
  const anchor = { type: 'attendance_confirm' };
  assert.throws(() => configureClosing([], fallback));
  assert.throws(() => configureClosing([anchor, anchor], fallback));
  assert.throws(() => configureClosing([anchor, fallback, fallback], fallback));
  assert.throws(() => configureClosing([anchor], { type: 'closing_message', config: {} }));
});
