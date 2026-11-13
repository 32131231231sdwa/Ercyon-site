import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';

export const root = fileURLToPath(new URL('../', import.meta.url));
export const settingsFile = path.join(root, '.dev.vars');

export function readSettings() {
  const values = {};
  if (!fs.existsSync(settingsFile)) return values;
  for (const line of fs.readFileSync(settingsFile, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match) continue;
    try { values[match[1]] = match[2].startsWith('"') ? JSON.parse(match[2]) : match[2]; }
    catch { throw new Error('Неверный формат строки ' + match[1] + ' в .dev.vars.'); }
  }
  return values;
}

export function prepareSettings() {
  const values = readSettings();
  values.BOT_TOKEN ||= '';
  values.WEBHOOK_SECRET ||= randomBytes(32).toString('hex');
  values.SETUP_CODE ||= randomBytes(24).toString('base64url');
  values.ADMIN_IDS ||= '';
  values.CLOUDFLARE_ACCOUNT_ID ||= '';
  const body = '# Private settings. This file must not be committed.\n' +
    Object.entries(values).map(([key, value]) => key + '=' + JSON.stringify(String(value))).join('\n') + '\n';
  fs.writeFileSync(settingsFile + '.tmp', body, { mode: 0o600 });
  fs.renameSync(settingsFile + '.tmp', settingsFile);
  return values;
}
