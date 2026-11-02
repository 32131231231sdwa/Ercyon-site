import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import yaml from '../vendor/js-yaml.mjs';
import { countrySections } from '../templates/country-sections.mjs';
import { countryInfobox } from '../templates/country-infobox.mjs';
import { war, country } from '../templates/views.mjs';
import { illustration, imageSource } from '../templates/media.mjs';

test('иллюстрации и подписи доступны во всех четырёх разделах досье', () => {
  const record = name => ({ name, image: `/img/${name}.png`, image_alt: `Описание ${name}`, image_caption: `Подпись ${name}` });
  const html = countrySections({ commanders: [record('воевода')], army: { units: [record('отряд')] },
    equipment: [record('корабль')], resource_stock: [record('серебро')] });
  for (const name of ['воевода', 'отряд', 'корабль', 'серебро']) {
    assert.ok(html.includes(`alt="Описание ${name}"`), name);
    assert.ok(html.includes(`<figcaption>Подпись ${name}</figcaption>`), name);
    assert.ok(html.includes(`href="/img/${name}.png"`), name);
  }
  assert.match(html, /<summary><img[^>]+class="unit-thumb"/);
  assert.doesNotMatch(countrySections({ commanders: [{ name: 'Без портрета' }] }), /<img/);
});

test('символика и карта находятся в таблице сведений с доступными подписями', () => {
  const html = countryInfobox({ flag: '/img/flag.png', coat_of_arms: '/img/coat.png', map: '/img/map.png', map_caption: 'Горные земли' },
    'Держава', [['Столица', 'Город'], ['Правитель', '<Князь>']]);
  assert.match(html, /alt="Флаг: Держава"/);
  assert.match(html, /alt="Герб: Держава"/);
  assert.match(html, /alt="Горные земли"/);
  assert.match(html, /<th scope="row">Правитель<\/th><td>&lt;Князь&gt;<\/td>/);
  assert.ok(html.indexOf('country-symbols') < html.indexOf('country-infobox__facts'));
  assert.doesNotMatch(countryInfobox({}, 'Держава', [['Столица', 'Город']]), /<img|country-infobox__visuals/);
});

test('конфликт подхватывает символику выбранного досье и допускает собственный флаг', () => {
  const ctx = { L: (_key, fallback) => fallback, countries: [{ slug: 'country', title: 'Держава', front: {
    flag: '/img/default.png', coat_of_arms: '/img/coat.png' } }] };
  const html = war(ctx, { title: 'Конфликт', front: { belligerents: { side_a: {
    name: 'Другая подпись', country: 'country', flag: '/img/historical.png' } } } });
  assert.match(html, /src="\/img\/historical.png"/);
  assert.match(html, /src="\/img\/coat.png"/);
  assert.doesNotMatch(html, /src="\/img\/default.png"/);
  assert.doesNotThrow(() => war(ctx, { title: 'Черновик', front: { belligerents: { side_a: null } } }));
});

test('пустые и опасные ссылки не становятся изображениями, текст подписи экранируется', () => {
  for (const value of [null, {}, 'javascript:alert(1)', 'data:text/html,x', '//example.org/image.png']) assert.equal(imageSource(value), '');
  assert.equal(illustration({ name: 'Пусто' }), '');
  const html = illustration({ image: '/img/test.png', image_alt: '" onclick="x', image_caption: '<script>x</script>' });
  assert.doesNotMatch(html, /<script| onclick="x/);
  assert.match(html, /&lt;script&gt;x&lt;\/script&gt;/);
});

test('связь стороны войны с досье работает при разных названиях страны и фракции', () => {
  const html = country({ L: (_key, fallback) => fallback, treaties: [], wars: [{
    title: 'Война', url: '/wars/example/', front: { belligerents: { side_b: { name: 'Армия движения', country: 'derzhava' } } },
  }] }, { title: 'Священная держава', slug: 'derzhava', front: {}, html: '<p>Хроника</p>' });
  assert.match(html, /href="\/wars\/example\/"/);
});

test('главная показывает баннер сезона, разделы мира и личный справочник', () => {
  const html = fs.readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8');
  assert.equal((html.match(/class="quick-grid"/g) || []).length, 1);
  assert.match(html, /aria-label="Разделы мира"/);
  assert.match(html, /id="homeFavorites"/);
  assert.match(html, /id="continueReading"/);
  assert.match(html, /class="season-brief season-brief--illustrated"/);
  assert.match(html, /Свет рока дней новых/);
  assert.doesNotMatch(html, /id="myCountrySelect"|class="home-news"/);
  for (const section of ['rules','mechanics','lore','countries','maps','news','season']) {
    assert.ok(html.includes(`/${section}/`), section);
  }
});

test('CMS сохраняет редакторы всех разделов для новых материалов', () => {
  const config = yaml.load(fs.readFileSync(new URL('../admin/config.yml', import.meta.url), 'utf8'));
  assert.deepEqual(config.collections.map(c => c.name).sort(), ['settings', 'pages', 'countries', 'treaties', 'wars', 'news'].sort());
  const settings = config.collections.find(c => c.name === 'settings');
  assert.ok(settings.files.every(f => ['site', 'labels', 'home'].includes(f.name)));
  assert.equal(settings.files.find(f => f.name === 'site').fields.find(f => f.name === 'season').required, false);
  const pages = config.collections.find(c => c.name === 'pages');
  assert.equal(pages.fields.find(f => f.name === 'body').widget, 'markdown');
  assert.ok(pages.fields.some(f => f.name === 'map_points'));
  const commanders = config.collections.find(c => c.name === 'countries').fields.find(f => f.name === 'commanders');
  assert.ok(commanders.fields.find(f => f.name === 'status').options.some(o => o.value === ''));
});
