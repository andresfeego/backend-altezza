const test = require('node:test');
const assert = require('node:assert/strict');
const { isConfirmationClosed, validateAttendanceResponses } = require('../server/utils/invitationAttendance');

test('Colombia deadline is exclusive, regardless of machine timezone', () => {
  const cutoff = Date.parse('2026-11-19T00:00:00-05:00');
  for (const deadline of ['2026-11-19 00:00:00', '2026-11-19T00:00:00-05:00', new Date(cutoff)]) {
    assert.equal(isConfirmationClosed(deadline, cutoff - 1), false);
    assert.equal(isConfirmationClosed(deadline, cutoff), true);
    assert.equal(isConfirmationClosed(deadline, cutoff + 1), true);
  }
});
test('events without a deadline remain open', () => {
  assert.equal(isConfirmationClosed(null), false);
  assert.equal(isConfirmationClosed(''), false);
});
test('valid family responses are accepted and invalid batches rejected before writes', () => {
  const members = new Set([1, 2]);
  assert.doesNotThrow(() => validateAttendanceResponses([{ idInvitado: 1, confirmado: 1 }, { idInvitado: 2, confirmado: 3 }], members));
  const reject = (input, code) => {
    try { validateAttendanceResponses(input, members); assert.fail('expected rejection'); }
    catch (error) { assert.equal(error, code); }
  };
  reject([], 400);
  reject([{ idInvitado: 1, confirmado: 42 }], 400);
  reject([{ idInvitado: 9, confirmado: 1 }], 404);
  reject([{ idInvitado: 1, confirmado: 1 }, { idInvitado: 1, confirmado: 2 }], 400);
});
