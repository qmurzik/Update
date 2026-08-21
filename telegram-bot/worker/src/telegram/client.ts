import type { Env } from '../config';
import type { InlineKeyboard } from './types';

/**
 * Thin wrapper around the Telegram Bot API. No SDK dependency — Workers
 * runs `fetch` natively, so a hand-rolled client keeps the bundle tiny.
 */
export class TelegramClient {
  private readonly base: string;

  constructor(env: Env) {
    this.base = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}`;
  }

  private async call<T = unknown>(method: string, params: Record<string, unknown>): Promise<T> {
    const res = await fetch(`${this.base}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const json = (await res.json()) as { ok: boolean; result?: T; description?: string };
    if (!json.ok) {
      throw new Error(`Telegram API ${method} failed: ${json.description ?? res.status}`);
    }
    return json.result as T;
  }

  sendMessage(chatId: number | string, text: string, keyboard?: InlineKeyboard) {
    return this.call('sendMessage', {
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      reply_markup: keyboard ? { inline_keyboard: keyboard } : undefined,
    });
  }

  editMessageText(chatId: number | string, messageId: number, text: string, keyboard?: InlineKeyboard) {
    return this.call('editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      reply_markup: keyboard ? { inline_keyboard: keyboard } : undefined,
    }).catch(() => {
      // Editing fails if the text/keyboard is identical, or the message is
      // too old — falling back to a fresh message keeps the UX working.
      return this.sendMessage(chatId, text, keyboard);
    });
  }

  /** photoUrl must be publicly reachable — Telegram fetches it itself, we never upload bytes. */
  sendPhoto(chatId: number | string, photoUrl: string, caption?: string, keyboard?: InlineKeyboard) {
    return this.call('sendPhoto', {
      chat_id: chatId,
      photo: photoUrl,
      caption,
      parse_mode: 'HTML',
      reply_markup: keyboard ? { inline_keyboard: keyboard } : undefined,
    });
  }

  answerCallbackQuery(callbackQueryId: string, text?: string, showAlert = false) {
    return this.call('answerCallbackQuery', {
      callback_query_id: callbackQueryId,
      text,
      show_alert: showAlert,
    });
  }

  /** One-time setup call — see README "Подключение webhook". */
  setWebhook(url: string, secretToken: string) {
    return this.call('setWebhook', {
      url,
      secret_token: secretToken,
      allowed_updates: ['message', 'callback_query'],
    });
  }

  /**
   * One-time persona setup — the bot's own profile photo has no Bot API
   * method (only /setuserpic in @BotFather can set that), but its display
   * name and the two description fields shown before /start are settable
   * here. See index.ts's /setup-profile route.
   */
  async setPersona(name: string, description: string, shortDescription: string): Promise<void> {
    await this.call('setMyName', { name });
    await this.call('setMyDescription', { description });
    await this.call('setMyShortDescription', { short_description: shortDescription });
  }
}
