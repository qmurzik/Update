import type { Ctx } from './context';
import { cancelKeyboard, supportKeyboard } from '../telegram/keyboards';
import { DIVIDER, esc } from '../util';
import { adminIds } from '../config';
import { checkRateLimit, clearState, setState } from '../db';
import { reply } from './reply';

const SUPPORT_RATE_MAX = 5;
const SUPPORT_RATE_WINDOW = 600; // 10 минут

export async function showSupport(ctx: Ctx): Promise<void> {
  const text =
    `<b>🆘 Нужна помощь?</b>\n${DIVIDER}\n\n` +
    'Опишите, что случилось — с доступом, оплатой или устройством — прямо здесь, и я перешлю сообщение напрямую. Не переживайте, разберёмся. С общими вопросами — в чат сообщества 💜';
  await reply(ctx, text, supportKeyboard());
}

/** "✍️ Написать в поддержку" — bot-native ticket, no site form involved. */
export async function askSupportMessage(ctx: Ctx): Promise<void> {
  await setState(ctx.env, ctx.chatId, 'support_text');
  await reply(ctx, 'Опишите проблему одним сообщением (минимум 10 символов) — постараюсь помочь как можно быстрее.', cancelKeyboard('m:support'));
}

/**
 * Forwards straight to every admin's own Telegram DM (`ADMIN_TELEGRAM_IDS`
 * IS the chat_id for a private chat) — no ticket queue/storage, this is a
 * solo-operator project and a live DM is both simpler and faster than
 * building a whole ticketing UI around it. Admin replies directly in that
 * DM thread, or through "📨 Написать" on the user's admin card if they'd
 * rather it land as a proper in-bot notification back to the user.
 */
export async function handleSupportMessageInput(ctx: Ctx, text: string): Promise<void> {
  const allowed = await checkRateLimit(ctx.env, `support:${ctx.chatId}`, SUPPORT_RATE_MAX, SUPPORT_RATE_WINDOW);
  if (!allowed) {
    await clearState(ctx.env, ctx.chatId);
    await reply(ctx, '⏳ Многовато сообщений подряд — дайте мне пару минут и напишите ещё раз: /support');
    return;
  }

  const trimmed = text.trim();
  if (trimmed.length < 10) {
    await reply(ctx, 'Совсем коротко — опишите чуть подробнее (минимум 10 символов).', cancelKeyboard('m:support'));
    return;
  }

  await clearState(ctx.env, ctx.chatId);

  const me = await ctx.api.me(ctx.telegramId);
  const who = me.linked && me.user ? esc(me.user.username) : `telegram_id ${esc(ctx.telegramId)} (не привязан)`;
  const alert = `<b>🆘 Обращение в поддержку</b>\nОт: ${who}\n\n${esc(trimmed)}`;

  const admins = adminIds(ctx.env);
  const delivered = (
    await Promise.all(admins.map((id) => ctx.tg.sendMessage(id, alert).then(() => true).catch(() => false)))
  ).some(Boolean);

  if (!delivered) {
    await reply(
      ctx,
      '❌ Не получилось доставить сообщение — попробуйте ещё раз чуть позже или напишите в чат сообщества.',
      supportKeyboard()
    );
    return;
  }

  if (ctx.incomingMessageId) {
    await ctx.tg.setMessageReaction(ctx.chatId, ctx.incomingMessageId, '🫡').catch(() => undefined);
  }
  await reply(ctx, '✅ Передала — ответят как можно быстрее, не переживайте.', supportKeyboard());
}
