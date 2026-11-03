// При переносе страницы её slug остаётся идентификатором старых внутренних ссылок.
// Исправляем адрес только при единственном совпадении и сохраняем запрос и якорь.
export function repairPageLinks(docs, siteURL) {
  let site;
  try { if (siteURL) site = new URL(siteURL); } catch { /* Корневые ссылки работают и без адреса сайта. */ }
  const siteBase = site?.pathname.replace(/\/$/, '') || '';
  const localPath = raw => {
    if (raw.startsWith('/') && !raw.startsWith('//')) {
      return siteBase && raw.startsWith(siteBase + '/') ? raw.slice(siteBase.length) : raw;
    }
    if (!site || !/^https?:\/\//i.test(raw)) return null;
    try {
      const url = new URL(raw);
      if (url.origin !== site.origin || (siteBase && !url.pathname.startsWith(siteBase + '/'))) return null;
      return url.pathname.slice(siteBase.length);
    } catch { return null; }
  };
  const occupied = new Set(docs.map(d => d.url));
  const bySlug = new Map();
  for (const doc of docs) {
    if (doc.kind !== 'page' || typeof doc.slug !== 'string') continue;
    bySlug.set(doc.slug, bySlug.has(doc.slug) ? null : doc);
  }
  const aliases = new Map();
  for (const doc of docs) {
    if (typeof doc.html !== 'string') continue;
    doc.html = doc.html.replace(/<a\b[^>]*?\shref="([^"]*)"[^>]*>/gi, (tag, href) => {
      const rawPath = href.split(/[?#]/, 1)[0];
      const pathname = localPath(rawPath);
      const match = pathname?.match(/^\/[a-z0-9-]+\/([a-z0-9-]+)\/?$/);
      if (!match) return tag;
      const alias = pathname.endsWith('/') ? pathname : pathname + '/';
      if (occupied.has(alias)) return tag;
      const target = bySlug.get(match[1]);
      if (!target) return tag;
      aliases.set(alias, target);
      return tag.replace(/(\s)href="[^"]*"/i, (_attribute, space) => `${space}href="${target.url}${href.slice(rawPath.length)}"`);
    });
  }
  return aliases;
}
