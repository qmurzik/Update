import type { Ctx } from './context';
import { paymentsKeyboard } from '../telegram/keyboards';
import { esc, money } from '../util';
import { requireLinked } from './guard';
import { reply } from './reply';

export async function showPayments(ctx: Ctx): Promise<void> {
  const me = await ctx.api.me(ctx.telegramId);
  if (!(await requireLinked(ctx, me))) return;

  const payments = me.user!.payments ?? [];
  const lines = ['<b>💳 Оплата / продление</b>', ''];

  if (payments.length === 0) {
    lines.push('Платежей пока не было.');
  } else {
    lines.push('<b>История платежей:</b>');
    for (const p of payments.slice(0, 10)) {
      lines.push(`${esc(p.date_text)} — ${esc(p.plan)} — ${money(p.amount)}`);
    }
  }

  lines.push('', 'Продлить подписку можно на странице оплаты QMods:');

  await reply(ctx, lines.join('\n'), paymentsKeyboard(ctx.env));
}
