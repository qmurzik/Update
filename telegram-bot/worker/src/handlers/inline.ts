import type { Env } from '../config';
import type { TgInlineQuery, InlineQueryResultArticle } from '../telegram/types';
import { TelegramClient } from '../telegram/client';
import { QmodsUserApi } from '../qmodsApi';
import { daysRu, esc } from '../util';

/**
 * Inline mode — typing `@qmods_bot` in ANY chat (not just this one) lets a
 * linked user drop a live snapshot of their own subscription/level card
 * into that conversation. Requires Inline Mode to be turned on for the bot
 * via @BotFather (`/setinline`); the Bot API has no endpoint for that
 * toggle. `is_personal: true` on every answer means Telegram never serves
 * one user's cached results to another.
 */
export async function handleInlineQuery(query: TgInlineQuery, env: Env): Promise<void> {
  const tg = new TelegramClient(env);
  const telegramId = String(query.from.id);
  const api = new QmodsUserApi(env);
  const me = await api.me(telegramId);

  if (!me.linked || !me.user) {
    const results: InlineQueryResultArticle[] = [
      {
        type: 'article',
        id: 'not_linked',
        title: '🔒 Аккаунт QMods не привязан',
        description: 'Откройте бота в личном чате и привяжите аккаунт, чтобы делиться статусом',
        input_message_content: {
          message_text: 'Ещё не привязал(а) аккаунт QMods к Telegram — сделаю это в @qmods_bot 🖤',
        },
      },
    ];
    await tg.answerInlineQuery(query.id, results, { cacheTime: 0 });
    return;
  }

  const user = me.user;
  const sub = user.subscription;
  const active = !!sub.plan && sub.plan !== 'none' && sub.active;
  const statusLine = !sub.plan || sub.plan === 'none'
    ? 'подписки нет'
    : sub.active
      ? `🟢 активна · осталось ${daysRu(sub.days_left)}`
      : `🔴 истекла ${esc(sub.expires_text)}`;

  const results: InlineQueryResultArticle[] = [
    {
      type: 'article',
      id: 'status',
      title: `${active ? '🟢' : '🔴'} Моя подписка QMods`,
      description: statusLine,
      input_message_content: {
        message_text: `<b>QMods · ${esc(user.username)}</b>\n${statusLine}`,
        parse_mode: 'HTML',
      },
    },
    {
      type: 'article',
      id: 'level',
      title: `${user.level.icon} Уровень: ${user.level.title}`,
      description: `Достижений: ${user.achievements_unlocked}/${user.achievements_total}`,
      input_message_content: {
        message_text:
          `<b>${esc(user.username)}</b> · уровень ${user.level.icon} <b>${esc(user.level.title)}</b>\n` +
          `🏆 Достижений: ${user.achievements_unlocked}/${user.achievements_total}`,
        parse_mode: 'HTML',
      },
    },
  ];

  await tg.answerInlineQuery(query.id, results, { cacheTime: 30 });
}
