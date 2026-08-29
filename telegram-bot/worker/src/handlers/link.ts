import type { Ctx } from './context';
import { confirmKeyboard, linkPasswordKeyboard, linkStartKeyboard, mainMenu } from '../telegram/keyboards';
import { esc, splitTitleBody } from '../util';
import { checkRateLimit, clearState, setState } from '../db';
import { showMainMenu } from './start';
import { reply } from './reply';

const LINK_RATE_MAX = 6;
const LINK_RATE_WINDOW = 600; // 10 минут
const LINK_PW_RATE_MAX = 5;
const LINK_PW_RATE_WINDOW = 600; // 10 минут

/** /link or the "🔗 Привязать аккаунт" button — start the code-entry flow. */
export async function startLink(ctx: Ctx): Promise<void> {
  const me = await ctx.api.me(ctx.telegramId);
  if (me.linked) {
    await reply(ctx, `Аккаунт уже привязан: <b>${esc(me.user?.username ?? '')}</b>.`, mainMenu(ctx.env, true, false));
    return;
  }

  await setState(ctx.env, ctx.chatId, 'link_code');
  const text =
    '<b>🔗 Привяжем аккаунт</b>\n┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄\n\n' +
    'Это займёт минуту:\n' +
    '1. Откройте личный кабинет <a href="https://qmods.ru/mod/cabinet.php">qmods.ru/mod</a>\n' +
    '2. В разделе профиля найдите блок «Telegram» и получите одноразовый код\n' +
    '3. Пришлите этот код сюда одним сообщением — и я сама всё сделаю';

  await reply(ctx, text, linkStartKeyboard());
}

/** Handles a plain-text message while the chat is awaiting a link code. */
export async function handleLinkCodeInput(ctx: Ctx, text: string): Promise<void> {
  const allowed = await checkRateLimit(ctx.env, `link:${ctx.chatId}`, LINK_RATE_MAX, LINK_RATE_WINDOW);
  if (!allowed) {
    await clearState(ctx.env, ctx.chatId);
    await reply(ctx, '⏳ Что-то слишком много попыток подряд — дай мне (и коду) немного отдохнуть, попробуй снова через несколько минут: /link');
    return;
  }

  const code = text.trim().toUpperCase().replace(/\s+/g, '');
  const result = await ctx.api.link(ctx.telegramId, code);

  if (result.success && result.linked) {
    await clearState(ctx.env, ctx.chatId);
    if (ctx.incomingMessageId) {
      await ctx.tg.setMessageReaction(ctx.chatId, ctx.incomingMessageId, '🎉').catch(() => undefined);
    }
    await showMainMenu(ctx, `✅ Готово! Аккаунт <b>${esc(String(result.username ?? ''))}</b> привязан — теперь я тоже за ним присмотрю.`);
    return;
  }

  const reason = String(result.error ?? 'Неверный код');
  await reply(ctx, `❌ ${esc(reason)}. Проверьте код в кабинете и пришлите ещё раз, либо нажмите «Отмена» — не переживайте, ничего не сломалось.`, linkStartKeyboard());
}

/**
 * "🔑 Войти по логину и паролю" — alternative to the code flow above for
 * when getting a code isn't practical (no site access right now, site
 * login switched off — see README "Известный оставшийся разрыв"). Verifies
 * straight against the site's own password (mod/api/bot.php
 * `link_by_password`, same password_verify()/pass_hash as login.php).
 */
export async function askLinkPassword(ctx: Ctx): Promise<void> {
  const me = await ctx.api.me(ctx.telegramId);
  if (me.linked) {
    await reply(ctx, `Аккаунт уже привязан: <b>${esc(me.user?.username ?? '')}</b>.`, mainMenu(ctx.env, true, false));
    return;
  }

  await setState(ctx.env, ctx.chatId, 'link_password');
  const text =
    '<b>🔑 Вход по логину и паролю</b>\n┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄\n\n' +
    'Пришлите логин и пароль от аккаунта qmods.ru ДВУМЯ строками — логин первой, пароль второй, одним сообщением.\n\n' +
    'Сообщение с паролем я сразу удалю из чата.';

  await reply(ctx, text, linkPasswordKeyboard());
}

/** Handles a plain-text message while the chat is awaiting login+password. */
export async function handleLinkPasswordInput(ctx: Ctx, text: string): Promise<void> {
  // Стираем сообщение с паролем из истории чата сразу, ещё до всех проверок
  // — best-effort (Telegram не всегда даёт боту удалить чужое сообщение),
  // но пытаемся в первую очередь, а не после медленного похода в PHP.
  if (ctx.incomingMessageId) {
    await ctx.tg.deleteMessage(ctx.chatId, ctx.incomingMessageId).catch(() => undefined);
  }

  const allowed = await checkRateLimit(ctx.env, `link-pw:${ctx.chatId}`, LINK_PW_RATE_MAX, LINK_PW_RATE_WINDOW);
  if (!allowed) {
    await clearState(ctx.env, ctx.chatId);
    await reply(ctx, '⏳ Слишком много попыток подряд — попробуйте снова через несколько минут: /link');
    return;
  }

  const { title: username, body: password } = splitTitleBody(text);
  if (!username || !password) {
    await reply(
      ctx,
      '❌ Нужны обе строки — логин на первой, пароль на второй, в одном сообщении. Попробуйте ещё раз.',
      linkPasswordKeyboard()
    );
    return;
  }

  const result = await ctx.api.linkByPassword(ctx.telegramId, username, password);
  if (result.success && result.linked) {
    await clearState(ctx.env, ctx.chatId);
    await showMainMenu(ctx, `✅ Готово! Аккаунт <b>${esc(String(result.username ?? username))}</b> привязан — теперь я тоже за ним присмотрю.`);
    return;
  }

  const reason = String(result.error ?? 'Неверный логин или пароль');
  await reply(ctx, `❌ ${esc(reason)}. Попробуйте ещё раз — логин и пароль двумя строками.`, linkPasswordKeyboard());
}

export async function cancelLink(ctx: Ctx): Promise<void> {
  await clearState(ctx.env, ctx.chatId);
  await showMainMenu(ctx, 'Хорошо, привязку отменила. Возвращайтесь, когда будете готовы 💜');
}

export async function askUnlink(ctx: Ctx): Promise<void> {
  await reply(
    ctx,
    'Точно отвязать Telegram от аккаунта QMods? Пока не привяжете заново, часть разделов бота будет недоступна.',
    confirmKeyboard('link:unlink:yes', 'm:profile')
  );
}

export async function confirmUnlink(ctx: Ctx): Promise<void> {
  const result = await ctx.api.unlink(ctx.telegramId);
  if (!result.success) {
    await reply(ctx, `Не получилось отвязать аккаунт: ${esc(String(result.error ?? 'ошибка'))}`);
    return;
  }
  await showMainMenu(ctx, '🔓 Готово, Telegram отвязан от аккаунта.');
}
