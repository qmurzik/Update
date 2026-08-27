import type { Ctx } from './context';
import { confirmKeyboard, devicesKeyboard } from '../telegram/keyboards';
import { DIVIDER, esc } from '../util';
import { requireLinked } from './guard';
import { reply } from './reply';
import { hasActiveDeviceToken, revokeDeviceTokensForUsername } from '../db';

function fmtDate(ts: number): string {
  if (!ts) return '—';
  return new Date(ts * 1000).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export async function showDevices(ctx: Ctx): Promise<void> {
  const me = await ctx.api.me(ctx.telegramId);
  if (!(await requireLinked(ctx, me))) return;

  const res = await ctx.api.devices(ctx.telegramId);
  const devices = res.devices ?? [];

  // A device_token can exist in D1 without qmods.ru's own device_id
  // reflecting it (see db.ts revokeDeviceTokensForUsername) — checked only
  // when qmods.ru shows nothing, so the unlink button (and ONE_DEVICE_PER_
  // ACCOUNT's block on new pairings) isn't invisible/unreachable here.
  const username = me.user?.username;
  const orphanToken = devices.length === 0 && username ? await hasActiveDeviceToken(ctx.env, username) : false;

  const lines = ['<b>📱 Устройства</b>', DIVIDER, ''];
  if (devices.length === 0 && !orphanToken) {
    lines.push(
      '<blockquote>Устройство ещё не привязано</blockquote>',
      '',
      'Оно появится здесь автоматически после первого входа в приложение QMods.'
    );
  } else if (devices.length === 0) {
    lines.push(
      '<blockquote>✅ Приложение привязано</blockquote>',
      '',
      'Устройство не отображается здесь, но привязка активна и мешает входу с другого устройства — отвяжите её ниже.'
    );
  } else {
    lines.push('<blockquote>✅ Устройство привязано</blockquote>', '');
    for (const d of devices) {
      lines.push(`ID: <code>${esc(d.id_short)}</code>`);
      lines.push(`Android: ${esc(d.android_version ?? 'неизвестно')}`);
      lines.push(`Добавлено: ${fmtDate(d.added_at)}`);
      lines.push(`Последний раз в сети: ${fmtDate(d.last_seen)}`);
    }
  }

  await reply(ctx, lines.join('\n'), devicesKeyboard(devices.length > 0 || orphanToken));
}

export async function askRemoveDevice(ctx: Ctx): Promise<void> {
  await reply(
    ctx,
    'Отвязать текущее устройство? Приложение потребует повторного входа на этом устройстве. Подписка при этом сохранится.',
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
      await reply(ctx, `Не удалось отвязать устройство: ${esc(String(result.error ?? 'ошибка'))}`);
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
