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

test('поисковый индекс содержит уникальные доступные страницы, включённые в sitemap', () => {
  const index = JSON.parse(fs.readFileSync(path.join(dist, 'search-index.json'), 'utf8'));
  const sitemap = fs.readFileSync(path.join(dist, 'sitemap.xml'), 'utf8');
  assert.ok(index.length > 0);
  assert.equal(new Set(index.map(d => d.u)).size, index.length, 'В поиске нет повторяющихся адресов');
  for (const record of index) {
    assert.equal(typeof record.t, 'string');
    assert.ok(record.t.trim(), record.u);
    assert.match(record.u, /^\/(?!\/)/);
    const url = new URL(record.u, 'https://site.test');
    assert.equal(url.origin, 'https://site.test');
    const file = path.join(dist, decodeURIComponent(url.pathname), 'index.html');
    assert.ok(fs.existsSync(file), record.u);
    const route = record.u.replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
    assert.ok(sitemap.includes(`${route}</loc>`), record.u);
  }
});

test('поисковый индекс хранит конец длинной технической страницы', () => {
  const text = documentSearchText({ kind: 'page', front: {},
    html: '<p>' + 'Описание механики. '.repeat(300) + '</p><p>Завершающее правило</p>' });
  assert.ok(text.includes('Завершающее правило'));
});
