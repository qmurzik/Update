import type { Ctx } from './context';
import { backButton, planPickerKeyboard, payOrderKeyboard } from '../telegram/keyboards';
import { DIVIDER, esc, money } from '../util';
import { requireLinked } from './guard';
import { reply } from './reply';
import { createPaymentOrder, getPaymentOrder } from '../db';
import { buildQuickpayUrl } from '../yoomoney';

/** Shows the plan list ("💳 Купить подписку") — the plans() action existed but was never wired up client-side before this. */
export async function askBuyPlan(ctx: Ctx): Promise<void> {
  const me = await ctx.api.me(ctx.telegramId);
  if (!(await requireLinked(ctx, me))) return;

  const res = await ctx.api.plans();
  const plans = res.plans ?? [];
  if (plans.length === 0) {
    await reply(ctx, 'Тарифы временно недоступны — попробуйте позже или продлите через сайт.', backButton('m:pay'));
    return;
  }

  const lines = ['<b>💳 Выберите тариф</b>', DIVIDER, ''];
  for (const p of plans) {
    lines.push(`<b>${esc(p.title)}</b> — ${money(p.price)} / ${p.days} дн.`);
  }
  lines.push('', 'Оплата через ЮMoney — картой или с кошелька. Подписка активируется автоматически.');

  await reply(ctx, lines.join('\n'), planPickerKeyboard(plans));
}

/** callback_data `pay:plan:<id>` — creates the order and shows the ЮMoney payment link. */
export async function handleBuyPlan(ctx: Ctx, planId: string): Promise<void> {
  const me = await ctx.api.me(ctx.telegramId);
  if (!(await requireLinked(ctx, me))) return;

  const res = await ctx.api.plans();
  const plan = (res.plans ?? []).find((p) => p.id === planId);
  if (!plan) {
    await reply(ctx, 'Тариф не найден — возможно, список обновился. Откройте оплату заново.', backButton('m:pay'));
    return;
  }

  const orderId = await createPaymentOrder(ctx.env, {
    telegramId: ctx.telegramId,
    username: me.user!.username,
    planId: plan.id,
    planTitle: plan.title,
    days: plan.days,
    amount: plan.price,
  });

  await reply(ctx, buildPayMessage(plan.title, plan.price, false), payOrderKeyboard(buildOrderUrl(ctx, orderId, plan.price, plan.title), orderId));
}

/** callback_data `pay:check:<orderId>` — manual re-check, in case the webhook is slow or the successURL round-trip didn't land. */
export async function checkOrderStatus(ctx: Ctx, orderId: string): Promise<void> {
  const order = await getPaymentOrder(ctx.env, orderId);
  if (!order) {
    await reply(ctx, 'Заказ не найден — возможно, устарел. Начните оплату заново.', backButton('m:pay'));
    return;
  }

  if (order.status === 'paid') {
    await reply(ctx, `✅ Оплата подтверждена! Подписка «${esc(order.plan_title)}» активна — приятного использования QMods.`, backButton('m:main'));
    return;
  }

  await reply(
    ctx,
    buildPayMessage(order.plan_title, order.amount, true),
    payOrderKeyboard(buildOrderUrl(ctx, order.id, order.amount, order.plan_title), order.id)
  );
}

/** `/start paid_<orderId>` — opened via the Quickpay successURL once the user returns from the payment page. */
export async function handlePaidReturn(ctx: Ctx, orderId: string): Promise<void> {
  await checkOrderStatus(ctx, orderId);
}

function buildPayMessage(planTitle: string, amount: number, pending: boolean): string {
  const lines = [`<b>💳 Оплата тарифа «${esc(planTitle)}»</b>`, DIVIDER, '', `Сумма: <b>${money(amount)}</b>`];
  lines.push(
    '',
    pending
      ? 'Платёж пока не подтверждён — обычно это занимает не больше минуты. Если уже оплатили, подождите немного и нажмите «Проверить оплату» ещё раз.'
      : 'Нажмите «Оплатить», выберите способ на странице ЮMoney. После оплаты подписка активируется автоматически — обычно в течение минуты.'
  );
  return lines.join('\n');
}

function buildOrderUrl(ctx: Ctx, orderId: string, amount: number, planTitle: string): string {
  return buildQuickpayUrl(ctx.env, {
    orderId,
    amount,
    description: `QMods — ${planTitle}`,
    successUrl: `https://t.me/${ctx.env.BOT_USERNAME}?start=paid_${orderId}`,
  });
}
