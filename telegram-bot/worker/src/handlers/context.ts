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
