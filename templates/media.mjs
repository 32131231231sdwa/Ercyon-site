import { esc, imgAttrs } from '../build.mjs';

// Images uploaded in the CMS use /img/uploads/. External HTTPS images also work.
export function imageSource(value) {
  const src = typeof value === 'string' ? value.trim() : '';
  return /^(?:\/(?!\/)|https?:\/\/)/i.test(src) ? src : '';
}

export function mediaImage(value, { alt = '', className = '', eager = false, sizes } = {}) {
  const src = imageSource(value);
  if (!src) return '';
  return `<img src="${esc(src)}" alt="${esc(alt)}"${className ? ` class="${esc(className)}"` : ''}${imgAttrs(src, sizes)} loading="${eager ? 'eager' : 'lazy'}" decoding="async"${eager ? ' fetchpriority="high"' : ''}>`;
}

export function illustration(record, { alt = record.name || '', className = 'dossier-media', sizes } = {}) {
  const src = imageSource(record.image);
  if (!src) return '';
  return `<figure class="${esc(className)}"><a href="${esc(src)}" target="_blank" rel="noopener" title="Открыть изображение в полном размере">${mediaImage(src, { alt: record.image_alt || alt, sizes })}</a>${record.image_caption ? `<figcaption>${esc(record.image_caption)}</figcaption>` : ''}</figure>`;
}

export function heraldry(record, name, fallbackClass) {
  const symbols = [[record.flag, 'Флаг'], [record.coat_of_arms, 'Герб']]
    .filter(([src]) => imageSource(src));
  if (!symbols.length) return `<span class="${esc(fallbackClass)}" aria-hidden="true"></span>`;
  return `<span class="heraldry">${symbols.map(([src, label]) => mediaImage(src, { alt: `${label}: ${name}`, sizes: '48px' })).join('')}</span>`;
}
