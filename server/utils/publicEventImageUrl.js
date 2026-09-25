/** Browser assets stay on the frontend origin, which proxies the local Storage. */
function publicEventImageUrl(value, {
  eventPath = '/scrAppaltezza/images/eventos',
  invitationPath = '/scrAppaltezza/invitations',
  templatePath = '/scrAppaltezza/templates',
} = {}) {
  const raw = String(value || '').trim();
  if (!raw) return raw;
  const roots = [eventPath, invitationPath, templatePath].map(root => root.replace(/\/+$/, ''));
  const isStoragePath = pathname => roots.some(root => pathname === root || pathname.startsWith(`${root}/`));

  if (/^(https?:)?\/\//i.test(raw)) {
    try {
      const url = new URL(raw, 'https://asset.invalid');
      return isStoragePath(url.pathname) ? `${url.pathname}${url.search}${url.hash}` : raw;
    } catch { return raw; }
  }

  const relative = raw.startsWith('/') ? raw : `/${raw}`;
  // Existing public URLs must not receive the event folder a second time.
  if (isStoragePath(relative.split(/[?#]/, 1)[0])) return relative;
  return `${roots[0]}${relative}`;
}

module.exports = { publicEventImageUrl };
