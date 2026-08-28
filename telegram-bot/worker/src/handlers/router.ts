import type { Env } from '../config';
import { isAdmin } from '../config';
import { buildCtx } from './context';
import { clearState, getState, setState, upsertTelegramUser } from '../db';
import { reportError } from '../errorReport';
import type { TgUpdate } from '../telegram/types';
import { handleInlineQuery } from './inline';
import { handleDevicePairClaim, handleDevicePairReject } from './devicePair';
import { handleStart, showMainMenu } from './start';
import { askUnlink, cancelLink, confirmUnlink, handleLinkCodeInput, startLink } from './link';
import { cancelRegister, handleRegisterUsernameInput, startRegister, startWithReferral } from './register';
import { showProfile } from './profile';
import { showSubscription } from './subscription';
import { askRemoveDevice, confirmRemoveDevice, showDevices } from './devices';
import { showPayments } from './payments';
import { askBuyPlan, checkOrderStatus, handleBuyPlan, handlePaidReturn } from './payment';
import { markAllRead, showNotifications } from './notifications';
import { askSupportMessage, handleSupportMessageInput, showSupport } from './support';
import { showAchievements } from './achievements';
import { showReferrals } from './referrals';
import { showAppRelease } from './app';
import { handleReviewText, pickStar, showReview } from './reviews';
import {
  askAppVersion,
  askApkUpload,
  askBroadcast,
  askDelete,
  askIssue,
  askMessage,
  askReleaseInfo,
  askRemove,
  askSearch,
  confirmDelete,
  confirmRemove,
  generateApkShareLink,
  handleApkDocument,
  handleAppVersionInput,
  handleBroadcastInput,
  handleIssueInput,
  handleMessageInput,
  handleReleaseInfoInput,
  handleSearchInput,
  revokeApkShareLink,
  showAdminMenu,
  showAppManager,
  showCurrentCard,
  showSiteAuthGate,
  showStats,
  showUsersList,
  toggleSiteAuthGate,
} from './admin';
import { reply } from './reply';
import { cancelKeyboard } from '../telegram/keyboards';

const CALLBACK_HANDLERS: Record<string, (ctx: ReturnType<typeof buildCtx>) => Promise<void>> = {
  'm:main': (ctx) => showMainMenu(ctx),
  'm:profile': showProfile,
  'm:sub': showSubscription,
  'm:devices': showDevices,
  'm:pay': showPayments,
  'pay:plans': askBuyPlan,
  'm:notif': showNotifications,
  'm:support': showSupport,
  'sup:ask': askSupportMessage,
  'm:ach': showAchievements,
  'm:ref': showReferrals,
  'm:app': showAppRelease,
  'm:review': showReview,
  'link:start': startLink,
  'link:cancel': cancelLink,
  'link:unlink:ask': askUnlink,
  'link:unlink:yes': confirmUnlink,
  'reg:start': startRegister,
  'reg:cancel': cancelRegister,
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
  'adm:appver': askAppVersion,
  'adm:siteauth': showSiteAuthGate,
  'adm:card': showCurrentCard,
  'adm:app': showAppManager,
  'adm:app:release': askReleaseInfo,
  'adm:app:upload': askApkUpload,
  'adm:app:share': generateApkShareLink,
  'adm:app:revoke': revokeApkShareLink,
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
  if (data.startsWith('rev:star:')) {
    const rating = parseInt(data.slice('rev:star:'.length), 10);
    if (rating >= 1 && rating <= 5) return (ctx) => pickStar(ctx, rating);
  }
  if (data.startsWith('pay:plan:')) {
    const planId = data.slice('pay:plan:'.length);
    return (ctx) => handleBuyPlan(ctx, planId);
  }
  if (data.startsWith('pay:check:')) {
    const orderId = data.slice('pay:check:'.length);
    return (ctx) => checkOrderStatus(ctx, orderId);
  }
  // Buttons on the confirmation message sent by /device/pair/notify-username
  // — see handlers/devicePair.ts and android-client/README.md "Привязка по
  // юзернейму". Same CODE_RE as the devicelink_ deep link above.
  if (data.startsWith('devicepair:confirm:')) {
    const code = data.slice('devicepair:confirm:'.length);
    if (/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{8}$/.test(code)) return (ctx) => handleDevicePairClaim(ctx, code);
  }
  if (data.startsWith('devicepair:reject:')) {
    const code = data.slice('devicepair:reject:'.length);
    if (/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{8}$/.test(code)) return (ctx) => handleDevicePairReject(ctx, code);
  }
  if (data.startsWith('adm:siteauth:set:')) {
    const val = data.slice('adm:siteauth:set:'.length);
    if (val === '0' || val === '1') return (ctx) => toggleSiteAuthGate(ctx, val === '1');
  }
  return null;
}

// Text-input states only reachable from an admin flow — double-checked here
// in case D1 state ever outlives an admin's access being revoked.
const ADMIN_STATES = new Set([
  'admin_search',
  'admin_issue_days',
  'admin_msg_text',
  'admin_broadcast_text',
  'admin_app_version_text',
  'admin_release_text',
  'admin_apk_upload_wait',
]);

export async function handleUpdate(update: TgUpdate, env: Env): Promise<void> {
  const from = update.message?.from ?? update.callback_query?.from;
  const chatId = update.message?.chat.id ?? update.callback_query?.message?.chat.id;
  if (from && chatId !== undefined) {
    await upsertTelegramUser(env, String(chatId), from.username ?? null, from.first_name).catch((err) => console.error('upsertTelegramUser failed', err));
  }

  if (update.callback_query) {
    await handleCallback(update, env);
    return;
  }
  if (update.inline_query) {
    await handleInlineQuery(update.inline_query, env).catch((err) => {
      console.error('inline query failed', err);
      return reportError(env, err, 'inline_query');
    });
    return;
  }
  if (update.message?.document) {
    await handleDocument(update, env);
    return;
  }
  if (update.message?.text) {
    await handleMessage(update, env);
  }
}

/** Only reachable meaningfully via the admin "📤 Загрузить APK через бота" flow — see handlers/admin.ts handleApkDocument. */
async function handleDocument(update: TgUpdate, env: Env): Promise<void> {
  const msg = update.message!;
  const chatId = msg.chat.id;
  const telegramId = String(msg.from?.id ?? chatId);
  const ctx = buildCtx(env, chatId, telegramId, { incomingMessageId: msg.message_id });

  try {
    const state = await getState(env, chatId);
    if (state?.awaiting !== 'admin_apk_upload_wait' || !isAdmin(env, telegramId)) return;
    await handleApkDocument(ctx, msg.document!);
  } catch (err) {
    console.error('document handler failed', err);
    await reportError(env, err, 'document upload');
    await reply(ctx, '⚠️ Ой, что-то пошло не так на моей стороне — я уже в курсе, попробуйте ещё раз через минуту 💜').catch(() => undefined);
  }
}

async function handleMessage(update: TgUpdate, env: Env): Promise<void> {
  const msg = update.message!;
  const chatId = msg.chat.id;
  const telegramId = String(msg.from?.id ?? chatId);
  const text = (msg.text ?? '').trim();
  const ctx = buildCtx(env, chatId, telegramId, { incomingMessageId: msg.message_id });

  try {
    await dispatchMessage(ctx, env, chatId, telegramId, text);
  } catch (err) {
    console.error('message handler failed', text, err);
    await reportError(env, err, `message "${text.slice(0, 40)}"`);
    await reply(ctx, '⚠️ Ой, что-то пошло не так на моей стороне — я уже в курсе, попробуйте ещё раз через минуту 💜').catch(() => undefined);
  }
}

async function dispatchMessage(ctx: ReturnType<typeof buildCtx>, env: Env, chatId: number, telegramId: string, text: string): Promise<void> {
  if (text.startsWith('/')) {
    const parts = text.split(/\s+/);
    const command = parts[0].split('@')[0];
    const payload = parts[1] ?? '';
    await clearState(env, chatId);
    switch (command) {
      case '/start': {
        // Deep link from the cabinet's "Получить код привязки" button:
        // t.me/<bot>?start=link_<CODE> arrives here as "/start link_<CODE>".
        const deepLink = /^link_([A-Z0-9]{10})$/.exec(payload);
        if (deepLink) {
          await setState(env, chatId, 'link_code');
          return handleLinkCodeInput(ctx, deepLink[1]);
        }
        // Deep link opened by the Android app after POST /device/pair/start —
        // t.me/<bot>?start=devicelink_<CODE>, see handlers/devicePair.ts.
        const deviceLink = /^devicelink_([23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{8})$/.exec(payload);
        if (deviceLink) {
          return handleDevicePairClaim(ctx, deviceLink[1]);
        }
        // ЮMoney Quickpay successURL — t.me/<bot>?start=paid_<orderId>, see
        // handlers/payment.ts buildOrderUrl(). Just shows current order
        // status; the webhook (not this) is what actually grants the days.
        const paidReturn = /^paid_([0-9a-f]{32})$/.exec(payload);
        if (paidReturn) {
          return handlePaidReturn(ctx, paidReturn[1]);
        }
        // Referral link from `me`'s ref_link (mod/api/bot.php) —
        // t.me/<bot>?start=ref_<CODE>. See handlers/register.ts
        // startWithReferral — carries the code into registration only,
        // doesn't apply to /link (an existing account already has whatever
        // referred_by it was created with, if any).
        const refLink = /^ref_([0-9A-F]{6})$/.exec(payload);
        if (refLink) {
          return startWithReferral(ctx, refLink[1]);
        }
        return handleStart(ctx);
      }
      case '/menu':
        return handleStart(ctx);
      case '/sub':
        return showSubscription(ctx);
      case '/devices':
        return showDevices(ctx);
      case '/ach':
        return showAchievements(ctx);
      case '/pay':
        return showPayments(ctx);
      case '/notif':
        return showNotifications(ctx);
      case '/support':
        return showSupport(ctx);
      case '/link':
        return startLink(ctx);
      case '/unlink':
        return askUnlink(ctx);
      case '/admin':
        return showAdminMenu(ctx);
      default:
        return reply(ctx, 'Не поняла команду — отправьте /start, откроем меню заново.');
    }
  }

  const state = await getState(env, chatId);
  if (!state) {
    return reply(ctx, 'Отправьте /start, и я открою меню.');
  }

  if (ADMIN_STATES.has(state.awaiting) && !isAdmin(env, telegramId)) {
    await clearState(env, chatId);
    return reply(ctx, '⛔ Тут только для своих — недостаточно прав.');
  }

  switch (state.awaiting) {
    case 'link_code':
      return handleLinkCodeInput(ctx, text);
    case 'register_username':
      return handleRegisterUsernameInput(ctx, text, String(state.payload.ref ?? ''));
    case 'admin_search':
      return handleSearchInput(ctx, text);
    case 'admin_issue_days':
      return handleIssueInput(ctx, String(state.payload.username ?? ''), text);
    case 'admin_msg_text':
      return handleMessageInput(ctx, String(state.payload.username ?? ''), text);
    case 'admin_broadcast_text':
      return handleBroadcastInput(ctx, text);
    case 'admin_app_version_text':
      return handleAppVersionInput(ctx, text);
    case 'admin_release_text':
      return handleReleaseInfoInput(ctx, text);
    case 'admin_apk_upload_wait':
      return reply(ctx, 'Пришлите файл .apk документом (не текстом).', cancelKeyboard('adm:app'));
    case 'support_text':
      return handleSupportMessageInput(ctx, text);
    case 'review_text':
      return handleReviewText(ctx, Number(state.payload.rating ?? 0), text);
    default:
      await clearState(env, chatId);
      return reply(ctx, 'Отправьте /start, и я открою меню.');
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
    await reportError(env, err, `callback ${data}`);
    await ctx.tg.answerCallbackQuery(cq.id, 'Произошла ошибка, попробуйте ещё раз', true);
  }
}
