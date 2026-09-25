const test = require('node:test');
const assert = require('node:assert/strict');
const { publicEventImageUrl } = require('../server/utils/publicEventImageUrl');

test('event images resolve on the current LAN, tunnel or production origin', () => {
  const image = publicEventImageUrl('/bodlauser/datos_evento/hero.jpg');
  for (const origin of ['http://192.168.80.43:3002', 'https://preview.trycloudflare.com', 'https://events.example']) {
    assert.equal(new URL(image, origin).href, `${origin}/scrAppaltezza/images/eventos/bodlauser/datos_evento/hero.jpg`);
  }
  assert.equal(publicEventImageUrl('bodlauser/datos_evento/hero.jpg'), image);
});

test('a cover already stored as a public path is not prefixed a second time', () => {
  for (const path of [
    '/scrAppaltezza/invitations/bodcatyand/cover/seo_cover.webp',
    '/scrAppaltezza/images/eventos/bodlauser/datos_evento/hero.jpg?v=2',
    '/scrAppaltezza/templates/lemoncello/cover.jpg',
  ]) {
    assert.equal(publicEventImageUrl(path), path);
    assert.equal(publicEventImageUrl(publicEventImageUrl(path)), path);
  }
});

test('legacy absolute Storage URLs lose the host but preserve query and hash', () => {
  const path = '/scrAppaltezza/images/eventos/bodlauser/datos_evento/hero.jpg?v=2#preview';
  for (const origin of ['http://localhost:3022', 'http://127.0.0.1:3022', 'https://old.example', '//old.example']) {
    assert.equal(publicEventImageUrl(origin + path), path);
  }
});

test('external images and empty values are preserved without a Storage prefix', () => {
  for (const url of ['https://cdn.example/portrait.jpg', '//cdn.example/portrait.jpg', 'https://cdn.example/scrAppaltezza/invitations-other/cover.jpg']) {
    assert.equal(publicEventImageUrl(url), url);
  }
  assert.equal(publicEventImageUrl(null), '');
  assert.equal(publicEventImageUrl('  '), '');
});

test('custom Storage mounts work with both relative files and existing public URLs', () => {
  const config = { eventPath: '/media/events/', invitationPath: '/media/invites/', templatePath: '/media/templates/' };
  assert.equal(publicEventImageUrl('/event/cover.jpg', config), '/media/events/event/cover.jpg');
  assert.equal(publicEventImageUrl('http://localhost:3022/media/invites/event/cover.jpg', config), '/media/invites/event/cover.jpg');
});
