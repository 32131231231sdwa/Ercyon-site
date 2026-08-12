/**
 * ═══════════════════════════════════════════════════════════════════
 *  СБОРЩИК САЙТА ERCYON
 *  Читает content/*.md  →  собирает готовый сайт в dist/
 *
 *  Запуск:  node build.mjs          (собрать)
 *           node build.mjs --serve  (собрать и открыть локально)
 *
 *  Зависимостей нет: обе библиотеки лежат в vendor/ и никуда не ходят.
 * ═══════════════════════════════════════════════════════════════════
 */
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { execFileSync } from 'node:child_process';
import { Marked } from './vendor/marked.esm.js';
import yaml from './vendor/js-yaml.mjs';
import { renderPage } from './templates/layout.mjs';
import * as views from './templates/views.mjs';
import { iconsPage } from './templates/icons-page.mjs';

const ROOT = path.dirname(url.fileURLToPath(import.meta.url));
const CONTENT = path.join(ROOT, 'content');
const STATIC = path.join(ROOT, 'static');
const DIST = path.join(ROOT, 'dist');
// База для GitHub Pages: сайт живёт в подпапке /Ercyon-site/.
// Задаётся переменной BASE_PATH при сборке (workflow). Локально пусто → корень.
const BASE = (process.env.BASE_PATH || '').replace(/\/+$/, '');

const log = (...a) => console.log(...a);

/* ═════════════════════════ утилиты ═════════════════════════ */

const TRANSLIT = {
  а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'e',ж:'zh',з:'z',и:'i',й:'y',к:'k',л:'l',м:'m',
  н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',х:'h',ц:'c',ч:'ch',ш:'sh',щ:'sch',
  ъ:'',ы:'y',ь:'',э:'e',ю:'yu',я:'ya'
};

export function slugify(s) {
  return String(s).toLowerCase().trim()
    .split('').map(ch => TRANSLIT[ch] ?? ch).join('')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70) || 'razdel';
}

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
}

const MONTHS = ['января','февраля','марта','апреля','мая','июня',
                'июля','августа','сентября','октября','ноября','декабря'];

export function humanDate(iso) {
  if (!iso) return '';
  const d = iso instanceof Date ? iso : new Date(iso);
  if (isNaN(d)) return String(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** Дата последней правки файла: сначала из git, иначе из шапки, иначе дата сборки. */
const BUILD_TIME = new Date();

/* Хостинги качают репозиторий «обрезанным», и тогда история правок недоступна.
   Один раз пробуем дотянуть её — чтобы даты обновления были настоящими. */
(function unshallow() {
  try {
    const shallow = execFileSync('git', ['rev-parse', '--is-shallow-repository'],
      { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    if (shallow === 'true') {
      execFileSync('git', ['fetch', '--unshallow', '--quiet'],
        { cwd: ROOT, stdio: 'ignore', timeout: 45000 });
    }
  } catch { /* нет git или нет сети — обойдёмся датой файла */ }
})();
function fileUpdated(abs, front) {
  if (front?.updated) return new Date(front.updated);
  try {
    const out = execFileSync('git', ['log', '-1', '--format=%cI', '--', abs],
      { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    if (out) return new Date(out);
  } catch { /* git недоступен — не страшно */ }
  try { return fs.statSync(abs).mtime; } catch { return BUILD_TIME; }
}

/* ═════════════════════════ подписи интерфейса ═════════════════════════ */

/** Достаёт надпись из настроек по пути вида 'news.empty'.
    Пустое или отсутствующее значение — берём запасное, чтобы сайт не «поплыл». */
export function makeL(S) {
  const root = S?.labels || {};
  return (dotted, fallback) => {
    const v = String(dotted).split('.').reduce((o, k) => (o == null ? o : o[k]), root);
    return v == null || v === '' ? fallback : v;
  };
}

/* Пока настройки не прочитаны, возвращаем запасные значения. */
let L = (_p, fb) => fb;

/* ═════════════════════════ markdown ═════════════════════════ */

const marked = new Marked({ gfm: true, breaks: false });

/** Разбирает YAML-шапку между --- */
function parseFront(raw, file) {
  const m = raw.match(/^﻿?---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { front: {}, body: raw };
  let front = {};
  try {
    front = yaml.load(m[1]) || {};
  } catch (e) {
    throw new Error(`Ошибка в YAML-шапке файла ${path.relative(ROOT, file)}:\n${e.message}`);
  }
  return { front, body: m[2] };
}

const CONTAINERS = {
  seal:  { cls: 'callout callout--seal',  icon: 'd-wax',   key: 'callouts.seal',  def: 'Важно'      },
  note:  { cls: 'callout callout--note',  icon: 'i-leaf',  key: 'callouts.note',  def: 'Заметка'    },
  warn:  { cls: 'callout callout--warn',  icon: 'i-seal',  key: 'callouts.warn',  def: 'Осторожно'  },
  quote: { cls: 'callout callout--quote', icon: 'i-quill', key: 'callouts.quote', def: 'Из хроники' },
};

/** Блоки вида  :::seal Заголовок … :::  превращаются в оформленные врезки. */
function renderMarkdown(md) {
  const lines = String(md).replace(/\r\n/g, '\n').split('\n');
  let html = '', buf = [], open = null;

  const flush = () => { if (buf.length) { html += marked.parse(buf.join('\n')); buf = []; } };

  for (const line of lines) {
    const o = line.match(/^:::[ \t]*([a-z]+)[ \t]*(.*)$/i);
    if (o && CONTAINERS[o[1].toLowerCase()] && !open) {
      flush();
      open = CONTAINERS[o[1].toLowerCase()];
      const title = (o[2] || '').trim() || L(open.key, open.def);
      html += `<aside class="${open.cls}"><div class="callout__head">`
            + `<svg class="callout__ico" aria-hidden="true"><use href="#${open.icon}"/></svg>`
            + `<span>${esc(title)}</span></div><div class="callout__body">`;
      continue;
    }
    if (/^:::[ \t]*$/.test(line) && open) { flush(); html += '</div></aside>'; open = null; continue; }
    buf.push(line);
  }
  flush();
  if (open) html += '</div></aside>';
  return html;
}

/** Доводка готового HTML: якоря, ленивые картинки, прокручиваемые таблицы, ❦. */
function polish(html) {
  const toc = [];
  const used = new Set();

  html = html.replace(/<h([23])>([\s\S]*?)<\/h\1>/g, (_, lvl, inner) => {
    const text = inner.replace(/<[^>]+>/g, '').trim();
    let id = slugify(text);
    let n = 2; while (used.has(id)) id = `${slugify(text)}-${n++}`;
    used.add(id);
    toc.push({ level: Number(lvl), text, id });
    return `<h${lvl} id="${id}">${inner}`
         + `<a class="anchor" href="#${id}" aria-label="Ссылка на раздел «${esc(text)}»">§</a></h${lvl}>`;
  });

  // внешние ссылки открываем в новой вкладке
  html = html.replace(/<a href="(https?:\/\/[^"]+)"/g,
    '<a href="$1" target="_blank" rel="noopener noreferrer" class="ext"');

  // картинки — ленивые, с подписью из title
  html = html.replace(/<p>(<img [^>]+>)<\/p>/g, (_, img) => {
    const alt = (img.match(/alt="([^"]*)"/) || [, ''])[1];
    const title = (img.match(/title="([^"]*)"/) || [, ''])[1];
    const cap = title || alt;
    const tag = img.replace('<img ', '<img loading="lazy" decoding="async" ');
    return `<figure class="fig">${tag}${cap ? `<figcaption>${cap}</figcaption>` : ''}</figure>`;
  });
  html = html.replace(/<img (?![^>]*loading)/g, '<img loading="lazy" decoding="async" ');

  // таблицы прокручиваются на телефоне
  html = html.replace(/<table>/g, '<div class="table-wrap"><table>').replace(/<\/table>/g, '</table></div>');

  // одинокий ❦ — растительный разделитель
  html = html.replace(/<p>[\s]*❦[\s]*<\/p>/g,
    '<div class="rule" role="separator"><svg aria-hidden="true"><use href="#d-divider"/></svg></div>');

  // чекбоксы и код без сюрпризов
  html = html.replace(/<blockquote>/g, '<blockquote class="bq">');

  return { html, toc };
}

function plainText(html) {
  return html.replace(/<(script|style)[\s\S]*?<\/\1>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;|&#\d+;/gi, ' ')
    .replace(/\s+/g, ' ').trim();
}

/* ═════════════════════════ чтение контента ═════════════════════════ */

function readDir(dir) {
  const p = path.join(CONTENT, dir);
  if (!fs.existsSync(p)) return [];
  return fs.readdirSync(p).filter(f => f.endsWith('.md')).sort()
    .map(f => {
      const abs = path.join(p, f);
      const raw = fs.readFileSync(abs, 'utf8');
      const { front, body } = parseFront(raw, abs);
      return { file: f, abs, front, body };
    });
}

function readYaml(name) {
  const abs = path.join(CONTENT, name);
  if (!fs.existsSync(abs)) return {};
  try {
    return yaml.load(fs.readFileSync(abs, 'utf8')) || {};
  } catch (e) {
    throw new Error(`Ошибка в файле content/${name}:\n    ${e.message}\n`
      + `    Подсказка: если в тексте есть двоеточие, возьмите значение в кавычки — `
      + `intro: "Карты: границы и земли".`);
  }
}

function loadSettings() {
  const s = readYaml('settings.yml');
  // Подписи интерфейса живут отдельным файлом: так две страницы панели
  // не затирают правки друг друга.
  s.labels = { ...(s.labels || {}), ...(readYaml('labels.yml').labels || {}) };
  s.categories = (s.categories || []).map((c, i) => ({ icon: 'i-leaf', order: i, ...c }));
  s.season = s.season || {};
  return s;
}

/* ═════════════════════ страховка разделов ═════════════════════
   Разделы, которые сайт знает «в лицо». Если такой раздел случайно удалили
   из настроек (легко сделать в панели), а страницы с ним остались, раздел
   восстанавливается сам: иначе половина сайта свалится в «Прочее», адреса
   страниц поедут, а страны, договоры и новости пропадут из меню.
   Это уже случалось — правка настроек трижды сносила по разделу. */
const CATEGORY_FALLBACKS = {
  base:      { title: 'База',             icon: 'seal',
               intro: 'С чего начать, как всё устроено и по каким правилам живёт мир.' },
  lore:      { title: 'Сеттинг',          icon: 'leaf',
               intro: 'История Эрциона, магия, народы и те, кто вершит судьбы.' },
  maps:      { title: 'Карты',            icon: 'map',
               intro: 'Как выглядит мир: границы, земли и то, что под ними.' },
  countries: { title: 'Страны',           icon: 'banner',
               intro: 'Досье держав, порядок вступления и реестр договоров.' },
  mechanics: { title: 'Механики',         icon: 'scales',
               intro: 'Правила экспансии, торговли, войн и исследований.' },
  news:      { title: 'Новости и пресса', icon: 'quill',
               intro: 'Что происходит в мире прямо сейчас и что пишут игроки.' },
  season:    { title: 'Сезон',            icon: 'crown',
               intro: 'Итоги, номинации и те, чьи имена остались в хронике.' },
};
const CATEGORY_ORDER = Object.keys(CATEGORY_FALLBACKS);

function ensureCategories(S, usedIds) {
  const restored = [];
  for (const id of usedIds) {
    if (!CATEGORY_FALLBACKS[id]) continue;          // незнакомый id — страница уйдёт в «Прочее»
    if (S.categories.some(c => c.id === id)) continue;
    const pos = CATEGORY_ORDER.indexOf(id);
    // Возвращаем раздел на его обычное место, чтобы меню не перетасовалось.
    let at = S.categories.findIndex(c => {
      const i = CATEGORY_ORDER.indexOf(c.id);
      return i === -1 || i > pos;
    });
    if (at < 0) at = S.categories.length;
    S.categories.splice(at, 0, { id, order: at, ...CATEGORY_FALLBACKS[id] });
    restored.push(id);
  }
  return restored;
}

/* ═════════════════════════ сборка ═════════════════════════ */

function build() {
  const t0 = Date.now();
  const S = loadSettings();
  L = makeL(S);

  const pageFiles = readDir('pages').filter(x => !x.front.draft);
  const countryFiles = readDir('countries').filter(x => !x.front.draft);
  const treatyFiles = readDir('treaties').filter(x => !x.front.draft);
  const newsFiles = readDir('news').filter(x => !x.front.draft);

  /* Пропавшие разделы возвращаем до того, как начнём раскладывать страницы. */
  const usedCats = new Set(pageFiles.map(x => x.front.category).filter(Boolean));
  if (countryFiles.length || treatyFiles.length) usedCats.add('countries');
  if (newsFiles.length) usedCats.add('news');
  const restoredCats = ensureCategories(S, usedCats);

  const catById = Object.fromEntries(S.categories.map(c => [c.id, c]));
  const orphans = [];
  const docs = [];

  const push = d => { docs.push(d); return d; };

  /* — обычные страницы — */
  for (const { file, abs, front, body } of pageFiles) {
    let cat = catById[front.category];
    if (!cat) {
      // Раздел удалили или переименовали. Страницу НЕ теряем: складываем
      // в раздел «Прочее», чтобы её можно было найти и перевесить в панели.
      if (!catById.other) {
        catById.other = { id: 'other', title: L('misc.orphan_category', 'Прочее'), icon: 'scroll',
                          intro: 'Страницы, чей раздел был удалён или переименован.' };
        S.categories.push(catById.other);
      }
      orphans.push(`${file} (категория «${front.category ?? '—'}»)`);
      cat = catById.other;
    }
    const slug = front.slug || slugify(front.title || path.basename(file, '.md'));
    const urlPath = cat.id === 'base' ? `/${slug}/` : `/${cat.id}/${slug}/`;
    const { html, toc } = polish(renderMarkdown(body));
    push({
      kind: 'page', title: front.title || slug, slug, url: urlPath, category: cat,
      order: Number(front.order ?? 100), summary: front.summary || '',
      html, toc, updated: fileUpdated(abs, front), front, inMenu: true,
    });
  }

  /* — страны — */
  const countries = countryFiles.map(({ abs, front, body }) => {
    const slug = front.slug || slugify(front.title);
    const { html, toc } = polish(renderMarkdown(body));
    return {
      kind: 'country', title: front.title, slug, url: `/countries/${slug}/`,
      category: catById.countries, order: Number(front.order ?? 100),
      summary: front.summary || '', html, toc, updated: fileUpdated(abs, front), front,
    };
  }).sort((a, b) => a.order - b.order || a.title.localeCompare(b.title, 'ru'));
  countries.forEach(push);

  /* — договоры — */
  const treaties = treatyFiles.map(({ abs, front, body }) => {
    const slug = front.slug || slugify(front.title);
    const { html, toc } = polish(renderMarkdown(body));
    return {
      kind: 'treaty', title: front.title, slug, url: `/treaties/${slug}/`,
      category: catById.countries, summary: front.summary || '',
      html, toc, updated: fileUpdated(abs, front), front,
    };
  });
  treaties.forEach(push);

  /* — новости — */
  const news = newsFiles.map(({ file, abs, front, body }) => {
    const slug = front.slug || slugify(path.basename(file, '.md').replace(/^\d{4}-\d{2}-\d{2}-/, ''));
    const { html, toc } = polish(renderMarkdown(body));
    return {
      kind: 'news', title: front.title, slug, url: `/news/${slug}/`,
      category: catById.news, summary: front.summary || '',
      date: front.date ? new Date(front.date) : fileUpdated(abs, front),
      author: front.author || L('news.default_author', 'Хронист'), newsKind: front.kind || 'world',
      html, toc, updated: fileUpdated(abs, front), front,
    };
  }).sort((a, b) => b.date - a.date);
  news.forEach(push);

  /* — служебные разделы-каталоги — */
  const indexes = [
    { kind: 'countries-index', title: L('countries.index_title', 'Досье стран'),
      url: '/countries/', category: catById.countries, order: 20, inMenu: true,
      summary: L('countries.index_menu_note', 'Все державы: правление, земли, союзы.') },
    { kind: 'treaties-index', title: L('treaties.index_title', 'Реестр договоров'),
      url: '/treaties/', category: catById.countries, order: 30, inMenu: true,
      summary: L('treaties.index_menu_note', 'Пакты, союзы и то, что от них осталось.') },
    { kind: 'news-index', title: L('news.index_title', 'Мировые новости'),
      url: '/news/', category: catById.news, order: 10, inMenu: true,
      summary: L('news.index_menu_note', 'Что происходит в мире прямо сейчас.') },
  ];
  indexes.forEach(i => push({ ...i, html: '', toc: [], updated: BUILD_TIME, front: {} }));

  /* — меню — */
  const menu = S.categories.map(cat => {
    const url = `/${cat.id}/`;
    const items = docs
      .filter(d => d.inMenu && d.category?.id === cat.id)
      .sort((a, b) => (a.order ?? 100) - (b.order ?? 100) || a.title.localeCompare(b.title, 'ru'))
      .map(d => ({ title: d.title, url: d.url, summary: d.summary }));
    // Если какая-то страница уже стоит на адресе раздела (каталог стран, лента новостей),
    // то отдельный «обзор раздела» не нужен — иначе получится две ссылки на одно и то же.
    return { ...cat, url, items, hasOwnHome: items.some(i => i.url === url) };
  }).filter(c => c.items.length);

  /* — главная — */
  const homeAbs = path.join(CONTENT, 'home.md');
  let home = { front: {}, body: '' };
  if (fs.existsSync(homeAbs)) home = parseFront(fs.readFileSync(homeAbs, 'utf8'), homeAbs);
  const homeDoc = {
    kind: 'home', title: S.site_title, url: '/', category: null,
    html: polish(renderMarkdown(home.body)).html, toc: [],
    updated: fileUpdated(homeAbs, home.front), front: home.front,
    summary: S.description || '',
  };

  /* — вывод — */
  fs.rmSync(DIST, { recursive: true, force: true });
  fs.mkdirSync(DIST, { recursive: true });

  const ctx = { S, menu, docs, countries, treaties, news, buildTime: BUILD_TIME, L };
  const write = (urlPath, html) => {
    const out = urlPath === '/'
      ? path.join(DIST, 'index.html')
      : path.join(DIST, urlPath.replace(/^\/|\/$/g, ''), 'index.html');
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, html, 'utf8');
  };

  write('/', renderPage(ctx, { ...homeDoc, body: views.home(ctx, homeDoc) }));

  for (const cat of menu) {
    if (cat.hasOwnHome) continue;          // адрес раздела занят настоящей страницей
    write(cat.url, renderPage(ctx, {
      kind: 'category', title: cat.title, url: cat.url, category: cat,
      summary: cat.intro || '', updated: BUILD_TIME, toc: [],
      body: views.categoryIndex(ctx, cat),
    }));
  }

  for (const d of docs) {
    let body;
    if (d.kind === 'page') body = views.page(ctx, d);
    else if (d.kind === 'country') body = views.country(ctx, d);
    else if (d.kind === 'treaty') body = views.treaty(ctx, d);
    else if (d.kind === 'news') body = views.newsItem(ctx, d);
    else if (d.kind === 'countries-index') body = views.countriesIndex(ctx);
    else if (d.kind === 'treaties-index') body = views.treatiesIndex(ctx);
    else if (d.kind === 'news-index') body = views.newsIndex(ctx);
    write(d.url, renderPage(ctx, { ...d, body }));
  }

  write('/search/', renderPage(ctx, {
    kind: 'search', title: L('search.page_title', 'Поиск по хронике'), url: '/search/',
    summary: L('search.page_note', 'Ищем по всем страницам, странам, договорам и новостям.'),
    updated: BUILD_TIME, toc: [], body: views.searchPage(ctx),
  }));

  fs.writeFileSync(path.join(DIST, '404.html'),
    renderPage(ctx, {
      kind: '404', title: L('notfound.title', 'Страница потерялась'), url: '/404.html',
      summary: L('notfound.note', 'Такой записи в хронике нет.'), updated: BUILD_TIME, toc: [],
      body: views.notFound(ctx),
    }), 'utf8');

  /* — поисковый индекс — */
  const index = [
    { u: '/', t: S.site_title, c: 'Главная', s: S.description || '', x: plainText(homeDoc.html) },
    ...docs.filter(d => d.kind !== 'countries-index' && d.kind !== 'treaties-index' && d.kind !== 'news-index')
      .map(d => ({
        u: d.url, t: d.title, c: d.category?.title || '', s: d.summary || '',
        h: (d.toc || []).map(x => x.text).join(' \u00b7 '),   // заголовки внутри страницы
        x: plainText(d.html).slice(0, 2200),
        k: d.kind,
      })),
    ...menu.map(c => ({ u: c.url, t: c.title, c: 'Раздел', s: c.intro || '', x: '', k: 'category' })),
  ];
  fs.writeFileSync(path.join(DIST, 'search-index.json'), JSON.stringify(index), 'utf8');

  /* — карта сайта, robots, RSS — */
  const base = (S.site_url || '').replace(/\/$/, '');
  const urls = ['/', '/search/', ...menu.map(c => c.url), ...docs.map(d => d.url)];
  fs.writeFileSync(path.join(DIST, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`
    + urls.map(u => `  <url><loc>${base}${u}</loc></url>`).join('\n') + `\n</urlset>\n`, 'utf8');
  fs.writeFileSync(path.join(DIST, 'robots.txt'),
    `User-agent: *\nAllow: /\nSitemap: ${base}/sitemap.xml\n`, 'utf8');

  const rssItems = news.slice(0, 20).map(n =>
    `  <item><title>${esc(n.title)}</title><link>${base}${n.url}</link>`
    + `<guid>${base}${n.url}</guid><pubDate>${n.date.toUTCString()}</pubDate>`
    + `<description>${esc(n.summary)}</description></item>`).join('\n');
  fs.writeFileSync(path.join(DIST, 'rss.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel>\n`
    + `  <title>${esc(L('news.rss_title', S.site_title + ' — новости'))}</title>\n  <link>${base}/news/</link>\n`
    + `  <description>${esc(S.description || '')}</description>\n${rssItems}\n</channel></rss>\n`, 'utf8');

  /* — страховка от старых адресов: «/base/…» и «/other/…» уводят на новый — */
  const aliasTo = new Map();
  for (const d of docs) {
    if (d.kind !== 'page') continue;
    if (d.category?.id === 'base') aliasTo.set(`/base/${d.slug}/`, d);
    // Пока раздел был удалён, страница жила по адресу /other/…: он уже
    // разошёлся по ссылкам, поэтому оставляем переадресацию.
    aliasTo.set(`/other/${d.slug}/`, d);
  }
  for (const [alias, d] of aliasTo) {
    if (alias === d.url || docs.some(x => x.url === alias)) continue;
    write(alias, `<!doctype html><html lang="ru"><head><meta charset="utf-8">`
      + `<meta http-equiv="refresh" content="0; url=${d.url}">`
      + `<link rel="canonical" href="${d.url}"><title>${esc(d.title)}</title></head>`
      + `<body><p>Страница переехала: <a href="${d.url}">${esc(d.title)}</a></p></body></html>`);
  }

  /* — проверка внутренних ссылок: пишем предупреждения в лог сборки — */
  checkLinks(DIST);

  /* — статика — */
  copyDir(STATIC, DIST);
  unpackAssets();
  for (const dir of ['admin', 'admin-classic']) {
    const src = path.join(ROOT, dir);
    if (fs.existsSync(src)) copyDir(src, path.join(DIST, dir));
  }
  // шпаргалка со значками — рисуется из того же спрайта, что и сайт
  fs.mkdirSync(path.join(DIST, 'admin'), { recursive: true });
  fs.writeFileSync(path.join(DIST, 'admin', 'icons.html'), iconsPage(S.site_title), 'utf8');
  // сырой контент кладём рядом — пригодится для предпросмотра и резервной копии
  copyDir(CONTENT, path.join(DIST, 'content'));

  // Если сайт в подпапке — переписываем все корневые ссылки на /Ercyon-site/...
  applyBasePath(DIST, BASE);

  if (restoredCats.length) {
    log(`\n  ⚠ В настройках не хватало разделов — вернули сами:`);
    restoredCats.forEach(id => log(`     ${id} → «${CATEGORY_FALLBACKS[id].title}»`));
    log('     (страницы этих разделов иначе свалились бы в «Прочее», а адреса поехали бы;');
    log('      проверьте список разделов в настройках — похоже, раздел удалили случайно)');
  }

  if (orphans.length) {
    log(`\n  ⚠ Страницы без раздела — сложены в «${L('misc.orphan_category', 'Прочее')}»:`);
    orphans.forEach(o => log(`     ${o}`));
    log('     (откройте страницу в панели и выберите ей существующий раздел)');
  }

  const pages = urls.length + 1;
  log(`\n  ✔ Собрано за ${Date.now() - t0} мс`);
  log(`    страниц: ${pages}   стран: ${countries.length}   новостей: ${news.length}   договоров: ${treaties.length}`);
  log(`    результат: dist/\n`);
}

/** Ищет ссылки на несуществующие страницы и печатает их в лог сборки. */
function checkLinks(dist) {
  const pages = [];
  (function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.html')) pages.push(p);
    }
  })(dist);

  const known = new Set(pages.map(p => {
    const u = '/' + path.relative(dist, p).replace(/index\.html$/, '').replace(/\\/g, '/');
    return u.endsWith('/') ? u : u + '/';
  }));
  known.add('/admin/');

  const broken = new Map();
  const SKIP = /^\/(img|css|js|fonts|content|admin|rss|sitemap|robots|manifest|404|search-index)/;
  for (const p of pages) {
    const html = fs.readFileSync(p, 'utf8');
    const from = '/' + path.relative(dist, p).replace(/index\.html$/, '');
    for (const m of html.matchAll(/href="(\/[^"#?]*)"/g)) {
      let href = m[1];
      if (SKIP.test(href)) continue;
      if (!href.endsWith('/')) href += '/';
      if (known.has(href)) continue;
      if (!broken.has(href)) broken.set(href, new Set());
      broken.get(href).add(from);
    }
  }
  if (broken.size) {
    log('\n  ⚠ Ссылки на несуществующие страницы:');
    for (const [href, where] of broken) {
      log(`     ${href}  ←  ${[...where].slice(0, 3).join(', ')}${where.size > 3 ? ` и ещё ${where.size - 3}` : ''}`);
    }
    log('     (сайт соберётся, но эти ссылки приведут читателя на «страница потерялась»)');
  }
}

/** Шрифты и картинки оформления лежат текстом в assets/*.b64.json —
    здесь они превращаются обратно в настоящие файлы внутри dist/.
    Подробнее: assets/README.md и tools/pack-assets.mjs */
function unpackAssets() {
  const dir = path.join(ROOT, 'assets');
  if (!fs.existsSync(dir)) return;
  let n = 0;
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.b64.json'))) {
    let bundle;
    try {
      bundle = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    } catch (e) {
      throw new Error(`Файл assets/${f} повреждён: ${e.message}`);
    }
    for (const [rel, b64] of Object.entries(bundle)) {
      const dst = path.join(DIST, rel);
      fs.mkdirSync(path.dirname(dst), { recursive: true });
      fs.writeFileSync(dst, Buffer.from(b64, 'base64'));
      n++;
    }
  }
  if (!n) console.warn('  ⚠ В assets/ нет ни шрифтов, ни картинок — сайт будет без оформления');
}

function applyBasePath(dist, base) {
  if (!base) return;
  const all = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => {
    const p = path.join(d, e.name);
    return e.isDirectory() ? all(p) : [p];
  });
  let n = 0;
  for (const f of all(dist)) {
    const ext = path.extname(f).toLowerCase();
    if (ext === '.html') {
      let h = fs.readFileSync(f, 'utf8');
      h = h.replace(/(\s(?:href|src))="\/(?!\/)/g, `$1="${base}/`);
      h = h.replace(/(\ssrcset)="\/(?!\/)/g, `$1="${base}/`);
      h = h.replace(/(content="\s*\d+\s*;\s*url=)\/(?!\/)/g, `$1${base}/`);
      fs.writeFileSync(f, h, 'utf8'); n++;
    } else if (ext === '.css') {
      let c = fs.readFileSync(f, 'utf8');
      c = c.replace(/url\((['"]?)\/(?!\/)/g, `url($1${base}/`);
      fs.writeFileSync(f, c, 'utf8'); n++;
    } else if (ext === '.webmanifest') {
      let m = fs.readFileSync(f, 'utf8');
      m = m.replace(/"\/(img|css|js|fonts)\//g, `"${base}/$1/`);
      m = m.replace(/("start_url":\s*")\/(?!\/)/g, `$1${base}/`);
      fs.writeFileSync(f, m, 'utf8'); n++;
    }
  }
  log(`  → база /Ercyon-site применена к ${n} файлам`);
}

function copyDir(src, dst) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name), d = path.join(dst, e.name);
    if (e.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

/* ═════════════════════════ локальный просмотр ═════════════════════════ */

async function serve(port = 4321) {
  const http = await import('node:http');
  const MIME = {
    '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8',
    '.js':'text/javascript; charset=utf-8', '.json':'application/json; charset=utf-8',
    '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg', '.webp':'image/webp',
    '.ico':'image/x-icon', '.woff2':'font/woff2', '.xml':'application/xml; charset=utf-8',
    '.md':'text/plain; charset=utf-8', '.yml':'text/yaml; charset=utf-8',
  };
  http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    let f = path.join(DIST, p);
    if (p.endsWith('/')) f = path.join(f, 'index.html');
    if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) {
      const alt = path.join(DIST, p, 'index.html');
      f = fs.existsSync(alt) ? alt : path.join(DIST, '404.html');
    }
    const body = fs.readFileSync(f);
    res.writeHead(f.endsWith('404.html') ? 404 : 200,
      { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
    res.end(body);
  }).listen(port, () => log(`  → http://localhost:${port}`));
}

/* ═════════════════════════ запуск ═════════════════════════ */

try {
  build();
  if (process.argv.includes('--serve')) await serve();
} catch (e) {
  console.error('\n  ✖ Сборка не удалась:\n');
  console.error('   ', e.message, '\n');
  process.exit(1);
}
