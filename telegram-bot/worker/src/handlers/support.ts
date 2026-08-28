import type { Ctx } from './context';
import { supportKeyboard } from '../telegram/keyboards';
import { DIVIDER } from '../util';
import { reply } from './reply';

export async function showSupport(ctx: Ctx): Promise<void> {
  const text =
    `<b>🆘 Нужна помощь?</b>\n${DIVIDER}\n\n` +
    'Если что-то с доступом, оплатой или устройством пошло не так — опишите это на странице поддержки, и вам ответят как можно быстрее. Не переживайте, разберёмся. С общими вопросами — в чат сообщества 💜';
  await reply(ctx, text, supportKeyboard(ctx.env));
}
