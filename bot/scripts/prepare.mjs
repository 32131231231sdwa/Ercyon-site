import { prepareSettings, settingsFile } from './settings.mjs';

try {
  const values = prepareSettings();
  console.log('Локальный файл настроек готов: ' + settingsFile);
  console.log(values.BOT_TOKEN ? 'Токен указан. Значения секретов не выводятся.' : 'Добавьте токен из BotFather в поле BOT_TOKEN.');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
