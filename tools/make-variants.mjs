/**
 * Делает уменьшенные копии картинок для телефона.
 *
 *   node tools/make-variants.mjs
 *
 * Рядом с каждой картинкой из static/img/uploads появляются foo-700.webp и
 * foo-1100.webp (копии шире оригинала не делаются) — из них браузер сам
 * выбирает нужную, srcset подставляет сборка. Готовую копию не переделывает.
 *
 * Нужен ffmpeg в системе. Сборка умеет то же самое на ходу, но этот скрипт
 * удобен, когда картинки загрузили из панели пачкой: сделал копии, сохранил
 * их в репозиторий — и дальше сборка обходится без ffmpeg вообще.
 */
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { makeVariant, variantSteps } from '../build.mjs';

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const UPLOADS = path.join(HERE, '..', 'static', 'img', 'uploads');
const CONTENT = path.join(HERE, '..', 'content');
const REL = 'img/uploads';

if (!fs.existsSync(UPLOADS)) {
  console.log('Папки static/img/uploads нет — нечего уменьшать.');
  process.exit(0);
}

/* Тексты страниц и настройки — одной строкой, чтобы спросить у неё, вставлена
   ли картинка хоть куда-нибудь. Копии для забытых в папке файлов не нужны. */
const used = (function read(dir) {
  if (!fs.existsSync(dir)) return '';
  return fs.readdirSync(dir, { withFileTypes: true }).map(e => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? read(p)
      : /\.(md|ya?ml|json)$/i.test(e.name) ? fs.readFileSync(p, 'utf8') : '';
  }).join('\n');
})(CONTENT);

let made = 0, had = 0, idle = 0;
for (const name of fs.readdirSync(UPLOADS).sort()) {
  if (!/\.(png|jpe?g|webp)$/i.test(name) || /-\d{3,4}\.webp$/i.test(name)) continue;
  if (!used.includes(name) && !used.includes(encodeURIComponent(name))) { idle++; continue; }
  const rel = `${REL}/${name}`;
  for (const w of variantSteps(rel)) {
    const out = path.join(UPLOADS, `${name.replace(/\.[^.]+$/, '')}-${w}.webp`);
    const existed = fs.existsSync(out);
    if (!makeVariant(rel, w)) continue;
    if (existed) { had++; continue; }
    made++;
    console.log(`  + /${REL}/${path.basename(out)}   ${(fs.statSync(out).size / 1024).toFixed(0)} КБ`);
  }
}

console.log(made || had
  ? `\nГотово: новых копий ${made}, уже было ${had}.${
      idle ? ` Пропустили ${idle} — они не стоят ни на одной странице.` : ''}`
  : '\nНечего делать: ffmpeg не найден или все картинки узкие.');
