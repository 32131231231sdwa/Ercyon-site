import { Store } from './db.js';
import { parseAdmins, sameSecret } from './domain.js';
import { buildPlan } from './flow.js';
import { telegramClient } from './telegram.js';

const text = (body, status = 200) => new Response(body, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });

export function createWorker(options = {}) {
  const clock = options.now || Date.now;
  const dependencies = { uuid: options.uuid || (() => crypto.randomUUID()), random: options.random, sameSecret };
  const client = env => telegramClient(env.BOT_TOKEN, options.fetch || fetch);
  const config = async (env, store) => ({
    admins: [...new Set([...parseAdmins(env.ADMIN_IDS), ...await store.admins()])].slice(0, 5),
    site: String(env.SITE_URL || 'https://32131231231sdwa.github.io/Ercyon-site').replace(/\/+$/, ''),
    username: String(env.BOT_USERNAME || '').replace(/^@/, ''),
    setupCode: env.SETUP_CODE || '',
  });
  const deliver = async (store, env, now, updateId, context) => {
    const pending = store.flush(client(env), now, updateId).catch(() => console.error('telegram_delivery_failed'));
    if (context?.waitUntil) context.waitUntil(pending);
    else await pending;
  };
  return {
    async fetch(request, env, context) {
      const url = new URL(request.url);
      if (request.method === 'GET' && (url.pathname === '/' || url.pathname === '/health')) {
        return Response.json({ service: 'Ercyon Telegram bot', configured: Boolean(env.DB && env.BOT_TOKEN && env.WEBHOOK_SECRET) });
      }
      if (url.pathname !== '/webhook' || request.method !== 'POST') return text('Not found', 404);
      if (!sameSecret(request.headers.get('X-Telegram-Bot-Api-Secret-Token'), env.WEBHOOK_SECRET)) return text('Forbidden', 403);
      if (!env.DB || !env.BOT_TOKEN) return text('Not configured', 503);
      let update;
      try {
        if (Number(request.headers.get('Content-Length')) > 100_000) return text('Too large', 413);
        const body = await request.text();
        if (body.length > 100_000) return text('Too large', 413);
        update = JSON.parse(body);
      } catch { return text('Invalid JSON', 400); }
      if (!update || !Number.isSafeInteger(update.update_id) || update.update_id < 0) return text('Invalid update', 400);
      const store = new Store(env.DB), now = clock();
      try {
        const state = await store.claim(update.update_id, now);
        if (state === 'busy') return text('Retry later', 503);
        if (state === 'claimed') {
          const settings = await config(env, store);
          const plan = await buildPlan(update, store, settings, now, dependencies);
          await store.commit(update.update_id, plan.statements, plan.effects, now);
        }
        await deliver(store, env, now, update.update_id, context);
        return text('OK');
      } catch {
        await store.release(update.update_id).catch(() => {});
        console.error('telegram_update_failed', update.update_id);
        return text('Temporary failure', 500);
      }
    },
    async scheduled(event, env) {
      if (!env.DB || !env.BOT_TOKEN) return;
      const store = new Store(env.DB), now = event.scheduledTime || clock();
      await store.flush(client(env), now);
      const date = new Date(now);
      if (date.getUTCHours() === 0 && date.getUTCMinutes() === 0) await store.cleanup(now);
    },
  };
}

export default createWorker();
