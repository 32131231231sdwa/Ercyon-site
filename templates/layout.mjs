/**
 * Каркас страницы: шапка, боковое меню, хлебные крошки, подвал, поиск.
 * Всё, что видно на каждой странице, живёт здесь.
 *
 * Ни одной надписи «на месте» — все берутся из content/settings.yml
 * (блок labels), поэтому их можно править из панели с телефона.
 */
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { esc, humanDate } from '../build.mjs';

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const SPRITE = fs.readFileSync(path.join(HERE, '..', 'static', 'img', 'decor', 'sprite.svg'), 'utf8')
  .replace(/<\?xml[^>]*\?>\s*/, '');

/* Лоза вдоль полей листа — несколько одинаковых звеньев подряд, чтобы тянулась непрерывно */
const VINE = '<svg viewBox="0 0 60 300" preserveAspectRatio="none"><use href="#d-vine"/></svg>'.repeat(7);

export const icon = (id, cls = 'ico') =>
  `<svg class="${cls}" aria-hidden="true"><use href="#${id}"/></svg>`;

const BASE = (process.env.BASE_PATH || '').replace(/\/+$/, '');

const STATE_CLASS = { idet: 'is-live', nabor: 'is-open', pauza: 'is-paused', zavershen: 'is-done' };

/* ─────────────────────────── меню ─────────────────────────── */

function navHtml(menu, current, L) {
  return menu.map(cat => {
    const active = cat.items.some(i => i.url === current) || current === cat.url;
    const items = cat.items.map(i =>
      `<li><a href="${i.url}"${i.url === current ? ' aria-current="page"' : ''}>${esc(i.title)}</a></li>`
    ).join('');
    return `<div class="nav__group${active ? ' is-open' : ''}">
      <button class="nav__toggle" aria-expanded="${active}">
        ${icon(`i-${cat.icon || 'leaf'}`, 'nav__ico')}
        <span class="nav__title">${esc(cat.title)}</span>
        ${icon('i-chevron', 'nav__chev')}
      </button>
      <ul class="nav__list">
        ${cat.hasOwnHome ? '' :
          `<li class="nav__all"><a href="${cat.url}"${cat.url === current ? ' aria-current="page"' : ''}>${
            esc(L('nav.overview', 'Обзор раздела'))}</a></li>`}
        ${items}
      </ul>
    </div>`;
  }).join('');
}

/* ─────────────────────── хлебные крошки ─────────────────────── */

function crumbs(doc, L) {
  const parts = [{ t: L('nav.home', 'Главная'), u: '/' }];
  if (doc.category) parts.push({ t: doc.category.title, u: `/${doc.category.id}/` });
  if (doc.kind === 'country') parts.push({ t: L('countries.index_title', 'Досье стран'), u: '/countries/' });
  if (doc.kind === 'treaty') parts.push({ t: L('treaties.index_title', 'Реестр договоров'), u: '/treaties/' });
  if (doc.kind === 'news') parts.push({ t: L('news.index_title', 'Мировые новости'), u: '/news/' });
  const last = doc.url !== '/' ? doc.title : null;

  const seen = new Set();
  const links = parts
    .filter(p => p.u !== doc.url && !seen.has(p.u) && seen.add(p.u))
    .map(p => `<li><a href="${p.u}">${esc(p.t)}</a></li>`).join('');
  return `<nav class="crumbs" aria-label="Вы здесь"><ol>${links}${
    last ? `<li aria-current="page">${esc(last)}</li>` : ''}</ol></nav>`;
}

/* ─────────────────────── оглавление ─────────────────────── */

function tocHtml(toc, L) {
  if (!toc || toc.length < 3) return '';
  return `<aside class="toc" aria-label="Содержание страницы">
    <div class="toc__head">${esc(L('nav.toc_head', 'На этой странице'))}</div>
    <ul>${toc.map(h =>
      `<li class="toc__l${h.level}"><a href="#${h.id}">${esc(h.text)}</a></li>`).join('')}</ul>
  </aside>`;
}

/* ─────────────────────────── страница ─────────────────────────── */

export function renderPage(ctx, doc) {
  const { S, menu, L } = ctx;
  const isHome = doc.url === '/';
  const title = isHome
    ? `${S.site_title} — ${S.motto}`
    : `${doc.title} — ${S.site_title}`;
  const desc = doc.summary || S.description || '';
  const base = (S.site_url || '').replace(/\/$/, '');
  const season = S.season || {};
  const stateCls = STATE_CLASS[season.state] || 'is-live';

  /* Надписи, которые нужны скриптам поиска */
  const jsLabels = {
    hint: L('nav.search_hint', 'Начните печатать — ищем по всем разделам сайта.'),
    nothing: L('nav.search_nothing', 'По запросу «{q}» ничего не нашлось. Попробуйте другое слово.'),
  };

  return `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="theme-color" content="#14352A">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${base}/img/og-image.jpg">
<meta property="og:url" content="${base}${doc.url}">
<meta property="og:site_name" content="${esc(S.site_title)}">
<meta name="twitter:card" content="summary_large_image">
<link rel="canonical" href="${base}${doc.url}">
<link rel="icon" href="/img/favicon.ico" sizes="any">
<link rel="icon" href="/img/favicon-32.png" type="image/png">
<link rel="apple-touch-icon" href="/img/apple-touch-icon.png">
<link rel="manifest" href="/manifest.webmanifest">
<link rel="alternate" type="application/rss+xml" title="${esc(L('news.rss_title', S.site_title))}" href="/rss.xml">
<link rel="preload" as="font" type="font/woff2" href="/fonts/cormorant-600-n-cyrillic.woff2" crossorigin>
<link rel="preload" as="font" type="font/woff2" href="/fonts/ptserif-400-n-cyrillic.woff2" crossorigin>
<link rel="stylesheet" href="/css/fonts.css">
<link rel="stylesheet" href="/css/site.css">
</head>
<body class="${isHome ? 'is-home' : ''}" data-cat="${doc.category?.id || ''}">
${SPRITE}
<a class="skip" href="#main">Перейти к содержанию</a>

<header class="topbar">
  <button class="topbar__btn" id="burger" aria-label="Открыть меню" aria-expanded="false" aria-controls="sidebar">
    ${icon('i-menu', 'ico ico--lg')}
  </button>
  <a class="topbar__brand" href="/">
    <img src="/img/logo-96.webp" width="34" height="34" alt="" class="topbar__logo">
    <span>${esc(S.site_title)}</span>
  </a>
  <button class="topbar__btn" id="searchBtn" aria-label="${esc(L('nav.search_button', 'Поиск по сайту'))}">
    ${icon('i-search', 'ico ico--lg')}
  </button>
</header>

<div class="shell">

  <aside class="sidebar" id="sidebar" aria-label="Разделы сайта">
    <div class="sidebar__inner">
      <button class="sidebar__close" id="navClose" aria-label="Закрыть меню">
        ${icon('i-close', 'ico ico--lg')}
      </button>
      <a class="sidebar__brand" href="/">
        <img src="/img/logo-128.webp" width="60" height="60" alt="Герб проекта «${esc(S.site_title)}»">
        <span class="sidebar__name">${esc(S.site_title)}</span>
        <span class="sidebar__sub">${esc(S.site_subtitle || '')}</span>
      </a>

      <button class="sidebar__search" id="searchBtn2">
        ${icon('i-search')}<span>${esc(L('nav.search_button', 'Поиск по сайту'))}</span><kbd>/</kbd>
      </button>

      <a class="season ${stateCls}" href="/season/">
        <span class="season__dot" aria-hidden="true"></span>
        <span class="season__body">
          <span class="season__label">${esc(L('nav.season_word', 'Сезон'))} ${
            esc(season.number ?? '')} · ${esc(season.state_label || '')}</span>
          <span class="season__year">${esc(season.year || '')}</span>
        </span>
      </a>

      <nav class="nav" aria-label="Основное меню">${navHtml(menu, doc.url, L)}</nav>

      <a class="tg" href="${esc(S.telegram_url || '#')}" target="_blank" rel="noopener noreferrer">
        ${icon('i-telegram')}<span>${esc(S.telegram_label || 'В группу')}</span>
      </a>
    </div>
  </aside>

  <div class="scrim" id="scrim" hidden></div>

  <main class="main" id="main">
    <span class="vine vine--left" aria-hidden="true">${VINE}</span>
    <span class="vine vine--right" aria-hidden="true">${VINE}</span>

    ${isHome ? '' : crumbs(doc, L)}
    ${doc.body}

    ${isHome ? '' : `<div class="updated">${icon('i-clock', 'ico ico--sm')}
      <span>${esc(L('nav.updated', 'Обновлено:'))} <time datetime="${
        new Date(doc.updated).toISOString()}">${humanDate(doc.updated)}</time></span>
    </div>`}

    <footer class="foot">
      <svg class="foot__rule" aria-hidden="true"><use href="#d-divider"/></svg>
      <p class="foot__note">${esc(S.footer_note || '')}</p>
      <p class="foot__links">
        <a href="/">${esc(L('nav.foot_home', 'Главная'))}</a> ·
        <a href="/search/">${esc(L('nav.foot_search', 'Поиск'))}</a> ·
        <a href="${esc(S.telegram_url || '#')}" target="_blank" rel="noopener noreferrer">Telegram</a> ·
        <a href="/admin/">${esc(L('nav.foot_admin', 'Панель редактора'))}</a>
      </p>
    </footer>
  </main>

  ${tocHtml(doc.toc, L)}
</div>

<div class="finder" id="finder" hidden role="dialog" aria-modal="true" aria-label="${
  esc(L('nav.search_button', 'Поиск по сайту'))}">
  <div class="finder__panel">
    <div class="finder__bar">
      ${icon('i-search', 'ico')}
      <input type="search" id="finderInput" placeholder="${
        esc(L('nav.search_placeholder', 'Искать по сайту…'))}"
             autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="search">
      <button class="finder__close" id="finderClose" aria-label="Закрыть поиск">${icon('i-close', 'ico')}</button>
    </div>
    <div class="finder__results" id="finderResults">
      <p class="finder__hint">${esc(jsLabels.hint)}</p>
    </div>
  </div>
</div>

<script>window.__BASE__ = ${JSON.stringify(BASE)}; window.__L = ${JSON.stringify(jsLabels)};</script>
<script src="/js/app.js" defer></script>
</body>
</html>`;
}
