const test = require('node:test');
const assert = require('node:assert/strict');
const { configureEventDetails } = require('../seeds/invitation_projects/bodlauser/configure-event-details');
const fallback = { type: 'event_details', config: { showCeremony: true, showReception: true, title: '' } };

test('event details insert after calendar, preserve existing data and remain idempotent', () => {
  const original = [{ type: 'countdown', order: 1, config: { message: 'Keep' } }, { type: 'save_the_date_calendar', order: 2 }, { type: 'dresscode', order: 3, enabled: false, config: { title: 'Keep' } }, { type: 'event_details', order: 4, enabled: false, config: { showReception: false, ceremonyMapUrl: 'https://example.com/location' } }];
  const snapshot = structuredClone(original);
  const result = configureEventDetails(original, fallback);
  assert.deepEqual(original, snapshot);
  assert.deepEqual(result.map(m => m.type), ['countdown', 'save_the_date_calendar', 'event_details', 'dresscode']);
  assert.equal(result[2].config.showReception, false);
  assert.equal(result[2].config.ceremonyMapUrl, original[3].config.ceremonyMapUrl);
  assert.equal(result[2].enabled, true);
  assert.deepEqual(result[3], { ...original[2], order: 4 });
  assert.deepEqual(configureEventDetails(result, fallback), result);
  assert.deepEqual(configureEventDetails(original.slice(0, 3), fallback)[2].config, fallback.config);
});

test('event details reject missing anchors and duplicate modules before mutation', () => {
  const calendar = { type: 'save_the_date_calendar', order: 1 };
  assert.throws(() => configureEventDetails([], fallback));
  assert.throws(() => configureEventDetails([calendar, calendar], fallback));
  assert.throws(() => configureEventDetails([calendar, fallback, fallback], fallback));
  assert.throws(() => configureEventDetails([calendar], {}));
});
