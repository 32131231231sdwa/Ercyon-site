/**
 * Шпаргалка со всеми значками разделов → dist/admin/icons.html
 * Открывается с телефона, чтобы видеть, как называется какой значок.
 */
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const SPRITE = fs.readFileSync(path.join(HERE, '..', 'static', 'img', 'decor', 'sprite.svg'), 'utf8')
  .replace(/<\?xml[^>]*\?>\s*/, '');

/* Имя значка → как он называется в панели. Порядок = порядок в списке панели. */
export const ICONS = [
  ['leaf', 'Лист', '🌿'], ['oak', 'Дуб', '🌳'], ['fern', 'Папоротник', '🌱'], ['thorn', 'Терн', '🥀'],
  ['crown', 'Корона', '👑'], ['sword', 'Меч', '⚔️'], ['shield', 'Щит', '🛡️'], ['banner', 'Знамя', '🚩'],
  ['castle', 'Замок', '🏰'], ['tower', 'Башня', '🗼'], ['gate', 'Врата', '⛩️'], ['bridge', 'Мост', '🌉'],
  ['scroll', 'Свиток', '📜'], ['book', 'Книга', '📖'], ['quill', 'Перо', '🖋️'], ['seal', 'Печать', '🔴'],
  ['key', 'Ключ', '🗝️'], ['coin', 'Монета', '🪙'], ['scales', 'Весы', '⚖️'], ['anvil', 'Наковальня', '⚒️'],
  ['hammer', 'Молот', '🔨'], ['gear', 'Шестерня', '⚙️'], ['compass', 'Компас', '🧭'], ['map', 'Карта', '🗺️'],
  ['ship', 'Корабль', '⛵'], ['mountain', 'Гора', '⛰️'], ['moon', 'Луна', '🌙'], ['sun', 'Солнце', '☀️'],
  ['star', 'Звезда', '⭐'], ['flame', 'Пламя', '🔥'], ['drop', 'Капля', '💧'],
  ['wolf', 'Волк', '🐺'], ['raven', 'Ворон', '🐦'],
];

export function iconsPage(siteTitle = 'Ercyon') {
  const cells = ICONS.map(([id, name, emoji]) => `
    <li class="ic">
      <svg class="ic__img" aria-hidden="true"><use href="#i-${id}"/></svg>
      <span class="ic__name">${emoji} ${name}</span>
      <code class="ic__id">${id}</code>
    </li>`).join('');

  return `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex">
<meta name="theme-color" content="#14352A">
<title>Значки разделов — ${siteTitle}</title>
<link rel="icon" href="/img/favicon-32.png" type="image/png">
<link rel="stylesheet" href="/css/fonts.css">
<style>
  :root{--deep:#14352A;--moss:#3E6B4F;--parch:#F2EBD9;--gold:#B08D4A;--ink:#2B3225;--ink3:#7B846F;--edge:#D8CBAC}
  *{box-sizing:border-box}
  body{
    margin:0;padding:1.5rem 1.1rem 3rem;
    padding-top:calc(1.5rem + env(safe-area-inset-top));
    background:var(--parch);background-image:url("/img/paper.webp");background-size:300px;
    background-blend-mode:multiply;
    font:400 1.0625rem/1.6 "PT Serif",Georgia,serif;color:var(--ink);
  }
  .wrap{max-width:56rem;margin:0 auto}
  h1{font-family:"Cormorant",Georgia,serif;font-weight:700;color:var(--deep);
     font-size:clamp(1.9rem,7vw,2.6rem);line-height:1.1;margin:0 0 .4rem}
  .lead{margin:0 0 1.6rem;color:#55604C;font-style:italic}
  .grid{list-style:none;margin:0;padding:0;display:grid;gap:.7rem;
        grid-template-columns:repeat(auto-fill,minmax(9.5rem,1fr))}
  .ic{display:grid;justify-items:center;gap:.35rem;padding:1rem .6rem;
      border:1px solid var(--edge);border-radius:6px;background:rgba(255,255,255,.5);text-align:center}
  .ic__img{width:2.1rem;height:2.1rem;color:var(--moss)}
  .ic__name{font-family:"Cormorant",Georgia,serif;font-size:1.2rem;font-weight:600;color:var(--deep);line-height:1.2}
  .ic__id{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:.78rem;color:var(--ink3)}
  .note{margin:2rem 0 0;padding:1rem 1.1rem;border:1px solid var(--edge);border-left:4px solid var(--gold);
        border-radius:6px;background:rgba(176,141,74,.08);font-size:.98rem}
  .back{display:inline-block;margin-top:1.6rem;color:var(--moss)}
  hr{border:0;height:1px;background:var(--edge);margin:2rem 0}
  h2{font-family:"Cormorant",Georgia,serif;color:var(--deep);font-size:1.5rem;margin:0 0 .8rem}
  .decor{list-style:none;margin:0;padding:0;display:grid;gap:.7rem;
         grid-template-columns:repeat(auto-fill,minmax(13rem,1fr))}
  .dc{display:grid;justify-items:center;gap:.4rem;padding:1rem;border:1px solid var(--edge);
      border-radius:6px;background:rgba(255,255,255,.5)}
  .dc svg{color:var(--gold)}
  .dc__t{font-size:.85rem;color:var(--ink3)}
</style>
</head>
<body>
${SPRITE}
<div class="wrap">
  <h1>Значки разделов</h1>
  <p class="lead">Столько значков доступно для разделов меню. В панели они выбираются
    в поле «Значок» — там рядом с названием стоит эмодзи-подсказка.</p>

  <ul class="grid">${cells}</ul>

  <div class="note">
    <b>Как поменять значок раздела.</b> Панель → Настройки → Основные настройки сайта →
    Разделы меню → нужный раздел → поле «Значок». Сохранили — через полминуты
    новый значок на сайте.
  </div>

  <hr>

  <h2>Украшения страниц</h2>
  <ul class="decor">
    <li class="dc"><svg width="200" height="22" aria-hidden="true"><use href="#d-divider"/></svg>
      <span class="dc__t">Разделитель — строка со знаком ❦</span></li>
    <li class="dc"><svg width="44" height="44" aria-hidden="true"><use href="#d-wax"/></svg>
      <span class="dc__t">Печать — врезка :::seal</span></li>
    <li class="dc"><svg width="160" height="18" aria-hidden="true"><use href="#d-flourish"/></svg>
      <span class="dc__t">Росчерк под заголовком</span></li>
    <li class="dc"><svg width="30" height="80" aria-hidden="true" style="opacity:.5"><use href="#d-vine"/></svg>
      <span class="dc__t">Лоза по краям листа</span></li>
  </ul>

  <a class="back" href="/admin/">← Вернуться в панель</a>
</div>
</body>
</html>`;
}
