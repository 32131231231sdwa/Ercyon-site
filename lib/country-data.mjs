/** Структурированные сведения досье. Отсутствие числа не означает ноль. */
export const COMMANDER_LEVELS = ['Без генерала / Толпа', 'Капитан', 'Воевода', 'Полководец', 'Маршал', 'Легендарный стратег'];
export const UNIT_TYPES = {
  light_infantry: 'Лёгкая пехота (ЛП)', heavy_infantry: 'Тяжёлая пехота (ТП)',
  cavalry: 'Кавалерия (КВ)', archers: 'Лучники (ЛЧ)', siege: 'Осадные / инженерные (ОС)',
  navy: 'Флот', other: 'Другие войска',
};
export const COMMANDER_STATUSES = {
  active: ['В строю', 'ok'], wounded: ['Ранен', 'mid'], captured: ['В плену', 'bad'],
  retired: ['В отставке', 'mid'], dead: ['Погиб', 'bad'],
};
export const COUNTRY_SECTIONS = [
  { id: 'country-overview', title: 'Обзор', icon: 'book' },
  { id: 'country-commanders', title: 'Воеводы', icon: 'crown' },
  { id: 'country-army', title: 'Армия', icon: 'sword' },
  { id: 'country-equipment', title: 'Снаряжение', icon: 'shield' },
  { id: 'country-resources', title: 'Ресурсы', icon: 'anvil' },
];

export const hasValue = value => value !== undefined && value !== null && String(value).trim() !== '';
export function nonNegativeNumber(value, integer = false) {
  if (!hasValue(value) || !['number', 'string'].includes(typeof value)) return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 && (!integer || Number.isSafeInteger(number)) ? number : null;
}
export function commanderLevel(value) {
  const level = nonNegativeNumber(value, true);
  return level !== null && level <= 5 ? level : null;
}
const records = value => Array.isArray(value)
  ? value.filter(item => item && typeof item === 'object' && hasValue(item.name)) : [];

export function countryData(front = {}) {
  const army = front.army && typeof front.army === 'object' && !Array.isArray(front.army) ? front.army : {};
  const units = records(army.units);
  const counts = units.map(unit => nonNegativeNumber(unit.count, true));
  const knownCounts = counts.filter(count => count !== null);
  const resources = (Array.isArray(front.resources) ? front.resources : [front.resources])
    .filter(value => hasValue(value) && ['string', 'number'].includes(typeof value));
  return {
    commanders: records(front.commanders), army, units,
    equipment: records(front.equipment), stock: records(front.resource_stock), resources,
    total: knownCounts.length ? knownCounts.reduce((sum, count) => sum + count, 0) : null,
    partial: knownCounts.length < units.length,
  };
}

export function countrySearchText(front = {}) {
  const data = countryData(front);
  const values = value => Array.isArray(value) ? value.flatMap(values)
    : value && typeof value === 'object' ? Object.values(value).flatMap(values)
    : hasValue(value) ? [String(value)] : [];
  return [front.ruler, front.capital, front.government, front.player, front.population, front.magic,
    ...values(data.commanders), ...values(data.army), ...values(data.equipment), ...values(data.stock),
    ...data.resources, ...data.units.map(unit => UNIT_TYPES[unit.type] || unit.type),
    ...data.commanders.map(commander => COMMANDER_LEVELS[commanderLevel(commander.level)]),
  ].filter(hasValue).join(' ');
}
