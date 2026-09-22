const test = require('node:test');
const assert = require('node:assert/strict');
const { rewriteMedia } = require('../seeds/invitation_projects/bodmys/optimize-media');
const manifest = require('../seeds/invitation_projects/bodmys/media-optimized.json');
const modules = require('../seeds/invitation_projects/bodmys/modules.json');

test('media update changes only matching URLs, preserves copy/order/settings and is repeatable', () => {
  const input = [{ type: 'instant_photos', enabled: true, order: 3, config: { images: [{ imageSrc: '/old.png', imageAlt: 'Pareja' }], message: 'Mensaje elegido', opacity: 0.1, unrelated: '/custom.jpg' } }];
  const original = structuredClone(input);
  const after = rewriteMedia(input, { '/old.png': '/new.webp' });
  assert.deepEqual(input, original);
  assert.deepEqual(after, [{ ...input[0], config: { ...input[0].config, images: [{ imageSrc: '/new.webp', imageAlt: 'Pareja' }] } }]);
  assert.deepEqual(rewriteMedia(after, { '/old.png': '/new.webp' }), after);
});

test('manifest retains hashes for originals and derivatives and seed uses optimized resources', () => {
  const text = JSON.stringify(modules);
  assert.equal(manifest.eventId, 'bodmys');
  for (const item of manifest.assets) {
    assert.match(item.originalSha256, /^[a-f0-9]{64}$/);
    assert.match(item.optimizedSha256, /^[a-f0-9]{64}$/);
    assert.ok(item.optimizedBytes <= item.originalBytes);
    if (item.url && item.url !== item.optimizedUrl) {
      assert.ok(text.includes(item.optimizedUrl), item.optimizedUrl);
      assert.ok(!text.includes(JSON.stringify(item.url)), item.url);
    }
    if (item.alphaUnchanged !== undefined) assert.equal(item.alphaUnchanged, true);
  }
});
