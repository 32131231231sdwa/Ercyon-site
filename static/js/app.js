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
        <span class="fres__cat">${escHtml(d.c === d.t ? '' : (d.c || ''))}</span>
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

  /* ─────────────────── СВЕЧНОЙ СВЕТ (ТЕМНЫЙ РЕЖИМ) ─────────────────── */
  const themeBtn = $('#themeBtn');
  const sidebarThemeBtn = $('#sidebarThemeBtn');
  const updateThemeUI = isCandle => {
    themeBtn?.classList.toggle('is-active', isCandle);
    sidebarThemeBtn?.classList.toggle('is-active', isCandle);
    if (themeBtn) themeBtn.setAttribute('aria-pressed', String(isCandle));
    if (sidebarThemeBtn) sidebarThemeBtn.setAttribute('aria-pressed', String(isCandle));
  };
  const toggleTheme = () => {
    const isCandle = document.documentElement.getAttribute('data-theme') === 'candle';
    const next = isCandle ? 'day' : 'candle';
    if (next === 'candle') {
      document.documentElement.setAttribute('data-theme', 'candle');
      try { localStorage.setItem('ercyon-theme', 'candle'); } catch(e){}
      updateThemeUI(true);
    } else {
      document.documentElement.removeAttribute('data-theme');
      try { localStorage.setItem('ercyon-theme', 'day'); } catch(e){}
      updateThemeUI(false);
    }
  };
  themeBtn?.addEventListener('click', toggleTheme);
  sidebarThemeBtn?.addEventListener('click', toggleTheme);
  updateThemeUI(document.documentElement.getAttribute('data-theme') === 'candle');

  /* ─────────────────── ЖИВОЙ ФИЛЬТР КАТАЛОГА ДЕРЖАВ ─────────────────── */
  const cFilter = $('#cfilter');
  if (cFilter) {
    const sInput = $('#cSearchInput');
    const pills = $$('.cfilter__pill', cFilter);
    const resSel = $('#cResourceSelect');
    const sortSel = $('#cSortSelect');
    const cardsGrid = $('#cCardsGrid');
    const statusLabel = $('#cFilterStatus');
    const cards = cardsGrid ? $$('.ccard', cardsGrid) : [];

    let currentStatus = 'all';
    let currentRes = '';
    let currentQuery = '';
    let currentSort = 'order';

    const applyFilter = () => {
      const q = norm(currentQuery);
      let visibleCount = 0;

      cards.forEach(card => {
        const title = card.getAttribute('data-title') || '';
        const ruler = card.getAttribute('data-ruler') || '';
        const capital = card.getAttribute('data-capital') || '';
        const status = card.getAttribute('data-status') || '';
        const resources = (card.getAttribute('data-resources') || '').split(';');

        const matchStatus = (currentStatus === 'all') || (status === currentStatus);
        const matchRes = (!currentRes) || resources.some(r => r.includes(currentRes));
        const matchSearch = (!q) || title.includes(q) || ruler.includes(q) || capital.includes(q);

        const match = matchStatus && matchRes && matchSearch;
        card.style.display = match ? '' : 'none';
        if (match) visibleCount++;
      });

      if (cardsGrid) {
        const sorted = [...cards].sort((a, b) => {
          if (currentSort === 'name') {
            return (a.getAttribute('data-title') || '').localeCompare(b.getAttribute('data-title') || '', 'ru');
          }
          if (currentSort === 'pop') {
            return (parseInt(b.getAttribute('data-pop') || '0', 10)) - (parseInt(a.getAttribute('data-pop') || '0', 10));
          }
          return (parseInt(a.getAttribute('data-order') || '100', 10)) - (parseInt(b.getAttribute('data-order') || '100', 10));
        });
        sorted.forEach(c => cardsGrid.appendChild(c));
      }

      if (statusLabel) {
        statusLabel.innerHTML = `Показано держав: <strong>${visibleCount}</strong> из ${cards.length}`;
      }
    };

    sInput?.addEventListener('input', () => {
      currentQuery = sInput.value;
      applyFilter();
    });

    pills.forEach(btn => {
      btn.addEventListener('click', () => {
        pills.forEach(b => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        currentStatus = btn.getAttribute('data-status') || 'all';
        applyFilter();
      });
    });

    resSel?.addEventListener('change', () => {
      currentRes = resSel.value.toLowerCase().trim();
      applyFilter();
    });

    sortSel?.addEventListener('change', () => {
      currentSort = sortSel.value;
      applyFilter();
    });
  }

  /* ─────────────────── ИНТЕРАКТИВНЫЙ ПРОСМОТРЩИК КАРТ (PAN & ZOOM) ─────────────────── */
  $$('.map-viewer').forEach(viewer => {
    const viewport = $('.map-viewer__viewport', viewer);
    const stage = $('.map-viewer__stage', viewer);
    const btnIn = $('.map-viewer__btn--in', viewer);
    const btnOut = $('.map-viewer__btn--out', viewer);
    const btnReset = $('.map-viewer__btn--reset', viewer);
    const btnFull = $('.map-viewer__btn--full', viewer);
    const filterBtns = $$('.map-filter-btn', viewer);
    const pins = $$('.map-pin', viewer);

    if (!viewport || !stage) return;

    let scale = 1;
    let tx = 0, ty = 0;
    let isDragging = false;
    let startX = 0, startY = 0;
    let initialTx = 0, initialTy = 0;

    const minScale = 1;
    const maxScale = 4.5;

    const updateTransform = (animate = false) => {
      stage.style.transition = animate ? 'transform .24s cubic-bezier(.25,1,.5,1)' : 'none';
      stage.style.transform = `matrix(${scale}, 0, 0, ${scale}, ${tx}, ${ty})`;
    };

    const clampPosition = () => {
      const vRect = viewport.getBoundingClientRect();
      const sW = vRect.width * scale;
      const sH = vRect.height * scale;
      const minX = Math.min(0, vRect.width - sW);
      const minY = Math.min(0, vRect.height - sH);
      const maxX = Math.max(0, (vRect.width - sW) / 2);
      const maxY = Math.max(0, (vRect.height - sH) / 2);

      if (scale === 1) {
        tx = 0; ty = 0;
      } else {
        tx = Math.min(maxX, Math.max(minX, tx));
        ty = Math.min(maxY, Math.max(minY, ty));
      }
    };

    const zoomAt = (newScale, clientX, clientY, animate = false) => {
      newScale = Math.max(minScale, Math.min(maxScale, newScale));
      if (newScale === scale) return;

      const vRect = viewport.getBoundingClientRect();
      const cx = (clientX != null) ? (clientX - vRect.left) : (vRect.width / 2);
      const cy = (clientY != null) ? (clientY - vRect.top) : (vRect.height / 2);

      const ratio = newScale / scale;
      tx = cx - (cx - tx) * ratio;
      ty = cy - (cy - ty) * ratio;
      scale = newScale;

      clampPosition();
      updateTransform(animate);
    };

    btnIn?.addEventListener('click', () => zoomAt(scale + 0.6, null, null, true));
    btnOut?.addEventListener('click', () => zoomAt(scale - 0.6, null, null, true));
    btnReset?.addEventListener('click', () => {
      scale = 1; tx = 0; ty = 0;
      updateTransform(true);
    });

    btnFull?.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        viewer.requestFullscreen?.() || viewer.webkitRequestFullscreen?.();
      } else {
        document.exitFullscreen?.() || document.webkitExitFullscreen?.();
      }
    });

    // Колёсико мыши
    viewport.addEventListener('wheel', e => {
      e.preventDefault();
      const delta = -e.deltaY * 0.0025;
      zoomAt(scale * (1 + delta), e.clientX, e.clientY, false);
    }, { passive: false });

    // Двойной клик для быстрого приближения
    viewport.addEventListener('dblclick', e => {
      if (e.target.closest('.map-pin')) return;
      e.preventDefault();
      const targetScale = scale > 1.8 ? 1 : 2.5;
      zoomAt(targetScale, e.clientX, e.clientY, true);
    });

    // Перетаскивание мышью
    viewport.addEventListener('mousedown', e => {
      if (e.button !== 0 || e.target.closest('.map-pin')) return;
      isDragging = true;
      viewport.classList.add('is-dragging');
      startX = e.clientX;
      startY = e.clientY;
      initialTx = tx;
      initialTy = ty;
    });

    window.addEventListener('mousemove', e => {
      if (!isDragging) return;
      tx = initialTx + (e.clientX - startX);
      ty = initialTy + (e.clientY - startY);
      clampPosition();
      updateTransform(false);
    });

    window.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        viewport.classList.remove('is-dragging');
      }
    });

    // Сенсорные жесты (Touch: Drag & Pinch-to-zoom)
    let touchDistance = null;
    let touchCenter = { x: 0, y: 0 };

    viewport.addEventListener('touchstart', e => {
      if (e.touches.length === 1) {
        if (e.target.closest('.map-pin')) return;
        isDragging = true;
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
        initialTx = tx;
        initialTy = ty;
      } else if (e.touches.length === 2) {
        isDragging = false;
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        touchDistance = Math.hypot(dx, dy);
        touchCenter = {
          x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
          y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
        };
      }
    }, { passive: true });

    viewport.addEventListener('touchmove', e => {
      if (e.touches.length === 1 && isDragging) {
        tx = initialTx + (e.touches[0].clientX - startX);
        ty = initialTy + (e.touches[0].clientY - startY);
        clampPosition();
        updateTransform(false);
      } else if (e.touches.length === 2 && touchDistance !== null) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const newDist = Math.hypot(dx, dy);
        const factor = newDist / touchDistance;
        touchDistance = newDist;
        zoomAt(scale * factor, touchCenter.x, touchCenter.y, false);
      }
    }, { passive: true });

    viewport.addEventListener('touchend', () => {
      isDragging = false;
      touchDistance = null;
    }, { passive: true });

    // Фильтр меток (Все, Столицы, Битвы)
    filterBtns.forEach(fBtn => {
      fBtn.addEventListener('click', () => {
        filterBtns.forEach(b => b.classList.remove('is-active'));
        fBtn.classList.add('is-active');
        const filterType = fBtn.getAttribute('data-type');
        pins.forEach(pin => {
          const type = pin.getAttribute('data-type');
          pin.style.display = (filterType === 'all' || type === filterType) ? '' : 'none';
        });
      });
    });

    // Тултипы меток при клике / наведении
    pins.forEach(pin => {
      const tooltip = $('.map-tooltip', pin);
      if (!tooltip) return;
      pin.addEventListener('click', e => {
        e.stopPropagation();
        const isOpen = !tooltip.hidden;
        $$('.map-tooltip', viewer).forEach(t => (t.hidden = true));
        tooltip.hidden = isOpen;
      });
    });

    viewer.addEventListener('click', () => {
      $$('.map-tooltip', viewer).forEach(t => (t.hidden = true));
    });
  });

  /* ─────────────────── КАЛЬКУЛЯТОР ЖИВИЦЫ ─────────────────── */
  const calc = $('#zhivicaCalc');
  if (calc) {
    const tabs = $$('.zhivica-mage-tab', calc);
    const meterVal = $('.zhivica-meter__val', calc);
    const meterFill = $('.zhivica-meter__fill', calc);
    const meterState = $('.zhivica-meter__state', calc);
    const meterNote = $('.zhivica-meter__note', calc);
    const meterBox = $('.zhivica-calc__meter', calc);
    const historyBox = $('.zhivica-calc__history', calc);

    const STAGES = [
      { min: 21, label: '🌿 Цветение духа', color: '#3e6b4f', note: 'Полная сила и юность духа. Живица течёт свободно, ясный взор и твёрдая рука.' },
      { min: 11, label: '🌾 Зрелость соков', color: '#b08d4a', note: 'Магическая сила в зените. Первые седые пряди на висках, лёгкая сухость во рту после ритуалов.' },
      { min: 1,  label: '🍂 Преддверие пепла', color: '#9e3933', note: 'Тление жизненных вёсен. Иссушение пальцев, притупление вкуса и запахов, отдача отдаётся ноющей болью.' },
      { min: 0,  label: '💀 Сухота', color: '#7b846f', note: 'Предел перейдён. Маг полностью поседел, перестал чувствовать вкус и запах и выбыл из круга живичников. Теперь он мудрый сухотный советник.' },
    ];

    let state = {
      activeMage: 0,
      mages: [
        { name: 'Старший живичник', springs: 30 },
        { name: 'Второй живичник', springs: 30 },
        { name: 'Младший живичник', springs: 30 },
      ],
      history: [],
    };

    try {
      const saved = localStorage.getItem('ercyon-zhivica');
      if (saved) state = { ...state, ...JSON.parse(saved) };
    } catch(e){}

    const saveState = () => {
      try { localStorage.setItem('ercyon-zhivica', JSON.stringify(state)); } catch(e){}
    };

    const updateCalcUI = () => {
      const cur = state.mages[state.activeMage] || state.mages[0];
      const sp = Math.max(0, Math.min(30, cur.springs));

      tabs.forEach((tab, i) => {
        tab.classList.toggle('is-active', i === state.activeMage);
        const countSpan = $('.zhivica-mage-tab__count', tab);
        if (countSpan) countSpan.textContent = `${state.mages[i].springs} вёсен`;
      });

      let stage = STAGES[STAGES.length - 1];
      for (const s of STAGES) {
        if (sp >= s.min) { stage = s; break; }
      }

      if (meterVal) meterVal.textContent = sp;
      if (meterFill) {
        meterFill.style.width = `${(sp / 30) * 100}%`;
        meterFill.style.backgroundColor = stage.color;
      }
      if (meterState) {
        meterState.textContent = stage.label;
        meterState.style.color = stage.color;
      }
      if (meterNote) meterNote.textContent = stage.note;
      if (meterBox) meterBox.style.setProperty('--meter-color', stage.color);

      if (historyBox) {
        if (!state.history.length) {
          historyBox.innerHTML = '<span class="muted">Летопись заклятий круга пуста. Сотворите заклятье…</span>';
        } else {
          historyBox.innerHTML = state.history.slice(-8).reverse().map(h =>
            `<div>• <strong>${escHtml(h.mage)}</strong>: ${escHtml(h.spell)} (−${h.cost} ${h.cost === 1 ? 'весна' : 'вёсен'}). Осталось: ${h.remain}</div>`
          ).join('');
        }
      }
    };

    tabs.forEach((tab, i) => {
      tab.addEventListener('click', () => {
        state.activeMage = i;
        updateCalcUI();
        saveState();
      });
    });

    $$('.zhivica-spell-btn', calc).forEach(btn => {
      btn.addEventListener('click', () => {
        const cost = parseInt(btn.getAttribute('data-cost') || '1', 10);
        const name = btn.getAttribute('data-name') || 'Заклятье';
        const cur = state.mages[state.activeMage];
        if (cur.springs <= 0) {
          alert(`${cur.name} уже вошёл в сухоту и больше не может тянуть Живицу!`);
          return;
        }
        cur.springs = Math.max(0, cur.springs - cost);
        state.history.push({
          mage: cur.name,
          spell: name,
          cost,
          remain: cur.springs,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        });
        updateCalcUI();
        saveState();
      });
    });

    $('#zhivicaUndo')?.addEventListener('click', () => {
      if (!state.history.length) return;
      const last = state.history.pop();
      const targetMage = state.mages.find(m => m.name === last.mage) || state.mages[state.activeMage];
      targetMage.springs = Math.min(30, targetMage.springs + last.cost);
      updateCalcUI();
      saveState();
    });

    $('#zhivicaReset')?.addEventListener('click', () => {
      if (!confirm('Восстановить круг живичников к началу сезона (по 30 вёсен)?')) return;
      state.mages.forEach(m => (m.springs = 30));
      state.history = [];
      updateCalcUI();
      saveState();
    });

    updateCalcUI();
  }
};
window.ercionInit();
