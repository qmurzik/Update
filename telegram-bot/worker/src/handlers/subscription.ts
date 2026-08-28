import type { Ctx } from './context';
import { subscriptionKeyboard } from '../telegram/keyboards';
import { DIVIDER, daysRu, esc } from '../util';
import { requireLinked } from './guard';
import { reply } from './reply';

export async function showSubscription(ctx: Ctx): Promise<void> {
  const me = await ctx.api.me(ctx.telegramId);
  if (!(await requireLinked(ctx, me))) return;

  const sub = me.user!.subscription;
  const lines = ['<b>⭐ Моя подписка</b>', DIVIDER, ''];

  if (!sub.plan || sub.plan === 'none') {
    lines.push('<blockquote>Активной подписки пока нет.</blockquote>', '', 'Выберите тариф ниже — я включу доступ, как только пройдёт оплата.');
  } else if (sub.active) {
    lines.push(`<blockquote>🟢 <b>Активна</b> · осталось ${daysRu(sub.days_left)}</blockquote>`);
    if (sub.days_left <= 3) lines.push('', '⚠️ Скоро закончится — загляните продлить, чтобы доступ не прервался.');
    lines.push('', `Тариф: <b>${esc(sub.plan)}</b>`, `Дата окончания: ${esc(sub.expires_text)}`);
  } else {
    lines.push(`<blockquote>🔴 <b>Истекла</b> ${esc(sub.expires_text)}</blockquote>`);
    lines.push('', '❗️ Продлите, и я сразу же верну доступ.', '', `Тариф: <b>${esc(sub.plan)}</b>`);
  }

  await reply(ctx, lines.join('\n'), subscriptionKeyboard());
}
