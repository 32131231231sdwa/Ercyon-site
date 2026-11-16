import { esc } from '../build.mjs';

export function calendarCard(settings = {}, detailed = false) {
  const season = settings.season || {};
  if (!season.calendar_url) return '';
  const start = new Date(season.starts_at || '');
  const label = Number.isFinite(start.getTime()) ? new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Europe/Moscow', dateStyle: 'long', timeStyle: 'short',
  }).format(start) + ' МСК' : '';
  return `<section class="calendar-card" data-calendar-root aria-label="Общий календарь мира">
    <div class="calendar-card__head"><h2>Календарь мира</h2><span class="pill pill--mid" data-calendar-state>${esc(season.state_label || 'Пауза')}</span></div>
    <p class="calendar-card__time"><strong data-calendar-year>${esc(season.year || '')}</strong><span data-calendar-countdown>${label ? 'Начало: ' + esc(label) : 'Точный год — в календаре бота.'}</span></p>
    <p class="calendar-card__source" data-calendar-freshness>Текущее состояние доступно в <a href="https://t.me/ErcionGay">@ErcionGay</a> по команде /calendar.</p>
    ${detailed ? '' : '<a class="calendar-card__link" href="/mechanics/calendar/">Месяцы и темп игры →</a>'}
  </section>`;
}
