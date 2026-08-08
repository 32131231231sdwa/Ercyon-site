/**
 * Собирает шрифты и картинки оформления в текстовые файлы assets/*.b64.json
 * и наоборот — распаковывает их обратно в static/.
 *
 *   node tools/pack-assets.mjs           упаковать static/fonts и static/img → assets/
 *   node tools/pack-assets.mjs --unpack  распаковать assets/ → static/
 *
 * Зачем: так весь проект состоит из текстовых файлов. Его можно целиком
 * положить в репозиторий через веб-интерфейс или через API, не теряя
 * ни одного байта, и он одинаково собирается везде.
 *
 * Картинки, которые загружает редактор через панель, сюда НЕ попадают —
 * они лежат обычными файлами в static/img/uploads/.
 */
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const STATIC = path.join(ROOT, 'static');
const ASSETS = path.join(ROOT, 'assets');

/** Что именно пакуем: папка внутри static → имя файла-контейнера */
const GROUPS = [
  { dir: 'fonts', out: 'fonts.b64.json', match: /\.woff2$/ },
  { dir: 'img',   out: 'images.b64.json', match: /\.(webp|png|jpg|jpeg|ico|gif)$/i,
    skip: /^(uploads|decor)\// },
];

function walk(dir, base = dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p, base) : [path.relative(base, p).replace(/\\/g, '/')];
  });
}

function pack() {
  fs.mkdirSync(ASSETS, { recursive: true });
  for (const g of GROUPS) {
    const src = path.join(STATIC, g.dir);
    const files = walk(src).filter(f => g.match.test(f) && !(g.skip && g.skip.test(f)));
    const bundle = {};
    for (const f of files.sort()) {
      bundle[`${g.dir}/${f}`] = fs.readFileSync(path.join(src, f)).toString('base64');
    }
    const out = path.join(ASSETS, g.out);
    fs.writeFileSync(out, JSON.stringify(bundle, null, 0) + '\n', 'utf8');
    console.log(`  ${g.out.padEnd(18)} файлов: ${String(files.length).padStart(3)}   ` +
                `${(fs.statSync(out).size / 1024 / 1024).toFixed(2)} МБ`);
  }
}

function unpack() {
  for (const g of GROUPS) {
    const file = path.join(ASSETS, g.out);
    if (!fs.existsSync(file)) continue;
    const bundle = JSON.parse(fs.readFileSync(file, 'utf8'));
    for (const [rel, b64] of Object.entries(bundle)) {
      const dst = path.join(STATIC, rel);
      fs.mkdirSync(path.dirname(dst), { recursive: true });
      fs.writeFileSync(dst, Buffer.from(b64, 'base64'));
    }
    console.log(`  ${g.out} → static/, файлов: ${Object.keys(bundle).length}`);
  }
}

process.argv.includes('--unpack') ? unpack() : pack();
