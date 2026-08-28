import type { Ctx } from './context';
import { mainMenu } from '../telegram/keyboards';
import { isAdmin } from '../config';
import { clearState } from '../db';
import { DIVIDER, esc, kiraImage } from '../util';
import { reply } from './reply';

const KIRA_INTRO =
  'Привет, я Кира 💜 Буду рядом и присмотрю за твоим QMods прямо здесь, в Telegram — подписка, устройства, достижения и уведомления под рукой, без захода на сайт.';

const WELCOME = `<b>Привет! Чем помочь?</b>
${DIVIDER}

Аккаунт тот же, что и в личном кабинете <a href="https://qmods.ru/mod">qmods.ru/mod</a> — просто теперь я тоже за ним слежу.`;

/** /start — Kira's intro photo (once), then greet, resolve link status, show the main menu. */
export async function handleStart(ctx: Ctx): Promise<void> {
  await clearState(ctx.env, ctx.chatId);

  const photoUrl = kiraImage(ctx.env, 'kira-hero.jpg');
  if (photoUrl) {
    // Отдельным сообщением: если editMessageText потом захочет отредактировать
    // текстовое меню, оно не должно зависеть от того, есть фото или нет.
    await ctx.tg.sendPhoto(ctx.chatId, photoUrl, KIRA_INTRO).catch(() => undefined);
  }

  await showMainMenu(ctx, WELCOME);
}

export async function showMainMenu(ctx: Ctx, prefaceText?: string): Promise<void> {
  const me = await ctx.api.me(ctx.telegramId);
  const linked = !!me.linked;
  const admin = isAdmin(ctx.env, ctx.telegramId);

  const lines: string[] = [];
  if (prefaceText) lines.push(prefaceText, '');

  if (linked && me.user) {
    const sub = me.user.subscription;
    const statusLine = !sub.plan || sub.plan === 'none'
      ? 'подписки нет'
      : sub.active
        ? `🟢 активна · осталось ${sub.days_left} дн.`
        : `🔴 истекла ${esc(sub.expires_text)}`;
    lines.push(`👤 <b>${esc(me.user.username)}</b>`);
    lines.push(`<blockquote>${statusLine}</blockquote>`);
  } else {
    lines.push(
      '🔒 Аккаунт QMods пока не привязан — давай это исправим. Если уже регистрировались на сайте, привяжите его кодом из кабинета; а если нет — заведём новый прямо здесь, без сайта.'
    );
  }

  await reply(ctx, lines.join('\n'), mainMenu(ctx.env, linked, admin));
}
