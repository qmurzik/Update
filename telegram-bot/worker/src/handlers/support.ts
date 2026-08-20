import type { Ctx } from './context';
import { supportKeyboard } from '../telegram/keyboards';
import { DIVIDER } from '../util';
import { reply } from './reply';

export async function showSupport(ctx: Ctx): Promise<void> {
  const text =
    `<b>🆘 Поддержка</b>\n${DIVIDER}\n\n` +
    'Если у вас проблема с доступом, оплатой или устройством — опишите её на странице поддержки QMods, и мы ответим как можно быстрее.';
  await reply(ctx, text, supportKeyboard(ctx.env));
}
