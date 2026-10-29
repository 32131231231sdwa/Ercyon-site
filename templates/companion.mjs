import { esc, humanDate } from '../build.mjs';
import { icon } from './layout.mjs';

export function searchFilters() {
  return `<div class="search-filters" role="group" aria-label="Где искать">
    ${[['all','Всё'],['country','Страны'],['rules','Правила'],['news','Новости']].map(([key,label]) =>
      `<button type="button" data-search-filter="${key}" aria-pressed="${key === 'all'}">${label}</button>`).join('')}
  </div>`;
}

export function mobileDock(doc) {
  return `<nav class="mobile-dock" aria-label="Быстрая навигация">
    ${[['/','home','Главная'],['/countries/','banner','Страны'],['/maps/','map','Карты'],['/search/','search','Поиск'],['/browse/','menu','Ещё']].map(([href,symbol,title]) =>
      `<a href="${href}"${(href === '/' ? doc.url === '/' : doc.url.startsWith(href)) ? ' aria-current="page"' : ''}${href === '/browse/' ? ' id="moreNav" aria-controls="sidebar" aria-expanded="false"' : ''}>${icon('i-'+(symbol === 'home' ? 'book' : symbol))}<span>${title}</span></a>`).join('')}
  </nav>`;
}

export function readerTools(doc) {
  if (!['page','country','news','war','treaty'].includes(doc.kind)) return '';
  return `<div class="reader-tools" data-enhance hidden>
    ${doc.toc?.length ? '<button type="button" data-open-reader>☷ <span>Содержание</span></button>' : '<button type="button" data-open-reader>Аа <span>Чтение</span></button>'}
    <button type="button" id="favoritePage" aria-pressed="false">☆ <span>В избранное</span></button>
    <button type="button" id="saveOffline">↓ <span>Офлайн</span></button>
  </div><p class="offline-status" id="offlineStatus" role="status" hidden></p>
  <p class="resume-notice" id="resumeNotice" hidden><button type="button" id="resumeReading">Продолжить с места остановки</button></p>
  <dialog class="reader-sheet" id="readerSheet" aria-labelledby="readerTitle">
    <div class="sheet-head"><h2 id="readerTitle">Чтение</h2><button type="button" data-close-dialog aria-label="Закрыть">×</button></div>
    <div class="reading-options"><label for="readingSize">Размер текста</label><select id="readingSize"><option value="18">Обычный</option><option value="20">Крупный</option><option value="22">Очень крупный</option></select>
    <label class="reading-check"><input id="quietReading" type="checkbox"> Спокойный фон</label></div>
    ${doc.toc?.length ? `<nav class="reader-contents" aria-label="Содержание статьи">${doc.toc.map(h=>`<a class="level-${h.level}" href="#${h.id}">${esc(h.text)}</a>`).join('')}</nav>` : ''}
    <button type="button" class="btn btn--ghost" id="sharePage">Поделиться этим разделом</button>
  </dialog><button type="button" class="reader-fab" data-open-reader hidden>${doc.toc?.length ? '☷ Содержание' : 'Аа Чтение'}</button>`;
}

export function dashboard(ctx, doc) {
  const {S, menu, docs, countries, news} = ctx;
  const s = S.season || {};
  const existing = path => docs.some(d=>d.url===path) || menu.some(c=>c.url===path);
  const quick = [['/rules/','scroll','Правила'],['/mechanics/war/','sword','Ведение войн'],['/maps/','map','Атлас мира'],['/countries/','banner','Государства']].filter(([u])=>existing(u));
  const changed = docs.filter(d=>['page','country','war','treaty','news'].includes(d.kind))
    .sort((a,b)=>new Date(b.updated)-new Date(a.updated)).slice(0,5);
  return `<header class="dashboard-head"><img src="/img/logo-128.webp" width="64" height="64" alt=""><div><p class="eyebrow">Хроника ролевых стезей</p><h1>${esc(S.site_title)}</h1></div><a class="join-small" href="${esc(S.telegram_url)}" target="_blank" rel="noopener">Вступить ↗</a></header>
  <section class="season-brief" aria-labelledby="season-name"><div class="season-brief__top"><span class="eyebrow">Сезон ${esc(s.number || '')}</span><span class="pill pill--ok">${esc(s.state_label || '')}</span></div>
    <h2 id="season-name">${esc(s.title || 'Хроника мира')}</h2><p>${esc(s.year || '')}${s.mode ? ` · ${esc(s.mode)}` : ''}</p>
    ${s.deadline ? `<p class="turn-deadline">Ход сдаётся до: <strong>${esc(s.deadline)}</strong></p>` : ''}
    ${s.note ? `<p>${esc(s.note)}</p>` : ''}
  </section>
  <nav class="quick-grid" aria-label="Часто нужны">${quick.map(([u,i,t])=>`<a href="${u}">${icon('i-'+i)}<span>${t}</span><span aria-hidden="true">↗</span></a>`).join('')}</nav>
  <section class="player-home" data-enhance hidden aria-label="Мой справочник">
    <div class="player-card"><div class="section-label">Моя страна</div><label class="sr-only" for="myCountrySelect">Выберите свою страну</label><select id="myCountrySelect"><option value="">Выберите державу</option>${countries.map(c=>`<option value="${esc(c.url)}">${esc(c.title)}</option>`).join('')}</select><a class="btn btn--gold" id="myCountryLink" href="/countries/">Открыть досье</a></div>
    <a class="continue-card" id="continueReading" href="/countries/" hidden><span class="section-label">Продолжить чтение</span><strong></strong><span class="continue-detail"></span><span aria-hidden="true">Продолжить →</span></a>
  </section>
  <section class="home-library" data-enhance hidden><div class="section-heading"><h2>Под рукой</h2><a href="/library/">Все сохранённые →</a></div><div id="homeFavorites" class="compact-list"><p class="muted">Отмечайте страницы звёздочкой — они появятся здесь.</p></div></section>
  <section class="home-changes"><div class="section-heading"><h2>Обновления хроники</h2></div><div class="compact-list">${changed.map(d=>`<a href="${d.url}" data-updated="${new Date(d.updated).toISOString()}"><span><strong>${esc(d.title)}</strong><small>${esc(d.category?.title || '')}</small></span><time datetime="${new Date(d.updated).toISOString()}">${humanDate(d.updated)}</time></a>`).join('')}</div></section>
  <section class="home-news"><div class="section-heading"><h2>Последние вести</h2><a href="/news/">Все →</a></div><div class="compact-list">${news.slice(0,3).map(n=>`<a href="${n.url}"><span><strong>${esc(n.title)}</strong><small>${esc(n.summary)}</small></span></a>`).join('')}</div></section>
  <details class="home-world"><summary>О мире и все разделы</summary>${doc.front?.intro_text ? `<p>${esc(doc.front.intro_text)}</p>` : ''}${s.about ? `<p>${esc(s.about)}</p>` : ''}<div class="quick-grid">${menu.map(c=>`<a href="${c.url}">${icon('i-'+c.icon)}<span>${esc(c.title)}</span></a>`).join('')}</div>${doc.html ? `<div class="prose">${doc.html}</div>` : ''}</details>`;
}

export function libraryPage() {
  return `<header class="phead"><h1>Мой справочник</h1><p>Избранное и страницы, сохранённые на этом устройстве.</p></header>
  <noscript><p>Для сохранения страниц включите JavaScript.</p></noscript>
  <h2 class="h-sec">Избранное</h2><div class="compact-list" id="favoritesList"></div>
  <h2 class="h-sec">Без интернета</h2><p class="muted">Копия содержит текст и оформление. Карты и иллюстрации могут потребовать интернет. Дата каждой копии указана ниже.</p><div class="compact-list" id="offlineList" role="status">Проверяем сохранённые страницы…</div>
  <button type="button" class="btn btn--ghost" id="installApp" hidden>Добавить на главный экран</button>
  <details class="install-help"><summary>Как установить на телефон</summary><p>На iPhone: Safari → «Поделиться» → «На экран Домой». На Android: меню браузера → «Установить приложение» или «Добавить на главный экран».</p></details>`;
}

export function mapViewer(maps, current) {
  return `<div class="map-links">${maps.map(m=>`<a href="${m.url}"${m.url===current?' aria-current="page"':''}>${esc(m.title)}</a>`).join('')}</div>
  <dialog class="map-viewer" id="mapViewer" aria-label="Просмотр карты">
    <div class="map-top"><label class="sr-only" for="mapSelect">Карта</label><select id="mapSelect">${maps.map(m=>`<option value="${esc(m.url)}"${m.url===current?' selected':''}>${esc(m.title)}</option>`).join('')}</select><button type="button" data-close-dialog aria-label="Закрыть карту">×</button></div>
    <p class="map-message" id="mapMessage" role="status"></p>
    <div class="map-stage" id="mapStage" tabindex="0" aria-label="Карта. Масштаб: плюс и минус; перемещение: стрелки."><div id="mapCanvas"><img id="mapImage" alt="" draggable="false"><div id="mapPoints"></div></div></div>
    <div class="map-controls"><button type="button" id="mapZoomOut" aria-label="Уменьшить карту">−</button><output id="mapZoom">100%</output><button type="button" id="mapZoomIn" aria-label="Увеличить карту">+</button><button type="button" id="mapReset">Целиком</button><a id="mapOriginal" href="${maps.find(m=>m.url===current)?.image || maps.find(m=>m.image)?.image || '/maps/'}" target="_blank" rel="noopener">Оригинал ↗</a></div>
    <p class="map-hint">Разведите два пальца для увеличения. Перетащите карту для перемещения.</p>
  </dialog>`;
}
