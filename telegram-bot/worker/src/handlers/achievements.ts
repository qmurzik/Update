import type { Ctx } from './context';
import { backButton } from '../telegram/keyboards';
import { DIVIDER, daysRu, esc } from '../util';
import { requireLinked } from './guard';
import { reply } from './reply';

export async function showAchievements(ctx: Ctx): Promise<void> {
  const me = await ctx.api.me(ctx.telegramId);
  if (!(await requireLinked(ctx, me))) return;

  const res = await ctx.api.achievements(ctx.telegramId);
  const lines: string[] = ['<b>🏆 Достижения</b>', DIVIDER, ''];

  if (res.level_up) {
    lines.push(`<blockquote>🎉 Ура, новый уровень: <b>${esc(res.level.title)}</b>! Я уже начислила ${daysRu(res.bonus_days)} на подписку — горжусь вами.</blockquote>`, '');
  } else if (res.newly_unlocked.length > 0) {
    lines.push(`<blockquote>🎉 Открыто новое достижение! +${res.bonus_days} дн. к подписке — так держать.</blockquote>`, '');
  }

  const p = res.progress;
  const progressLine = p.next_code
    ? `${p.closest ? `${p.closest.current}/${p.closest.min} ${esc(p.closest.label)}` : `${p.percent}%`} → ${esc(p.next_title ?? '')}`
    : 'максимальный уровень достигнут';
  lines.push(`<blockquote>${res.level.icon} <b>${esc(res.level.title)}</b>\n${progressLine}</blockquote>`);
  lines.push('', esc(res.level.perks));

  const earned = res.achievements.filter((a) => a.earned);
  const locked = res.achievements.filter((a) => !a.earned);

  lines.push('', `<b>Получено ${earned.length} из ${res.achievements.length}</b>`);
  for (const a of earned) {
    lines.push(`${a.icon} <b>${esc(a.title)}</b> — +${daysRu(a.bonus)}`);
  }

  if (locked.length > 0) {
    lines.push('', '<b>Ещё не открыто:</b>');
    for (const a of locked) {
      lines.push(`🔒 ${esc(a.title)} — ${esc(a.desc)} · +${daysRu(a.bonus)}`);
    }
  }

  await reply(ctx, lines.join('\n'), backButton());
}
