/* Общий источник времени для сайта и Telegram. Часы считаются от ответа сервера. */
(() => {
  const endpoint = document.querySelector('meta[name="ercyon-calendar"]')?.content;
  if (!endpoint) return;
  let snapshot = null, observedAt = 0, inFlight = false;
  const date = value => new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Europe/Moscow', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
  }).format(new Date(value)) + ' МСК';
  const duration = ms => {
    const minutes = Math.max(1, Math.ceil(ms / 60000)), days = Math.floor(minutes / 1440), hours = Math.floor(minutes % 1440 / 60);
    return [days && days + ' дн.', hours && hours + ' ч.', minutes % 60 && minutes % 60 + ' мин.'].filter(Boolean).join(' ');
  };
  function render() {
    if (!snapshot) return;
    const now = Date.parse(snapshot.as_of) + performance.now() - observedAt;
    const starts = Date.parse(snapshot.starts_at), boundary = Date.parse(snapshot.next_year_at);
    const scheduled = snapshot.state === 'scheduled' && now < starts;
    const running = snapshot.state === 'running' || (snapshot.state === 'scheduled' && !scheduled);
    const passed = running && now >= boundary ? Math.floor((now - boundary) / snapshot.year_ms) + 1 : 0;
    const year = snapshot.year + passed;
    const next = boundary + passed * snapshot.year_ms;
    const state = scheduled ? 'Старт назначен' : running ? 'Идёт игра' : 'Пауза';
    document.querySelectorAll('[data-calendar-year]').forEach(el => { el.textContent = year + ' год'; });
    document.querySelectorAll('[data-calendar-state]').forEach(el => {
      el.textContent = state;
      if (el.classList.contains('pill')) {
        el.classList.toggle('pill--ok', running); el.classList.toggle('pill--mid', !running);
      }
    });
    document.querySelectorAll('[data-calendar-countdown]').forEach(el => {
      el.textContent = scheduled ? 'До старта: ' + duration(starts - now) + ' · ' + date(starts)
        : running ? 'До ' + (year + 1) + ' года: ' + duration(next - now) : 'Отсчёт игровых сроков остановлен.';
    });
  }
  async function refresh() {
    if (inFlight || document.hidden) return;
    inFlight = true;
    try {
      const response = await fetch(endpoint, { cache: 'no-store', signal: AbortSignal.timeout(8000) });
      if (!response.ok) throw new Error('Calendar unavailable');
      const data = await response.json();
      if (!Number.isSafeInteger(data.year) || data.year < 1 || !['paused','scheduled','running'].includes(data.state)
        || !Number.isSafeInteger(data.year_ms) || data.year_ms < 60000 || !Number.isFinite(Date.parse(data.as_of))
        || (data.state !== 'paused' && !Number.isFinite(Date.parse(data.next_year_at)))
        || (data.state === 'scheduled' && !Number.isFinite(Date.parse(data.starts_at)))) throw new Error('Invalid calendar');
      snapshot = data; observedAt = performance.now(); render();
      document.querySelectorAll('[data-calendar-freshness]').forEach(el => {
        el.textContent = 'Сверено с общим календарём: ' + date(data.as_of) + '. Год длится ' + data.year_ms / 3600000 + ' часов.';
      });
    } catch {
      snapshot = null;
      document.querySelectorAll('[data-calendar-countdown]').forEach(el => { el.textContent = 'Текущее состояние проверьте командой /calendar в боте.'; });
      document.querySelectorAll('[data-calendar-freshness]').forEach(el => { el.textContent = 'Связь с общим календарём недоступна. Показанные год и состояние — последние известные данные.'; });
    } finally { inFlight = false; }
  }
  refresh();
  setInterval(() => { if (!document.hidden) render(); }, 1000);
  setInterval(refresh, 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
  window.addEventListener('online', refresh);
})();
