import type { Env } from './config';
import { adminIds } from './config';
import { verifyWebhookSecret } from './security';
import { handleUpdate } from './handlers/router';
import { TelegramClient } from './telegram/client';
import { QmodsAdminApi, QmodsUserApi } from './qmodsApi';
import { esc, kiraImage } from './util';
import { reportError } from './errorReport';
import {
  checkRateLimit,
  createDevicePairing,
  getChatIdByUsername,
  getDevicePairing,
  getPaymentOrder,
  getUsernameByDeviceToken,
  markPaymentOrderPaid,
  revokeDeviceTokensForUsername,
} from './db';
import type { PaymentOrderRow } from './db';
import type { InlineKeyboard, TgUpdate } from './telegram/types';
import { APP_HTML } from './webapp/page';
import { handleWebAppApi } from './webapp/api';
import { parseNotification, verifyNotificationSignature } from './yoomoney';

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
}

/** Best-effort caller identity for rate-limiting anonymous device-auth routes — Cloudflare always sets this. */
function clientIp(request: Request): string {
  return request.headers.get('cf-connecting-ip') ?? 'unknown';
}

// The bot's "/" command menu — see /setup-menu below. Kept short and curated
// (full feature list stays discoverable via the Mini App menu button and
// the inline keyboards) rather than listing every callback-driven section.
const DEFAULT_COMMANDS = [
  { command: 'start', description: 'Открыть меню' },
  { command: 'menu', description: 'Главное меню' },
  { command: 'sub', description: 'Моя подписка' },
  { command: 'devices', description: 'Мои устройства' },
  { command: 'ach', description: 'Достижения и уровень' },
  { command: 'pay', description: 'История платежей' },
  { command: 'notif', description: 'Уведомления' },
  { command: 'link', description: 'Привязать аккаунт QMods' },
  { command: 'support', description: 'Поддержка' },
];
const ADMIN_COMMANDS = [...DEFAULT_COMMANDS, { command: 'admin', description: 'Админ-панель' }];

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    try {
      return await route(request, env, ctx, url);
    } catch (err) {
      console.error('fetch handler failed', url.pathname, err);
      ctx.waitUntil(reportError(env, err, `fetch ${request.method} ${url.pathname}`));
      return new Response('Internal error', { status: 500 });
    }
  },

  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(
      deliverPendingNotifications(env).catch((err) => {
        console.error('scheduled delivery failed', err);
        return reportError(env, err, 'scheduled: deliverPendingNotifications');
      })
    );
    ctx.waitUntil(
      deliverPendingPaymentAlerts(env).catch((err) => {
        console.error('scheduled payment alert delivery failed', err);
        return reportError(env, err, 'scheduled: deliverPendingPaymentAlerts');
      })
    );
  },
};

async function route(request: Request, env: Env, ctx: ExecutionContext, url: URL): Promise<Response> {
  // One-off convenience endpoint to (re)register the webhook with Telegram.
  // Gated by the webhook secret itself, so it's only usable by whoever can
  // already read the deployed secret (i.e. the operator running curl/browser
  // right after `wrangler secret put`), never by a random visitor.
  if (url.pathname === '/setup-webhook' && request.method === 'GET') {
    if (url.searchParams.get('token') !== env.TELEGRAM_WEBHOOK_SECRET) {
      return new Response('Forbidden', { status: 403 });
    }
    const tg = new TelegramClient(env);
    await tg.setWebhook(`${url.origin}/webhook`, env.TELEGRAM_WEBHOOK_SECRET);
    return new Response('Webhook registered', { status: 200 });
  }

  // One-off: sets the bot's Telegram-side name/description to Kira's
  // persona (setMyName/setMyDescription/setMyShortDescription — there is
  // no Bot API method for the bot's own avatar, that's still @BotFather's
  // /setuserpic). Same gating pattern as /setup-webhook.
  if (url.pathname === '/setup-profile' && request.method === 'GET') {
    if (url.searchParams.get('token') !== env.TELEGRAM_WEBHOOK_SECRET) {
      return new Response('Forbidden', { status: 403 });
    }
    const tg = new TelegramClient(env);
    await tg.setPersona(
      'Кира — QMods Bot',
      'Привет! Я Кира 🖤 Помогу привязать аккаунт QMods, буду следить за подпиской, устройствами и уведомлениями — прямо здесь, в Telegram, без захода на сайт.\n\nНажмите Start, чтобы начать.',
      'Кира — твой помощник QMods в Telegram: подписка, устройства, достижения 🖤'
    );
    return new Response('Profile updated. Аватар всё ещё нужно задать вручную через @BotFather -> /setuserpic.', { status: 200 });
  }

  // Mini App — static page + its one JSON API endpoint.
  if (url.pathname === '/app' && request.method === 'GET') {
    // about:blank when PUBLIC_URL isn't set yet — the onerror handlers on
    // each <img> hide it cleanly rather than showing a broken-image icon.
    const img = (name: string) => kiraImage(env, name) ?? 'about:blank';
    const html = APP_HTML.replaceAll('__SUBSCRIBE_URL__', env.QMODS_SUBSCRIBE_URL)
      .replaceAll('__KIRA_HERO__', img('kira-hero.webp'))
      .replaceAll('__KIRA_LOADING__', img('kira-loading.webp'))
      .replaceAll('__KIRA_EMPTY__', img('kira-empty.webp'));
    return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }
  if (url.pathname === '/app/api') {
    return handleWebAppApi(request, env);
  }

  // One-off: registers the "/" command menu (default + a richer one for
  // each admin's private chat via BotCommandScopeChat) and the persistent
  // chat menu button that opens the Mini App directly from the message
  // compose bar. Same gating pattern as /setup-webhook.
  if (url.pathname === '/setup-menu' && request.method === 'GET') {
    if (url.searchParams.get('token') !== env.TELEGRAM_WEBHOOK_SECRET) {
      return new Response('Forbidden', { status: 403 });
    }
    const tg = new TelegramClient(env);
    await tg.setMyCommands(DEFAULT_COMMANDS, { type: 'default' });
    const ids = adminIds(env);
    for (const id of ids) {
      await tg.setMyCommands(ADMIN_COMMANDS, { type: 'chat', chat_id: id });
    }
    let menuButtonMsg = 'menu button skipped (PUBLIC_URL not set)';
    if (env.PUBLIC_URL) {
      await tg.setChatMenuButton(`${env.PUBLIC_URL}/app`);
      menuButtonMsg = 'menu button -> Mini App';
    }
    return new Response(`Commands set (default + ${ids.length} admin scope(s)); ${menuButtonMsg}.`, { status: 200 });
  }

  // ============================================================
  // Device-auth handshake for the native Android app — see
  // handlers/devicePair.ts and README "Авторизация приложения через бота".
  // The app never holds a qmods.ru credential or this Worker's own PHP
  // token; it only ever gets a device_token minted here, after the account
  // owner confirms the pairing by opening a Telegram deep link into the bot.
  // ============================================================

  if (url.pathname === '/device/pair/start' && request.method === 'POST') {
    const allowed = await checkRateLimit(env, `device-pair-start:${clientIp(request)}`, 10, 600);
    if (!allowed) return jsonResponse({ success: false, error: 'Too many requests' }, 429);

    const code = await createDevicePairing(env);
    return jsonResponse({
      success: true,
      code,
      deep_link: `https://t.me/${env.BOT_USERNAME}?start=devicelink_${code}`,
      expires_in: 600,
    });
  }

  if (url.pathname === '/device/pair/status' && request.method === 'GET') {
    const code = (url.searchParams.get('code') ?? '').toUpperCase();
    if (!code) return jsonResponse({ success: false, error: 'Missing code' }, 400);

    const allowed = await checkRateLimit(env, `device-pair-status:${code}`, 150, 600);
    if (!allowed) return jsonResponse({ success: false, error: 'Too many requests' }, 429);

    const pairing = await getDevicePairing(env, code);
    if (!pairing) return jsonResponse({ success: true, status: 'expired' });
    if (pairing.status === 'pending') return jsonResponse({ success: true, status: 'pending' });
    if (pairing.status === 'rejected') return jsonResponse({ success: true, status: 'rejected', reason: pairing.reason ?? 'rejected' });
    return jsonResponse({ success: true, status: 'claimed', device_token: pairing.device_token });
  }

  // Alternative to opening the devicelink_ deep link — for a device that
  // has the app but no Telegram installed on it (see android-client/
  // README.md "Привязка по юзернейму"). The app sends the Telegram
  // @username the account owner typed; if that account has ever messaged
  // this bot before (from any device — that's the whole point), we can
  // message it a Confirm/Decline prompt. If it hasn't, a Telegram bot
  // fundamentally cannot reach it first — that's the platform's own
  // anti-spam rule, not something this endpoint can work around.
  if (url.pathname === '/device/pair/notify-username' && request.method === 'POST') {
    const code = (url.searchParams.get('code') ?? '').toUpperCase();
    const username = url.searchParams.get('username') ?? '';
    const deviceHint = (url.searchParams.get('device') ?? '').slice(0, 60);
    if (!code || !username) return jsonResponse({ success: false, error: 'Missing code or username' }, 400);

    const allowed = await checkRateLimit(env, `device-pair-notify:${code}`, 5, 600);
    if (!allowed) return jsonResponse({ success: false, error: 'Too many requests' }, 429);

    const pairing = await getDevicePairing(env, code);
    if (!pairing || pairing.status !== 'pending') {
      return jsonResponse({ success: false, error: 'invalid_or_expired_code' }, 400);
    }

    const chatId = await getChatIdByUsername(env, username);
    if (!chatId) {
      return jsonResponse({ success: false, error: 'telegram_not_started' }, 404);
    }

    const tg = new TelegramClient(env);
    const deviceText = esc(deviceHint || 'неизвестное устройство');
    const text =
      `🔐 <b>Вход в приложение QMods</b>\n\nКто-то пытается войти в приложение с устройства: <b>${deviceText}</b>.\n\n` +
      'Если это вы — подтвердите ниже. Если нет — просто отклоните, ничего не произойдёт.';
    const keyboard: InlineKeyboard = [
      [
        { text: '✅ Подтвердить', callback_data: `devicepair:confirm:${code}` },
        { text: '❌ Отклонить', callback_data: `devicepair:reject:${code}` },
      ],
    ];

    try {
      await tg.sendMessage(chatId, text, keyboard);
    } catch (err) {
      // Most likely the account blocked the bot after its last message —
      // we still have a chat_id on file (upsertTelegramUser doesn't know
      // that), but can't actually reach them.
      console.error('device pair notify-username sendMessage failed', chatId, err);
      return jsonResponse({ success: false, error: 'telegram_unreachable' }, 502);
    }

    return jsonResponse({ success: true });
  }

  if (url.pathname === '/device/subscription' && request.method === 'GET') {
    const token = url.searchParams.get('token') ?? '';
    if (!token) return jsonResponse({ success: false, error: 'Missing token' }, 400);

    const allowed = await checkRateLimit(env, `device-sub:${token}`, 30, 600);
    if (!allowed) return jsonResponse({ success: false, error: 'Too many requests' }, 429);

    const username = await getUsernameByDeviceToken(env, token);
    if (!username) return jsonResponse({ success: false, revoked: true, error: 'Unknown or revoked device token' }, 401);

    const versionCode = Number.parseInt(url.searchParams.get('version_code') ?? '', 10) || 0;
    const api = new QmodsUserApi(env);
    const res = await api.subscriptionByUsername(username, versionCode);
    if (!res.success) return jsonResponse({ success: false, error: 'Upstream error' }, 502);
    return jsonResponse({
      success: true,
      found: res.found,
      subscription: res.subscription,
      notifications: res.notifications ?? [],
      force_update: res.force_update ?? { required: false, message: '' },
    });
  }

  // Self-service "log out" from inside the app — see android-client/README.md
  // "Отвязка устройства из приложения". Best-effort: an unknown/already-dead
  // token still returns success (that's the caller's desired end state
  // either way), and D1 revocation always happens even if the qmods.ru
  // mirror call below fails — the D1 device_tokens row is what actually
  // gates /device/subscription, the site's own device_id field is only a
  // best-effort mirror for the bot's/cabinet's "Устройства" section.
  if (url.pathname === '/device/unlink' && request.method === 'POST') {
    const token = url.searchParams.get('token') ?? '';
    if (!token) return jsonResponse({ success: false, error: 'Missing token' }, 400);

    const allowed = await checkRateLimit(env, `device-unlink:${token}`, 10, 600);
    if (!allowed) return jsonResponse({ success: false, error: 'Too many requests' }, 429);

    const username = await getUsernameByDeviceToken(env, token);
    if (!username) return jsonResponse({ success: true, already_unlinked: true });

    await revokeDeviceTokensForUsername(env, username);
    const api = new QmodsUserApi(env);
    await api.deviceRemoveByUsername(username).catch((err) => console.error('device unlink: qmods.ru mirror failed', username, err));

    return jsonResponse({ success: true });
  }

  // Android crash reports (see android-client's CrashHandler/CrashReportRunnable)
  // — forwarded through the same admin-alert channel as the Worker's own
  // hidden errors (errorReport.ts), deduped by exception type + message +
  // top stack frame ONLY (not device/version/username, which vary per hit
  // of the very same crash — see reportError's signatureOverride param),
  // so one bad release doesn't flood admins with one alert per user.
  if (url.pathname === '/device/crash' && request.method === 'POST') {
    const allowed = await checkRateLimit(env, `device-crash:${clientIp(request)}`, 10, 600);
    if (!allowed) return jsonResponse({ success: false, error: 'Too many requests' }, 429);

    let body: { name?: unknown; message?: unknown; stack?: unknown; device?: unknown; version_name?: unknown; version_code?: unknown };
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ success: false, error: 'Invalid JSON' }, 400);
    }

    const name = String(body.name ?? 'Error').slice(0, 200);
    const message = String(body.message ?? '').slice(0, 500);
    const stack = String(body.stack ?? '').slice(0, 4000);
    const device = String(body.device ?? '').slice(0, 100);
    const versionName = String(body.version_name ?? '').slice(0, 50);
    const versionCode = Number(body.version_code ?? 0) || 0;

    const token = url.searchParams.get('token') ?? '';
    const username = token ? await getUsernameByDeviceToken(env, token) : null;

    // Android's Log.getStackTraceString() output already starts with the
    // exception's own toString() ("Name: message\n\tat ...") — stack's first
    // line is that header, not a real frame, so grab the first actual "at "
    // line instead (otherwise the dedup signature is needlessly widened by
    // whatever varies in the message, defeating the point of a separate
    // topFrame component).
    const topFrame = (stack.split('\n').find((line) => line.trim().startsWith('at ')) ?? '').trim().slice(0, 200);
    const signature = `android-crash|${name}|${message}|${topFrame}`.slice(0, 500);

    const syntheticError = new Error(message);
    syntheticError.name = name;
    // stack already carries "name: message" as its own first line — don't
    // prepend it again (that showed up as the header repeating 2-3x in the
    // Telegram alert: once from sendAlert's own "Тип:" line, once from this
    // prefix, once from stack's own toString()-derived first line).
    syntheticError.stack = stack || `${name}: ${message}`;

    const context = `android crash (${device || 'unknown device'}, v${versionName || '?'}/${versionCode}${username ? `, ${username}` : ''})`;
    ctx.waitUntil(reportError(env, syntheticError, context, signature));

    return jsonResponse({ success: true });
  }

  // ============================================================
  // ЮMoney HTTP-notification — see handlers/payment.ts and
  // yoomoney.ts. No custom headers/auth possible on ЮMoney's side; the
  // sha1_hash IS the only authentication, so every field is untrusted
  // until verifyNotificationSignature() passes.
  // ============================================================

  if (url.pathname === '/pay/yoomoney/webhook' && request.method === 'POST') {
    const bodyText = await request.text();
    const notification = parseNotification(new URLSearchParams(bodyText));

    const validSignature = await verifyNotificationSignature(env, notification);
    if (!validSignature) {
      console.error('yoomoney webhook: bad signature', notification.operation_id || '(no operation_id)');
      return new Response('Forbidden', { status: 403 });
    }

    // "true" means the payment is on hold (e.g. anti-fraud/protection-code)
    // and isn't real settled money yet — ack (200, so it isn't retried
    // forever) but don't grant anything; a later notification for the same
    // operation, once accepted, will carry unaccepted=false.
    if (notification.unaccepted === 'true') {
      return new Response('OK', { status: 200 });
    }

    const order = await getPaymentOrder(env, notification.label);
    if (!order) {
      console.error('yoomoney webhook: unknown order label', notification.label);
      return new Response('OK', { status: 200 });
    }

    const receivedAmount = Number.parseFloat(notification.amount);
    if (!Number.isFinite(receivedAmount) || receivedAmount < order.amount - 0.01) {
      console.error('yoomoney webhook: amount mismatch', order.id, notification.amount, 'expected', order.amount);
      ctx.waitUntil(reportError(env, new Error(`ЮMoney amount mismatch on order ${order.id}`), 'yoomoney webhook'));
      return new Response('OK', { status: 200 });
    }

    // Idempotency guard — markPaymentOrderPaid only flips a still-'pending'
    // row, so a retried notification for an already-granted order is a
    // harmless no-op here (ЮMoney resends until it gets HTTP 200).
    const granted = await markPaymentOrderPaid(env, order.id, notification.operation_id);
    if (granted) {
      ctx.waitUntil(
        finalizePayment(env, order).catch((err) => {
          console.error('yoomoney webhook: finalizePayment failed', order.id, err);
          return reportError(env, err, `yoomoney webhook: finalizePayment(${order.id})`);
        })
      );
    }

    return new Response('OK', { status: 200 });
  }

  if (url.pathname !== '/webhook' || request.method !== 'POST') {
    return new Response('Not found', { status: 404 });
  }

  if (!verifyWebhookSecret(request, env)) {
    return new Response('Forbidden', { status: 403 });
  }

  let update: TgUpdate;
  try {
    update = await request.json();
  } catch {
    return new Response('Bad request', { status: 400 });
  }

  // Ack Telegram immediately; do the actual work in the background so a
  // slow downstream call to qmods.ru never causes Telegram to retry/duplicate.
  ctx.waitUntil(
    handleUpdate(update, env).catch((err) => {
      console.error('handleUpdate failed', err);
      return reportError(env, err, 'handleUpdate');
    })
  );

  return new Response('OK', { status: 200 });
}

/**
 * Runs on the Cron Trigger (see wrangler.toml). Pulls notifications created
 * by site-side events (payment success, expiring subscription, admin
 * broadcasts/messages — anything that called notify_user_event() /
 * notify_broadcast_event() in bot_notify.php) that haven't reached Telegram
 * yet, and delivers them.
 */
async function deliverPendingNotifications(env: Env): Promise<void> {
  const tg = new TelegramClient(env);
  const adminApi = new QmodsAdminApi(env);

  const res = await adminApi.pendingTelegramPushes(100);
  const items = res.items ?? [];
  if (items.length === 0) return;

  const acked: Array<{ notification_id: string; user_id: string }> = [];

  for (const item of items) {
    try {
      await tg.sendMessage(item.telegram_id, `<b>${esc(item.title)}</b>\n\n${esc(item.message)}`);
    } catch (err) {
      // Most common cause: user blocked the bot. Ack anyway so this item
      // doesn't get retried forever; the failure is still visible in `wrangler tail`.
      console.error('push delivery failed', item.telegram_id, err);
    }
    acked.push({ notification_id: item.notification_id, user_id: item.user_id });
  }

  if (acked.length > 0) {
    await adminApi.ackTelegramPush(acked);
  }
}

/**
 * Runs on the same Cron Trigger — "кто/когда/что купил" alerts for the
 * project owner(s), queued by notify_admin_payment_event() (see
 * INTEGRATION.md "Алерт админу об оплате"). Separate from
 * deliverPendingNotifications: these never reach the buyer, only
 * ADMIN_TELEGRAM_IDS.
 */
async function deliverPendingPaymentAlerts(env: Env): Promise<void> {
  const ids = adminIds(env);
  if (ids.length === 0) return;

  const tg = new TelegramClient(env);
  const adminApi = new QmodsAdminApi(env);

  const res = await adminApi.pendingPaymentAlerts(100);
  const items = res.items ?? [];
  if (items.length === 0) return;

  for (const item of items) {
    const dateText = new Date(item.created_at * 1000).toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/Moscow',
    });
    const who = item.telegram_id ? `${esc(item.username)} (id <code>${esc(item.telegram_id)}</code>)` : esc(item.username);
    const daysText = item.days > 0 ? ` · ${item.days} дн.` : '';
    const text = `💰 <b>Новая оплата</b>\n\nПользователь: ${who}\nПлан: ${esc(item.plan)}${daysText}\nСумма: ${item.amount} ₽\nДата: ${dateText}`;

    for (const id of ids) {
      await tg.sendMessage(id, text).catch((err) => console.error('payment alert delivery failed', id, err));
    }
  }
}

/**
 * Applies a just-confirmed ЮMoney payment: grants the days via
 * mod/admin/bot.php's record_payment (extends subscription + logs payment
 * history), then confirms directly to the buyer. record_payment also
 * queues the same confirmation via notify_user_event() (so it shows in
 * the cabinet bell too) — acking it here via ackTelegramPush prevents the
 * 5-min cron from delivering that same message a second time (same fix as
 * handleMessageInput's dedupe, see handlers/admin.ts).
 */
async function finalizePayment(env: Env, order: PaymentOrderRow): Promise<void> {
  const adminApi = new QmodsAdminApi(env);
  const res = await adminApi.recordPayment(order.username, order.plan_title, order.days, order.amount);
  if (!res.success) {
    throw new Error(`record_payment failed for order ${order.id}: ${res.error ?? 'unknown'}`);
  }

  const tg = new TelegramClient(env);
  const sent = await tg
    .sendMessage(order.telegram_id, `✅ <b>Оплата получена!</b>\n\nПодписка «${esc(order.plan_title)}» активирована на ${order.days} дн. Спасибо!`)
    .then(() => true)
    .catch((err) => {
      console.error('payment confirmation delivery failed', order.telegram_id, err);
      return false;
    });

  if (sent && res.notification_id && res.user_id) {
    await adminApi.ackTelegramPush([{ notification_id: res.notification_id, user_id: res.user_id }]).catch(() => undefined);
  }
}
