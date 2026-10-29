import { esc } from '../build.mjs';
import { icon } from './layout.mjs';
import { COUNTRY_SECTIONS, COMMANDER_LEVELS, COMMANDER_STATUSES, UNIT_TYPES,
  countryData, commanderLevel, nonNegativeNumber, hasValue } from '../lib/country-data.mjs';

const number = value => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 3 }).format(value);
const amount = (value, unit = '') => {
  const n = nonNegativeNumber(value);
  return n === null ? 'Не указано' : `${number(n)}${unit ? ` ${unit}` : ''}`;
};
const facts = rows => {
  const items = rows.filter(([, value]) => hasValue(value));
  return items.length ? `<dl class="dossier-facts">${items.map(([label, value]) =>
    `<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl>` : '';
};
const note = value => hasValue(value) ? `<p class="dossier-note">${esc(value)}</p>` : '';
const empty = text => `<p class="dossier-empty">${esc(text)}</p>`;
const section = (index, content) => {
  const { id, title, icon: symbol } = COUNTRY_SECTIONS[index];
  return `<section class="dossier-section" aria-labelledby="${id}">
    <h2 class="dossier-heading" id="${id}">${icon(`i-${symbol}`)}${title}<a class="anchor" href="#${id}" aria-label="Ссылка на раздел «${title}»">§</a></h2>
    ${content}</section>`;
};

export function countryNavigation() {
  return `<nav class="dossier-nav" aria-label="Разделы досье страны">${COUNTRY_SECTIONS.map(s =>
    `<a href="#${s.id}">${icon(`i-${s.icon}`, 'ico ico--sm')}<span>${s.title}</span></a>`).join('')}</nav>`;
}

export function countrySections(front) {
  const { commanders, army, units, equipment, stock, resources, total, partial } = countryData(front);
  const commanderCards = commanders.map(c => {
    const level = commanderLevel(c.level);
    const status = COMMANDER_STATUSES[c.status];
    return `<article class="dossier-card">
      <div class="dossier-card__head"><h3>${esc(c.name)}</h3>${status ? `<span class="pill pill--${status[1]}">${status[0]}</span>` : ''}</div>
      ${hasValue(c.title) ? `<p class="dossier-card__subtitle">${esc(c.title)}</p>` : ''}
      <div class="commander-rank"><span>${level === null ? 'Уровень не указан' : `Уровень ${level} · ${COMMANDER_LEVELS[level]}`}</span>
      ${level !== null ? `<strong>Навык +${level * 10}</strong>` : ''}</div>
      ${facts([['Специализация', c.specialty], ['Командует', c.assignment]])}${note(c.notes)}
    </article>`;
  }).join('');
  const commanderHelp = `<details class="dossier-help"><summary>Уровни и тактический навык</summary>
    <p>Тактический бросок: d100 + навык генерала. Навык равен уровню × 10.</p>
    <ol start="0">${COMMANDER_LEVELS.map((title, level) => `<li>${title} — навык ${level * 10}</li>`).join('')}</ol>
    <a href="/mechanics/war/">Правила ведения войн</a></details>`;

  const unitCards = units.map(u => `<article class="dossier-card">
    <div class="dossier-card__head"><h3>${esc(u.name)}</h3><span class="tag">${esc(UNIT_TYPES[u.type] || u.type || 'Тип не указан')}</span></div>
    ${facts([['Бойцов / экипаж', amount(u.count, 'чел.')], ['Командир', u.commander], ['Расположение', u.location],
      ['Подготовка', u.training], ['Вооружение', u.equipment]])}${note(u.notes)}</article>`).join('');
  const armyFacts = facts([
    ['Численность по указанным отрядам', total === null ? 'Не указана' : `${number(total)} чел.${partial ? ' (данные неполные)' : ''}`],
    ['Резерв', hasValue(army.reserve) ? amount(army.reserve, 'чел.') : null],
    ['Боевой дух', army.morale], ['Снабжение', army.supply],
  ]);

  const equipmentCards = equipment.map(e => `<article class="dossier-card">
    <div class="dossier-card__head"><h3>${esc(e.name)}</h3>${hasValue(e.category) ? `<span class="tag">${esc(e.category)}</span>` : ''}</div>
    ${facts([['Количество', amount(e.quantity, e.unit)], ['Материал', e.material], ['Качество', e.quality], ['Выдано', e.assigned_to]])}
    ${note(e.notes)}</article>`).join('');
  const stockCards = stock.map(r => `<article class="dossier-card">
    <h3>${esc(r.name)}</h3>${facts([['Запас', amount(r.amount, r.unit)], ['Добыча / доход за ход', r.production],
      ['Расход за ход', r.consumption], ['Расположение', r.location]])}${note(r.notes)}</article>`).join('');

  return section(1, (commanderCards ? `<div class="dossier-grid">${commanderCards}</div>`
    : empty('Сведения о воеводах пока не опубликованы.')) + commanderHelp)
    + section(2, armyFacts + note(army.notes) + (unitCards ? `<div class="dossier-grid">${unitCards}</div>`
      : empty('Состав армии пока не опубликован.')))
    + section(3, equipmentCards ? `<div class="dossier-grid">${equipmentCards}</div>`
      : empty('Сведения о вооружении и снаряжении пока не опубликованы.'))
    + section(4, (resources.length ? `<div class="dossier-legacy"><h3>Ресурсы из досье</h3><div class="tags">${resources.map(r => `<span class="tag">${esc(r)}</span>`).join('')}</div></div>` : '')
      + (stockCards ? `<div class="dossier-grid">${stockCards}</div>` : empty('Подробный учёт запасов пока не опубликован.')));
}
