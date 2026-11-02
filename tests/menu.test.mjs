import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import yaml from '../vendor/js-yaml.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));

test('редактор добавляет произвольные разделы и берёт их список для страниц из настроек', () => {
  const config = yaml.load(fs.readFileSync(path.join(root, 'admin/config.yml'), 'utf8'));
  const site = config.collections.find(c => c.name === 'settings').files.find(f => f.name === 'site');
  const categories = site.fields.find(f => f.name === 'categories');
  assert.equal(categories.max, undefined);
  assert.equal(categories.fields.find(f => f.name === 'id').widget, 'string');
  const category = config.collections.find(c => c.name === 'pages').fields.find(f => f.name === 'category');
  assert.equal(category.widget, 'relation');
  assert.equal(category.value_field, 'categories.*.id');
});

test('новый раздел появляется в меню даже пустым, а его страницы публикуются и доступны офлайн', () => {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'ercyon-menu-'));
  try {
    for (const name of ['build.mjs', 'vendor', 'lib', 'templates', 'content', 'static', 'admin', 'assets']) {
      if (fs.existsSync(path.join(root, name))) fs.cpSync(path.join(root, name), path.join(fixture, name), { recursive: true });
    }
    const settingsPath = path.join(fixture, 'content/settings.yml');
    const settings = yaml.load(fs.readFileSync(settingsPath, 'utf8'));
    settings.categories.push({ id: 'custom-guide', title: 'Новый справочник', icon: 'book' }, { id: 'empty-guide', title: 'Пустой раздел', icon: 'leaf' });
    fs.writeFileSync(settingsPath, yaml.dump(settings));
    fs.writeFileSync(path.join(fixture, 'content/pages/custom-guide.md'), '---\ntitle: Новый материал\ncategory: custom-guide\nslug: first-page\n---\nТекст нового справочника.\n');
    execFileSync(process.execPath, ['build.mjs'], { cwd: fixture, env: { ...process.env, BASE_PATH: '/Ercyon-site' }, stdio: 'pipe' });
    const dist = path.join(fixture, 'dist');
    const home = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
    assert.match(home, /href="\/Ercyon-site\/custom-guide\/"/);
    assert.match(home, /href="\/Ercyon-site\/empty-guide\/"/);
    assert.ok(fs.existsSync(path.join(dist, 'empty-guide/index.html')));
    assert.ok(fs.existsSync(path.join(dist, 'custom-guide/first-page/index.html')));
    const index = JSON.parse(fs.readFileSync(path.join(dist, 'search-index.json'), 'utf8'));
    assert.ok(index.some(d => d.u === '/custom-guide/first-page/'));
    for (const file of ['sw.js', 'js/storage.js']) assert.ok(fs.readFileSync(path.join(dist, file), 'utf8').includes('/custom-guide/first-page/'));
  } finally {
    assert.ok(path.resolve(fixture).startsWith(path.join(path.resolve(os.tmpdir()), 'ercyon-menu-')));
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});
