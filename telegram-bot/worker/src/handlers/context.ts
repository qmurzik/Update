import type { Env } from '../config';
import { TelegramClient } from '../telegram/client';
import { QmodsAdminApi, QmodsUserApi } from '../qmodsApi';

export interface Ctx {
  env: Env;
  tg: TelegramClient;
  api: QmodsUserApi;
  adminApi: QmodsAdminApi;
  chatId: number;
  telegramId: string;
  /** Present only when the update came from a callback query (button press). */
  callbackQueryId?: string;
  messageId?: number;
  /**
   * The user's own incoming message id, when this update is a plain text
   * message (not a button press) — used only for decorative
   * setMessageReaction calls, never for reply()'s edit-vs-send branching
   * (that's `messageId`, the bot's own message from a callback query; the
   * bot can't editMessageText on a message it didn't send).
   */
  incomingMessageId?: number;
}

export function buildCtx(env: Env, chatId: number, telegramId: string, extra: Partial<Ctx> = {}): Ctx {
  return {
    env,
    tg: new TelegramClient(env),
    api: new QmodsUserApi(env),
    adminApi: new QmodsAdminApi(env),
    chatId,
    telegramId,
    ...extra,
  };
}
