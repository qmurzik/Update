import type { Ctx } from './context';
import { confirmKeyboard, x5MenuKeyboard } from '../telegram/keyboards';
import { DIVIDER, esc } from '../util';
import { requireLinked } from './guard';
import { reply } from './reply';
import { countActiveDeviceTokens, revokeDeviceTokensForUsername } from '../db';

/**
 * X5 — второе, отдельно продаваемое приложение (см. README "X5 — второе
 * приложение"): своя подписка (x5_subscription), своё устройство
 * (x5_device_id), свой клон (x5_extra_device_slot) — на том же аккаунте
 * qmods.ru, но полностью независимо от основной подписки. Один экран
 * сразу показывает статус подписки и устройства (в отличие от основного
 * приложения, где это два отдельных раздела меню) — X5 проще и не нужно
 * дублировать всю глубину основного меню.
 */
export async function showX5Menu(ctx: Ctx): Promise<void> {
  const me = await ctx.api.me(ctx.telegramId);
  if (!(await requireLinked(ctx, me))) return;

  const meX5 = await ctx.api.meX5(ctx.telegramId);
  const sub = meX5.user?.subscription;
  const hasCloneSlot = !!meX5.user?.extra_device_slot;
  const maxDevices = meX5.user?.max_devices ?? 1;
  const activeTokenCount = await countActiveDeviceTokens(ctx.env, me.user!.username, 'x5');

  const lines = ['<b>🎯 X5</b>', DIVIDER, ''];

  if (!sub || !sub.plan || sub.plan === 'none') {
    lines.push('<blockquote>Подписки X5 пока нет.</blockquote>', '', 'Выберите тариф ниже — включу доступ сразу после оплаты.');
  } else if (sub.active) {
    lines.push(`<blockquote>🟢 <b>Активна</b> · осталось ${sub.days_left} дн.</blockquote>`, '', `Тариф: <b>${esc(sub.plan)}</b>`, `Дата окончания: ${esc(sub.expires_text)}`);
  } else {
    lines.push(`<blockquote>🔴 <b>Истекла</b> ${esc(sub.expires_text)}</blockquote>`, '', `Тариф: <b>${esc(sub.plan)}</b>`);
  }

  lines.push('', `📱 Устройств привязано: ${activeTokenCount}/${maxDevices}`);
  lines.push(hasCloneSlot ? '🧬 Клон X5 куплен — можно входить одновременно с двух устройств.' : '🧬 Можно купить второе устройство X5 («клон») за 300 ₽.');

  await reply(ctx, lines.join('\n'), x5MenuKeyboard(activeTokenCount > 0, hasCloneSlot));
}

export async function askRemoveDeviceX5(ctx: Ctx): Promise<void> {
  await reply(
    ctx,
    'Отвязать текущее устройство X5? На нём потребуется войти заново, а подписка X5 никуда не денется.',
    confirmKeyboard('x5:dev:rm:yes', 'm:x5')
  );
}

export async function confirmRemoveDeviceX5(ctx: Ctx): Promise<void> {
  const me = await ctx.api.me(ctx.telegramId);
  if (!me.user?.username) {
    await showX5Menu(ctx);
    return;
  }

  const meX5 = await ctx.api.meX5(ctx.telegramId);
  const deviceId = meX5.user?.device.id;
  if (deviceId) {
    const result = await ctx.api.deviceRemove(ctx.telegramId, deviceId, 'x5');
    if (!result.success) {
      await reply(ctx, `Не получилось отвязать устройство X5: ${esc(String(result.error ?? 'ошибка'))}`);
      return;
    }
  }

  // Same reasoning as the main app's confirmRemoveDevice — clear ALL x5
  // device_tokens for the account, not just the one qmods.ru's own
  // x5_device_id happened to mirror (see db.ts revokeDeviceTokensForUsername).
  await revokeDeviceTokensForUsername(ctx.env, me.user.username, 'x5');

  await showX5Menu(ctx);
}
