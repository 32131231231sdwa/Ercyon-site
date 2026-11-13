export const YEAR_MS = 48 * 60 * 60 * 1000;
export const SESSION_MS = 24 * 60 * 60 * 1000;

export function readCalendar(row, now) {
  const elapsed = Math.max(0, row.accumulated_ms +
    (row.running && row.anchor_ms !== null ? Math.max(0, now - row.anchor_ms) : 0));
  return {
    year: row.base_year + Math.floor(elapsed / YEAR_MS),
    elapsed,
    remaining: YEAR_MS - elapsed % YEAR_MS,
    running: Boolean(row.running),
  };
}

export function changeCalendar(row, action, now, year) {
  const current = readCalendar(row, now);
  if (action === 'year') return { ...row, base_year: year, accumulated_ms: 0, anchor_ms: null, running: 0 };
  if (action === 'pause') return { ...row, accumulated_ms: current.elapsed, anchor_ms: null, running: 0 };
  if (action === 'start' && !row.running) return { ...row, anchor_ms: now, running: 1 };
  return row;
}

// Rejection sampling keeps all 100 outcomes equally likely.
export function rollD100(random = buffer => crypto.getRandomValues(buffer)) {
  const limit = Math.floor(0x100000000 / 100) * 100;
  const buffer = new Uint32Array(1);
  do { random(buffer); } while (buffer[0] >= limit);
  return buffer[0] % 100 + 1;
}

export function parseAdmins(value) {
  const values = String(value || '').split(',').map(v => v.trim()).filter(Boolean);
  if (!values.length || values.length > 5 || values.some(v => !/^[1-9]\d*$/.test(v))) return [];
  const ids = [...new Set(values.map(Number))];
  return ids.every(Number.isSafeInteger) ? ids : [];
}

export const isId = value => Number.isSafeInteger(value) && value !== 0;
export const esc = value => String(value ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function sameSecret(actual, expected) {
  if (typeof actual !== 'string' || typeof expected !== 'string' || !expected || actual.length !== expected.length) return false;
  let difference = 0;
  for (let i = 0; i < expected.length; i++) difference |= actual.charCodeAt(i) ^ expected.charCodeAt(i);
  return difference === 0;
}
