import type { Ctx } from './context';
import { paymentsKeyboard } from '../telegram/keyboards';
import { DIVIDER, esc, money } from '../util';
import { requireLinked } from './guard';
import { reply } from './reply';

export async function showPayments(ctx: Ctx): Promise<void> {
  const me = await ctx.api.me(ctx.telegramId);
  if (!(await requireLinked(ctx, me))) return;

  const payments = me.user!.payments ?? [];
  const lines = ['<b>💳 Оплата и продление</b>', DIVIDER, ''];

  if (payments.length === 0) {
    lines.push('<blockquote>Платежей пока не было</blockquote>', '', 'Выберите тариф на странице оплаты — включу доступ сразу после подтверждения.');
  } else {
    lines.push(`<blockquote>Всего платежей: ${payments.length}</blockquote>`, '', '<b>История:</b>');
    for (const p of payments.slice(0, 10)) {
      lines.push(`${esc(p.date_text)} — ${esc(p.plan)} — ${money(p.amount)}`);
    }
    lines.push('', 'Продлить подписку можно на странице оплаты QMods:');
  }

  await reply(ctx, lines.join('\n'), paymentsKeyboard());
}
