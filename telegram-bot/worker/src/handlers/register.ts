import type { Ctx } from './context';
import { mainMenu, registerStartKeyboard } from '../telegram/keyboards';
import { esc } from '../util';
import { checkRateLimit, clearState, setState } from '../db';
import { showMainMenu } from './start';
import { reply } from './reply';

const REGISTER_RATE_MAX = 5;
const REGISTER_RATE_WINDOW = 600; // 10 минут

const USERNAME_RE = /^[A-Za-z0-9_-]{3,20}$/;

/** /start's "🆕 Зарегистрироваться в Telegram" button — the migration-era
 * alternative to `link:start` for people who never had a qmods.ru account.
 * Creates a brand-new account with telegram_id already set, no site
 * password involved (see mod/api/bot.php `register` action). */
export async function startRegister(ctx: Ctx): Promise<void> {
  const me = await ctx.api.me(ctx.telegramId);
  if (me.linked) {
    await reply(ctx, `Аккаунт уже привязан: <b>${esc(me.user?.username ?? '')}</b>.`, mainMenu(ctx.env, true, false));
    return;
  }

  await setState(ctx.env, ctx.chatId, 'register_username');
  const text =
    '<b>🆕 Заведём новый аккаунт</b>\n┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄\n\n' +
    'Придумайте никнейм (3–20 символов: латиница, цифры, _ и -) и пришлите его одним сообщением — сайт вообще не понадобится.';

  await reply(ctx, text, registerStartKeyboard());
}

/**
 * `t.me/qmods_bot?start=ref_<CODE>` — a bot-native referral link (see
 * mod/api/bot.php `me`'s ref_link, generated from `bot_make_ref_code()`).
 * Carries the code straight into `register_username`'s FSM payload so it
 * survives until the username is actually submitted, then gets applied in
 * `register` (see handleRegisterUsernameInput below) — no separate storage
 * needed since the whole funnel is one linear conversation.
 */
export async function startWithReferral(ctx: Ctx, refCode: string): Promise<void> {
  const me = await ctx.api.me(ctx.telegramId);
  if (me.linked) {
    await showMainMenu(ctx, `Аккаунт уже привязан: <b>${esc(me.user?.username ?? '')}</b>.`);
    return;
  }

  await setState(ctx.env, ctx.chatId, 'register_username', { ref: refCode });
  const text =
    '<b>🎁 Вас пригласили в QMods</b>\n┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄\n\n' +
    'Придумайте никнейм (3–20 символов: латиница, цифры, _ и -) и пришлите его одним сообщением — заведу аккаунт и учту приглашение, сайт не понадобится.';

  await reply(ctx, text, registerStartKeyboard());
}

/** Handles a plain-text message while the chat is awaiting a username. */
export async function handleRegisterUsernameInput(ctx: Ctx, text: string, refCode = ''): Promise<void> {
  const allowed = await checkRateLimit(ctx.env, `register:${ctx.chatId}`, REGISTER_RATE_MAX, REGISTER_RATE_WINDOW);
  if (!allowed) {
    await clearState(ctx.env, ctx.chatId);
    await reply(ctx, '⏳ Многовато попыток подряд — переведём дыхание и попробуем снова через пару минут: /start');
    return;
  }

  const username = text.trim();
  if (!USERNAME_RE.test(username)) {
    await reply(ctx, '❌ Никнейм должен быть 3–20 символов: латиница, цифры, _ и -. Попробуйте ещё раз.', registerStartKeyboard());
    return;
  }

  const result = await ctx.api.register(ctx.telegramId, username, refCode || undefined);

  if (result.success) {
    await clearState(ctx.env, ctx.chatId);
    if (ctx.incomingMessageId) {
      await ctx.tg.setMessageReaction(ctx.chatId, ctx.incomingMessageId, '🎉').catch(() => undefined);
    }
    const trialText = result.trial
      ? '\n\n🎁 Дарю пробный доступ на 24 часа — успевайте освоиться.'
      : '\n\nЧтобы пользоваться QMods — оформите подписку в разделе «⭐ Подписка».';
    await showMainMenu(ctx, `✅ Аккаунт <b>${esc(String(result.username ?? username))}</b> создан и сразу привязан к Telegram — добро пожаловать!${trialText}`);
    return;
  }

  const reason = String(result.error ?? 'Не удалось зарегистрироваться');
  await reply(ctx, `❌ ${esc(reason)}. Попробуйте другой никнейм.`, registerStartKeyboard());
}

export async function cancelRegister(ctx: Ctx): Promise<void> {
  await clearState(ctx.env, ctx.chatId);
  await showMainMenu(ctx, 'Хорошо, регистрацию отменила. Я никуда не денусь, если передумаете 💜');
}
