import type { Ctx } from './context';
import { confirmKeyboard, devicesKeyboard } from '../telegram/keyboards';
import { DIVIDER, esc } from '../util';
import { requireLinked } from './guard';
import { reply } from './reply';
import { countActiveDeviceTokens, revokeDeviceTokensForUsername } from '../db';
import { appDownloadButton } from './app';

function fmtDate(ts: number): string {
  if (!ts) return '—';
  return new Date(ts * 1000).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export async function showDevices(ctx: Ctx): Promise<void> {
  const me = await ctx.api.me(ctx.telegramId);
  if (!(await requireLinked(ctx, me))) return;

  const res = await ctx.api.devices(ctx.telegramId);
  const devices = res.devices ?? [];
  const username = me.user!.username;
  const maxDevices = me.user!.max_devices ?? 1;
  const hasCloneSlot = !!me.user!.extra_device_slot;

  // Скачать APK нужно для установки НА КЛОН (второе устройство) — то же
  // приложение, что и на первом, отдельного билда для клона нет. Просим
  // релиз только когда он реально пригодится, чтобы не тратить лишний
  // round-trip на каждый показ "Устройств".
  const downloadRow = hasCloneSlot ? appDownloadButton(await ctx.api.appRelease()) : null;

  // qmods.ru's own device_id field mirrors only ONE device (see mod/api/
  // bot.php `devices` action comment) — D1's device_tokens table is the
  // real source of truth for how many are actually live, which matters now
  // that an account can have up to 2 (see db.ts countActiveDeviceTokens).
  const activeTokenCount = await countActiveDeviceTokens(ctx.env, username);

  const lines = ['<b>📱 Устройства</b>', DIVIDER, ''];
  if (activeTokenCount === 0) {
    lines.push(
      '<blockquote>Устройство ещё не привязано</blockquote>',
      '',
      'Появится здесь само, как только вы первый раз войдёте в приложение QMods — я слежу.'
    );
  } else {
    lines.push(`<blockquote>✅ Привязано устройств: ${activeTokenCount}/${maxDevices}</blockquote>`, '');
    if (devices.length > 0) {
      const d = devices[0];
      lines.push(`ID: <code>${esc(d.id_short)}</code>`);
      lines.push(`Android: ${esc(d.android_version ?? 'неизвестно')}`);
      lines.push(`Добавлено: ${fmtDate(d.added_at)}`);
      lines.push(`Последний раз в сети: ${fmtDate(d.last_seen)}`);
    } else {
      lines.push('Само устройство здесь не показывается, но привязка активна.');
    }
    if (activeTokenCount > 1) lines.push('', 'Показано последнее устройство — остальные тоже активны. Отвязка снимает все сразу.');
  }

  lines.push(
    '',
    hasCloneSlot
      ? '🧬 Клон куплен — можно входить одновременно с двух устройств, пока активна подписка.'
      : '🧬 Можно купить второе устройство («клон») за 200 ₽ — работает, пока активна подписка.'
  );

  await reply(ctx, lines.join('\n'), devicesKeyboard(activeTokenCount > 0, hasCloneSlot, downloadRow));
}

export async function askRemoveDevice(ctx: Ctx): Promise<void> {
  await reply(
    ctx,
    'Отвязать текущее устройство? На нём потребуется войти заново, а подписка никуда не денется.',
    confirmKeyboard('dev:rm:yes', 'm:devices')
  );
}

export async function confirmRemoveDevice(ctx: Ctx): Promise<void> {
  const me = await ctx.api.me(ctx.telegramId);
  const devicesRes = await ctx.api.devices(ctx.telegramId);
  const device = devicesRes.devices?.[0];

  if (device) {
    const result = await ctx.api.deviceRemove(ctx.telegramId, device.id);
    if (!result.success) {
      await reply(ctx, `Не получилось отвязать устройство: ${esc(String(result.error ?? 'ошибка'))}`);
      return;
    }
  }

  // Always clear device_token(s) for the account, not just the one that
  // happened to match qmods.ru's device_id — covers an orphaned token too
  // (see db.ts revokeDeviceTokensForUsername).
  if (me.user?.username) {
    await revokeDeviceTokensForUsername(ctx.env, me.user.username);
  }

  await showDevices(ctx);
}
