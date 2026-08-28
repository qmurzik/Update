import type { Ctx } from './context';
import type { InlineKeyboard } from '../telegram/types';
import { DIVIDER, esc } from '../util';
import { reply } from './reply';

export async function showAppRelease(ctx: Ctx): Promise<void> {
  const res = await ctx.api.appRelease();
  const lines = ['<b>⬇️ Приложение QMods</b>', DIVIDER, ''];

  if (res.version) lines.push(`Версия <b>${esc(res.version)}</b>`, '');
  if (res.changelog) lines.push(esc(res.changelog));

  const kb: InlineKeyboard = [];
  if (res.download_url) {
    kb.push([{ text: '⬇️ Скачать APK', url: res.download_url }]);
  } else if (res.has_file) {
    lines.push('', 'Скачать можно из личного кабинета — откройте ссылку ниже и войдите.');
    kb.push([{ text: '🌐 Открыть кабинет', url: res.cabinet_url }]);
  } else {
    lines.push('', 'Файл приложения сейчас недоступен, загляните чуть позже.');
  }
  kb.push([{ text: '‹ Назад', callback_data: 'm:main' }]);

  await reply(ctx, lines.join('\n'), kb);
}
