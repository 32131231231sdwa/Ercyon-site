/**
 * Разметка отдельных типов страниц.
 * Все надписи берутся из content/settings.yml (блок labels) — их правит владелец.
 */
import { esc, humanDate } from '../build.mjs';
import { icon } from './layout.mjs';

const head = (title, sub) => `<header class="phead">
  <h1>${esc(title)}</h1>
  ${sub ? `<p class="phead__sub">${esc(sub)}</p>` : ''}
  <svg class="phead__rule" aria-hidden="true"><use href="#d-flourish"/></svg>
</header>`;

const prose = html => `<div class="prose">${html}</div>`;

const countryStatus = (L, key) => ({
  active:  { label: L('countries.status_active',  'Действует'),   cls: 'ok'  },
  neutral: { label: L('countries.status_neutral', 'Нейтралитет'), cls: 'mid' },
  fallen:  { label: L('countries.status_fallen',  'Пала'),        cls: 'bad' },
}[key] || { label: L('countries.status_active', 'Действует'), cls: 'ok' });

const treatyStatus = (L, key) => ({
  active:  { label: L('treaties.status_active',  'В силе'),  cls: 'ok'  },
  broken:  { label: L('treaties.status_broken',  'Нарушен'), cls: 'bad' },
  expired: { label: L('treaties.status_expired', 'Истёк'),   cls: 'mid' },
}[key] || { label: L('treaties.status_active', 'В силе'), cls: 'ok' });

/* ═══════════════════════════ ГЛАВНАЯ ═══════════════════════════ */

export function home(ctx, doc) {
  const { S, menu, news, L } = ctx;
  const f = doc.front || {};
  const season = S.season || {};
  const latest = news.slice(0, 4);

  const cards = menu.map(cat => `
    <a class="card" href="${cat.url}">
      <span class="card__ico">${icon(`i-${cat.icon || 'leaf'}`, 'ico ico--xl')}</span>
      <span class="card__body">
        <span class="card__title">${esc(cat.title)}</span>
        <span class="card__text">${esc(cat.intro || '')}</span>
      </span>
      <span class="card__more">${icon('i-arrow', 'ico ico--sm')}</span>
    </a>`).join('');

  const newsList = latest.length ? latest.map(n => `
    <a class="feed__item" href="${n.url}">
      <time class="feed__date" datetime="${n.date.toISOString()}">${humanDate(n.date)}</time>
      <span class="feed__title">${esc(n.title)}</span>
      <span class="feed__sum">${esc(n.summary || '')}</span>
    </a>`).join('')
    : `<p class="muted">${esc(L('home.news_empty', 'Новостей пока нет.'))}</p>`;

  return `
<section class="hero">
  <picture class="hero__bg">
    <source media="(max-width:640px)" srcset="/img/hero-800.webp">
    <source media="(max-width:1280px)" srcset="/img/hero-1280.webp">
    <img src="/img/hero-1920.webp" alt="" fetchpriority="high" decoding="async">
  </picture>
  <div class="hero__inner">
    <img class="hero__logo" src="/img/logo-256.webp" width="150" height="150"
         alt="Герб проекта «${esc(S.site_title)}»" fetchpriority="high">
    <h1 class="hero__title">${esc(S.site_title)}</h1>
    <p class="hero__motto">${esc(S.motto || '')}</p>
    <svg class="hero__rule" aria-hidden="true"><use href="#d-divider"/></svg>
    <p class="hero__lede">${esc(f.intro_text || S.description || '').replace(/\r?\n/g, '<br>')}</p>
    <div class="hero__actions">
      <a class="btn btn--gold" href="${esc(S.telegram_url || '#')}" target="_blank" rel="noopener noreferrer">
        ${icon('i-telegram', 'ico')}<span>${esc(S.telegram_label || 'В группу')}</span></a>
      <a class="btn btn--ghost" href="/countries/join/">${esc(L('home.join_button', 'Как вступить'))}</a>
    </div>
  </div>
</section>

<section class="status" aria-label="Статус сезона">
  <div class="status__seal">${icon('d-wax', 'wax')}<span class="status__sealtext">${
    esc(L('nav.season_word', 'Сезон'))}<br>${esc(season.number ?? '')}</span></div>
  <div class="status__grid">
    <div><span class="status__k">${esc(L('home.status_year', 'Сейчас в мире'))}</span>
         <span class="status__v">${esc(season.year || '—')}</span></div>
    <div><span class="status__k">${esc(L('home.status_state', 'Состояние'))}</span>
         <span class="status__v">${esc(season.state_label || '—')}</span></div>
    <div><span class="status__k">${esc(L('home.status_mode', 'Набор'))}</span>
         <span class="status__v">${esc(season.mode || '—')}</span></div>
  </div>
  ${season.note ? `<p class="status__note">${esc(season.note)}</p>` : ''}
</section>

${f.intro_title ? `<h2 class="h-sec">${esc(f.intro_title)}</h2>` : ''}

<section class="cards" aria-label="Разделы вики">${cards}</section>

<section class="feed" aria-label="Последние новости">
  <div class="feed__head">
    <h2 class="h-sec">${esc(L('home.news_title', 'Последние вести'))}</h2>
    <a class="feed__all" href="/news/">${esc(L('home.news_all', 'Все новости'))} ${icon('i-arrow', 'ico ico--sm')}</a>
  </div>
  <div class="feed__list">${newsList}</div>
</section>

${doc.html ? `<section class="homeprose">${prose(doc.html)}</section>` : ''}
`;
}

/* ═══════════════════════ ОБЫЧНАЯ СТРАНИЦА ═══════════════════════ */

export function page(ctx, d) {
  return head(d.title, d.summary) + prose(d.html);
}

/* ═══════════════════════ ОБЗОР КАТЕГОРИИ ═══════════════════════ */

export function categoryIndex(ctx, cat) {
  const items = cat.items.map(i => `
    <a class="tile" href="${i.url}">
      <span class="tile__title">${esc(i.title)}</span>
      ${i.summary ? `<span class="tile__sum">${esc(i.summary)}</span>` : ''}
      <span class="tile__go">${icon('i-arrow', 'ico ico--sm')}</span>
    </a>`).join('');
  return head(cat.title, cat.intro) + `<div class="tiles">${items}</div>`;
}

/* ═══════════════════════════ СТРАНЫ ═══════════════════════════ */

export function countriesIndex(ctx) {
  const { countries, L } = ctx;
  const title = L('countries.index_title', 'Досье стран');

  if (!countries.length) {
    return head(title, '') +
      `<p class="muted">${esc(L('countries.empty', 'Первая держава ещё не основана.'))}
       <a href="/countries/join/">${esc(L('countries.cta', 'Основать свою страну'))}</a></p>`;
  }

  const cards = countries.map(c => {
    const st = countryStatus(L, c.front.status);
    return `<a class="ccard" href="${c.url}" style="--flag:${esc(c.front.color || '#3E6B4F')}">
      <span class="ccard__flag" aria-hidden="true"></span>
      <span class="ccard__main">
        <span class="ccard__title">${esc(c.title)}</span>
        <span class="ccard__meta">${esc(c.front.government || '')}${
          c.front.capital ? ` · ${esc(c.front.capital)}` : ''}</span>
        <span class="ccard__sum">${esc(c.summary || '')}</span>
      </span>
      <span class="pill pill--${st.cls}">${esc(st.label)}</span>
    </a>`;
  }).join('');

  return head(title, L('countries.index_note', ''))
    + `<div class="ccards">${cards}</div>
       <p class="cta-line"><a class="btn btn--gold" href="/countries/join/">${
         esc(L('countries.cta', 'Основать свою страну'))}</a></p>`;
}

export function country(ctx, d) {
  const { L } = ctx;
  const f = d.front || {};
  const st = countryStatus(L, f.status);
  const rows = [
    [L('countries.f_government', 'Правление'), f.government],
    [L('countries.f_ruler',      'Правитель'), f.ruler],
    [L('countries.f_capital',    'Столица'),   f.capital],
    [L('countries.f_founded',    'Основана'),  f.founded],
    [L('countries.f_population', 'Население'), f.population],
    [L('countries.f_magic',      'Школы Живицы'), f.magic],
    [L('countries.f_player',     'Игрок'),     f.player],
  ].filter(([, v]) => v);

  const res = Array.isArray(f.resources) ? f.resources : (f.resources ? [f.resources] : []);
  const linked = ctx.treaties.filter(t =>
    Array.isArray(t.front.parties) && t.front.parties.some(p => String(p).trim() === d.title.trim()));

  return `
<header class="phead phead--country" style="--flag:${esc(f.color || '#3E6B4F')}">
  <span class="phead__banner" aria-hidden="true">${icon('i-banner', 'ico ico--xl')}</span>
  <h1>${esc(d.title)}</h1>
  ${d.summary ? `<p class="phead__sub">${esc(d.summary)}</p>` : ''}
  <span class="pill pill--${st.cls}">${esc(st.label)}</span>
</header>

<section class="passport">
  <dl>${rows.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
  ${res.length ? `<div class="passport__res">
    <span class="passport__resk">${esc(L('countries.f_resources', 'Ресурсы'))}</span>
    <span class="tags">${res.map(r => `<span class="tag">${esc(r)}</span>`).join('')}</span></div>` : ''}
</section>

${prose(d.html)}

${linked.length ? `<section class="related">
  <h2 class="h-sec">${esc(L('countries.treaties_title', 'Договоры державы'))}</h2>
  <div class="tiles">${linked.map(t => {
    const ts = treatyStatus(L, t.front.status);
    return `<a class="tile" href="${t.url}"><span class="tile__title">${esc(t.title)}</span>
      <span class="tile__sum">${esc(t.summary || '')}</span>
      <span class="pill pill--${ts.cls}">${esc(ts.label)}</span></a>`;
  }).join('')}</div>
</section>` : ''}
`;
}

/* ═══════════════════════════ ДОГОВОРЫ ═══════════════════════════ */

export function treatiesIndex(ctx) {
  const { treaties, L } = ctx;
  const title = L('treaties.index_title', 'Реестр договоров');
  if (!treaties.length) return head(title, L('treaties.empty', 'Договоров пока нет.'));

  const rows = treaties.map(t => {
    const st = treatyStatus(L, t.front.status);
    const parties = Array.isArray(t.front.parties) ? t.front.parties.join(' · ') : (t.front.parties || '');
    return `<a class="trow" href="${t.url}">
      <span class="trow__seal">${icon('d-wax', 'wax wax--sm')}</span>
      <span class="trow__main">
        <span class="trow__title">${esc(t.title)}</span>
        <span class="trow__parties">${esc(parties)}</span>
      </span>
      <span class="trow__side">
        <span class="pill pill--${st.cls}">${esc(st.label)}</span>
        <span class="trow__date">${esc(t.front.date || '')}</span>
      </span>
    </a>`;
  }).join('');
  return head(title, L('treaties.index_note', '')) + `<div class="trows">${rows}</div>`;
}

export function treaty(ctx, d) {
  const { L } = ctx;
  const f = d.front || {};
  const st = treatyStatus(L, f.status);
  const parties = Array.isArray(f.parties) ? f.parties : (f.parties ? [f.parties] : []);
  const byTitle = Object.fromEntries(ctx.countries.map(c => [c.title.trim(), c.url]));
  return `
<header class="phead phead--treaty">
  <span class="phead__wax">${icon('d-wax', 'wax')}</span>
  <h1>${esc(d.title)}</h1>
  ${d.summary ? `<p class="phead__sub">${esc(d.summary)}</p>` : ''}
  <p class="phead__meta">
    <span class="pill pill--${st.cls}">${esc(st.label)}</span>
    ${f.date ? `<span class="phead__date">${esc(L('treaties.date_prefix', 'Заключён:'))} ${esc(f.date)}</span>` : ''}
  </p>
</header>

${parties.length ? `<section class="parties">
  <span class="parties__k">${esc(L('treaties.parties', 'Стороны'))}</span>
  <span class="tags">${parties.map(p => {
    const u = byTitle[String(p).trim()];
    return u ? `<a class="tag tag--link" href="${u}">${esc(p)}</a>` : `<span class="tag">${esc(p)}</span>`;
  }).join('')}</span>
</section>` : ''}

${prose(d.html)}`;
}

/* ═══════════════════════════ НОВОСТИ ═══════════════════════════ */

export function newsIndex(ctx) {
  const { news, L } = ctx;
  const title = L('news.index_title', 'Мировые новости');
  if (!news.length) return head(title, L('news.empty', 'Новостей пока нет.'));

  const items = news.map(n => `
    <a class="nitem${n.newsKind === 'press' ? ' nitem--press' : ''}" href="${n.url}">
      <span class="nitem__top">
        <time datetime="${n.date.toISOString()}">${humanDate(n.date)}</time>
        <span class="nitem__author">${esc(n.author)}</span>
      </span>
      <span class="nitem__title">${esc(n.title)}</span>
      <span class="nitem__sum">${esc(n.summary || '')}</span>
    </a>`).join('');
  return head(title, L('news.index_note', '')) + `<div class="nlist">${items}</div>`;
}

export function newsItem(ctx, d) {
  const { L } = ctx;
  return `
<header class="phead phead--news">
  <p class="phead__meta">
    <time datetime="${d.date.toISOString()}">${humanDate(d.date)}</time>
    <span class="dot">·</span>
    <span>${esc(d.author)}</span>
    ${d.newsKind === 'press'
      ? `<span class="pill pill--mid">${esc(L('news.press_badge', 'Газета игроков'))}</span>` : ''}
  </p>
  <h1>${esc(d.title)}</h1>
  ${d.summary ? `<p class="phead__sub">${esc(d.summary)}</p>` : ''}
  <svg class="phead__rule" aria-hidden="true"><use href="#d-flourish"/></svg>
</header>
${prose(d.html)}
<p class="cta-line"><a class="btn btn--ghost" href="/news/">${
  esc(L('news.back', '← Ко всем новостям'))}</a></p>`;
}

/* ═══════════════════════ ПОИСК И 404 ═══════════════════════ */

export function searchPage(ctx) {
  const { L } = ctx;
  return head(L('search.page_title', 'Поиск по сайту'), L('search.page_note', '')) + `
<div class="searchpage">
  <div class="finder__bar finder__bar--page">
    ${icon('i-search', 'ico')}
    <input type="search" id="pageSearchInput" placeholder="${
      esc(L('search.page_placeholder', 'Введите слово…'))}"
           autocomplete="off" spellcheck="false" enterkeyhint="search">
  </div>
  <div id="pageSearchResults" class="finder__results finder__results--page">
    <p class="finder__hint">${esc(L('nav.search_hint', 'Начните печатать.'))}</p>
  </div>
</div>`;
}

export function notFound(ctx) {
  const { L } = ctx;
  return head(L('notfound.title', 'Страница потерялась'), L('notfound.note', '')) + `
<p class="cta-line">
  <a class="btn btn--gold" href="/">${esc(L('notfound.home', 'На главную'))}</a>
  <a class="btn btn--ghost" href="/search/">${esc(L('notfound.search', 'Искать по сайту'))}</a>
</p>`;
}
