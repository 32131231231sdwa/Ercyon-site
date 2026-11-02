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

test('технические материалы сохранены, каталоги и исходники лора не публикуются', () => {
  const index = JSON.parse(fs.readFileSync(path.join(dist, 'search-index.json'), 'utf8'));
  const pages = index.filter(d => d.k === 'page');
  const published = new Set(pages.map(d => d.u));
  for (const route of [
    '/rules/', '/mechanics/calendar/', '/mechanics/expansion/', '/mechanics/research/',
    '/mechanics/resources/', '/mechanics/posts/', '/mechanics/metal/', '/mechanics/war/',
  ]) assert.ok(published.has(route), route);
  assert.ok(pages.every(d => ['rules', 'mechanics'].includes(d.category)));
  for (const route of ['countries', 'news', 'wars', 'treaties', 'lore', 'maps', 'season']) {
    assert.equal(fs.existsSync(path.join(dist, route)), false, route);
    assert.equal(fs.existsSync(path.join(dist, 'content', route)), false, `content/${route}`);
  }
  assert.equal(fs.existsSync(path.join(dist, 'rss.xml')), false);
  assert.equal(fs.existsSync(path.join(dist, 'other', 'medrin-ii')), false);
  assert.equal(fs.readdirSync(path.join(dist, 'content', 'pages')).length, pages.length);
  const sitemap = fs.readFileSync(path.join(dist, 'sitemap.xml'), 'utf8');
  const serialized = JSON.stringify(index) + sitemap;
  assert.doesNotMatch(serialized, /\/(countries|news|wars|treaties|lore|maps|season)\//);
  assert.doesNotMatch(serialized, /Медрин|Нотаир|Тан-Боро|Грейвульф/);
  const uploads = fs.readdirSync(path.join(dist, 'img', 'uploads')).filter(f=>/\.(png|webp)$/.test(f)).sort();
  for (const image of [
    '9B54D04A-5CDA-4C10-B4AC-2CDD1E0B84AB-700.webp',
    '9B54D04A-5CDA-4C10-B4AC-2CDD1E0B84AB.png',
    'Без названия59_20261003162023-1100.webp',
    'Без названия59_20261003162023-700.webp',
    'Без названия59_20261003162023.webp',
  ]) assert.ok(uploads.includes(image), image);
  assert.ok(!uploads.some(f => f.includes('03EACD0B-73FA-44A7-9738-AFB338F54C67') || f.includes('Без названия60_20261025131426')));
});

test('поисковый индекс хранит конец длинной технической страницы', () => {
  const text = documentSearchText({ kind: 'page', front: {},
    html: '<p>' + 'Описание механики. '.repeat(300) + '</p><p>Завершающее правило</p>' });
  assert.ok(text.includes('Завершающее правило'));
});
