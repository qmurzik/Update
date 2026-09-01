import type { Ctx } from './context';
import {
  backButton,
  confirmKeyboard,
  curatorInviteAnswerKeyboard,
  curatorMenuKeyboard,
  curatorPlanPickerKeyboard,
  curatorWardDetailKeyboard,
  mainMenu,
  payOrderKeyboard,
} from '../telegram/keyboards';
import { DIVIDER, esc, money } from '../util';
import { requireLinked } from './guard';
import { reply } from './reply';
import { claimCuratorInvite, clearState, createCuratorInvite, createPaymentOrder, getCuratorInvite, getState, rejectCuratorInvite, setState } from '../db';
import { buildOrderUrl, buildPayMessage } from './payment';

/**
 * "Кураторство" — see README "Кураторы". A curator (is_curator=true,
 * granted only by the site admin — see handlers/admin.ts
 * askGrantCurator/confirmGrantCurator) can view a ward's subscription and
 * device, and pay real ЮMoney to extend the ward's subscription — but only
 * for accounts that explicitly consented via the invite-link handshake
 * below (worker/src/db.ts curator_invites), never assigned unilaterally.
 * This screen is always reachable from the main menu and adapts to
 * whichever role(s) the account actually has, same as "🎁 Рефералы".
 */
export async function showCuratorMenu(ctx: Ctx): Promise<void> {
  const me = await ctx.api.me(ctx.telegramId);
  if (!(await requireLinked(ctx, me))) return;

  const lines = ['<b>👔 Кураторство</b>', DIVIDER, ''];
  let wards: Awaited<ReturnType<typeof ctx.api.curatorWards>>['wards'] = [];

  if (me.user!.is_curator) {
    const res = await ctx.api.curatorWards(ctx.telegramId);
    wards = res.wards ?? [];
    if (wards.length === 0) {
      lines.push('Подопечных пока нет — пригласите первого кнопкой ниже.');
    } else {
      lines.push(`<b>Ваши подопечные (${wards.length}):</b>`, '');
      for (const w of wards) {
        const status = w.subscription.active ? `🟢 до ${esc(w.subscription.expires_text)}` : '🔴 не активна';
        lines.push(`• <b>${esc(w.username)}</b> — ${status}`);
      }
    }
    lines.push('');
  }

  if (me.user!.curator_username) {
    lines.push(`Ваш куратор: <b>${esc(me.user!.curator_username)}</b> — он видит вашу подписку и устройство и может продлевать подписку.`, '');
  }

  if (!me.user!.is_curator && !me.user!.curator_username) {
    lines.push(
      'Куратор — доверенный человек, который может продлевать вашу подписку и видеть её срок и привязанное устройство, но только с вашего согласия. Если вам прислали ссылку-приглашение — просто откройте её.'
    );
  }

  await reply(ctx, lines.join('\n'), curatorMenuKeyboard(!!me.user!.is_curator, wards, !!me.user!.curator_username));
}

/** callback_data `cur:invite` — only reachable when is_curator (button hidden otherwise, but re-checked here too). */
export async function askInviteWard(ctx: Ctx): Promise<void> {
  const me = await ctx.api.me(ctx.telegramId);
  if (!(await requireLinked(ctx, me))) return;
  if (!me.user!.is_curator) return showCuratorMenu(ctx);

  const code = await createCuratorInvite(ctx.env, me.user!.username, ctx.telegramId);
  const link = `https://t.me/${ctx.env.BOT_USERNAME}?start=curatorlink_${code}`;

  await reply(
    ctx,
    [
      '<b>➕ Пригласить подопечного</b>',
      DIVIDER,
      '',
      'Отправьте эту ссылку человеку, которого хотите курировать — она откроется в его Telegram, и он сам решит, подтвердить или отклонить. Без его подтверждения доступа не будет.',
      '',
      `<code>${esc(link)}</code>`,
      '',
      'Ссылка действует 10 минут.',
    ].join('\n'),
    backButton('m:curator')
  );
}

/** `/start curatorlink_<CODE>` — the ward opens the invite link. */
export async function handleCuratorLinkStart(ctx: Ctx, code: string): Promise<void> {
  const invite = await getCuratorInvite(ctx.env, code);
  if (!invite || invite.status !== 'pending') {
    await reply(
      ctx,
      '❌ Ссылка устарела или уже использована. Попросите куратора прислать новую.',
      mainMenu(ctx.env, true, false)
    );
    return;
  }

  const me = await ctx.api.me(ctx.telegramId);
  if (!me.linked || !me.user) {
    await reply(
      ctx,
      '🔒 Чтобы принять приглашение куратора, сперва привяжите свой аккаунт QMods — нажмите кнопку ниже, а затем откройте ссылку ещё раз.',
      mainMenu(ctx.env, false, false)
    );
    return;
  }

  if (me.user.username.toLowerCase() === invite.curator_username.toLowerCase()) {
    await reply(ctx, '❌ Нельзя стать куратором самому себе.', mainMenu(ctx.env, true, false));
    return;
  }

  const replaceWarning =
    me.user.curator_username && me.user.curator_username.toLowerCase() !== invite.curator_username.toLowerCase()
      ? `\n\n⚠️ Сейчас ваш куратор — <b>${esc(me.user.curator_username)}</b>. Подтверждение заменит его на нового.`
      : '';

  await reply(
    ctx,
    `<b>👔 Приглашение от куратора</b>\n${DIVIDER}\n\n<b>${esc(invite.curator_username)}</b> предлагает стать вашим куратором — сможет продлевать вашу подписку и видеть её срок и привязанное устройство.${replaceWarning}\n\nОтвязать куратора можно в любой момент самостоятельно, в разделе «👔 Кураторство».`,
    curatorInviteAnswerKeyboard(code)
  );
}

/** callback_data `curatorlink:confirm:<CODE>` — the ward's own consent, see mod/api/bot.php set_curator_for_ward. */
export async function handleCuratorLinkConfirm(ctx: Ctx, code: string): Promise<void> {
  const invite = await getCuratorInvite(ctx.env, code);
  if (!invite || invite.status !== 'pending') {
    await reply(ctx, '❌ Ссылка устарела или уже использована.', mainMenu(ctx.env, true, false));
    return;
  }

  const me = await ctx.api.me(ctx.telegramId);
  if (!me.linked || !me.user) {
    await reply(ctx, '🔒 Сначала привяжите аккаунт QMods.', mainMenu(ctx.env, false, false));
    return;
  }

  const res = await ctx.api.setCuratorForWard(ctx.telegramId, invite.curator_username);
  if (!res.success) {
    await reply(ctx, `❌ ${esc(String(res.error ?? 'Не получилось подтвердить.'))}`, mainMenu(ctx.env, true, false));
    return;
  }
  await claimCuratorInvite(ctx.env, code, me.user.username);

  await reply(
    ctx,
    `✅ Готово — теперь <b>${esc(invite.curator_username)}</b> ваш куратор. Отвязать можно в любой момент в разделе «👔 Кураторство».`,
    mainMenu(ctx.env, true, false)
  );
}

/** callback_data `curatorlink:reject:<CODE>`. */
export async function handleCuratorLinkReject(ctx: Ctx, code: string): Promise<void> {
  await rejectCuratorInvite(ctx.env, code);
  const me = await ctx.api.me(ctx.telegramId);
  await reply(ctx, '❌ Приглашение отклонено — куратор не получит доступ к вашему аккаунту.', mainMenu(ctx.env, !!me.linked, false));
}

/** callback_data `cur:unlink:ask` — a ward detaching their own curator. */
export async function askUnlinkCurator(ctx: Ctx): Promise<void> {
  const me = await ctx.api.me(ctx.telegramId);
  if (!(await requireLinked(ctx, me))) return;
  if (!me.user!.curator_username) return showCuratorMenu(ctx);

  await reply(ctx, `Отвязать куратора <b>${esc(me.user!.curator_username)}</b>? Он больше не увидит вашу подписку и устройство.`, confirmKeyboard('cur:unlink:yes', 'm:curator'));
}

export async function confirmUnlinkCurator(ctx: Ctx): Promise<void> {
  await ctx.api.unlinkCurator(ctx.telegramId);
  await showCuratorMenu(ctx);
}

/** callback_data `cur:ward:<username>` — a curator opening one ward's card. */
export async function showWardDetail(ctx: Ctx, wardUsername: string): Promise<void> {
  const me = await ctx.api.me(ctx.telegramId);
  if (!(await requireLinked(ctx, me))) return;
  if (!me.user!.is_curator) return showCuratorMenu(ctx);

  const res = await ctx.api.curatorWards(ctx.telegramId);
  const ward = (res.wards ?? []).find((w) => w.username.toLowerCase() === wardUsername.toLowerCase());
  if (!ward) {
    await reply(ctx, 'Этого подопечного больше нет в списке — возможно, он отвязал вас.', backButton('m:curator'));
    return;
  }

  const lines = [
    `<b>👤 ${esc(ward.username)}</b>`,
    DIVIDER,
    '',
    `Подписка: ${esc(ward.subscription.plan)} (${ward.subscription.active ? '🟢 активна' : '🔴 не активна'})`,
    `Окончание: ${esc(ward.subscription.expires_text)}`,
    `Устройство: ${ward.device.linked ? `✅ привязано (${esc(ward.device.android_version ?? 'Android')})` : '—'}`,
  ];

  await reply(ctx, lines.join('\n'), curatorWardDetailKeyboard(ward.username));
}

/** callback_data `cur:buyask:<username>` — plan picker for a specific ward, mirrors payment.ts askBuyPlan. */
export async function askBuyForWard(ctx: Ctx, wardUsername: string): Promise<void> {
  const me = await ctx.api.me(ctx.telegramId);
  if (!(await requireLinked(ctx, me))) return;
  if (!me.user!.is_curator) return showCuratorMenu(ctx);

  const res = await ctx.api.curatorWards(ctx.telegramId);
  const ward = (res.wards ?? []).find((w) => w.username.toLowerCase() === wardUsername.toLowerCase());
  if (!ward) {
    await reply(ctx, 'Этого подопечного больше нет в списке.', backButton('m:curator'));
    return;
  }

  const plansRes = await ctx.api.plans();
  const plans = plansRes.plans ?? [];
  if (plans.length === 0) {
    await reply(ctx, 'Тарифы сейчас недоступны — попробуйте чуть позже.', backButton('m:curator'));
    return;
  }

  // Ward username travels via bot_state, not callback_data — same pattern
  // as admin's admin_issue_days, keeps callback_data short and avoids any
  // assumption about which characters a username can contain.
  await setState(ctx.env, ctx.chatId, 'curator_buy_ward', { username: ward.username });

  const lines = [`<b>💳 Подписка для ${esc(ward.username)}</b>`, DIVIDER, ''];
  for (const p of plans) {
    lines.push(`<b>${esc(p.title)}</b> — ${money(p.price)} / ${p.days} дн.`);
  }
  lines.push('', 'Платите вы, дни получает подопечный. Оплата через ЮMoney — как обычная покупка.');

  await reply(ctx, lines.join('\n'), curatorPlanPickerKeyboard(plans));
}

/** callback_data `cur:buyplan:<planId>` — reads the target ward's username from bot_state (see askBuyForWard). */
export async function handleBuyForWard(ctx: Ctx, planId: string): Promise<void> {
  const me = await ctx.api.me(ctx.telegramId);
  if (!(await requireLinked(ctx, me))) return;
  if (!me.user!.is_curator) return showCuratorMenu(ctx);

  const state = await getState(ctx.env, ctx.chatId);
  const wardUsername = state?.awaiting === 'curator_buy_ward' ? String(state.payload.username ?? '') : '';
  if (!wardUsername) {
    await reply(ctx, 'Сессия покупки истекла — откройте карточку подопечного заново.', backButton('m:curator'));
    return;
  }

  const res = await ctx.api.curatorWards(ctx.telegramId);
  const ward = (res.wards ?? []).find((w) => w.username.toLowerCase() === wardUsername.toLowerCase());
  if (!ward) {
    await clearState(ctx.env, ctx.chatId);
    await reply(ctx, 'Этого подопечного больше нет в списке.', backButton('m:curator'));
    return;
  }

  const plansRes = await ctx.api.plans();
  const plan = (plansRes.plans ?? []).find((p) => p.id === planId);
  if (!plan) {
    await reply(ctx, 'Не нашла такой тариф — список обновился, откройте покупку заново.', backButton('m:curator'));
    return;
  }

  await clearState(ctx.env, ctx.chatId);

  const orderId = await createPaymentOrder(ctx.env, {
    telegramId: ctx.telegramId, // curator's own — the ЮMoney return link and confirmation message go to them, since they're the one paying
    username: ward.username, // the WARD's account is what actually gets the days (see index.ts finalizePayment -> recordPayment)
    planId: plan.id,
    planTitle: plan.title,
    days: plan.days,
    amount: plan.price,
  });

  await reply(
    ctx,
    buildPayMessage(`${plan.title} — для ${ward.username}`, plan.price, false),
    payOrderKeyboard(buildOrderUrl(ctx, orderId, plan.price, plan.title), orderId)
  );
}
