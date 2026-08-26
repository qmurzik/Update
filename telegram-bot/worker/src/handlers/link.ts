import type { Ctx } from './context';
import { confirmKeyboard, linkStartKeyboard, mainMenu } from '../telegram/keyboards';
import { esc } from '../util';
import { checkRateLimit, clearState, setState } from '../db';
import { showMainMenu } from './start';
import { reply } from './reply';

const LINK_RATE_MAX = 6;
const LINK_RATE_WINDOW = 600; // 10 минут

/** /link or the "🔗 Привязать аккаунт" button — start the code-entry flow. */
export async function startLink(ctx: Ctx): Promise<void> {
  const me = await ctx.api.me(ctx.telegramId);
  if (me.linked) {
    await reply(ctx, `Аккаунт уже привязан: <b>${esc(me.user?.username ?? '')}</b>.`, mainMenu(ctx.env, true, false));
    return;
  }

  await setState(ctx.env, ctx.chatId, 'link_code');
  const text =
    '<b>🔗 Привязка аккаунта</b>\n┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄\n\n' +
    '1. Откройте личный кабинет <a href="https://qmods.ru/mod/cabinet.php">qmods.ru/mod</a>\n' +
    '2. В разделе профиля найдите блок «Telegram» и получите одноразовый код\n' +
    '3. Пришлите этот код сюда одним сообщением';

  await reply(ctx, text, linkStartKeyboard());
}

/** Handles a plain-text message while the chat is awaiting a link code. */
export async function handleLinkCodeInput(ctx: Ctx, text: string): Promise<void> {
  const allowed = await checkRateLimit(ctx.env, `link:${ctx.chatId}`, LINK_RATE_MAX, LINK_RATE_WINDOW);
  if (!allowed) {
    await clearState(ctx.env, ctx.chatId);
    await reply(ctx, '⏳ Слишком много попыток. Попробуйте снова через несколько минут: /link');
    return;
  }

  const code = text.trim().toUpperCase().replace(/\s+/g, '');
  const result = await ctx.api.link(ctx.telegramId, code);

  if (result.success && result.linked) {
    await clearState(ctx.env, ctx.chatId);
    if (ctx.incomingMessageId) {
      await ctx.tg.setMessageReaction(ctx.chatId, ctx.incomingMessageId, '🎉').catch(() => undefined);
    }
    await showMainMenu(ctx, `✅ Аккаунт <b>${esc(String(result.username ?? ''))}</b> успешно привязан!`);
    return;
  }

  const reason = String(result.error ?? 'Неверный код');
  await reply(ctx, `❌ ${esc(reason)}. Проверьте код в кабинете и отправьте его ещё раз, либо нажмите «Отмена».`, linkStartKeyboard());
}

export async function cancelLink(ctx: Ctx): Promise<void> {
  await clearState(ctx.env, ctx.chatId);
  await showMainMenu(ctx, 'Привязка отменена.');
}

export async function askUnlink(ctx: Ctx): Promise<void> {
  await reply(
    ctx,
    'Отвязать Telegram от аккаунта QMods? Доступ к разделам бота будет ограничен до повторной привязки.',
    confirmKeyboard('link:unlink:yes', 'm:profile')
  );
}

export async function confirmUnlink(ctx: Ctx): Promise<void> {
  const result = await ctx.api.unlink(ctx.telegramId);
  if (!result.success) {
    await reply(ctx, `Не удалось отвязать аккаунт: ${esc(String(result.error ?? 'ошибка'))}`);
    return;
  }
  await showMainMenu(ctx, '🔓 Telegram отвязан от аккаунта.');
}
