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

  const setNav = open => {
    body.classList.toggle('nav-open', open);
    if (scrim) scrim.hidden = !open;
    if (burger) {
      burger.setAttribute('aria-expanded', String(open));
      burger.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
    }
    if (open) {
      const first = sidebar?.querySelector('a,button');
      first && first.focus({ preventScroll: true });
    }
  };

  burger?.addEventListener('click', () => setNav(!body.classList.contains('nav-open')));
  scrim?.addEventListener('click', () => setNav(false));
  $('#navClose')?.addEventListener('click', () => setNav(false));

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

  let index = null, loading = null;

  const norm = s => String(s).toLowerCase().replace(/ё/g, 'е').replace(/[^\wа-я0-9\s-]/gi, ' ');

  const prepare = data =>
    data.map(d => ({ ...d, _t: norm(d.t), _s: norm(d.s || ''), _x: norm(d.x || ''),
                     _c: norm(d.c || ''), _h: norm(d.h || '') }));

  const loadIndex = () => {
    if (index) return Promise.resolve(index);
    if (window.__SEARCH_INDEX__) { index = prepare(window.__SEARCH_INDEX__); return Promise.resolve(index); }
    if (!loading) loading = fetch((window.__BASE__ || '') + '/search-index.json')
      .then(r => r.json())
      .then(data => (index = prepare(data)))
      .catch(() => (index = []));
    return loading;
  };

  /* Русский язык склоняется, поэтому ищем ещё и по «корню» слова:
     «торговый путь» должен находить «торговые пути». */
  const stemOf = t => t.length >= 8 ? t.slice(0, -3)
                    : t.length >= 6 ? t.slice(0, -2)
                    : t.length >= 5 ? t.slice(0, -1) : t;

  function search(q) {
    const tokens = norm(q).split(/\s+/).filter(t => t.length > 1);
    if (!tokens.length) return [];
    const out = [];
    for (const d of index) {
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
    let html = escHtml(text);
    for (const t of tokens) {
      if (t.length < 2) continue;
      const st = stemOf(t).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      html = html.replace(new RegExp('(' + st + '[а-яёa-z]{0,4})', 'gi'), '<mark>$1</mark>');
    }
    return html;
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
    const tokens = norm(q).split(/\s+/).filter(t => t.length > 1);
    const T = window.__L || {};
    if (!tokens.length) {
      box.innerHTML = '<p class="finder__hint">' +
        escHtml(T.hint || 'Начните печатать — ищем по всему сайту.') + '</p>';
      return;
    }
    const hits = search(q);
    if (!hits.length) {
      const tpl = T.nothing || 'По запросу «{q}» ничего не нашлось. Попробуйте другое слово.';
      box.innerHTML = '<p class="finder__hint">' + escHtml(tpl.replace('{q}', q)) + '</p>';
      return;
    }
    box.innerHTML = hits.map((d, i) => `
      <a class="fres${i === 0 ? ' is-sel' : ''}" href="${(window.__BASE__||'')+d.u}">
        <span class="fres__cat">${escHtml(d.c || '')}</span>
        <span class="fres__title">${mark(d.t, tokens)}</span>
        <span class="fres__snip">${mark(snippet(d, tokens), tokens)}</span>
      </a>`).join('');
  }

  const openFinder = () => {
    if (!finder) return;
    finder.hidden = false;
    body.classList.add('nav-open-lock');
    document.documentElement.style.overflow = 'hidden';
    loadIndex().then(() => input.value && render(results, input.value));
    setTimeout(() => input.focus(), 30);
  };
  const closeFinder = () => {
    if (!finder) return;
    finder.hidden = true;
    document.documentElement.style.overflow = '';
  };

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
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
    if (!typing && (e.key === '/' || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k'))) {
      e.preventDefault(); openFinder(); return;
    }
    if (e.key === 'Escape') {
      if (finder && !finder.hidden) { closeFinder(); return; }
      if (body.classList.contains('nav-open')) setNav(false);
    }
    if (finder && !finder.hidden && (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter')) {
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
    if (q0) run();
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
};
window.ercionInit();
