/* Проверка настоящей Sveltia CMS на копии контента в хранилище браузера. */
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..'), dist = path.join(root, 'dist');
const prefix = (process.env.BASE_PATH || '').replace(/\/$/, '');
const fixtures = [];
const walk = dir => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(file);
    else fixtures.push([path.relative(root, file).split(path.sep).join('/'), fs.readFileSync(file, 'utf8')]);
  }
};
walk(path.join(root, 'content'));
fixtures.push(['admin/config.yml', fs.readFileSync(path.join(root, 'admin/config.yml'), 'utf8')]);
const mime = { '.html': 'text/html; charset=utf-8', '.yml': 'text/yaml; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png', '.webp': 'image/webp', '.jpeg': 'image/jpeg' };

(async () => {
  const yaml = (await import('../vendor/js-yaml.mjs')).default;
  const admin = fs.readFileSync(path.join(dist, 'admin/index.html'), 'utf8');
  const source = admin.match(/src="(https:\/\/cdn\.jsdelivr\.net\/npm\/@sveltia\/cms@[^\"]+\/dist\/sveltia-cms\.js)"/)[1];
  let cms;
  if (process.env.CMS_SCRIPT_FILE) cms = fs.readFileSync(process.env.CMS_SCRIPT_FILE);
  else {
    const response = await fetch(source, { signal: AbortSignal.timeout(30000) });
    assert.ok(response.ok, 'Не удалось загрузить ' + source);
    cms = Buffer.from(await response.arrayBuffer());
  }
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (!url.pathname.startsWith(prefix + '/')) { res.writeHead(404).end(); return; }
    const route = decodeURIComponent(url.pathname.slice(prefix.length));
    if (route === '/sveltia-cms.js') { res.setHeader('Content-Type', mime['.js']); res.end(cms); return; }
    let file = path.resolve(dist, '.' + route);
    if (file !== dist && !file.startsWith(dist + path.sep)) { res.writeHead(403).end(); return; }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    if (!fs.existsSync(file)) { res.writeHead(404).end(); return; }
    if (mime[path.extname(file)]) res.setHeader('Content-Type', mime[path.extname(file)]);
    res.end(file === path.join(dist, 'admin/index.html')
      ? admin.replace(source, prefix + '/sveltia-cms.js') : fs.readFileSync(file));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'ru-RU' });
    // Native handles can be cached by the CMS in IndexedDB. Only this disposable
    // browser context's origin-private file system receives writes.
    await context.addInitScript(({ fixtures }) => {
      FileSystemHandle.prototype.requestPermission = async () => 'granted';
      FileSystemHandle.prototype.queryPermission = async () => 'granted';
      let ready;
      window.showDirectoryPicker = () => ready ||= (async () => {
        const dir = await navigator.storage.getDirectory();
        await dir.getDirectoryHandle('.git', { create: true });
        for (const [rel, content] of fixtures) {
          const parts = rel.split('/'); let parent = dir;
          for (const name of parts.slice(0, -1)) parent = await parent.getDirectoryHandle(name, { create: true });
          const handle = await parent.getFileHandle(parts.at(-1), { create: true });
          const stream = await handle.createWritable(); await stream.write(content); await stream.close();
        }
        return dir;
      })();
    }, { fixtures });
    const page = await context.newPage(), errors = [];
    page.setDefaultTimeout(8000);
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') console.error('CMS:', message.text().slice(0, 400)); });
    const base = `http://127.0.0.1:${server.address().port}${prefix}`;
    await page.goto(base + '/admin/', { waitUntil: 'load' });
    await page.getByRole('button', { name: /локальным репозиторием/i }).click();
    await page.getByText('Правила и механики', { exact: true }).first().click();
    const openPage = async () => {
      await page.getByText(/Исследования/).first().dblclick();
      await page.getByText('Заголовок', { exact: true }).first().waitFor();
    };
    const field = key => page.locator('section.field[data-key-path="' + key + '"]').first();
    const readPage = () => page.evaluate(async () => {
      let dir = await navigator.storage.getDirectory();
      for (const name of ['content', 'pages']) dir = await dir.getDirectoryHandle(name);
      return (await (await dir.getFileHandle('research.md')).getFile()).text();
    });
    const parse = text => {
      const parts = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
      return { front: yaml.load(parts[1]), body: parts[2] };
    };
    const save = async predicate => {
      await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
      const deadline = Date.now() + 10000;
      let lastSaved;
      while (Date.now() < deadline) {
        try {
          const data = parse(await readPage());
          lastSaved = data;
          if (predicate(data)) return data;
        } catch (error) {
          if (!/NotFoundError|NotReadableError/.test(error.message)) throw error;
        }
        await page.waitForTimeout(100);
      }
      console.error('Invalid fields:', await page.locator('[aria-invalid="true"]').evaluateAll(items => items.map(e => e.closest('[data-key-path]')?.dataset.keyPath)));
      console.error('Last saved technical page:', lastSaved);
      console.error('Editor DOM:', await field('body').locator('[contenteditable="true"]').evaluateAll(items=>items.map(e=>({tag:e.tagName,className:e.className,text:e.textContent}))));
      throw new Error('Сохранение технической страницы не завершилось');
    };
    await openPage();
    const original = parse(fixtures.find(([rel]) => rel === 'content/pages/research.md')[1]);
    const summary = 'Проверочное описание исследования после обновления.';
    const body = 'Проверочная механика редактора. Исследования сохраняются после обновления страницы.';
    await field('summary').locator('textarea').fill(summary);
    await field('body').scrollIntoViewIfNeeded();
    await field('body').locator('[contenteditable="true"]').first().fill(body);
    // Lexical обновляет сохраняемый Markdown асинхронно после ввода текста.
    await page.waitForTimeout(500);
    const data = await save(value => value.front.summary === summary && value.body.includes(body));
    for (const key of ['title', 'category', 'slug', 'order', 'section_home']) assert.deepEqual(data.front[key], original.front[key]);
    console.log('PASS описание и текст технической страницы сохраняются');

    await page.reload(); await openPage();
    assert.equal(await field('summary').locator('textarea').inputValue(), summary);
    assert.ok((await field('body').innerText()).includes(body));
    console.log('PASS после обновления страницы редактор повторно открывает сохранённый текст');

    await page.setViewportSize({ width: 390, height: 844 });
    await field('summary').scrollIntoViewIfNeeded();
    const mobileSummary = 'Мобильная проверка: правила и механики доступны в редакторе.';
    await field('summary').locator('textarea').fill(mobileSummary);
    await save(value => value.front.summary === mobileSummary && value.body.includes(body));
    await page.reload(); await openPage();
    assert.equal(await field('summary').locator('textarea').inputValue(), mobileSummary);
    assert.equal(await page.locator('section.field[data-key-path="map_points"]').count(), 0);
    assert.deepEqual(errors, []);
    if (process.env.SCREENSHOT_DIR) {
      fs.mkdirSync(process.env.SCREENSHOT_DIR, { recursive: true });
      await page.screenshot({ path: path.join(process.env.SCREENSHOT_DIR, 'admin-mechanics-mobile.png') });
    }
    console.log('PASS мобильная панель сохраняет техническую страницу без ошибок JavaScript');
  } finally {
    await browser?.close(); server.close(); server.closeAllConnections();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
