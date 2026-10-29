/* ═══════════════════════════════════════════════════════════════
   ERCYON — поведение сайта: меню, поиск, оглавление.
   Без библиотек. Всё работает и без JavaScript, просто менее удобно.
   ═══════════════════════════════════════════════════════════════ */
window.ercionInit = () => {
  'use strict';
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  /* ─────────────────── БОКОВОЕ МЕНЮ (телефон) ─────────────────── */
  const body   = document.body;
  const burger = $('#burger');
  const scrim  = $('#scrim');
  const sidebar= $('#sidebar');
  const moreNav = $('#moreNav');
  let navReturnFocus;

  const setNav = open => {
    if (open) navReturnFocus = document.activeElement;
    body.classList.toggle('nav-open', open);
    if (scrim) scrim.hidden = !open;
    if (burger) {
      burger.setAttribute('aria-expanded', String(open));
      burger.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
    }
    if (open) {
      const first = sidebar?.querySelector('a,button');
      first && first.focus({ preventScroll: true });
    } else navReturnFocus?.focus({ preventScroll:true });
    moreNav?.setAttribute('aria-expanded',String(open));
  };

  burger?.addEventListener('click', () => setNav(!body.classList.contains('nav-open')));
  scrim?.addEventListener('click', () => setNav(false));
  $('#navClose')?.addEventListener('click', () => setNav(false));
  moreNav?.addEventListener('click', e => {e.preventDefault();setNav(!body.classList.contains('nav-open'));});

  // ссылка в меню → закрываем ящик
  sidebar?.addEventListener('click', e => {
    if (e.target.closest('a') && window.innerWidth < 992) setNav(false);
  });

  // свайп влево по ящику закрывает его
  if (sidebar) {
    let x0 = null, y0 = null;
    sidebar.addEventListener('touchstart', e => {
      x0 = e.touches[0].clientX; y0 = e.touches[0].clientY;
    }, { passive: true });
    sidebar.addEventListener('touchend', e => {
      if (x0 === null) return;
      const dx = e.changedTouches[0].clientX - x0;
      const dy = Math.abs(e.changedTouches[0].clientY - y0);
      if (dx < -55 && dy < 70) setNav(false);
      x0 = y0 = null;
    }, { passive: true });
  }

  // «гармошка» разделов
  $$('.nav__toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const group = btn.closest('.nav__group');
      const open = group.classList.toggle('is-open');
      btn.setAttribute('aria-expanded', String(open));
    });
  });

  /* ─────────────────────────── ПОИСК ─────────────────────────── */
  const finder  = $('#finder');
  const input   = $('#finderInput');
  const results = $('#finderResults');
  const pInput  = $('#pageSearchInput');
  const pResults= $('#pageSearchResults');

  let index = null, loading = null, loadError = false;

  const norm = s => String(s).toLowerCase().replace(/ё/g, 'е').replace(/[^\wа-я0-9\s-]/gi, ' ');
  const aliases = {лп:'легкая пехота',тп:'тяжелая пехота',кв:'кавалерия',лч:'лучники',ос:'осадные',ст:'степь',рв:'равнина',ск:'скалы',бл:'болота',лс:'лес'};
  const tokensFor = q => norm(q).split(/\s+/).filter(t=>t.length>1).flatMap(t=>(aliases[t]||t).split(' '));
  let searchFilter = ['country','rules','news'].includes(new URLSearchParams(location.search).get('type')) ? new URLSearchParams(location.search).get('type') : 'all';

  const prepare = data =>
    data.map(d => ({ ...d, _t: norm(d.t), _s: norm(d.s || ''), _x: norm(d.x || ''),
                     _c: norm(d.c || ''), _h: norm(d.h || '') }));

  const loadIndex = () => {
    if (index) return Promise.resolve(index);
    if (window.__SEARCH_INDEX__) { index = prepare(window.__SEARCH_INDEX__); return Promise.resolve(index); }
    if (!loading) {
      loadError = false;
      loading = fetch((window.__BASE__ || '') + '/search-index.json')
        .then(r => { if (!r.ok) throw new Error('Search index unavailable'); return r.json(); })
        .then(data => {
          if (!Array.isArray(data)) throw new Error('Invalid search index');
          return (index = prepare(data));
        })
        .catch(() => { loadError = true; return null; })
        .finally(() => { loading = null; });
    }
    return loading;
  };

  /* Русский язык склоняется, поэтому ищем ещё и по «корню» слова:
     «торговый путь» должен находить «торговые пути». */
  const stemOf = t => t.length >= 8 ? t.slice(0, -3)
                    : t.length >= 6 ? t.slice(0, -2)
                    : t.length >= 5 ? t.slice(0, -1) : t;

  function search(q) {
    const tokens = tokensFor(q);
    if (!tokens.length) return [];
    const out = [];
    for (const d of index) {
      if (searchFilter === 'country' && d.k !== 'country') continue;
      if (searchFilter === 'news' && d.k !== 'news') continue;
      if (searchFilter === 'rules' && !['rules','mechanics'].includes(d.category)) continue;
      let score = 0, all = true;
      for (const t of tokens) {
        const st = stemOf(t);
        let s = 0;
        if (d._t.includes(t)) s += d._t.startsWith(t) ? 120 : 80;
        else if (d._t.includes(st)) s += 55;
        if (new RegExp('(^|[\\s-])' + st.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).test(d._t)) s += 40;
        if (d._h.includes(t)) s += 55; else if (d._h.includes(st)) s += 34;
        if (d._s.includes(t)) s += 30; else if (d._s.includes(st)) s += 18;
        if (d._c.includes(t)) s += 20;
        const hits = d._x.split(t).length - 1;
        if (hits) s += Math.min(24, 6 + hits * 3);
        else {
          const soft = d._x.split(st).length - 1;
          if (soft) s += Math.min(15, 4 + soft * 2);
        }
        if (!s) { all = false; break; }
        score += s;
      }
      if (all) out.push({ d, score });
    }
    return out.sort((a, b) => b.score - a.score).slice(0, 14).map(r => r.d);
  }

  const escHtml = s => String(s).replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));

  function mark(text, tokens) {
    const stems = [...new Set(tokens.filter(t => t.length > 1).map(stemOf))]
      .sort((a, b) => b.length - a.length)
      .map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/е/g, '[её]'));
    if (!stems.length) return escHtml(text);
    const source = String(text);
    const pattern = new RegExp('(?:' + stems.join('|') + ')[а-яёa-z]{0,4}', 'gi');
    let html = '', end = 0;
    for (const match of source.matchAll(pattern)) {
      html += escHtml(source.slice(end, match.index)) + '<mark>' + escHtml(match[0]) + '</mark>';
      end = match.index + match[0].length;
    }
    return html + escHtml(source.slice(end));
  }

  function snippet(d, tokens) {
    const src = d.x || d.s || '';
    if (!src) return d.s || '';
    const n = norm(src);
    let at = -1;
    for (const t of tokens) {
      let i = n.indexOf(t);
      if (i < 0) i = n.indexOf(stemOf(t));
      if (i > -1 && (at < 0 || i < at)) at = i;
    }
    if (at < 0) return src.slice(0, 130) + '…';
    const from = Math.max(0, at - 60);
    return (from ? '…' : '') + src.slice(from, from + 170).trim() + '…';
  }

  function render(box, q) {
    const tokens = tokensFor(q);
    const T = window.__L || {};
    if (!tokens.length) {
      const E=window.Ercyon;
      const stored=E?.read('recentQueries',[]);
      const recent=Array.isArray(stored)?stored.filter(q=>typeof q==='string').slice(0,6):[];
      const favorites=E?.list('favorites').slice(0,5)||[];
      box.innerHTML = '<p class="finder__hint">' + escHtml(T.hint || 'Начните печатать — ищем по всему сайту.') + '</p>'
        + (recent.length ? '<div class="search-recent"><p>Недавно искали <button type="button" data-clear-queries>Очистить</button></p>'+recent.map(q=>'<button type="button" data-recent-query="'+escHtml(q)+'">'+escHtml(q)+'</button>').join('')+'</div>':'')
        + (favorites.length ? '<p class="finder__hint">Избранные страницы</p>'+favorites.map(d=>'<a class="fres" href="'+escHtml(E.href(d.url))+'"><span class="fres__title">'+escHtml(d.title)+'</span></a>').join(''):'');
      return;
    }
    if (loadError) {
      box.innerHTML = '<p class="finder__hint">Не удалось загрузить поиск. Проверьте соединение и попробуйте ещё раз.</p>'
        + '<button type="button" class="btn btn--ghost" data-search-retry>Повторить</button>';
      return;
    }
    const hits = search(q);
    if (!hits.length) {
      const tpl = T.nothing || 'По запросу «{q}» ничего не нашлось. Попробуйте другое слово.';
      box.innerHTML = '<p class="finder__hint">' + escHtml(tpl.replace('{q}', q)) + '</p>';
      return;
    }
    box.innerHTML = hits.map((d, i) => `
      <a class="fres${i === 0 ? ' is-sel' : ''}" href="${escHtml((window.__BASE__||'')+d.u)}">
        <span class="fres__cat">${escHtml(d.c === d.t ? '' : (d.c || ''))}</span>
        <span class="fres__title">${mark(d.t, tokens)}</span>
        <span class="fres__snip">${mark(snippet(d, tokens), tokens)}</span>
      </a>`).join('');
  }

  let finderReturnFocus = null;
  const openFinder = () => {
    if (!finder) return;
    finderReturnFocus = document.activeElement;
    finder.hidden = false;
    body.classList.add('nav-open-lock');
    document.documentElement.style.overflow = 'hidden';
    loadIndex().then(() => render(results, input.value));
    setTimeout(() => input.focus(), 30);
  };
  const closeFinder = () => {
    if (!finder) return;
    finder.hidden = true;
    body.classList.remove('nav-open-lock');
    document.documentElement.style.overflow = '';
    finderReturnFocus?.focus({ preventScroll: true });
  };

  for (const [box, field] of [[results, input], [pResults, pInput]]) {
    box?.addEventListener('click', e => {
      if (e.target.closest('[data-search-retry]')) loadIndex().then(() => render(box, field.value));
      const recent=e.target.closest('[data-recent-query]');
      if(recent){field.value=recent.dataset.recentQuery;field.dispatchEvent(new Event('input'));}
      if(e.target.closest('[data-clear-queries]')){window.Ercyon?.write('recentQueries',[]);render(box,field.value);}
      if(e.target.closest('.fres') && field.value.trim()){
        const E=window.Ercyon,stored=E?.read('recentQueries',[]),q=field.value.trim().slice(0,100);
        E?.write('recentQueries',[q,...(Array.isArray(stored)?stored:[]).filter(x=>typeof x==='string'&&x!==q)].slice(0,8));
      }
    });
  }
  const syncFilters=()=>$$('[data-search-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.searchFilter===searchFilter)));
  syncFilters();
  $$('[data-search-filter]').forEach(button=>button.addEventListener('click',()=>{
    searchFilter=button.dataset.searchFilter;syncFilters();
    if(pInput){const u=new URL(location.href);searchFilter==='all'?u.searchParams.delete('type'):u.searchParams.set('type',searchFilter);history.replaceState(null,'',u);}
    loadIndex().then(()=>{if(results && !finder.hidden)render(results,input.value);if(pResults)render(pResults,pInput.value);});
  }));

  $('#searchBtn')?.addEventListener('click', openFinder);
  $('#searchBtn2')?.addEventListener('click', () => { setNav(false); openFinder(); });
  $('#finderClose')?.addEventListener('click', closeFinder);
  finder?.addEventListener('click', e => { if (e.target === finder) closeFinder(); });

  let timer;
  input?.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => loadIndex().then(() => render(results, input.value)), 90);
  });

  // клавиатура: / или Ctrl+K открывают поиск, стрелки листают, Esc закрывает
  document.addEventListener('keydown', e => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable;
    if (!typing && (e.key === '/' || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k'))) {
      e.preventDefault(); openFinder(); return;
    }
    if (e.key === 'Escape') {
      if (finder && !finder.hidden) { closeFinder(); return; }
      if (body.classList.contains('nav-open')) setNav(false);
    }
    if (finder && !finder.hidden && e.key === 'Tab') {
      const controls = $$('input,button,a[href]', finder);
      const first = controls[0], last = controls[controls.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
    }
    if (finder && !finder.hidden && e.target === input && (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter')) {
      const items = $$('.fres', results);
      if (!items.length) return;
      let i = items.findIndex(el => el.classList.contains('is-sel'));
      if (e.key === 'Enter') { e.preventDefault(); (items[i] || items[0]).click(); return; }
      e.preventDefault();
      items[i]?.classList.remove('is-sel');
      i = e.key === 'ArrowDown' ? (i + 1) % items.length : (i - 1 + items.length) % items.length;
      items[i].classList.add('is-sel');
      items[i].scrollIntoView({ block: 'nearest' });
    }
  });

  /* поиск на отдельной странице /search/ */
  if (pInput) {
    const q0 = new URLSearchParams(location.search).get('q');
    if (q0) pInput.value = q0;
    const run = () => loadIndex().then(() => {
      render(pResults, pInput.value);
      const u = new URL(location.href);
      pInput.value ? u.searchParams.set('q', pInput.value) : u.searchParams.delete('q');
      history.replaceState(null, '', u);
    });
    pInput.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(run, 90); });
    pInput.focus();
    run();
  }

  /* ─────────────────── ОГЛАВЛЕНИЕ: подсветка ─────────────────── */
  const tocLinks = $$('.toc a');
  if (tocLinks.length && 'IntersectionObserver' in window) {
    const map = new Map();
    tocLinks.forEach(a => {
      const el = document.getElementById(decodeURIComponent(a.hash.slice(1)));
      if (el) map.set(el, a);
    });
    let last = null;
    const io = new IntersectionObserver(entries => {
      for (const e of entries) {
        if (e.isIntersecting) {
          last?.classList.remove('is-active');
          last = map.get(e.target);
          last?.classList.add('is-active');
        }
      }
    }, { rootMargin: '-15% 0px -70% 0px' });
    map.forEach((_, el) => io.observe(el));
  }

  /* ───────── внешние ссылки в новой вкладке уже помечены в HTML ───────── */

  /* ─────────── КАРТОЧКИ ПОЯВЛЯЮТСЯ ПРИ ПРОКРУТКЕ ───────────
     Трогаем только то, что при загрузке ниже линии сгиба: карточки в первом
     экране должны быть видны сразу, иначе читатель ловит пустой лист.
     Без JS и при prefers-reduced-motion всё видно всегда — класс .reveal
     либо не ставится, либо его переход длится .01ms (см. site.css). */
  if ('IntersectionObserver' in window) {
    const fold = window.innerHeight - 40;
    $$('.cards,.tiles,.ccards,.nlist,.trows,.feed__list').forEach(group => {
      let i = 0;
      for (const el of group.children) {
        if (el.getBoundingClientRect().top < fold) continue;
        el.classList.add('reveal');
        el.style.setProperty('--i', i++);   // ступенька внутри своей группы
      }
    });

    const pending = new Set($$('.reveal'));
    const show = el => { el.classList.add('is-visible'); pending.delete(el); io2.unobserve(el); };
    const io2 = new IntersectionObserver(entries => {
      for (const e of entries) if (e.isIntersecting) show(e.target);
    }, { threshold: .06, rootMargin: '0px 0px -20px 0px' });
    pending.forEach(el => io2.observe(el));

    /* Страховка. Наблюдатель сообщает только об изменении: если рывок прокрутки
       (колесо до упора, переход по якорю) пронёс карточку мимо кадра целиком,
       она так и осталась бы пустой. Досматриваем руками, пока есть что показать. */
    let queued = false;
    const sweep = () => {
      queued = false;
      for (const el of [...pending]) {
        if (el.getBoundingClientRect().top < window.innerHeight) show(el);
      }
      if (!pending.size) window.removeEventListener('scroll', onScroll);
    };
    const onScroll = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(sweep);
    };
    if (pending.size) window.addEventListener('scroll', onScroll, { passive: true });
  }
  /* ─────────────────── ЖИВОЙ ПОИСК КАТАЛОГА ДЕРЖАВ ─────────────────── */
  const cFilter = $('#cfilter');
  if (cFilter) {
    const sInput = $('#cSearchInput');
    const cardsGrid = $('#cCardsGrid');
    const cards = cardsGrid ? $$('.ccard', cardsGrid) : [];

    const countEl = $('#cFilterCount');

    sInput?.addEventListener('input', () => {
      const q = norm(sInput.value);
      const tokens = q.split(/\s+/).filter(Boolean);
      let matched = 0;
      cards.forEach(card => {
        const text = norm((card.textContent || '') + ' ' + (card.getAttribute('data-search') || '')
          + ' ' + (card.getAttribute('data-resources') || ''));
        const match = !tokens.length || tokens.every(t => text.includes(t));
        card.style.display = match ? '' : 'none';
        if (match) {
          card.classList.add('is-visible');
          matched++;
        }
      });
      if (countEl) {
        if (!tokens.length) {
          countEl.textContent = '';
        } else if (matched === 0) {
          countEl.textContent = 'Ничего не найдено по вашему запросу.';
        } else {
          countEl.textContent = `Показано держав: ${matched} из ${cards.length}`;
        }
      }
    });
  }
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', window.ercionInit);
} else {
  window.ercionInit();
}

