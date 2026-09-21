function mapsFromCoordinates(lat, lng) {
  if (lat == null || lng == null || lat === '' || lng === '') return null;
  const latitude = Number(lat);
  const longitude = Number(lng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
}

// Resolve once in the public payload, independently of the chosen template.
// Existing module links remain a fallback for places without coordinates.
function resolveInvitationLocations(evento = {}, modules = []) {
  const config = modules.find((module) => module.type === 'event_details')?.config || {};
  return {
    ceremonyMapUrl: mapsFromCoordinates(evento.latitudLugarCeremonia, evento.longitudLugarCeremonia)
      || String(config.ceremonyMapUrl || '').trim() || null,
    receptionMapUrl: mapsFromCoordinates(evento.latitudLugarRecepcion, evento.longitudLugarRecepcion)
      || String(config.receptionMapUrl || '').trim() || null,
    ceremonyAddress: String(config.ceremonyAddress || '').trim(),
    receptionAddress: String(config.receptionAddress || '').trim(),
  };
}

module.exports = { resolveInvitationLocations };
