const test = require('node:test');
const assert = require('node:assert/strict');
const seed = require('../seeds/invitation_projects/bodmys/modules.json');
const { configureDressCode } = require('../seeds/invitation_projects/bodmys/configure-dresscode');

test('dresscode is inserted after details without changing other module content or relative order', () => {
  const before = seed.filter((m) => !['dresscode', 'gift_envelopes'].includes(m.type)).map((m, i) => ({ ...m, order: i + 1 }));
  const snapshot = structuredClone(before);
  const after = configureDressCode(before, seed);
  assert.deepEqual(before, snapshot);
  assert.equal(after.findIndex((m) => m.type === 'dresscode'), after.findIndex((m) => m.type === 'event_details') + 1);
  assert.deepEqual(after.filter((m) => m.type !== 'dresscode').map(({ order, ...m }) => m), before.map(({ order, ...m }) => m));
  assert.deepEqual(after.map((m) => m.order), after.map((_, i) => i + 1));
  const data = after.find((m) => m.type === 'dresscode').config;
  assert.equal(data.suggestedColors.length, 8);
  assert.deepEqual(data.avoidedColors.map((c) => c.label), ['Blanco', 'Marfil', 'Beige']);
  assert.ok(data.suggestedColors.every((c) => c.imageSrc && c.crop && c.label !== 'Blanco'));
});

test('repeating migration preserves customer dresscode configuration and rejects ambiguous source data', () => {
  const custom = structuredClone(seed);
  custom.find((m) => m.type === 'dresscode').config.title = 'Título personalizado';
  assert.deepEqual(configureDressCode(custom, seed), custom);
  assert.throws(() => configureDressCode([], seed), /detalles/);
  assert.throws(() => configureDressCode([...seed, seed.find((m) => m.type === 'dresscode')], seed), /duplicados/);
});
