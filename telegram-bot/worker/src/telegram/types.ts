// Minimal Telegram Bot API types — only what this bot actually uses.
// Full schema: https://core.telegram.org/bots/api

export interface TgUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  username?: string;
}

export interface TgChat {
  id: number;
  type: string;
}

/** https://core.telegram.org/bots/api#document — only the fields the admin APK-upload flow needs. */
export interface TgDocument {
  file_id: string;
  file_name?: string;
  file_size?: number;
  mime_type?: string;
}

export interface TgMessage {
  message_id: number;
  from?: TgUser;
  chat: TgChat;
  text?: string;
  document?: TgDocument;
  date: number;
}

export interface TgCallbackQuery {
  id: string;
  from: TgUser;
  message?: TgMessage;
  data?: string;
}

export interface TgInlineQuery {
  id: string;
  from: TgUser;
  query: string;
  offset: string;
}

export interface TgUpdate {
  update_id: number;
  message?: TgMessage;
  callback_query?: TgCallbackQuery;
  inline_query?: TgInlineQuery;
}

/** Minimal subset of https://core.telegram.org/bots/api#inlinequeryresultarticle */
export interface InlineQueryResultArticle {
  type: 'article';
  id: string;
  title: string;
  description?: string;
  thumbnail_url?: string;
  input_message_content: { message_text: string; parse_mode?: 'HTML' };
}

/** https://core.telegram.org/bots/api#botcommandscope — only the shapes this bot uses. */
export interface BotCommandScope {
  type: 'default' | 'chat';
  chat_id?: number | string;
}

export interface InlineKeyboardButton {
  text: string;
  callback_data?: string;
  url?: string;
  /** Opens the Mini App (see worker/src/webapp/) inside Telegram instead of a browser tab. */
  web_app?: { url: string };
}

export type InlineKeyboard = InlineKeyboardButton[][];
