const test = require('node:test');
const assert = require('node:assert/strict');
const { configureDateScene } = require('../seeds/invitation_projects/bodlauser/configure-date-scene');
const defaults = [
  { type: 'countdown', config: { title: 'Faltan', message: 'Cada instante nos acerca a compartir este día contigo.', showDate: true, target: 'fechaHoraCeremonia' } },
  { type: 'save_the_date_calendar', config: { message: 'El gran día' } },
];
const original = [{ type: 'hero_image_1', order: 1, config: { text1: 'Nos casamos' } }, { type: 'image_slider_1', order: 2, config: { images: ['/one.webp'] } }, { type: 'event_details', order: 3, enabled: false, config: { ceremonyMessage: 'Preservar' } }];
test('date composition inserts after photos and stays idempotent without changing existing data', () => {
  const snapshot = structuredClone(original);
  const next = configureDateScene(original, defaults);
  assert.deepEqual(original, snapshot);
  assert.deepEqual(next.map(m => m.type), ['hero_image_1', 'image_slider_1', 'countdown', 'save_the_date_calendar', 'event_details']);
  assert.deepEqual(next[4].config, original[2].config);
  assert.equal(next[4].enabled, false);
  assert.deepEqual(configureDateScene(next, defaults), next);
});
test('date composition preserves explicit copy and backgrounds, enables the date and rejects ambiguous input', () => {
  const next = configureDateScene([...original, { type: 'countdown', order: 4, config: { message: '', showDate: false, sectionBackground: { imageSrc: '/custom.webp' } } }], defaults);
  assert.equal(next[2].config.message, '');
  assert.equal(next[2].config.showDate, true);
  assert.deepEqual(next[2].config.sectionBackground, { imageSrc: '/custom.webp' });
  assert.throws(() => configureDateScene([], defaults));
  assert.throws(() => configureDateScene(original, []));
  assert.throws(() => configureDateScene([...next, next[2]], defaults));
});
