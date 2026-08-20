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
    lines.push('У вас нет активной подписки.');
  } else {
    lines.push(`Тариф: <b>${esc(sub.plan)}</b>`);
    lines.push(`Статус: ${sub.active ? '🟢 активна' : '🔴 истекла'}`);
    lines.push(`Дата окончания: ${esc(sub.expires_text)}`);
    if (sub.active) {
      lines.push(`Осталось: ${daysRu(sub.days_left)}`);
      if (sub.days_left <= 3) lines.push('', '⚠️ Подписка скоро закончится — продлите её заранее.');
    } else {
      lines.push('', '❗️ Подписка закончилась. Продлите её, чтобы восстановить доступ.');
    }
  }

  await reply(ctx, lines.join('\n'), subscriptionKeyboard(ctx.env));
}
