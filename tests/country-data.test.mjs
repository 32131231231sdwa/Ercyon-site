import test from 'node:test';
import assert from 'node:assert/strict';
import { countryData, commanderLevel, countrySearchText } from '../lib/country-data.mjs';
import { countrySections } from '../templates/country-sections.mjs';
import { war } from '../templates/views.mjs';
import yaml from '../vendor/js-yaml.mjs';
import fs from 'node:fs';

test('уровни генералов: 0–5, неизвестный уровень не становится нулевым', () => {
  for (const value of [null, undefined, '', ' ', -1, 6, 1.5, true, 'ошибка']) {
    assert.equal(commanderLevel(value), null);
  }
  for (let level = 0; level <= 5; level++) {
    assert.equal(commanderLevel(level), level);
    assert.equal(commanderLevel(String(level)), level);
    assert.match(countrySections({ commanders: [{ name: 'Воевода', level }] }), new RegExp(`Навык \\+${level * 10}<`));
  }
});

test('численность армии отличает ноль от неизвестных и неполных данных', () => {
  assert.equal(countryData({}).total, null);
  assert.equal(countryData({ army: { units: [{ name: 'Расформирован', count: 0 }] } }).total, 0);
  const data = countryData({ army: { units: [
    { name: 'Гвардия', count: 120 }, { name: 'Экипажи', count: '30' },
    { name: 'Разведка', count: '' }, { name: 'Некорректно', count: -1 },
  ] } });
  assert.equal(data.total, 150);
  assert.equal(data.partial, true);
  assert.equal(countryData({ army: { units: [{ name: 'Дробь', count: 1.5 }] } }).total, null);
});

test('досье совместимо со старыми ресурсами и пустыми полями CMS', () => {
  const html = countrySections({ resources: 'Железо (2)', commanders: null, army: null, equipment: null });
  assert.match(html, /Железо \(2\)/);
  assert.match(html, /Сведения о воеводах пока не опубликованы/);
  assert.doesNotMatch(html, /undefined|NaN|Навык \+0/);
  assert.match(countrySections({ resource_stock: [{ name: 'Соль', amount: 0, unit: 'т' }] }), /0 т/);
});

test('имена и заметки в карточках экранируются', () => {
  const html = countrySections({ commanders: [{ name: '<script>alert(1)</script>', notes: '<img onerror=alert(1)>' }] });
  assert.doesNotMatch(html, /<script>|<img onerror/);
  assert.match(html, /&lt;script&gt;/);
});

test('поисковый текст включает воевод, отряды, снаряжение и запасы', () => {
  const text = countrySearchText({ ruler: 'Правитель', commanders: [{ name: 'Мирослав', level: 4 }],
    army: { units: [{ name: 'Стража', type: 'archers' }] }, equipment: [{ name: 'Арбалет' }],
    resource_stock: [{ name: 'Селитра' }] });
  for (const value of ['Правитель', 'Мирослав', 'Маршал', 'Стража', 'Лучники', 'Арбалет', 'Селитра']) {
    assert.ok(text.includes(value), value);
  }
});

test('CMS сохраняет новые поля и ограничения чисел', () => {
  const config = yaml.load(fs.readFileSync(new URL('../admin/config.yml', import.meta.url), 'utf8'));
  const fields = config.collections.find(c => c.name === 'countries').fields;
  for (const name of ['resources', 'commanders', 'army', 'equipment', 'resource_stock']) {
    assert.ok(fields.some(f => f.name === name), name);
  }
  const levels = fields.find(f => f.name === 'commanders').fields.find(f => f.name === 'level').options;
  assert.deepEqual(levels.map(l => l.value), [0, 1, 2, 3, 4, 5]);
});

test('раненый командующий не помечается погибшим по символу в имени', () => {
  const html = war({ L: (_key, fallback) => fallback }, { title: 'Битва', front: {
    belligerents: { side_a: { commanders: ['Раненый #†', { name: 'Воевода', status: 'wounded' }] } },
  } });
  assert.doesNotMatch(html, /title="Погиб в бою"/);
  assert.equal((html.match(/title="Ранен"/g) || []).length, 2);
});
