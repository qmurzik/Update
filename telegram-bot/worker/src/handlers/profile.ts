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
    '<b>👤 Профиль</b>',
    DIVIDER,
    '',
    `<blockquote>${u.level.icon} ${esc(u.level.title)} · 🏆 ${u.achievements_unlocked}/${u.achievements_total} · 🎁 ${u.ref_count}</blockquote>`,
    '',
    `<b>${esc(u.username)}</b>`,
    `На QMods с ${esc(u.created_text)} · ID <code>${esc(u.id)}</code>`,
    '',
    'Telegram привязан ✅',
  ].join('\n');

  await reply(ctx, text, profileKeyboard());
}
