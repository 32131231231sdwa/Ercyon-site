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
    await page.getByText('Страны', { exact: true }).first().click();
    await page.getByText(/Княжество Сребрно/).first().dblclick();
    await page.getByText('Название страны', { exact: true }).first().waitFor();
    const field = key => page.locator(`section.field[data-key-path="${key}"]`).first();
    const openCountry = async () => {
      await page.getByText(/Княжество Сребрно/).first().dblclick();
      await page.getByRole('button', { name: 'Сохранить', exact: true }).waitFor();
    };
    const reachCommanders = async () => {
      await page.mouse.move(Math.min(300, page.viewportSize().width / 2), 500);
      for (let i = 0; i < 20 && !await field('commanders').count(); i++) {
        await page.mouse.wheel(0, 500); await page.waitForTimeout(100);
      }
      await field('commanders').scrollIntoViewIfNeeded();
      if (!await field('commanders').locator('button[aria-controls*="-item-0-body"]').count()) {
        await field('commanders').getByText('Воеводы', { exact: true }).click();
      }
    };
    const openRecord = async index => {
      const button = field('commanders').locator(`button[aria-controls$="-item-${index}-body"]`);
      if (await button.getAttribute('aria-expanded') === 'false') await button.click();
      await field(`commanders.${index}.name`).locator('input').waitFor();
    };
    const choose = async (key, label) => {
      await field(key).getByRole('combobox').click();
      await page.getByRole('option', { name: label, exact: true }).click();
    };
    const readCountry = () => page.evaluate(async () => {
      let dir = await navigator.storage.getDirectory();
      for (const name of ['content', 'countries']) dir = await dir.getDirectoryHandle(name);
      return (await (await dir.getFileHandle('srebrno.md')).getFile()).text();
    });
    const parse = text => yaml.load(text.match(/^---\r?\n([\s\S]*?)\r?\n---/)[1]);
    const save = async predicate => {
      await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
      const deadline = Date.now() + 8000;
      while (Date.now() < deadline) {
        try {
          const data = parse(await readCountry());
          if (predicate(data)) return data;
        } catch (error) {
          if (!error.message.includes('NotFoundError')) throw error;
        }
        await page.waitForTimeout(100);
      }
      console.error('Country files:', await page.evaluate(async () => {
        const root = await navigator.storage.getDirectory();
        const content = await root.getDirectoryHandle('content');
        const countries = await content.getDirectoryHandle('countries');
        const files = [];
        for await (const [name] of countries.entries()) files.push(name);
        return files;
      }));
      throw new Error('Сохранение воеводы не завершилось');
    };
    const original = parse(fixtures.find(([rel]) => rel === 'content/countries/srebrno.md')[1]);
    await reachCommanders(); await openRecord(0);
    await field('commanders.0.name').locator('input').fill('Проверочный воевода');
    await choose('commanders.0.level', '0 — Без генерала / Толпа (навык 0)');
    await choose('commanders.0.status', 'Ранен');
    let data = await save(value => value.commanders[0].name === 'Проверочный воевода' && value.commanders[0].status === 'wounded');
    assert.equal(data.commanders[0].level, 0);
    for (const key of ['title', 'resources', 'army', 'equipment', 'resource_stock']) assert.deepEqual(data[key], original[key]);
    console.log('PASS существующий воевода: раскрытие, уровень 0, смена состояния и сохранение');

    await page.reload();
    await openCountry();
    await reachCommanders(); await openRecord(0);
    assert.equal(await field('commanders.0.name').locator('input').inputValue(), 'Проверочный воевода');
    assert.match(await field('commanders.0.status').getByRole('combobox').innerText(), /Ранен/);
    await choose('commanders.0.level', '5 — Легендарный стратег (навык 50)');
    await choose('commanders.0.status', 'Не указано');
    data = await save(value => value.commanders[0].level === 5 && !value.commanders[0].status);
    console.log('PASS обновление страницы: повторное редактирование и очистка состояния');

    await page.waitForURL(/#\/collections\/countries$/); await openCountry();
    await reachCommanders();
    await field('commanders').getByRole('button', { name: /Добавить.*воеводу/ }).click();
    await openRecord(1);
    await field('commanders.1.name').locator('input').fill('Второй проверочный воевода');
    data = await save(value => value.commanders.length === original.commanders.length + 1);
    assert.equal(data.commanders[1].name, 'Второй проверочный воевода');
    assert.ok(data.commanders[1].level === undefined || data.commanders[1].level === '');
    assert.ok(!data.commanders[1].status);
    console.log('PASS новый воевода сохраняется без неизвестного уровня и состояния');

    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload(); await openCountry();
    await reachCommanders(); await openRecord(0);
    await choose('commanders.0.status', 'В строю');
    await save(value => value.commanders[0].status === 'active');
    assert.deepEqual(errors, []);
    if (process.env.SCREENSHOT_DIR) {
      fs.mkdirSync(process.env.SCREENSHOT_DIR, { recursive: true });
      await page.screenshot({ path: path.join(process.env.SCREENSHOT_DIR, 'admin-commanders-mobile.png') });
    }
    console.log('PASS мобильная панель: воеводы редактируются после обновления, ошибок JavaScript нет');
  } finally {
    await browser?.close(); server.close(); server.closeAllConnections();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
