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

test('главная использует загруженную обложку и один видимый каталог внизу', () => {
  const html = fs.readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8');
  assert.match(html, /class="season-brief__cover"[^>]+loading="eager"/);
  assert.equal((html.match(/class="quick-grid"/g) || []).length, 1);
  assert.ok(html.indexOf('class="home-world"') > html.indexOf('class="player-home"'));
  assert.ok(html.indexOf('class="home-world"') > html.indexOf('id="continueReading"'));
  assert.doesNotMatch(html, /<details class="home-world"/);
});

test('CMS предоставляет загрузку символики и иллюстраций во всех требуемых формах', () => {
  const config = yaml.load(fs.readFileSync(new URL('../admin/config.yml', import.meta.url), 'utf8'));
  const country = config.collections.find(c => c.name === 'countries').fields;
  for (const key of ['flag', 'coat_of_arms', 'map']) assert.equal(country.find(f => f.name === key).widget, 'image');
  for (const fields of [country.find(f => f.name === 'commanders').fields,
    country.find(f => f.name === 'army').fields.find(f => f.name === 'units').fields,
    country.find(f => f.name === 'equipment').fields, country.find(f => f.name === 'resource_stock').fields]) {
    assert.equal(fields.find(f => f.name === 'image').widget, 'image');
    for (const key of ['image_alt', 'image_caption']) assert.equal(fields.find(f => f.name === key).required, false);
  }
  const sides = config.collections.find(c => c.name === 'wars').fields.find(f => f.name === 'belligerents').fields;
  for (const side of sides) for (const key of ['flag', 'coat_of_arms']) assert.equal(side.fields.find(f => f.name === key).widget, 'image');
});
