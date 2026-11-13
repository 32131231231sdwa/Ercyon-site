import { esc, readCalendar } from './domain.js';

export const BUTTONS = {
  rules: '📚 Правила и сайт', apply: '📝 Подать анкету', calendar: '🗓 Календарь',
  roll: '🎲 Кубик d100', admin: '⚙️ Админ-панель', cancel: '❌ Отмена',
};
export const STATUS = { pending: 'На рассмотрении', accepted: 'Принята', rejected: 'Отклонена' };
const button = (text, callback_data) => ({ text, callback_data });
const shorten = (text, count = 55) => Array.from(text).slice(0, count).join('');

export const keyboard = admin => ({ keyboard: [
  [{ text: BUTTONS.rules }, { text: BUTTONS.apply }],
  [{ text: BUTTONS.calendar }, { text: BUTTONS.roll }],
  ...(admin ? [[{ text: BUTTONS.admin }]] : []),
], resize_keyboard: true, is_persistent: true });
export const cancelKeyboard = { keyboard: [[{ text: BUTTONS.cancel }]], resize_keyboard: true };
export const inline = rows => ({ inline_keyboard: rows });

export function send(chatId, text, markup, extra = {}) {
  return { method: 'sendMessage', payload: {
    chat_id: chatId, text, parse_mode: 'HTML', link_preview_options: { is_disabled: true },
    ...(markup ? { reply_markup: markup } : {}), ...extra,
  } };
}
export function answer(callback, text = '', alert = false) {
  return { method: 'answerCallbackQuery', payload: {
    callback_query_id: callback.id, text, show_alert: alert,
  } };
}
export function edit(callback, text, markup) {
  return { method: 'editMessageText', payload: {
    chat_id: callback.message.chat.id, message_id: callback.message.message_id,
    text, parse_mode: 'HTML', link_preview_options: { is_disabled: true }, reply_markup: markup || inline([]),
  } };
}

export function rules(base) {
  return inline([
    [{ text: 'Правила', url: base + '/rules/' }, { text: 'Механики', url: base + '/mechanics/' }],
    [{ text: 'Карта', url: base + '/maps/political/' }, { text: 'Государства', url: base + '/countries/' }],
    [{ text: 'Открыть сайт', url: base + '/' }],
  ]);
}
export const previewButtons = nonce => inline([
  [button('📨 Отправить анкету', 'form:submit:' + nonce)],
  [button('✏️ Заполнить заново', 'form:restart:' + nonce), button('Отмена', 'form:cancel:' + nonce)],
]);
export const backToAdmin = inline([[button('← Админ-панель', 'adm:home')]]);

export function applicationText(app, review = false) {
  const userId = app.user_id;
  return `<b>${review ? 'Анкета №' + esc(app.id.slice(0, 8)) : 'Проверьте анкету'}</b>\n\n` +
    `<b>Имя:</b> ${esc(app.player_name)}\n<b>Страна:</b> ${esc(app.country_name)}\n` +
    `<b>Описание:</b>\n${esc(app.description)}` +
    (review ? `\n\n<b>Игрок:</b> <a href="tg://user?id=${userId}">${esc(app.display_name)}</a>` +
      (app.username ? ` (@${esc(app.username)})` : '') + `\n<b>Статус:</b> ${STATUS[app.status]}` +
      (app.review_reason ? `\n<b>Причина:</b> ${esc(app.review_reason)}` : '') : '');
}
export const reviewButtons = app => inline([
  ...(app.status === 'pending' ? [[button('✅ Принять', 'app:accept:' + app.id), button('❌ Отклонить', 'app:reject:' + app.id)]] : []),
  [button('← Очередь', 'adm:list:pending:0')],
]);

export function adminPanel(counts) {
  return {
    text: `<b>Админ-панель Эрциона</b>\n\nНа рассмотрении: ${counts.pending}\nПринято: ${counts.accepted}\nОтклонено: ${counts.rejected}`,
    markup: inline([
      [button('📥 Новые анкеты · ' + counts.pending, 'adm:list:pending:0')],
      [button('✅ Принятые', 'adm:list:accepted:0'), button('❌ Отклонённые', 'adm:list:rejected:0')],
      [button('🗓 Настроить календарь', 'cal:home')],
    ]),
  };
}
export function queuePanel(rows, status, offset) {
  const visible = rows.slice(0, 5);
  const navigation = [];
  if (offset) navigation.push(button('← Назад', `adm:list:${status}:${Math.max(0, offset - 5)}`));
  if (rows.length > 5) navigation.push(button('Далее →', `adm:list:${status}:${offset + 5}`));
  return {
    text: `<b>Анкеты: ${STATUS[status].toLowerCase()}</b>\n\n` + (visible.length ? 'Выберите заявку.' : 'В этой очереди пока нет заявок.'),
    markup: inline([
      ...visible.map(app => [button(shorten(app.country_name + ' · ' + app.player_name), 'app:view:' + app.id)]),
      ...(navigation.length ? [navigation] : []), [button('← Админ-панель', 'adm:home')],
    ]),
  };
}

function duration(ms) {
  const total = Math.max(1, Math.ceil(ms / 60_000));
  const days = Math.floor(total / 1440), hours = Math.floor(total % 1440 / 60), minutes = total % 60;
  return [days && days + ' дн.', hours && hours + ' ч.', (minutes || (!days && !hours)) && minutes + ' мин.'].filter(Boolean).join(' ');
}
export function calendarText(row, now) {
  const current = readCalendar(row, now);
  return `<b>Игровой календарь</b>\n\nГод: <b>${current.year}</b>\n` +
    (current.running ? `До ${current.year + 1} года: <b>${duration(current.remaining)}</b>.` : 'Отсчёт на паузе.') +
    '\n\n2 реальных суток = 1 игровой год.';
}
export function calendarPanel(row, now) {
  return { text: calendarText(row, now), markup: inline([
    [button(row.running ? '⏸ Пауза' : '▶️ Запустить / продолжить', row.running ? 'cal:pause' : 'cal:start')],
    [button('📝 Установить игровой год', 'cal:year')],
    [button('← Админ-панель', 'adm:home')],
  ]) };
}
