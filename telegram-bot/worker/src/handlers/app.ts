import type { Ctx } from './context';
import type { InlineKeyboard } from '../telegram/types';
import { DIVIDER, esc } from '../util';
import { reply } from './reply';

interface AppReleaseInfo {
  download_url: string | null;
  has_file: boolean;
  cabinet_url: string;
}

/**
 * One "⬇️ Скачать APK" button, reused everywhere someone needs to install
 * the app on a device — the main "⬇️ Приложение" screen below, and the
 * device-slot ("клон") purchase flow, which needs the SAME apk to put on
 * the second device (see handlers/devices.ts, handlers/payment.ts,
 * index.ts finalizePayment). Falls back to a "🌐 Открыть кабинет" link
 * when no direct share link is generated, same as showAppRelease always did.
 * Returns null only when the file isn't published at all yet.
 */
export function appDownloadButton(release: AppReleaseInfo): InlineKeyboard[number] | null {
  if (release.download_url) return [{ text: '⬇️ Скачать APK', url: release.download_url }];
  if (release.has_file) return [{ text: '🌐 Открыть кабинет (скачать APK)', url: release.cabinet_url }];
  return null;
}

export async function showAppRelease(ctx: Ctx): Promise<void> {
  const res = await ctx.api.appRelease();
  const lines = ['<b>⬇️ Приложение QMods</b>', DIVIDER, ''];

  if (res.version) lines.push(`Версия <b>${esc(res.version)}</b>`, '');
  if (res.changelog) lines.push(esc(res.changelog));

  const kb: InlineKeyboard = [];
  const downloadRow = appDownloadButton(res);
  if (downloadRow) {
    if (!res.download_url) lines.push('', 'Скачать можно из личного кабинета — откройте ссылку ниже и войдите.');
    kb.push(downloadRow);
  } else {
    lines.push('', 'Файл приложения сейчас недоступен, загляните чуть позже.');
  }
  kb.push([{ text: '‹ Назад', callback_data: 'm:main' }]);

  await reply(ctx, lines.join('\n'), kb);
}
