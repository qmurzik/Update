import type { Env } from '../config';
import { isAdmin } from '../config';
import { buildCtx } from './context';
import { clearState, getState } from '../db';
import type { TgUpdate } from '../telegram/types';
import { handleStart, showMainMenu } from './start';
import { askUnlink, cancelLink, confirmUnlink, handleLinkCodeInput, startLink } from './link';
import { showProfile } from './profile';
import { showSubscription } from './subscription';
import { askRemoveDevice, confirmRemoveDevice, showDevices } from './devices';
import { showPayments } from './payments';
import { markAllRead, showNotifications } from './notifications';
import { showSupport } from './support';
import {
  askBroadcast,
  askDelete,
  askIssue,
  askMessage,
  askRemove,
  askSearch,
  confirmDelete,
  confirmRemove,
  handleBroadcastInput,
  handleIssueInput,
  handleMessageInput,
  handleSearchInput,
  showAdminMenu,
  showCurrentCard,
  showStats,
  showUsersList,
} from './admin';
import { reply } from './reply';

const CALLBACK_HANDLERS: Record<string, (ctx: ReturnType<typeof buildCtx>) => Promise<void>> = {
  'm:main': (ctx) => showMainMenu(ctx),
  'm:profile': showProfile,
  'm:sub': showSubscription,
  'm:devices': showDevices,
  'm:pay': showPayments,
  'm:notif': showNotifications,
  'm:support': showSupport,
  'link:start': startLink,
  'link:cancel': cancelLink,
  'link:unlink:ask': askUnlink,
  'link:unlink:yes': confirmUnlink,
  'dev:rm:ask': askRemoveDevice,
  'dev:rm:yes': confirmRemoveDevice,
  'notif:readall': markAllRead,
  'adm:menu': showAdminMenu,
  'adm:stats': showStats,
  'adm:search': askSearch,
  'adm:issue': askIssue,
  'adm:msg': askMessage,
  'adm:rm:ask': askRemove,
  'adm:rm:yes': confirmRemove,
  'adm:del:ask': askDelete,
  'adm:del:yes': confirmDelete,
  'adm:broadcast': askBroadcast,
  'adm:card': showCurrentCard,
};

/**
 * Callback data carrying a dynamic suffix (page number, username) — handled
 * by prefix rather than an exact CALLBACK_HANDLERS entry. Checked only after
 * an exact-match lookup misses.
 */
function matchDynamicCallback(data: string): ((ctx: ReturnType<typeof buildCtx>) => Promise<void>) | null {
  if (data.startsWith('adm:users:')) {
    const page = parseInt(data.slice('adm:users:'.length), 10);
    return (ctx) => showUsersList(ctx, Number.isFinite(page) ? page : 0);
  }
  if (data.startsWith('adm:u:')) {
    const username = data.slice('adm:u:'.length);
    return (ctx) => handleSearchInput(ctx, username);
  }
  return null;
}

// Text-input states only reachable from an admin flow — double-checked here
// in case D1 state ever outlives an admin's access being revoked.
const ADMIN_STATES = new Set(['admin_search', 'admin_issue_days', 'admin_msg_text', 'admin_broadcast_text']);

export async function handleUpdate(update: TgUpdate, env: Env): Promise<void> {
  if (update.callback_query) {
    await handleCallback(update, env);
    return;
  }
  if (update.message?.text) {
    await handleMessage(update, env);
  }
}

async function handleMessage(update: TgUpdate, env: Env): Promise<void> {
  const msg = update.message!;
  const chatId = msg.chat.id;
  const telegramId = String(msg.from?.id ?? chatId);
  const text = (msg.text ?? '').trim();
  const ctx = buildCtx(env, chatId, telegramId);

  if (text.startsWith('/')) {
    const command = text.split(/[\s@]/)[0];
    await clearState(env, chatId);
    switch (command) {
      case '/start':
      case '/menu':
        return handleStart(ctx);
      case '/link':
        return startLink(ctx);
      case '/unlink':
        return askUnlink(ctx);
      case '/admin':
        return showAdminMenu(ctx);
      default:
        return reply(ctx, 'Неизвестная команда. Отправьте /start, чтобы открыть меню.');
    }
  }

  const state = await getState(env, chatId);
  if (!state) {
    return reply(ctx, 'Отправьте /start, чтобы открыть меню.');
  }

  if (ADMIN_STATES.has(state.awaiting) && !isAdmin(env, telegramId)) {
    await clearState(env, chatId);
    return reply(ctx, '⛔ Недостаточно прав.');
  }

  switch (state.awaiting) {
    case 'link_code':
      return handleLinkCodeInput(ctx, text);
    case 'admin_search':
      return handleSearchInput(ctx, text);
    case 'admin_issue_days':
      return handleIssueInput(ctx, String(state.payload.username ?? ''), text);
    case 'admin_msg_text':
      return handleMessageInput(ctx, String(state.payload.username ?? ''), text);
    case 'admin_broadcast_text':
      return handleBroadcastInput(ctx, text);
    default:
      await clearState(env, chatId);
      return reply(ctx, 'Отправьте /start, чтобы открыть меню.');
  }
}

async function handleCallback(update: TgUpdate, env: Env): Promise<void> {
  const cq = update.callback_query!;
  const chatId = cq.message?.chat.id;
  if (chatId === undefined) return;

  const telegramId = String(cq.from.id);
  const ctx = buildCtx(env, chatId, telegramId, { callbackQueryId: cq.id, messageId: cq.message?.message_id });
  const data = cq.data ?? '';

  const handler = CALLBACK_HANDLERS[data] ?? matchDynamicCallback(data);
  if (!handler) {
    await ctx.tg.answerCallbackQuery(cq.id);
    return;
  }

  if (data.startsWith('adm:') && !isAdmin(env, telegramId)) {
    await ctx.tg.answerCallbackQuery(cq.id, '⛔ Недостаточно прав', true);
    return;
  }

  try {
    await handler(ctx);
    await ctx.tg.answerCallbackQuery(cq.id);
  } catch (err) {
    console.error('callback handler failed', data, err);
    await ctx.tg.answerCallbackQuery(cq.id, 'Произошла ошибка, попробуйте ещё раз', true);
  }
}
