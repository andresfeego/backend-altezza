function isConfirmationClosed(deadline, now = Date.now()) {
  if (!deadline) return false;
  // MySQL dates are normally Date objects. Explicitly interpret unzoned SQL
  // strings in Colombia as well, independent of the server's operating system.
  const normalized = typeof deadline === 'string' && /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}$/.test(deadline)
    ? `${deadline.replace(' ', 'T')}-05:00`
    : deadline;
  const timestamp = new Date(normalized).getTime();
  return Number.isFinite(timestamp) && now >= timestamp;
}

function validateAttendanceResponses(respuestas, allowedIds) {
  if (!Array.isArray(respuestas) || !respuestas.length) throw 400;
  const seen = new Set();
  for (const item of respuestas) {
    const id = Number(item?.idInvitado);
    if (!Number.isSafeInteger(id) || id <= 0 || !allowedIds.has(id)) throw 404;
    if (![1, 2, 3].includes(Number(item?.confirmado)) || seen.has(id)) throw 400;
    seen.add(id);
  }
}

module.exports = { isConfirmationClosed, validateAttendanceResponses };
