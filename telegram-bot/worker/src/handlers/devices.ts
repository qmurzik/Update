import type { Ctx } from './context';
import { confirmKeyboard, devicesKeyboard } from '../telegram/keyboards';
import { DIVIDER, esc } from '../util';
import { requireLinked } from './guard';
import { reply } from './reply';

function fmtDate(ts: number): string {
  if (!ts) return '—';
  return new Date(ts * 1000).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export async function showDevices(ctx: Ctx): Promise<void> {
  const me = await ctx.api.me(ctx.telegramId);
  if (!(await requireLinked(ctx, me))) return;

  const res = await ctx.api.devices(ctx.telegramId);
  const devices = res.devices ?? [];

  const lines = ['<b>📱 Устройства</b>', DIVIDER, ''];
  if (devices.length === 0) {
    lines.push(
      '<blockquote>Устройство ещё не привязано</blockquote>',
      '',
      'Оно появится здесь автоматически после первого входа в приложение QMods.'
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

  await reply(ctx, lines.join('\n'), devicesKeyboard(devices.length > 0));
}

export async function askRemoveDevice(ctx: Ctx): Promise<void> {
  await reply(
    ctx,
    'Отвязать текущее устройство? Приложение потребует повторного входа на этом устройстве. Подписка при этом сохранится.',
    confirmKeyboard('dev:rm:yes', 'm:devices')
  );
}

export async function confirmRemoveDevice(ctx: Ctx): Promise<void> {
  const devicesRes = await ctx.api.devices(ctx.telegramId);
  const device = devicesRes.devices?.[0];
  if (!device) {
    await reply(ctx, 'Устройство уже не привязано.');
    return;
  }

  const result = await ctx.api.deviceRemove(ctx.telegramId, device.id);
  if (!result.success) {
    await reply(ctx, `Не удалось отвязать устройство: ${esc(String(result.error ?? 'ошибка'))}`);
    return;
  }
  await showDevices(ctx);
}
