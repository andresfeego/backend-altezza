const test = require('node:test');
const assert = require('node:assert/strict');
const { confirmDetails } = require('../seeds/invitation_projects/bodlauser/configure-confirmed-details');
const { configurePhotos } = require('../seeds/invitation_projects/bodlauser/configure-photos');
const seed = require('../seeds/invitation_projects/bodlauser/modules.json');

test('confirmed reception and chapel preserve other modules and repeat safely', () => {
  const before = [{ type: 'hero_image_1', config: { text1: 'Keep' } }, { type: 'event_details', order: 7, config: { ceremonyMessage: 'Keep', showCeremony: true, receptionMessage: 'RECEPTION TIME TO REPLACE' } }];
  const original = structuredClone(before);
  const after = confirmDetails(before);
  assert.deepEqual(before, original);
  assert.deepEqual(after[0], before[0]);
  assert.deepEqual(after[1], { ...before[1], config: { ...before[1].config, receptionMessage: '', ceremonyMapUrl: 'https://maps.app.goo.gl/ULysqgZLGN33vxTv9?g_st=ic', receptionMapUrl: 'https://www.google.com/maps/search/?api=1&query=5.7550716,-73.0934421' } });
  assert.deepEqual(confirmDetails(after), after);
  assert.throws(() => confirmDetails([]));
  assert.throws(() => confirmDetails([...before, before[1]]));
});

test('photo configuration accepts eleven interleaved images without dropping earlier photos', () => {
  const config = seed.find(m => m.type === 'image_slider_1').config;
  const after = configurePhotos(seed, config);
  const images = after.find(m => m.type === 'image_slider_1').config.images;
  assert.equal(images.length, 11);
  assert.deepEqual(images.filter(image => !/\/02[3-6]\.webp$/.test(image)).map(image => image.split('/').at(-1)), ['017.webp', '005.webp', '012.webp', '004.webp', '011.webp', '015.webp', '006.webp']);
  assert.deepEqual(configurePhotos(after, config), after);
  assert.throws(() => configurePhotos(seed, { images: [] }));
  assert.throws(() => configurePhotos(seed, { images: [''] }));
});
