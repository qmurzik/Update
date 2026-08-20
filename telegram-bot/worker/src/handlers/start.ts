import type { Ctx } from './context';
import { mainMenu } from '../telegram/keyboards';
import { isAdmin } from '../config';
import { clearState } from '../db';
import { DIVIDER, esc } from '../util';
import { reply } from './reply';

const WELCOME = `<b>👋 QMods Bot</b>
${DIVIDER}

Дополнительный канал управления вашим аккаунтом QMods — тем же самым, что и в личном кабинете <a href="https://qmods.ru/mod">qmods.ru/mod</a>.

Здесь можно смотреть подписку, устройства, историю платежей и получать уведомления, не заходя на сайт.`;

/** /start — greet, resolve link status, show the main menu. */
export async function handleStart(ctx: Ctx): Promise<void> {
  await clearState(ctx.env, ctx.chatId);
  await showMainMenu(ctx, WELCOME);
}

export async function showMainMenu(ctx: Ctx, prefaceText?: string): Promise<void> {
  const me = await ctx.api.me(ctx.telegramId);
  const linked = !!me.linked;
  const admin = isAdmin(ctx.env, ctx.telegramId);

  const lines: string[] = [];
  if (prefaceText) lines.push(prefaceText, '');

  if (linked && me.user) {
    lines.push(`👤 Вы вошли как <b>${esc(me.user.username)}</b>`);
  } else {
    lines.push('🔒 Аккаунт QMods ещё не привязан. Нажмите кнопку ниже, чтобы подключить бота к вашему личному кабинету.');
  }

  await reply(ctx, lines.join('\n'), mainMenu(linked, admin));
}
