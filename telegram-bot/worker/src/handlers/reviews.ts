import type { Ctx } from './context';
import { backButton, cancelKeyboard, reviewStarsKeyboard } from '../telegram/keyboards';
import { DIVIDER, esc } from '../util';
import { clearState, setState } from '../db';
import { requireLinked } from './guard';
import { reply } from './reply';

const STARS = ['', '⭐️', '⭐️⭐️', '⭐️⭐️⭐️', '⭐️⭐️⭐️⭐️', '⭐️⭐️⭐️⭐️⭐️'];
const STATUS_LABEL: Record<string, string> = {
  approved: '✅ опубликован',
  pending: '⏳ на модерации',
};

export async function showReview(ctx: Ctx): Promise<void> {
  const me = await ctx.api.me(ctx.telegramId);
  if (!(await requireLinked(ctx, me))) return;

  const res = await ctx.api.review(ctx.telegramId);
  const lines = ['<b>⭐ Отзыв о QMods</b>', DIVIDER, ''];

  if (res.review) {
    lines.push(`${STARS[res.review.rating] ?? ''}`, '', esc(res.review.text), '', `Статус: ${STATUS_LABEL[res.review.status] ?? res.review.status}`);
  } else {
    lines.push('Поделитесь впечатлением — это помогает другим пользователям и нам самим. Выберите оценку:');
  }

  await reply(ctx, lines.join('\n'), reviewStarsKeyboard(!!res.review));
}

export async function pickStar(ctx: Ctx, rating: number): Promise<void> {
  await setState(ctx.env, ctx.chatId, 'review_text', { rating });
  await reply(
    ctx,
    `${STARS[rating]}\n\nТеперь опишите впечатление в паре предложений (минимум 10 символов).`,
    cancelKeyboard('m:review')
  );
}

export async function handleReviewText(ctx: Ctx, rating: number, text: string): Promise<void> {
  const trimmed = text.trim();
  if (trimmed.length < 10) {
    await reply(ctx, 'Слишком коротко — минимум 10 символов. Попробуйте ещё раз.', cancelKeyboard('m:review'));
    return;
  }

  const result = await ctx.api.reviewAdd(ctx.telegramId, rating, trimmed);
  await clearState(ctx.env, ctx.chatId);

  if (!result.success) {
    await reply(ctx, `❌ ${esc(String(result.error ?? 'Не удалось сохранить отзыв'))}`, backButton());
    return;
  }
  await reply(ctx, '✅ Спасибо! Отзыв отправлен на модерацию.', backButton());
}
