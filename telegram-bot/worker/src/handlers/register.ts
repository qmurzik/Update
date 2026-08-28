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
    '<b>🆕 Регистрация в Telegram</b>\n┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄\n\n' +
    'Придумайте никнейм для нового аккаунта QMods (3–20 символов: латиница, цифры, _ и -) и пришлите его одним сообщением.';

  await reply(ctx, text, registerStartKeyboard());
}

/** Handles a plain-text message while the chat is awaiting a username. */
export async function handleRegisterUsernameInput(ctx: Ctx, text: string): Promise<void> {
  const allowed = await checkRateLimit(ctx.env, `register:${ctx.chatId}`, REGISTER_RATE_MAX, REGISTER_RATE_WINDOW);
  if (!allowed) {
    await clearState(ctx.env, ctx.chatId);
    await reply(ctx, '⏳ Слишком много попыток. Попробуйте снова через несколько минут: /start');
    return;
  }

  const username = text.trim();
  if (!USERNAME_RE.test(username)) {
    await reply(ctx, '❌ Никнейм должен быть 3–20 символов: латиница, цифры, _ и -. Попробуйте другой.', registerStartKeyboard());
    return;
  }

  const result = await ctx.api.register(ctx.telegramId, username);

  if (result.success) {
    await clearState(ctx.env, ctx.chatId);
    if (ctx.incomingMessageId) {
      await ctx.tg.setMessageReaction(ctx.chatId, ctx.incomingMessageId, '🎉').catch(() => undefined);
    }
    const trialText = result.trial
      ? '\n\n🎁 Вам открыт пробный доступ на 24 часа.'
      : '\n\nЧтобы пользоваться QMods — оформите подписку в разделе «⭐ Подписка».';
    await showMainMenu(ctx, `✅ Аккаунт <b>${esc(String(result.username ?? username))}</b> создан и привязан к Telegram!${trialText}`);
    return;
  }

  const reason = String(result.error ?? 'Не удалось зарегистрироваться');
  await reply(ctx, `❌ ${esc(reason)}. Попробуйте другой никнейм.`, registerStartKeyboard());
}

export async function cancelRegister(ctx: Ctx): Promise<void> {
  await clearState(ctx.env, ctx.chatId);
  await showMainMenu(ctx, 'Регистрация отменена.');
}
