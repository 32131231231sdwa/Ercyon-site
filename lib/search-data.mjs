import { countrySearchText } from './country-data.mjs';

export function plainText(html = '') {
  return html.replace(/<(script|style)[\s\S]*?<\/\1>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;|&#\d+;/gi, ' ')
    .replace(/\s+/g, ' ').trim();
}

/** Индексируем весь текст: выдержка для выдачи выбирается уже в браузере. */
export function documentSearchText(doc) {
  return [doc.kind === 'country' ? countrySearchText(doc.front) : '', plainText(doc.html)]
    .filter(Boolean).join(' ');
}
