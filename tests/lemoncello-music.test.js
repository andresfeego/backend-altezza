const test = require('node:test');
const assert = require('node:assert/strict');
const { configureMusic, AUDIO_SRC } = require('../seeds/invitation_projects/bodlauser/configure-music');

test('soundtrack configuration is idempotent and preserves visual modules', () => {
  const original = [{ type: 'envelop_intro', order: 1, config: {} }, { type: 'dresscode', order: 10, config: { message: 'Keep' } }];
  const snapshot = structuredClone(original);
  const next = configureMusic(original);
  assert.deepEqual(original, snapshot);
  assert.deepEqual(next.slice(0, 2), original);
  assert.equal(next[2].config.audioSrc, AUDIO_SRC);
  assert.equal(next[2].config.autoplay, true);
  assert.equal(next[2].config.initiallyMuted, false);
  assert.equal(next[2].enabled, true);
  assert.deepEqual(configureMusic(next), next);
  const existing = [...original, { type: 'music_player', order: 13, enabled: false, config: { sectionBackground: 'keep' } }];
  assert.equal(configureMusic(existing)[2].config.sectionBackground, 'keep');
  assert.throws(() => configureMusic([...existing, existing[2]]), /duplicada/);
});
