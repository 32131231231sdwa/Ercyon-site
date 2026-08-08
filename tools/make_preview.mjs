/**
 * Собирает ВЕСЬ сайт в один самодостаточный HTML-файл (preview.html):
 * шрифты, картинки, стили и поиск зашиты внутрь, переходы по разделам работают.
 * Нужен только для показа сайта до публикации. На боевой сайт не влияет.
 *
 *   node build.mjs && node tools/make_preview.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const DIST = path.join(ROOT, 'dist');

const b64 = p => fs.readFileSync(p).toString('base64');
const MIME = { '.webp':'image/webp', '.png':'image/png', '.jpg':'image/jpeg',
               '.ico':'image/x-icon', '.woff2':'font/woff2', '.svg':'image/svg+xml' };

/* ── картинки → data URI (тяжёлые заменяем облегчёнными) ── */
const SWAP = { 'hero-1920.webp':'hero-1280.webp', 'banner-1600.webp':'banner-1000.webp',
               'og-image.jpg':'logo-128.webp', 'logo-192.png':'logo-128.webp',
               'apple-touch-icon.png':'logo-96.webp', 'favicon.ico':'favicon-32.png' };
const imgCache = new Map();
function dataImg(rel) {
  const name = SWAP[path.basename(rel)] || path.basename(rel);
  if (imgCache.has(name)) return imgCache.get(name);
  const file = path.join(DIST, 'img', name);
  if (!fs.existsSync(file)) return '';
  const u = `data:${MIME[path.extname(name)] || 'image/webp'};base64,${b64(file)}`;
  imgCache.set(name, u);
  return u;
}

/* ── шрифты: только кириллица + латиница, иначе файл разбухает ── */
let fontCss = fs.readFileSync(path.join(DIST, 'css', 'fonts.css'), 'utf8');
fontCss = fontCss.split('@font-face').filter(Boolean).map((chunk, i) => {
  if (i === 0 && !chunk.includes('url(')) return '';
  if (!/cyrillic\.woff2|-latin\.woff2/.test(chunk)) return '';
  return '@font-face' + chunk.replace(/url\(\.\.\/fonts\/([^)]+)\)/g, (_, f) => {
    const p = path.join(DIST, 'fonts', f);
    return fs.existsSync(p) ? `url(data:font/woff2;base64,${b64(p)})` : 'url()';
  });
}).join('\n');

let siteCss = fs.readFileSync(path.join(DIST, 'css', 'site.css'), 'utf8')
  .replace(/url\("\/img\/([^"]+)"\)/g, (_, f) => `url("${dataImg(f)}")`);

/* ── собираем страницы ── */
const pages = {};
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { walk(p); continue; }
    if (e.name !== 'index.html') continue;
    const rel = '/' + path.relative(DIST, p).replace(/index\.html$/, '').replace(/\\/g, '/');
    let html = fs.readFileSync(p, 'utf8');
    const body = html.match(/<body([^>]*)>([\s\S]*)<\/body>/);
    if (!body) continue;
    const cls = (body[1].match(/class="([^"]*)"/) || [, ''])[1];
    const cat = (body[1].match(/data-cat="([^"]*)"/) || [, ''])[1];
    let inner = body[2]
      .replace(/<script[\s\S]*?<\/script>/g, '')
      .replace(/(src|href)="(\/img\/[^"]+)"/g, (m, a, u) => `${a}="${dataImg(u)}"`)
      .replace(/srcset="(\/img\/[^"]+)"/g, (m, u) => `srcset="${dataImg(u)}"`);
    pages[rel] = { cls, cat, inner, title: (html.match(/<title>([^<]*)<\/title>/) || [, ''])[1] };
  }
})(DIST);

const index = JSON.parse(fs.readFileSync(path.join(DIST, 'search-index.json'), 'utf8'));
const appJs = fs.readFileSync(path.join(DIST, 'js', 'app.js'), 'utf8');

const ARG = Object.fromEntries(process.argv.slice(2)
  .map(a => a.replace(/^--/, '').split('=')).map(([k, v]) => [k, v ?? '1']));
const START = ARG.route || '/';
const FORCE_NAV = ARG['nav-open'] ? 'true' : 'false';
const OUTFILE = ARG.out || path.join(ROOT, 'preview.html');
const SCROLL = Number(ARG.scroll || 0);

const out = `<!doctype html>
<html lang="ru"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Ercyon — предпросмотр сайта</title>
<style>${fontCss}</style>
<style>${siteCss}</style>
<style>
  .prevbar{position:fixed;left:50%;transform:translateX(-50%);bottom:.6rem;z-index:300;
    display:flex;align-items:center;gap:.5rem;padding:.4rem .5rem .4rem .85rem;border-radius:99px;
    background:rgba(13,33,25,.94);border:1px solid rgba(176,141,74,.5);color:#E9E2CD;
    font:400 .78rem/1.2 "PT Serif",Georgia,serif;box-shadow:0 8px 30px rgba(0,0,0,.5);max-width:92vw}
  .prevbar b{color:#D5B87C;font-weight:400;letter-spacing:.06em;text-transform:uppercase;font-size:.7rem}
  .prevbar button{border:1px solid rgba(176,141,74,.45);border-radius:99px;padding:.28rem .7rem;
    color:#E9E2CD;font:inherit;white-space:nowrap}
  .prevbar button:hover{background:rgba(176,141,74,.2)}
</style>
</head>
<body>
<div id="app"></div>
<div class="prevbar"><b>Предпросмотр</b><button id="pv-home">На главную</button><button id="pv-top">Наверх</button></div>
<script>window.__SEARCH_INDEX__ = ${JSON.stringify(index)};</script>
<script>${appJs.replace(/<\/script>/g, '<\\/script>')}</script>
<script>
(function(){
  var PAGES = ${JSON.stringify(pages)};
  var app = document.getElementById('app');
  var START = ${JSON.stringify(START)}, FORCE_NAV = ${FORCE_NAV}, SCROLL = ${SCROLL};
  function route(){
    var r = decodeURIComponent(location.hash.replace(/^#/,'')) || START;
    if(!PAGES[r] && PAGES[r + '/']) r = r + '/';
    var p = PAGES[r] || PAGES['/'];
    document.body.className = p.cls || '';
    document.body.setAttribute('data-cat', p.cat || '');
    document.title = p.title || 'Ercyon';
    app.innerHTML = p.inner;
    window.ercionInit();
    if(FORCE_NAV){ var b=document.getElementById('burger'); b && b.click(); }
    window.scrollTo(0, SCROLL);
  }
  document.addEventListener('click', function(e){
    var a = e.target.closest && e.target.closest('a');
    if(!a) return;
    var href = a.getAttribute('href') || '';
    if(href.charAt(0) === '#'){ return; }
    if(/^https?:/.test(href)){ a.target='_blank'; return; }
    if(href.charAt(0) === '/'){ e.preventDefault(); location.hash = href; if(location.hash === '#'+href) route(); }
  });
  window.addEventListener('hashchange', route);
  document.getElementById('pv-home').onclick = function(){ location.hash='/'; };
  document.getElementById('pv-top').onclick = function(){ window.scrollTo({top:0,behavior:'smooth'}); };
  route();
})();
</script>
</body></html>`;

fs.writeFileSync(OUTFILE, out, 'utf8');
console.log(`  ${path.basename(OUTFILE)} — ${(Buffer.byteLength(out) / 1024 / 1024).toFixed(2)} МБ, страниц: ${Object.keys(pages).length}`);
