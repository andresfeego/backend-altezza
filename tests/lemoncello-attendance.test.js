const test = require('node:test');
const assert = require('node:assert/strict');
const { configureAttendance } = require('../seeds/invitation_projects/bodlauser/configure-attendance');
const fallback = { type: 'attendance_confirm', config: { title: '¿Nos acompañas?', helperText: 'Mensaje' } };

test('attendance configuration is repeatable and preserves unrelated modules and settings', () => {
  const original = [{ type: 'hero_image_1', order: 1, config: { text1: 'Keep' } }, { type: 'dresscode', order: 2, config: { showReception: false } }, { type: 'closing_message', order: 3, enabled: false }, { type: 'attendance_confirm', order: 4, enabled: false, config: { title: 'Old', sectionBackground: 'keep' } }];
  const snapshot = structuredClone(original);
  const result = configureAttendance(original, fallback);
  assert.deepEqual(original, snapshot);
  assert.deepEqual(result.map(m => m.type), ['hero_image_1', 'dresscode', 'attendance_confirm', 'closing_message']);
  assert.deepEqual(result.slice(0, 2), original.slice(0, 2));
  assert.deepEqual(result[3], { ...original[2], order: 4 });
  assert.equal(result[2].config.sectionBackground, 'keep');
  assert.equal(result[2].config.helperText, 'Mensaje');
  assert.equal(result[2].enabled, true);
  assert.deepEqual(configureAttendance(result, fallback), result);
  assert.deepEqual(configureAttendance(original.slice(0, 3), fallback)[2].config, fallback.config);
});
test('attendance configuration rejects missing anchors, duplicates and absent copy', () => {
  const anchor = { type: 'dresscode' };
  assert.throws(() => configureAttendance([], fallback));
  assert.throws(() => configureAttendance([anchor, anchor], fallback));
  assert.throws(() => configureAttendance([anchor, fallback, fallback], fallback));
  assert.throws(() => configureAttendance([anchor], { type: 'attendance_confirm', config: {} }));
});
