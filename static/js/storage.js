(() => {
  const base = window.__BASE__ || '';
  const prefix = `ercyon:${base}:`;
  const read = (key, fallback) => { try { const value = JSON.parse(localStorage.getItem(prefix + key)); return value ?? fallback; } catch { return fallback; } };
  const write = (key, value) => { try { localStorage.setItem(prefix + key, JSON.stringify(value)); return true; } catch { return false; } };
  const localPath = value => typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') && !value.includes('\\');
  const readablePaths = new Set(__READABLE_PATHS__);
  const isReadable = value => localPath(value) && readablePaths.has(value);
  const list = key => { const value = read(key, []); return Array.isArray(value) ? value.filter(x=>x && isReadable(x.url) && typeof x.title === 'string') : []; };
  const href = value => localPath(value) ? base + value : base + '/';
  // Удалённые материалы не должны оставаться в избранном и истории чтения.
  const favorites = read('favorites', []);
  if (Array.isArray(favorites) && list('favorites').length !== favorites.length) write('favorites', list('favorites'));
  const positions = read('positions', {});
  if (positions && typeof positions === 'object' && !Array.isArray(positions)) {
    const kept = Object.entries(positions).filter(([url, record]) => isReadable(url) && record && isReadable(record.url));
    if (kept.length !== Object.keys(positions).length) write('positions', Object.fromEntries(kept));
  }
  const last = read('lastReading', null);
  const obsolete = ['myCountry', 'countryTabs'];
  if (last && !isReadable(last.url)) obsolete.push('lastReading');
  for (const key of obsolete) { try { localStorage.removeItem(prefix + key); } catch { /* Хранилище может быть недоступно. */ } }
  let toastTimer;
  const toast = message => { const box = document.getElementById('siteToast'); if (!box) return; clearTimeout(toastTimer); box.textContent = message; box.hidden = false; toastTimer = setTimeout(()=>{box.hidden=true;},4500); };
  window.Ercyon = {base, read, write, list, localPath, isReadable, href, toast};
})();
