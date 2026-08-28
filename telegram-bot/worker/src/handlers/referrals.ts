import type { Ctx } from './context';
import { backButton } from '../telegram/keyboards';
import { DIVIDER, esc } from '../util';
import { requireLinked } from './guard';
import { reply } from './reply';

export async function showReferrals(ctx: Ctx): Promise<void> {
  const me = await ctx.api.me(ctx.telegramId);
  if (!(await requireLinked(ctx, me))) return;

  const res = await ctx.api.referrals(ctx.telegramId);
  const lines = [
    '<b>🎁 Рефералы</b>',
    DIVIDER,
    '',
    `<blockquote>Приглашено: <b>${res.ref_count}</b></blockquote>`,
    '',
    'Поделитесь этой ссылкой с друзьями — достижения и бонусные дни за приглашения я начислю сама, заходить на сайт не нужно.',
    '',
    `<code>${esc(res.ref_link)}</code>`,
    '',
    `Код: <code>${esc(res.ref_code)}</code>`,
  ];

  await reply(ctx, lines.join('\n'), backButton());
}
