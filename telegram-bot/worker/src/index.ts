import type { Env } from './config';
import { adminIds } from './config';
import { verifyWebhookSecret } from './security';
import { handleUpdate } from './handlers/router';
import { TelegramClient } from './telegram/client';
import { QmodsAdminApi, QmodsUserApi } from './qmodsApi';
import { esc, kiraImage } from './util';
import { reportError } from './errorReport';
import { checkRateLimit, createDevicePairing, getDevicePairing, getUsernameByDeviceToken } from './db';
import type { TgUpdate } from './telegram/types';
import { APP_HTML } from './webapp/page';
import { handleWebAppApi } from './webapp/api';

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
