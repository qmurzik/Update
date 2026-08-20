import type { Ctx } from './context';
import type { InlineKeyboard } from '../telegram/types';

/** Edits the triggering message when this came from a button press, otherwise sends a new one. */
export async function reply(ctx: Ctx, text: string, keyboard?: InlineKeyboard): Promise<void> {
  if (ctx.messageId) {
    await ctx.tg.editMessageText(ctx.chatId, ctx.messageId, text, keyboard);
  } else {
    await ctx.tg.sendMessage(ctx.chatId, text, keyboard);
  }
}
