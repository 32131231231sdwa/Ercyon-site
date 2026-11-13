import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { prepareSettings, root } from './settings.mjs';
import { parseAdmins } from '../src/domain.js';

async function main() {
  const values = prepareSettings();
  if (!/^\d+:[A-Za-z0-9_-]{20,}$/.test(values.BOT_TOKEN)) throw new Error('Добавьте API-токен бота из BotFather в поле BOT_TOKEN файла bot/.dev.vars.');
  if (values.ADMIN_IDS && !parseAdmins(values.ADMIN_IDS).length) throw new Error('ADMIN_IDS должен содержать до пяти числовых Telegram ID через запятую, либо быть пустым.');
  for (const key of ['WEBHOOK_SECRET', 'SETUP_CODE']) if (!/^[A-Za-z0-9_-]{16,64}$/.test(values[key])) throw new Error('Неверный формат ' + key + ' в .dev.vars.');

  const redact = text => Object.values(values).filter(value => value && value.length > 16)
    .reduce((result, value) => result.replaceAll(value, '[hidden]'), String(text));
  const api = async (method, payload = {}) => {
    let response;
    try {
      response = await fetch('https://api.telegram.org/bot' + values.BOT_TOKEN + '/' + method, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
        signal: AbortSignal.timeout(20_000),
      });
    } catch { throw new Error('Не удалось подключиться к Telegram. Повторите запуск позже.'); }
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error('Telegram: ' + redact(data.description || response.status));
    return data.result;
  };
  const identity = await api('getMe');
  if (!identity.is_bot || !identity.username) throw new Error('Telegram не подтвердил, что токен принадлежит боту.');
  console.log('Подключаем @' + identity.username + '.');

  const bin = path.join(root, 'node_modules/wrangler/bin/wrangler.js');
  if (!fs.existsSync(bin)) throw new Error('Сначала установите зависимости: npm install в папке bot.');
  const env = { ...process.env, CI: 'true', WRANGLER_SEND_METRICS: 'false',
    ...(values.CLOUDFLARE_ACCOUNT_ID ? { CLOUDFLARE_ACCOUNT_ID: values.CLOUDFLARE_ACCOUNT_ID } : {}) };
  const run = (args, input) => {
    const result = spawnSync(process.execPath, [bin, ...args], {
      cwd: root, encoding: 'utf8', input, env, timeout: 180_000, maxBuffer: 8 * 1024 * 1024,
    });
    if (result.error || result.status !== 0) throw new Error('Wrangler ' + args.slice(0, 2).join(' ') + ': ' + redact(result.stderr || result.stdout || 'команда не выполнена'));
    return result.stdout;
  };
  const account = run(['whoami']);
  if (/not authenticated|not logged in/i.test(account)) throw new Error('Нужен вход в Cloudflare. Выполните npm run login в папке bot, затем повторите npm run deploy.');

  const configFile = path.join(root, 'wrangler.json');
  const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
  config.vars.BOT_USERNAME = identity.username;
  const binding = config.d1_databases[0];
  if (binding.database_id === '00000000-0000-0000-0000-000000000000') {
    console.log('Подготавливаю базу D1.');
    const databases = JSON.parse(run(['d1', 'list', '--json']));
    const existing = databases.find(database => database.name === binding.database_name);
    if (existing) binding.database_id = existing.uuid || existing.id;
    else {
      const output = run(['d1', 'create', binding.database_name]);
      const match = output.match(/"database_id"\s*:\s*"([a-f0-9-]{36})"|database_id\s*=\s*"([a-f0-9-]{36})"|"uuid"\s*:\s*"([a-f0-9-]{36})"/i);
      if (!match) throw new Error('База создана, но Wrangler не вернул её ID в ожидаемом формате. Выполните wrangler d1 list --json и добавьте ID в wrangler.json.');
      binding.database_id = match[1] || match[2] || match[3];
    }
  }
  fs.writeFileSync(configFile, JSON.stringify(config, null, 2) + '\n');
  console.log('Применяю миграции и размещаю Worker.');
  run(['d1', 'migrations', 'apply', binding.binding, '--remote']);
  const deployed = run(['deploy']);
  const urls = deployed.match(/https:\/\/[a-z0-9.-]+\.workers\.dev/gi);
  if (!urls?.length) throw new Error('Worker размещён, но его адрес не найден. Проверьте вывод wrangler deploy.');
  const workerUrl = urls.at(-1);
  run(['secret', 'bulk'], JSON.stringify({
    BOT_TOKEN: values.BOT_TOKEN, WEBHOOK_SECRET: values.WEBHOOK_SECRET, SETUP_CODE: values.SETUP_CODE, ADMIN_IDS: values.ADMIN_IDS,
  }));

  console.log('Настраиваю команды и вебхук Telegram.');
  await api('setMyCommands', { commands: [
    { command: 'start', description: 'Открыть меню' }, { command: 'rules', description: 'Правила и сайт' },
    { command: 'apply', description: 'Подать анкету' }, { command: 'status', description: 'Статус моей анкеты' },
    { command: 'calendar', description: 'Игровой календарь' }, { command: 'roll', description: 'Бросить d100' },
    { command: 'cancel', description: 'Отменить заполнение' },
  ] });
  await api('setWebhook', { url: workerUrl + '/webhook', secret_token: values.WEBHOOK_SECRET,
    max_connections: 1, allowed_updates: ['message', 'callback_query'], drop_pending_updates: false });
  const webhook = await api('getWebhookInfo');
  if (webhook.url !== workerUrl + '/webhook') throw new Error('Telegram не подтвердил нужный адрес вебхука.');
  const health = await fetch(workerUrl + '/health', { signal: AbortSignal.timeout(20_000) });
  if (!health.ok || !(await health.json()).configured) throw new Error('Worker отвечает, но настройки пока не применились. Повторите запуск через минуту.');

  const adminLink = 'https://t.me/' + identity.username + (values.ADMIN_IDS ? '?start=admin' : '?start=' + values.SETUP_CODE);
  const directory = path.join(root, '.wrangler');
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, 'ADMIN-START.md'),
    '# Подключение администратора\n\n[Открыть @' + identity.username + '](' + adminLink + ')\n\n' +
    (values.ADMIN_IDS ? 'Нажмите Start в Telegram. Доступ имеют указанные в ADMIN_IDS пользователи.\n' :
      'Нажмите Start в Telegram. Эта ссылка подключает первого администратора и срабатывает один раз. Передайте её только куратору.\n') +
    '\nЗатем откройте «Админ-панель» → «Настроить календарь». Год 1601 установлен; отсчёт на паузе.\n');
  console.log('Бот размещён: ' + workerUrl);
  console.log('Ссылка администратора сохранена локально: bot/.wrangler/ADMIN-START.md');
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
