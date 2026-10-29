import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { documentSearchText } from '../lib/search-data.mjs';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const base = (process.env.BASE_PATH || '').replace(/\/$/, '');
const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
  const file = path.join(dir, e.name);
  return e.isDirectory() ? walk(file) : [file];
});

test('все внутренние ссылки опубликованных страниц ведут на существующие файлы и якоря', () => {
  const failures = [];
  for (const file of walk(dist).filter(f => f.endsWith('.html') && !f.includes(`${path.sep}admin`))) {
    const route = '/' + path.relative(dist, file).split(path.sep).join('/');
    const html = fs.readFileSync(file, 'utf8');
    for (const [, href] of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
      const url = new URL(href.replace(/&amp;/g, '&'), `https://site.test${base}${route}`);
      if (url.origin !== 'https://site.test') continue;
      if (base && !url.pathname.startsWith(base + '/')) { failures.push(`${route}: нет базы ${href}`); continue; }
      let target = path.join(dist, decodeURIComponent(url.pathname.slice(base.length)));
      if (fs.existsSync(target) && fs.statSync(target).isDirectory()) target = path.join(target, 'index.html');
      if (!fs.existsSync(target)) { failures.push(`${route}: ${href}`); continue; }
      if (url.hash && target.endsWith('.html')) {
        const id = decodeURIComponent(url.hash.slice(1));
        if (!fs.readFileSync(target, 'utf8').includes(`id="${id}"`)) failures.push(`${route}: якорь ${href}`);
      }
    }
  }
  assert.deepEqual([...new Set(failures)], []);
});

test('каждая опубликованная страна содержит пять уникальных разделов и прежний текст', () => {
  const index = JSON.parse(fs.readFileSync(path.join(dist, 'search-index.json'), 'utf8'));
  const countries = index.filter(d => d.k === 'country');
  assert.ok(countries.length > 0);
  for (const country of countries) {
    const html = fs.readFileSync(path.join(dist, country.u, 'index.html'), 'utf8');
    for (const part of ['overview', 'commanders', 'army', 'equipment', 'resources']) {
      assert.equal(html.split(`id="country-${part}"`).length - 1, 1, `${country.u}: ${part}`);
    }
    assert.ok(html.includes('class="prose"'), country.u);
  }
});

test('поисковый индекс хранит конец длинных страниц и правителя страны', () => {
  const text = documentSearchText({ kind: 'country', front: { ruler: 'Правитель Мирослав' },
    html: '<p>' + 'Длинная хроника. '.repeat(300) + '</p><p>Завершающее событие</p>' });
  assert.ok(text.includes('Завершающее событие'));
  assert.ok(text.includes('Правитель Мирослав'));
});
