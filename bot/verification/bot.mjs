import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { createWorker } from '../src/worker.js';
import { Store } from '../src/db.js';
import { YEAR_MS, changeCalendar, readCalendar, rollD100 } from '../src/domain.js';

class Statement {
  constructor(db, sql, values = []) { this.db = db; this.query = sql; this.values = values; }
  bind(...values) { return new Statement(this.db, this.query, values); }
  async first(column) {
    const row = this.db.prepare(this.query).get(...this.values);
    return row ? (column ? row[column] : { ...row }) : null;
  }
  async all() { return { results: this.db.prepare(this.query).all(...this.values).map(row => ({ ...row })), success: true }; }
  async run() {
    const result = this.db.prepare(this.query).run(...this.values);
    return { success: true, meta: { changes: Number(result.changes), last_row_id: Number(result.lastInsertRowid) } };
  }
}
class D1 {
  constructor() {
    this.sqlite = new DatabaseSync(':memory:');
    this.sqlite.exec(fs.readFileSync(new URL('../migrations/0001_initial.sql', import.meta.url), 'utf8'));
  }
  prepare(sql) { return new Statement(this.sqlite, sql); }
  async batch(statements) {
    this.sqlite.exec('BEGIN');
    try {
      const results = [];
      // A D1 batch is one atomic database operation, with no client-side yields between statements.
      for (const statement of statements) {
        const result = this.sqlite.prepare(statement.query).run(...statement.values);
        results.push({ success: true, meta: { changes: Number(result.changes), last_row_id: Number(result.lastInsertRowid) } });
      }
      this.sqlite.exec('COMMIT');
      return results;
    } catch (error) { this.sqlite.exec('ROLLBACK'); throw error; }
  }
}

function fixture({ admins = '7,8', response, random } = {}) {
  const db = new D1(), sent = [];
  let now = Date.parse('2026-11-14T09:00:00Z'), serial = 1, randomCalls = 0;
  const env = { DB: db, BOT_TOKEN: '123456:TEST_ONLY_NOT_A_TOKEN', WEBHOOK_SECRET: 'test-webhook-secret',
    SETUP_CODE: 'test-setup-code', ADMIN_IDS: admins, BOT_USERNAME: 'ercyon_test_bot' };
  const worker = createWorker({ now: () => now, uuid: () => `00000000-0000-4000-8000-${String(serial++).padStart(12, '0')}`,
    random: buffer => { randomCalls++; buffer[0] = random ?? 62; },
    fetch: async (url, options) => {
      const request = { method: url.split('/').at(-1), ...JSON.parse(options.body) };
      sent.push(request);
      const result = response?.(request, sent.length) || { status: 200, body: { ok: true, result: { message_id: sent.length } } };
      return new Response(JSON.stringify(result.body), { status: result.status });
    },
  });
  let updateId = 100;
  const post = async (update, secret = env.WEBHOOK_SECRET) => {
    const pending = [];
    const request = new Request('https://example.test/webhook', { method: 'POST', headers: {
      'Content-Type': 'application/json', 'X-Telegram-Bot-Api-Secret-Token': secret,
    }, body: JSON.stringify(update) });
    const result = await worker.fetch(request, env, { waitUntil: promise => pending.push(promise) });
    await Promise.all(pending);
    return result;
  };
  const message = (text, user = 1, chat = { id: user, type: 'private' }, extra = {}) => ({
    update_id: updateId++, message: { message_id: updateId, from: { id: user, first_name: 'Игрок ' + user }, chat, text, ...extra },
  });
  const callback = (data, user = 7, chat = { id: user, type: 'private' }) => ({ update_id: updateId++, callback_query: {
    id: 'query-' + updateId, data, from: { id: user, first_name: 'Игрок ' + user },
    message: { message_id: 50, chat },
  } });
  const get = (sql, ...values) => ({ ...db.sqlite.prepare(sql).get(...values) });
  const rows = (sql, ...values) => db.sqlite.prepare(sql).all(...values).map(row => ({ ...row }));
  const fill = async (user = 1) => {
    for (const value of ['/apply', 'Иван <&>', 'Страна ' + user, 'Союз хлебных городов, ищущий безопасный путь к морю.']) assert.equal((await post(message(value, user))).status, 200);
    const session = JSON.parse(get('SELECT payload FROM sessions WHERE user_id = ?', user).payload);
    assert.equal(session.stage, 3);
    await post(callback('form:submit:' + session.nonce, user));
    return get('SELECT * FROM applications WHERE user_id = ?', user);
  };
  return { db, env, worker, sent, post, message, callback, get, rows, fill,
    advance: ms => { now += ms; }, time: () => now, randomCalls: () => randomCalls };
}

test('webhook rejects an invalid secret before changing data or calling Telegram', async () => {
  const f = fixture();
  const result = await f.post(f.message('/admin'), 'wrong');
  assert.equal(result.status, 403);
  assert.equal(f.sent.length, 0);
  assert.equal(f.get('SELECT COUNT(*) AS n FROM updates').n, 0);
  const health = await f.worker.fetch(new Request('https://example.test/health'), f.env);
  assert.ok(!(await health.text()).includes(f.env.BOT_TOKEN));
});

test('short application persists all fields, escapes HTML, and notifies administrators once', async () => {
  const f = fixture(), app = await f.fill();
  assert.equal(app.player_name, 'Иван <&>');
  assert.equal(app.country_name, 'Страна 1');
  assert.equal(app.status, 'pending');
  assert.equal(f.get('SELECT COUNT(*) AS n FROM sessions').n, 0);
  assert.equal(f.sent.filter(m => m.method === 'sendMessage' && [7, 8].includes(m.chat_id)).length, 2);
  assert.ok(f.sent.some(m => m.text?.includes('Иван &lt;&amp;&gt;')));
  assert.ok(!f.sent.some(m => m.text?.includes('Иван <&>')));
  await f.post(f.message('/apply'));
  assert.equal(f.get('SELECT COUNT(*) AS n FROM applications').n, 1);
  assert.equal(f.get('SELECT COUNT(*) AS n FROM sessions').n, 0);
});

test('a replaced form nonce cannot submit a new or another player’s draft', async () => {
  const f = fixture();
  await f.post(f.message('/apply'));
  const old = JSON.parse(f.get('SELECT payload FROM sessions WHERE user_id = 1').payload).nonce;
  await f.post(f.message('/apply'));
  await f.post(f.callback('form:submit:' + old, 1));
  assert.equal(f.get('SELECT COUNT(*) AS n FROM applications').n, 0);
  assert.ok(f.sent.at(-1).show_alert);
  await f.post(f.callback('form:cancel:' + old, 2));
  assert.equal(f.get('SELECT COUNT(*) AS n FROM sessions WHERE user_id = 1').n, 1);
});

test('text length validation and cancellation leave no half-submitted application', async () => {
  const f = fixture();
  await f.post(f.message('/apply'));
  await f.post(f.message('a'.repeat(101)));
  assert.equal(JSON.parse(f.get('SELECT payload FROM sessions WHERE user_id = 1').payload).stage, 0);
  await f.post(f.message('/cancel'));
  assert.equal(f.get('SELECT COUNT(*) AS n FROM sessions').n, 0);
  assert.equal(f.get('SELECT COUNT(*) AS n FROM applications').n, 0);
});

test('a player or an administrator in a group cannot accept an application', async () => {
  const f = fixture(), app = await f.fill();
  await f.post(f.callback('app:accept:' + app.id, 99));
  assert.equal(f.get('SELECT status FROM applications WHERE id = ?', app.id).status, 'pending');
  assert.equal(f.sent.at(-1).show_alert, true);
  await f.post(f.callback('app:accept:' + app.id, 7, { id: -100, type: 'supergroup' }));
  assert.equal(f.get('SELECT status FROM applications WHERE id = ?', app.id).status, 'pending');
});

test('simultaneous reviews produce one decision and one notification to the player', async () => {
  const f = fixture(), app = await f.fill();
  const before = f.sent.length;
  const results = await Promise.all([f.post(f.callback('app:accept:' + app.id, 7)), f.post(f.callback('app:accept:' + app.id, 8))]);
  assert.ok(results.every(r => r.status === 200));
  const saved = f.get('SELECT * FROM applications WHERE id = ?', app.id);
  assert.equal(saved.status, 'accepted');
  assert.ok([7, 8].includes(saved.reviewer_id));
  assert.equal(f.sent.slice(before).filter(m => m.method === 'sendMessage' && m.chat_id === 1).length, 1);
  await f.post(f.callback('app:accept:' + app.id, 7));
  assert.equal(f.sent.slice(before).filter(m => m.method === 'sendMessage' && m.chat_id === 1).length, 1);
});

test('rejection records a reason and permits a corrected application', async () => {
  const f = fixture(), app = await f.fill();
  await f.post(f.callback('app:reject:' + app.id));
  assert.equal(f.get('SELECT status FROM applications WHERE id = ?', app.id).status, 'pending');
  await f.post(f.message('Уточните <территорию> и цель страны.', 7));
  const saved = f.get('SELECT * FROM applications WHERE id = ?', app.id);
  assert.equal(saved.status, 'rejected');
  assert.equal(saved.review_reason, 'Уточните <территорию> и цель страны.');
  assert.ok(f.sent.some(m => m.chat_id === 1 && m.text?.includes('&lt;территорию&gt;')));
  await f.post(f.message('/apply'));
  assert.equal(JSON.parse(f.get('SELECT payload FROM sessions WHERE user_id = 1').payload).stage, 0);
});

test('admin panel lists application counts and pagination without granting player access', async () => {
  const f = fixture();
  for (let user = 1; user <= 6; user++) await f.fill(user + 100);
  await f.post(f.message('/admin', 7));
  assert.ok(f.sent.at(-1).text.includes('На рассмотрении: 6'));
  await f.post(f.callback('adm:list:pending:0'));
  assert.equal(f.sent.at(-1).reply_markup.inline_keyboard.filter(row => row[0].callback_data.startsWith('app:view:')).length, 5);
  assert.ok(JSON.stringify(f.sent.at(-1)).includes('adm:list:pending:5'));
  await f.post(f.message('/admin', 1));
  assert.ok(!f.sent.at(-1).reply_markup.inline_keyboard);
});

test('d100 uses rejection sampling and includes both endpoints', () => {
  assert.equal(rollD100(buffer => { buffer[0] = 0; }), 1);
  assert.equal(rollD100(buffer => { buffer[0] = 99; }), 100);
  const values = [4_294_967_200, 99];
  assert.equal(rollD100(buffer => { buffer[0] = values.shift(); }), 100);
  assert.equal(values.length, 0);
});

test('a repeated Telegram update reuses the roll and does not send another message', async () => {
  const f = fixture(), update = f.message('/roll', 1, { id: -100, type: 'supergroup' }, { reply_to_message: { message_id: 4 } });
  assert.equal((await f.post(update)).status, 200);
  const count = f.sent.length;
  assert.equal((await f.post(update)).status, 200);
  assert.equal(f.sent.length, count);
  assert.equal(f.randomCalls(), 1);
  assert.equal(f.get('SELECT result FROM rolls').result, 63);
  assert.equal(f.sent[0].reply_parameters.message_id, 4);
  assert.ok(f.sent[0].text.includes('d100: 63'));
  assert.ok(f.sent[0].text.includes('куратор'));
});

test('calendar changes exactly at 48 hours and preserves a partial year while paused', () => {
  const initial = { base_year: 1601, accumulated_ms: 0, anchor_ms: null, running: 0 };
  const started = changeCalendar(initial, 'start', 1000);
  assert.equal(readCalendar(started, 1000 + YEAR_MS - 1).year, 1601);
  assert.equal(readCalendar(started, 1000 + YEAR_MS).year, 1602);
  const paused = changeCalendar(started, 'pause', 1000 + YEAR_MS / 2);
  assert.equal(readCalendar(paused, 1000 + 10 * YEAR_MS).remaining, YEAR_MS / 2);
  const resumed = changeCalendar(paused, 'start', 10 * YEAR_MS);
  assert.equal(readCalendar(resumed, 10 * YEAR_MS + YEAR_MS / 2).year, 1602);
});

test('calendar starts paused, survives a new worker, and rejects player settings', async () => {
  const f = fixture();
  await f.post(f.message('/calendar'));
  assert.ok(f.sent.at(-1).text.includes('1601'));
  assert.ok(f.sent.at(-1).text.includes('паузе'));
  await f.post(f.callback('cal:start', 1));
  assert.equal(f.get('SELECT running FROM calendar').running, 0);
  await f.post(f.callback('cal:start', 7));
  const anchor = f.get('SELECT anchor_ms FROM calendar').anchor_ms;
  f.advance(YEAR_MS + 600_000);
  await f.post(f.message('/calendar'));
  assert.ok(f.sent.at(-1).text.includes('1602'));
  await f.post(f.callback('cal:pause', 7));
  const saved = f.get('SELECT * FROM calendar');
  f.advance(YEAR_MS * 10);
  const restart = createWorker({ now: f.time });
  const health = await restart.fetch(new Request('https://example.test/health'), f.env);
  assert.equal(health.status, 200);
  assert.equal(readCalendar(saved, f.time()).year, 1602);
  await f.post(f.callback('cal:start', 7));
  assert.notEqual(f.get('SELECT anchor_ms FROM calendar').anchor_ms, anchor);
  assert.equal(readCalendar(f.get('SELECT * FROM calendar'), f.time()).year, 1602);
});

test('setting a year validates input, resets its progress, and leaves the calendar paused', async () => {
  const f = fixture();
  await f.post(f.callback('cal:year'));
  await f.post(f.message('0', 7));
  assert.equal(f.get('SELECT base_year FROM calendar').base_year, 1601);
  assert.equal(f.get('SELECT kind FROM sessions WHERE user_id = 7').kind, 'calendar_year');
  await f.post(f.message('1700', 7));
  assert.equal(f.get('SELECT base_year FROM calendar').base_year, 1700);
  assert.equal(f.get('SELECT running FROM calendar').running, 0);
});

test('temporary Telegram errors leave a durable message for a scheduled retry', async () => {
  let first = true;
  const f = fixture({ response: () => {
    if (first) { first = false; return { status: 429, body: { ok: false, parameters: { retry_after: 40 } } }; }
  } });
  await f.post(f.message('/start'));
  assert.equal(f.get('SELECT status FROM updates').status, 'done');
  assert.equal(f.get('SELECT status FROM outbox').status, 'pending');
  f.advance(60_000);
  await f.worker.scheduled({ scheduledTime: f.time() }, f.env);
  assert.equal(f.get('SELECT status FROM outbox').status, 'sent');
  assert.equal(f.sent.length, 2);
});

test('an outbox lease prevents two invocations from delivering the same message concurrently', async () => {
  const f = fixture();
  f.db.sqlite.prepare("INSERT INTO outbox(update_id, sequence, method, payload, created_at) VALUES (1, 0, 'sendMessage', '{}', ?)").run(f.time());
  const store = new Store(f.db);
  let calls = 0;
  const send = async () => { calls++; await Promise.resolve(); return { ok: true }; };
  await Promise.all([store.flush(send, f.time()), store.flush(send, f.time())]);
  assert.equal(calls, 1);
});

test('one-time setup grants the first administrator and cannot be claimed again', async () => {
  const f = fixture({ admins: '' });
  await f.post(f.message('/start wrong-code', 42));
  assert.equal(f.get('SELECT COUNT(*) AS n FROM admins').n, 0);
  await f.post(f.message('/start test-setup-code', 42));
  assert.equal(f.get('SELECT user_id FROM admins').user_id, 42);
  assert.ok(JSON.stringify(f.sent.at(-1).reply_markup).includes('Админ-панель'));
  await f.post(f.message('/start test-setup-code', 43));
  assert.equal(f.get('SELECT COUNT(*) AS n FROM admins').n, 1);
  await f.post(f.message('/admin', 42));
  assert.ok(f.sent.at(-1).text.includes('Админ-панель'));
});

test('a busy update is retried after its processing lease expires', async () => {
  const f = fixture(), update = f.message('/start');
  f.db.sqlite.prepare("INSERT INTO updates(update_id, status, lease_until, created_at) VALUES (?, 'processing', ?, ?)").run(update.update_id, f.time() + 30_000, f.time());
  assert.equal((await f.post(update)).status, 503);
  assert.equal(f.sent.length, 0);
  f.advance(31_000);
  assert.equal((await f.post(update)).status, 200);
  assert.equal(f.sent.length, 1);
});

test('application collection stays private and commands addressed to another bot are ignored', async () => {
  const f = fixture();
  await f.post(f.message('/apply', 1, { id: -100, type: 'supergroup' }));
  assert.equal(f.get('SELECT COUNT(*) AS n FROM sessions').n, 0);
  assert.ok(f.sent.at(-1).text.includes('личном чате'));
  const count = f.sent.length;
  await f.post(f.message('/roll@another_bot', 1, { id: -100, type: 'supergroup' }));
  assert.equal(f.sent.length, count);
});
