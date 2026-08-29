import type { Env } from '../config';
import type { BotCommandScope, InlineKeyboard, InlineQueryResultArticle } from './types';

/**
 * Thin wrapper around the Telegram Bot API. No SDK dependency — Workers
 * runs `fetch` natively, so a hand-rolled client keeps the bundle tiny.
 */
export class TelegramClient {
  private readonly base: string;
  private readonly token: string;

  constructor(env: Env) {
    this.token = env.TELEGRAM_BOT_TOKEN;
    this.base = `https://api.telegram.org/bot${this.token}`;
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

  /**
   * Deletes a message — used right after a user sends their password in
   * chat (see handlers/link.ts handleLinkPasswordInput) so it doesn't sit
   * in plaintext in the chat history. Best-effort: whether a bot can
   * delete a message it didn't send in a private chat depends on the
   * Bot API version/age of the message, and this is privacy sugar, not
   * the actual auth boundary — callers should swallow failures.
   */
  deleteMessage(chatId: number | string, messageId: number) {
    return this.call('deleteMessage', { chat_id: chatId, message_id: messageId });
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
      allowed_updates: ['message', 'callback_query', 'inline_query'],
    });
  }

  /**
   * Answers an inline query (`@qmods_bot ...` typed in any chat) — see
   * handlers/inline.ts. Requires Inline Mode to be turned on for the bot via
   * @BotFather (`/setinline`), a one-time manual step the Bot API has no
   * endpoint for.
   */
  answerInlineQuery(inlineQueryId: string, results: InlineQueryResultArticle[], opts: { cacheTime?: number; isPersonal?: boolean } = {}) {
    return this.call('answerInlineQuery', {
      inline_query_id: inlineQueryId,
      results,
      cache_time: opts.cacheTime ?? 30,
      is_personal: opts.isPersonal ?? true,
    });
  }

  /**
   * Registers the "/" command menu Telegram shows next to the message
   * input. Scoped per-chat (BotCommandScopeChat) so admins can see a richer
   * menu without cluttering it for everyone else — see /setup-menu in
   * index.ts. A scoped call REPLACES that chat's list rather than merging
   * with the default scope, so the admin list must repeat the default
   * commands and add its own on top.
   */
  setMyCommands(commands: Array<{ command: string; description: string }>, scope: BotCommandScope) {
    return this.call('setMyCommands', { commands, scope });
  }

  /**
   * Persistent button next to the message compose bar that opens the Mini
   * App directly — Telegram's flagship "this bot is really an app" entry
   * point, distinct from the inline "Open Mini App" buttons already used
   * elsewhere in the keyboards.
   */
  setChatMenuButton(webAppUrl: string, text = 'Открыть QMods') {
    return this.call('setChatMenuButton', { menu_button: { type: 'web_app', text, web_app: { url: webAppUrl } } });
  }

  /**
   * Reacts to a message with a single emoji. Best-effort by design — only a
   * fixed Telegram-defined set of emoji is valid for reactions, so callers
   * should treat this as decorative and swallow failures rather than let a
   * rejected reaction break the surrounding flow.
   */
  setMessageReaction(chatId: number | string, messageId: number, emoji: string) {
    return this.call('setMessageReaction', { chat_id: chatId, message_id: messageId, reaction: [{ type: 'emoji', emoji }] });
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

  /**
   * Downloads a file the bot received (e.g. an admin-uploaded APK document
   * — see handlers/admin.ts handleApkDocument). The Bot API caps file
   * downloads at 20MB regardless of account type; callers must check
   * `message.document.file_size` BEFORE calling this, since a too-large
   * file_id makes getFile itself fail rather than truncate.
   */
  async downloadFile(fileId: string): Promise<ArrayBuffer> {
    const info = await this.call<{ file_path?: string }>('getFile', { file_id: fileId });
    if (!info.file_path) throw new Error('Telegram getFile returned no file_path');
    const res = await fetch(`https://api.telegram.org/file/bot${this.token}/${info.file_path}`);
    if (!res.ok) throw new Error(`Telegram file download failed: ${res.status}`);
    return res.arrayBuffer();
  }
}
