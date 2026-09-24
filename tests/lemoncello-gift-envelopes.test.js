const test = require('node:test');
const assert = require('node:assert/strict');
const { configureGiftEnvelopes } = require('../seeds/invitation_projects/bodlauser/configure-gift-envelopes');
const fallback = { type: 'gift_envelopes', config: { title: 'Lluvia de sobres', leadText: 'Mensaje', imageSrc: '/envelope.webp' } };

test('gift configuration is repeatable and preserves unrelated modules and settings', () => {
  const original = [{ type: 'hero_image_1', order: 1, config: { text1: 'Keep' } }, { type: 'event_details', order: 2, config: { showReception: false } }, { type: 'dresscode', order: 3, enabled: false }, { type: 'gift_envelopes', order: 4, enabled: false, config: { title: 'Old', sectionBackground: 'keep' } }];
  const snapshot = structuredClone(original);
  const result = configureGiftEnvelopes(original, fallback);
  assert.deepEqual(original, snapshot);
  assert.deepEqual(result.map(m => m.type), ['hero_image_1', 'event_details', 'gift_envelopes', 'dresscode']);
  assert.deepEqual(result.slice(0, 2), original.slice(0, 2));
  assert.deepEqual(result[3], { ...original[2], order: 4 });
  assert.equal(result[2].config.sectionBackground, 'keep');
  assert.equal(result[2].config.leadText, 'Mensaje');
  assert.equal(result[2].enabled, true);
  assert.deepEqual(configureGiftEnvelopes(result, fallback), result);
  assert.deepEqual(configureGiftEnvelopes(original.slice(0, 3), fallback)[2].config, fallback.config);
});
test('gift configuration rejects missing anchors, duplicates and absent icon', () => {
  const anchor = { type: 'event_details' };
  assert.throws(() => configureGiftEnvelopes([], fallback));
  assert.throws(() => configureGiftEnvelopes([anchor, anchor], fallback));
  assert.throws(() => configureGiftEnvelopes([anchor, fallback, fallback], fallback));
  assert.throws(() => configureGiftEnvelopes([anchor], { type: 'gift_envelopes', config: {} }));
});
