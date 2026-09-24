const test = require('node:test');
const assert = require('node:assert/strict');
const { configureRecommendations } = require('../seeds/invitation_projects/bodlauser/configure-recommendations');
const fallback = { type: 'recommendations', config: { title: 'Hospedaje', text1: 'Mensaje', imageSrc: '/envelope.webp' } };

test('recommendation configuration is repeatable and preserves unrelated modules and settings', () => {
  const original = [{ type: 'hero_image_1', order: 1, config: { text1: 'Keep' } }, { type: 'gift_envelopes', order: 2, config: { showReception: false } }, { type: 'dresscode', order: 3, enabled: false }, { type: 'recommendations', order: 4, enabled: false, config: { title: 'Old', sectionBackground: 'keep' } }];
  const snapshot = structuredClone(original);
  const result = configureRecommendations(original, fallback);
  assert.deepEqual(original, snapshot);
  assert.deepEqual(result.map(m => m.type), ['hero_image_1', 'gift_envelopes', 'recommendations', 'dresscode']);
  assert.deepEqual(result.slice(0, 2), original.slice(0, 2));
  assert.deepEqual(result[3], { ...original[2], order: 4 });
  assert.equal(result[2].config.sectionBackground, 'keep');
  assert.equal(result[2].config.text1, 'Mensaje');
  assert.equal(result[2].enabled, true);
  assert.deepEqual(configureRecommendations(result, fallback), result);
  assert.deepEqual(configureRecommendations(original.slice(0, 3), fallback)[2].config, fallback.config);
});
test('recommendation configuration rejects missing anchors, duplicates and absent image', () => {
  const anchor = { type: 'gift_envelopes' };
  assert.throws(() => configureRecommendations([], fallback));
  assert.throws(() => configureRecommendations([anchor, anchor], fallback));
  assert.throws(() => configureRecommendations([anchor, fallback, fallback], fallback));
  assert.throws(() => configureRecommendations([anchor], { type: 'recommendations', config: {} }));
});
