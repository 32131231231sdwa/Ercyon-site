(() => {
  const base = window.__BASE__ || '';
  const prefix = `ercyon:${base}:`;
  const read = (key, fallback) => { try { const value = JSON.parse(localStorage.getItem(prefix + key)); return value ?? fallback; } catch { return fallback; } };
  const write = (key, value) => { try { localStorage.setItem(prefix + key, JSON.stringify(value)); return true; } catch { return false; } };
  const localPath = value => typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') && !value.includes('\\');
  const list = key => { const value = read(key, []); return Array.isArray(value) ? value.filter(x=>x && localPath(x.url) && typeof x.title === 'string') : []; };
  const href = value => localPath(value) ? base + value : base + '/';
  let toastTimer;
  const toast = message => { const box = document.getElementById('siteToast'); if (!box) return; clearTimeout(toastTimer); box.textContent = message; box.hidden = false; toastTimer = setTimeout(()=>{box.hidden=true;},4500); };
  window.Ercyon = {base, read, write, list, localPath, href, toast};
})();
