import type { Ctx } from './context';
import { supportKeyboard } from '../telegram/keyboards';
import { DIVIDER } from '../util';
import { reply } from './reply';

export async function showSupport(ctx: Ctx): Promise<void> {
  const text =
    `<b>🆘 Поддержка</b>\n${DIVIDER}\n\n` +
    'Проблема с доступом, оплатой или устройством? Опишите её на странице поддержки — ответим как можно быстрее. Общие вопросы можно задать в чате сообщества.';
  await reply(ctx, text, supportKeyboard(ctx.env));
}
