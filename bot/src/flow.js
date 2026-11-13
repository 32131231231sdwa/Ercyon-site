import { changeCalendar, esc, isId, readCalendar, rollD100 } from './domain.js';
import * as ui from './ui.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FORM_FIELDS = [
  { key: 'player_name', max: 100, prompt: 'Как вас называть? Напишите имя игрока.' },
  { key: 'country_name', max: 120, prompt: 'Как называется ваша страна?' },
  { key: 'description', max: 2000, prompt: 'Коротко опишите страну и то, чего она добивается. До 2 000 символов.' },
];

export async function buildPlan(update, store, config, now, dependencies) {
  const statements = [], effects = [];
  const message = update.message;
  const callback = update.callback_query;
  const actor = callback?.from || message?.from;
  const chat = callback?.message?.chat || message?.chat;
  const updateId = update.update_id;
  const plan = { statements, effects };
  if (!actor || actor.is_bot || !isId(actor.id) || actor.id < 0) return plan;
  const admin = config.admins.includes(actor.id);
  const privateChat = chat?.type === 'private';
  const menu = ui.keyboard(admin);
  const push = effect => effects.push(effect);
  const say = (text, markup = menu, extra) => push(ui.send(chat.id, text, markup, extra));
  const clearSession = () => statements.push(store.clearSession(actor.id));
  const saveSession = (kind, data) => statements.push(store.saveSession(actor.id, kind, data, now));
  const panel = (content, target = callback) => push(target ? ui.edit(target, content.text, content.markup) : ui.send(chat.id, content.text, content.markup));

  async function requirePrivate() {
    if (privateChat) return true;
    if (isId(chat?.id)) {
      const markup = config.username ? ui.inline([[{ text: 'Открыть бота', url: 'https://t.me/' + config.username }]]) : undefined;
      say('Анкеты и админ-панель доступны в личном чате с ботом.', markup);
    }
    return false;
  }
  function requireAdmin() {
    if (admin && privateChat) return true;
    if (callback) push(ui.answer(callback, 'Доступ только для администрации в личном чате.', true));
    else if (privateChat) say('Эта команда доступна только администрации.');
    return false;
  }
  async function beginForm() {
    if (!(await requirePrivate())) return;
    if (!config.admins.length) { say('Приём анкет ещё не открыт. Попробуйте позже.'); return; }
    const pending = await store.pending(actor.id);
    if (pending) { say(`Анкета страны <b>${esc(pending.country_name)}</b> уже на рассмотрении. Ответ придёт в этот чат.`); return; }
    saveSession('application', { stage: 0, nonce: dependencies.uuid() });
    say('<b>Новая анкета</b>\n\nТри поля: имя, страна и короткое описание.\n\n' + FORM_FIELDS[0].prompt, ui.cancelKeyboard);
  }
  async function showAdmin(target) {
    if (!requireAdmin()) return;
    clearSession();
    panel(ui.adminPanel(await store.counts()), target);
  }
  async function showCalendarAdmin(target) {
    if (!requireAdmin()) return;
    panel(ui.calendarPanel(await store.calendar(), now), target);
  }
  function decision(app, status, reason, target, restoreKeyboard = false) {
    statements.push(store.sql(`UPDATE applications SET status = ?, reviewer_id = ?, review_reason = ?,
      reviewed_at = ?, decision_update_id = ? WHERE id = ? AND status = 'pending'`,
    status, actor.id, reason || null, now, updateId, app.id));
    const condition = { sql: 'EXISTS (SELECT 1 FROM applications WHERE id = ? AND decision_update_id = ?)', params: [app.id, updateId] };
    const reviewed = { ...app, status, review_reason: reason || null };
    if (target) push({ ...ui.edit(target, ui.applicationText(reviewed, true), ui.reviewButtons(reviewed)), condition });
    push({ ...ui.send(app.chat_id,
      status === 'accepted' ? `✅ Анкета страны <b>${esc(app.country_name)}</b> принята куратором.` :
        `Анкета страны <b>${esc(app.country_name)}</b> отклонена.\n\n<b>Причина:</b> ${esc(reason)}\n\nИсправленную анкету можно отправить заново.`,
    ui.keyboard(config.admins.includes(app.user_id))), condition });
    if (restoreKeyboard) say(status === 'accepted' ? 'Анкета принята.' : 'Анкета отклонена, игроку отправлена причина.', menu);
    clearSession();
  }

  if (callback) {
    if (typeof callback.id !== 'string' || !isId(chat?.id) || !callback.message?.message_id) return plan;
    const data = typeof callback.data === 'string' ? callback.data : '';
    const parts = data.split(':');
    if (parts[0] === 'form') {
      if (!privateChat) { push(ui.answer(callback, 'Откройте анкету в личном чате.', true)); return plan; }
      const session = await store.session(actor.id, now);
      if (session?.kind !== 'application' || session.nonce !== parts[2]) {
        push(ui.answer(callback, 'Эта анкета уже отправлена или закрыта. Начните новую через меню.', true));
        return plan;
      }
      push(ui.answer(callback));
      if (parts[1] === 'cancel') { clearSession(); say('Заполнение анкеты отменено.'); return plan; }
      if (parts[1] === 'restart') { await beginForm(); return plan; }
      if (parts[1] !== 'submit' || session.stage !== FORM_FIELDS.length) return plan;
      const pending = await store.pending(actor.id);
      if (pending) { clearSession(); say('Ваша анкета уже на рассмотрении.'); return plan; }
      const app = {
        id: dependencies.uuid(), user_id: actor.id, chat_id: chat.id, username: actor.username || null,
        display_name: [actor.first_name, actor.last_name].filter(Boolean).join(' ') || String(actor.id),
        player_name: session.player_name, country_name: session.country_name, description: session.description,
        status: 'pending',
      };
      statements.push(store.sql(`INSERT INTO applications(id, user_id, chat_id, username, display_name,
        player_name, country_name, description, submitted_update_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT DO NOTHING`, app.id, app.user_id, app.chat_id,
      app.username, app.display_name, app.player_name, app.country_name, app.description, updateId, now));
      clearSession();
      const condition = { sql: 'EXISTS (SELECT 1 FROM applications WHERE id = ? AND submitted_update_id = ?)', params: [app.id, updateId] };
      push({ ...ui.send(chat.id, `Анкета страны <b>${esc(app.country_name)}</b> отправлена на рассмотрение. Ответ придёт сюда.`, menu), condition });
      for (const adminId of config.admins) push({ ...ui.send(adminId, ui.applicationText(app, true), ui.reviewButtons(app)), condition });
      push(ui.edit(callback, ui.applicationText(app, false) + '\n\n<b>Отправлена на рассмотрение.</b>', ui.inline([])));
      return plan;
    }
    if (!['adm', 'app', 'cal'].includes(parts[0])) { push(ui.answer(callback, 'Кнопка устарела. Откройте меню заново.')); return plan; }
    if (!requireAdmin()) return plan;
    push(ui.answer(callback));
    if (parts[0] === 'adm') {
      if (parts[1] === 'home') await showAdmin(callback);
      else if (parts[1] === 'list' && Object.hasOwn(ui.STATUS, parts[2]) && /^\d{1,6}$/.test(parts[3] || '')) {
        const offset = Number(parts[3]);
        panel(ui.queuePanel(await store.list(parts[2], offset), parts[2], offset));
      }
    } else if (parts[0] === 'app' && UUID.test(parts[2] || '')) {
      const app = await store.application(parts[2]);
      if (!app) { panel({ text: 'Анкета не найдена.', markup: ui.backToAdmin }); return plan; }
      if (parts[1] === 'view' || app.status !== 'pending') {
        panel({ text: ui.applicationText(app, true), markup: ui.reviewButtons(app) });
      } else if (parts[1] === 'accept') decision(app, 'accepted', null, callback);
      else if (parts[1] === 'reject') {
        saveSession('reject', { id: app.id, chatId: chat.id, messageId: callback.message.message_id });
        say(`Почему отклоняем анкету страны <b>${esc(app.country_name)}</b>? Напишите причину до 800 символов. Игрок получит этот текст.`, ui.cancelKeyboard);
      }
    } else if (parts[0] === 'cal') {
      if (parts[1] === 'home') await showCalendarAdmin(callback);
      else if (parts[1] === 'year') {
        saveSession('calendar_year', {});
        say('Введите игровой год, например 1601. Отсчёт будет поставлен на паузу; запустить его можно из меню календаря.', ui.cancelKeyboard);
      } else if (['start', 'pause'].includes(parts[1])) {
        const row = await store.calendar();
        const next = changeCalendar(row, parts[1], now);
        statements.push(store.sql(`UPDATE calendar SET base_year = ?, accumulated_ms = ?, anchor_ms = ?,
          running = ?, version = version + 1, updated_at = ?, last_update_id = ? WHERE id = 1 AND version = ?`,
        next.base_year, next.accumulated_ms, next.anchor_ms, next.running, now, updateId, row.version));
        const content = ui.calendarPanel(next, now);
        push({ ...ui.edit(callback, content.text, content.markup),
          condition: { sql: 'EXISTS (SELECT 1 FROM calendar WHERE id = 1 AND last_update_id = ?)', params: [updateId] } });
      }
    }
    return plan;
  }

  if (!message || !isId(chat?.id)) return plan;
  const text = typeof message.text === 'string' ? message.text.trim() : '';
  const commandMatch = text.match(/^\/([a-z0-9_]+)(?:@([a-z0-9_]+))?(?:\s+([\s\S]*))?$/i);
  if (commandMatch?.[2] && config.username && commandMatch[2].toLowerCase() !== config.username.toLowerCase()) return plan;
  const command = commandMatch?.[1].toLowerCase();
  const argument = commandMatch?.[3] || '';

  if (command === 'start' && privateChat && !config.admins.length && config.setupCode && dependencies.sameSecret(argument, config.setupCode)) {
    statements.push(store.sql('INSERT INTO admins(user_id, created_at) SELECT ?, ? WHERE NOT EXISTS (SELECT 1 FROM admins)', actor.id, now));
    push({ ...ui.send(chat.id, 'Вы подключены как администратор Эрциона. Здесь можно рассматривать анкеты и управлять календарём.', ui.keyboard(true)),
      condition: { sql: 'EXISTS (SELECT 1 FROM admins WHERE user_id = ?)', params: [actor.id] } });
    return plan;
  }
  if (command === 'start' || command === 'help') {
    if (!privateChat) { say('Команды в группе: /roll — d100, /calendar — игровой календарь.', undefined); return plan; }
    clearSession();
    say('<b>Эрцион</b>\n\nЗдесь можно подать анкету, посмотреть игровой год и бросить d100.\n\n' +
      '/status — состояние вашей анкеты\n/cancel — отменить заполнение' + (admin ? '\n/admin — админ-панель' : ''));
    return plan;
  }
  if (command === 'id') { if (privateChat) say(`Ваш Telegram ID: <code>${actor.id}</code>`); return plan; }
  if (command === 'cancel' || text === ui.BUTTONS.cancel) { if (privateChat) { clearSession(); say('Действие отменено.'); } return plan; }
  if (command === 'rules' || text === ui.BUTTONS.rules) { say('Правила, механики и материалы Эрциона:', ui.rules(config.site)); return plan; }
  if (command === 'apply' || text === ui.BUTTONS.apply) { await beginForm(); return plan; }
  if (command === 'status') {
    if (!(await requirePrivate())) return plan;
    const app = await store.latest(actor.id);
    say(app ? `<b>${esc(app.country_name)}</b>\nСтатус: ${ui.STATUS[app.status]}` +
      (app.review_reason ? `\nПричина: ${esc(app.review_reason)}` : '') : 'Вы пока не отправляли анкету. Начать можно кнопкой «Подать анкету».');
    return plan;
  }
  if (command === 'calendar' || text === ui.BUTTONS.calendar) { say(ui.calendarText(await store.calendar(), now), privateChat ? menu : undefined); return plan; }
  if (command === 'roll' || command === 'd100' || text === ui.BUTTONS.roll) {
    const existing = await store.roll(updateId);
    const result = existing?.result || rollD100(dependencies.random);
    const source = message.reply_to_message?.message_id || message.message_id;
    statements.push(store.sql('INSERT OR IGNORE INTO rolls(update_id, user_id, chat_id, source_message_id, result, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      updateId, actor.id, chat.id, source || null, result, now));
    say(`🎲 <b>d100: ${result}</b>\n\nРезультат действия определяет куратор.`, privateChat ? menu : undefined,
      isId(source) ? { reply_parameters: { message_id: source, allow_sending_without_reply: true } } : {});
    return plan;
  }
  if (command === 'admin' || text === ui.BUTTONS.admin) { await showAdmin(null); return plan; }
  if (!privateChat) return plan;
  if (commandMatch) { say('Команда не найдена. Откройте /help или выберите кнопку меню.'); return plan; }
  const session = await store.session(actor.id, now);
  if (session?.kind === 'application') {
    const field = FORM_FIELDS[session.stage];
    if (!field) { say('Проверьте анкету выше и нажмите «Отправить анкету».', ui.cancelKeyboard); return plan; }
    if (!text || Array.from(text).length > field.max) { say(`Нужен текст от 1 до ${field.max} символов.\n\n${field.prompt}`, ui.cancelKeyboard); return plan; }
    const next = { ...session, [field.key]: text, stage: session.stage + 1 };
    delete next.kind;
    saveSession('application', next);
    if (next.stage < FORM_FIELDS.length) say(FORM_FIELDS[next.stage].prompt, ui.cancelKeyboard);
    else say(ui.applicationText(next), ui.previewButtons(next.nonce));
  } else if (session?.kind === 'reject' && admin) {
    if (!text || Array.from(text).length > 800) { say('Напишите причину отклонения от 1 до 800 символов.', ui.cancelKeyboard); return plan; }
    const app = await store.application(session.id);
    if (!app || app.status !== 'pending') { clearSession(); say('Анкета уже рассмотрена другим администратором.'); return plan; }
    const target = { message: { chat: { id: session.chatId }, message_id: session.messageId } };
    decision(app, 'rejected', text, target, true);
  } else if (session?.kind === 'calendar_year' && admin) {
    if (!/^\d{1,4}$/.test(text) || Number(text) < 1) { say('Введите целый игровой год от 1 до 9999, например 1601.', ui.cancelKeyboard); return plan; }
    const row = await store.calendar(), next = changeCalendar(row, 'year', now, Number(text));
    statements.push(store.sql(`UPDATE calendar SET base_year = ?, accumulated_ms = 0, anchor_ms = NULL,
      running = 0, version = version + 1, updated_at = ?, last_update_id = ? WHERE id = 1 AND version = ?`,
    next.base_year, now, updateId, row.version));
    clearSession();
    say('Игровой год установлен. Календарь на паузе.');
    const content = ui.calendarPanel(next, now);
    push({ ...ui.send(chat.id, content.text, content.markup),
      condition: { sql: 'EXISTS (SELECT 1 FROM calendar WHERE id = 1 AND last_update_id = ?)', params: [updateId] } });
  } else say('Выберите кнопку меню. Для новой анкеты — /apply, для календаря — /calendar, для кубика — /roll.');
  return plan;
}
