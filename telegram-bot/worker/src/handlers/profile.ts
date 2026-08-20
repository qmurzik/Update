import type { Ctx } from './context';
import { profileKeyboard } from '../telegram/keyboards';
import { DIVIDER, esc } from '../util';
import { requireLinked } from './guard';
import { reply } from './reply';

export async function showProfile(ctx: Ctx): Promise<void> {
  const me = await ctx.api.me(ctx.telegramId);
  if (!(await requireLinked(ctx, me))) return;

  const u = me.user!;
  const text = [
    '<b>👤 Мой профиль</b>',
    DIVIDER,
    '',
    `Логин: <b>${esc(u.username)}</b>`,
    `ID пользователя: <code>${esc(u.id)}</code>`,
    `Дата регистрации: ${esc(u.created_text)}`,
    `Статус аккаунта: ${u.status === 'active' ? '🟢 активен' : '🔴 подписка не активна'}`,
    `Telegram: привязан ✅`,
  ].join('\n');

  await reply(ctx, text, profileKeyboard());
}
