const test = require('node:test');
const assert = require('node:assert/strict');
const seed = require('../seeds/invitation_projects/bodmys/modules.json');
const { configureGiftEnvelopes } = require('../seeds/invitation_projects/bodmys/configure-gift-envelopes');
const { configureDressCode } = require('../seeds/invitation_projects/bodmys/configure-dresscode');

test('gift envelopes precedes dresscode and preserves the content and relative order of other modules', () => {
  const before = seed.filter((m) => m.type !== 'gift_envelopes').map((m, i) => ({ ...m, order: i + 1 }));
  const snapshot = structuredClone(before);
  const after = configureGiftEnvelopes(before, seed);
  assert.deepEqual(before, snapshot);
  assert.equal(after.findIndex((m) => m.type === 'gift_envelopes') + 1, after.findIndex((m) => m.type === 'dresscode'));
  assert.deepEqual(after.filter((m) => m.type !== 'gift_envelopes').map(({ order, ...m }) => m), before.map(({ order, ...m }) => m));
  assert.equal(after.find((m) => m.type === 'gift_envelopes').config.title, 'Lluvia de sobres');
  const custom = structuredClone(after);
  custom.find((m) => m.type === 'gift_envelopes').config.title = 'Título editado';
  assert.deepEqual(configureGiftEnvelopes(custom, seed), custom);
});

test('dresscode and gift migrations compose in order and reject ambiguous input', () => {
  const legacy = seed.filter((m) => !['dresscode', 'gift_envelopes'].includes(m.type)).map((m, i) => ({ ...m, order: i + 1 }));
  const after = configureGiftEnvelopes(configureDressCode(legacy, seed), seed);
  assert.deepEqual(after, seed);
  assert.throws(() => configureGiftEnvelopes([], seed), /dresscode/);
  assert.throws(() => configureGiftEnvelopes([...seed, seed.find((m) => m.type === 'gift_envelopes')], seed), /duplicados/);
});
