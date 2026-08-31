import type { Env } from '../config';
import type { Ctx } from './context';
import { backButton, planPickerKeyboard, payOrderKeyboard } from '../telegram/keyboards';
import type { InlineKeyboard } from '../telegram/types';
import { DIVIDER, esc, money } from '../util';
import { requireLinked } from './guard';
import { reply } from './reply';
import { createPaymentOrder, getPaymentOrder } from '../db';
import type { PaymentOrderRow } from '../db';
import { QmodsAdminApi, QmodsUserApi } from '../qmodsApi';
import { buildQuickpayUrl } from '../yoomoney';
import { appDownloadButton } from './app';

/** Shows the plan list ("💳 Купить подписку") — the plans() action existed but was never wired up client-side before this. */
export async function askBuyPlan(ctx: Ctx): Promise<void> {
  const me = await ctx.api.me(ctx.telegramId);
  if (!(await requireLinked(ctx, me))) return;

  const res = await ctx.api.plans();
  const plans = res.plans ?? [];
  if (plans.length === 0) {
    await reply(ctx, 'Тарифы сейчас недоступны — попробуйте чуть позже или продлите через сайт, простите за неудобство.', backButton('m:pay'));
    return;
  }

  const lines = ['<b>💳 Выберите тариф</b>', DIVIDER, ''];
  for (const p of plans) {
    lines.push(`<b>${esc(p.title)}</b> — ${money(p.price)} / ${p.days} дн.`);
  }
  lines.push('', 'Оплата через ЮMoney — картой или с кошелька. Как только деньги дойдут, подписка включится сама, без моего участия — но я на всякий случай проверю.');

  await reply(ctx, lines.join('\n'), planPickerKeyboard(plans));
}

/** callback_data `pay:plan:<id>` — creates the order and shows the ЮMoney payment link. */
export async function handleBuyPlan(ctx: Ctx, planId: string): Promise<void> {
  const me = await ctx.api.me(ctx.telegramId);
  if (!(await requireLinked(ctx, me))) return;

  const res = await ctx.api.plans();
  const plan = (res.plans ?? []).find((p) => p.id === planId);
  if (!plan) {
    await reply(ctx, 'Не нашла такой тариф — похоже, список обновился. Откройте оплату заново.', backButton('m:pay'));
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

/**
 * "Клон" — a one-time 200₽ purchase that permanently raises the account's
 * device cap from 1 to 2 (see db.ts claimDevicePairing maxDevices / PHP
 * grant_device_slot). Separate from the PLANS/plans() subscription tariffs
 * — reuses the same payment_orders + ЮMoney flow, distinguished by
 * DEVICE_SLOT_PLAN_ID so finalizePayment() in index.ts grants it
 * differently (extra_device_slot flag, not subscription days). Works only
 * while the subscription itself stays active — no extra check needed here,
 * since device_subscription already gates ANY device the same way.
 */
export const DEVICE_SLOT_PLAN_ID = 'device_slot';
export const DEVICE_SLOT_PRICE = 200;
export const DEVICE_SLOT_TITLE = 'Клон (второе устройство)';

/** callback_data `dev:clone` — see handlers/devices.ts, which surfaces the button. */
export async function handleBuyDeviceSlot(ctx: Ctx): Promise<void> {
  const me = await ctx.api.me(ctx.telegramId);
  if (!(await requireLinked(ctx, me))) return;

  if (me.user!.extra_device_slot) {
    await reply(ctx, 'У вас уже есть клон — можно привязать второе устройство прямо сейчас, независимо от первого.', backButton('m:devices'));
    return;
  }

  const orderId = await createPaymentOrder(ctx.env, {
    telegramId: ctx.telegramId,
    username: me.user!.username,
    planId: DEVICE_SLOT_PLAN_ID,
    planTitle: DEVICE_SLOT_TITLE,
    days: 0,
    amount: DEVICE_SLOT_PRICE,
  });

  await reply(
    ctx,
    buildPayMessage(DEVICE_SLOT_TITLE, DEVICE_SLOT_PRICE, false),
    payOrderKeyboard(buildOrderUrl(ctx, orderId, DEVICE_SLOT_PRICE, DEVICE_SLOT_TITLE), orderId)
  );
}

/**
 * Self-heal for a "клон" order: the webhook (`/pay/yoomoney/webhook` in
 * index.ts) marks the order 'paid' and THEN, in a separate fire-and-forget
 * `ctx.waitUntil()`, calls grant_device_slot — if that second step fails
 * (deploy lag between the two PHP files landing on the server, a transient
 * PHP/network error) the money is captured but extra_device_slot never
 * gets set, with no automatic retry. Both places that report a paid
 * order back to the user — checkOrderStatus below and the Mini App's
 * `pay_status` (webapp/api.ts) — call this first, so a stuck purchase
 * completes itself the next time the user checks instead of silently
 * staying broken forever.
 */
export async function ensureDeviceSlotGranted(env: Env, telegramId: string, order: PaymentOrderRow): Promise<void> {
  if (order.plan_id !== DEVICE_SLOT_PLAN_ID) return;
  const me = await new QmodsUserApi(env).me(telegramId);
  if (!me.linked || !me.user || me.user.extra_device_slot) return;
  await new QmodsAdminApi(env).grantDeviceSlot(order.username, order.amount).catch(() => undefined);
}

/** callback_data `pay:check:<orderId>` — manual re-check, in case the webhook is slow or the successURL round-trip didn't land. */
export async function checkOrderStatus(ctx: Ctx, orderId: string): Promise<void> {
  const order = await getPaymentOrder(ctx.env, orderId);
  if (!order) {
    await reply(ctx, 'Не нашла такой заказ — возможно, он устарел. Начните оплату заново.', backButton('m:pay'));
    return;
  }

  if (order.status === 'paid') {
    if (order.plan_id === DEVICE_SLOT_PLAN_ID) {
      await ensureDeviceSlotGranted(ctx.env, ctx.telegramId, order);
      const downloadRow = appDownloadButton(await ctx.api.appRelease());
      const kb: InlineKeyboard = downloadRow ? [downloadRow, ...backButton('m:devices')] : backButton('m:devices');
      await reply(
        ctx,
        '✅ Оплата подтверждена! Клон активирован — второе устройство можно привязать в любой момент. Установите на него то же приложение QMods, что и на первом.',
        kb
      );
      return;
    }
    await reply(
      ctx,
      `✅ Оплата подтверждена! Подписка «${esc(order.plan_title)}» активна — пользуйтесь на здоровье, а я пока присмотрю за остальным.`,
      backButton('m:main')
    );
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
      ? 'Платёж пока не подтверждён — обычно это занимает не больше минуты. Если уже оплатили, подождите немного и нажмите «Проверить оплату» ещё раз, я перепроверю.'
      : 'Нажмите «Оплатить», выберите способ на странице ЮMoney. Как только оплата пройдёт — подписка включится сама, обычно в течение минуты.'
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
