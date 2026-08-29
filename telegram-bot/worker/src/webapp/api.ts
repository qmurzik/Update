import type { Env } from '../config';
import { isAdmin } from '../config';
import { QmodsAdminApi, QmodsUserApi, uploadApkBinary } from '../qmodsApi';
import { checkRateLimit, createPaymentOrder, getPaymentOrder, revokeDeviceToken, revokeDeviceTokensForUsername } from '../db';
import { reportError } from '../errorReport';
import { buildQuickpayUrl } from '../yoomoney';
import { extractInitData, validateInitData } from './validate';

const LINK_RATE_MAX = 6;
const LINK_RATE_WINDOW = 600; // 10 минут, тот же лимит, что и в чат-боте

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
}

/**
 * Handles POST /app/api — the Mini App's only backend endpoint. Every
 * request must carry a fresh, HMAC-valid `Authorization: tma <initData>`
 * header (see validate.ts); the Telegram user id it yields is the only
 * source of truth for "whose account is this", the app can't spoof it by
 * passing a different telegram_id in the body.
 */
export async function handleWebAppApi(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') {
    return json({ success: false, error: 'Method not allowed' }, 405);
  }

  const initData = extractInitData(request.headers.get('Authorization'));
  if (!initData) {
    return json({ success: false, error: 'Missing Authorization' }, 401);
  }

  const validated = await validateInitData(initData, env.TELEGRAM_BOT_TOKEN);
  if (!validated) {
    return json({ success: false, error: 'Invalid or expired initData' }, 401);
  }

  const telegramId = String(validated.user.id);

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    // action-less requests (unlikely) fall through with an empty body
  }
  const action = String(body.action ?? '');

  try {
    return await dispatchAction(action, body, telegramId, env);
  } catch (err) {
    console.error('webapp api action failed', action, err);
    await reportError(env, err, `webapp/api action=${action}`);
    return json({ success: false, error: 'Внутренняя ошибка сервера' }, 500);
  }
}

async function dispatchAction(action: string, body: Record<string, unknown>, telegramId: string, env: Env): Promise<Response> {
  const api = new QmodsUserApi(env);
  const userIsAdmin = isAdmin(env, telegramId);

  switch (action) {
    case 'me': {
      const res = await api.me(telegramId);
      return json({ ...res, is_admin: userIsAdmin });
    }

    case 'link': {
      const code = String(body.code ?? '').trim().toUpperCase();
      const allowed = await checkRateLimit(env, `link:webapp:${telegramId}`, LINK_RATE_MAX, LINK_RATE_WINDOW);
      if (!allowed) return json({ success: false, error: 'Слишком много попыток, попробуйте позже' }, 429);
      return json(await api.link(telegramId, code));
    }

    case 'unlink':
      return json(await api.unlink(telegramId));

    case 'devices':
      return json(await api.devices(telegramId));

    case 'device_remove': {
      const deviceId = String(body.device_id ?? '');
      const res = await api.deviceRemove(telegramId, deviceId);
      // See handlers/devices.ts — device_id doubles as the device-auth
      // device_token when the device was paired via the Android app.
      if (res.success) await revokeDeviceToken(env, deviceId);
      return json(res);
    }

    case 'notifications':
      return json(await api.notifications(telegramId));

    case 'notifications_ack': {
      const ids = Array.isArray(body.ids) ? body.ids.map(String) : [];
      return json(await api.notificationsAck(telegramId, ids));
    }

    case 'achievements':
      return json(await api.achievements(telegramId));

    case 'referrals':
      return json(await api.referrals(telegramId));

    case 'app_release':
      return json(await api.appRelease());

    case 'review':
      return json(await api.review(telegramId));

    case 'review_add': {
      const rating = Number(body.rating ?? 0);
      const text = String(body.text ?? '');
      return json(await api.reviewAdd(telegramId, rating, text));
    }

    case 'plans':
      return json(await api.plans());

    // Creates a payment_orders row + ЮMoney Quickpay URL — mirrors the chat
    // bot's handleBuyPlan (handlers/payment.ts), same order flow, same
    // webhook. The Worker (not this endpoint) grants the days once the
    // webhook confirms payment — this only ever hands back a link to open.
    case 'pay_start': {
      const me = await api.me(telegramId);
      if (!me.linked || !me.user) return json({ success: false, error: 'Not linked' }, 403);

      const plansRes = await api.plans();
      const planId = String(body.plan_id ?? '');
      const plan = (plansRes.plans ?? []).find((p) => p.id === planId);
      if (!plan) return json({ success: false, error: 'Тариф не найден' }, 404);

      const orderId = await createPaymentOrder(env, {
        telegramId,
        username: me.user.username,
        planId: plan.id,
        planTitle: plan.title,
        days: plan.days,
        amount: plan.price,
      });
      const url = buildQuickpayUrl(env, {
        orderId,
        amount: plan.price,
        description: `QMods — ${plan.title}`,
        successUrl: `https://t.me/${env.BOT_USERNAME}?start=paid_${orderId}`,
      });
      return json({ success: true, order_id: orderId, url });
    }

    // Polled by the webapp after the user returns from the ЮMoney page —
    // the webhook is what actually grants anything, this just reports it.
    case 'pay_status': {
      const orderId = String(body.order_id ?? '');
      const order = await getPaymentOrder(env, orderId);
      if (!order) return json({ success: false, error: 'Order not found' }, 404);
      return json({ success: true, status: order.status, plan: order.plan_title, days: order.days, amount: order.amount });
    }

    // ============================================================
    // Admin — gated on isAdmin(), same ADMIN_TELEGRAM_IDS as the chat bot.
    // ============================================================

    case 'admin_stats':
    case 'admin_users':
    case 'admin_user':
    case 'admin_issue':
    case 'admin_remove':
    case 'admin_delete_user':
    case 'admin_send_notification':
    case 'admin_get_app_version':
    case 'admin_set_app_version':
    case 'admin_get_site_auth_gate':
    case 'admin_set_site_auth_gate':
    case 'admin_get_app_release':
    case 'admin_set_app_release':
    case 'admin_generate_apk_share_link':
    case 'admin_revoke_apk_share_link': {
      if (!userIsAdmin) return json({ success: false, error: 'Forbidden' }, 403);
      return handleAdminAction(action, body, env);
    }

    default:
      return json({ success: false, error: 'Unknown action' }, 400);
  }
}

async function handleAdminAction(action: string, body: Record<string, unknown>, env: Env): Promise<Response> {
  const adminApi = new QmodsAdminApi(env);

  switch (action) {
    case 'admin_stats':
      return json(await adminApi.stats());

    case 'admin_users':
      return json(await adminApi.users());

    case 'admin_user':
      return json(await adminApi.user(String(body.username ?? '')));

    case 'admin_issue':
      return json(await adminApi.issue(String(body.username ?? ''), Number(body.days ?? 0)));

    case 'admin_remove':
      return json(await adminApi.remove(String(body.username ?? '')));

    case 'admin_delete_user': {
      const username = String(body.username ?? '');
      const res = await adminApi.deleteUser(username);
      // Same D1 cleanup as handlers/admin.ts confirmDelete — see its comment.
      if (res.success) await revokeDeviceTokensForUsername(env, username);
      return json(res);
    }

    case 'admin_send_notification': {
      const target = body.target ? String(body.target) : undefined;
      return json(await adminApi.sendNotification(String(body.title ?? ''), String(body.message ?? ''), target));
    }

    case 'admin_get_app_version':
      return json(await adminApi.getAppVersion());

    case 'admin_set_app_version':
      return json(await adminApi.setAppVersion(Number(body.min_version_code ?? 0), String(body.message ?? '')));

    case 'admin_get_site_auth_gate':
      return json(await adminApi.getSiteAuthGate());

    case 'admin_set_site_auth_gate':
      return json(await adminApi.setSiteAuthGate(!!body.enabled));

    case 'admin_get_app_release':
      return json(await adminApi.getAppRelease());

    case 'admin_set_app_release':
      return json(await adminApi.setAppRelease(String(body.version ?? ''), String(body.changelog ?? '')));

    case 'admin_generate_apk_share_link':
      return json(await adminApi.generateApkShareLink());

    case 'admin_revoke_apk_share_link':
      return json(await adminApi.revokeApkShareLink());

    default:
      return json({ success: false, error: 'Unknown action' }, 400);
  }
}

/**
 * POST /app/api/apk — separate from the JSON-only /app/api above because
 * this body IS the file (raw bytes), same convention as the chat bot's
 * apk_upload flow (see qmodsApi.ts uploadApkBinary). Unlike a Telegram
 * document upload, a browser file input has no 20MB cap here — this is a
 * plain HTTPS POST, not routed through the Bot API's getFile.
 */
export async function handleWebAppApkUpload(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') {
    return json({ success: false, error: 'Method not allowed' }, 405);
  }

  const initData = extractInitData(request.headers.get('Authorization'));
  if (!initData) return json({ success: false, error: 'Missing Authorization' }, 401);

  const validated = await validateInitData(initData, env.TELEGRAM_BOT_TOKEN);
  if (!validated) return json({ success: false, error: 'Invalid or expired initData' }, 401);

  if (!isAdmin(env, String(validated.user.id))) {
    return json({ success: false, error: 'Forbidden' }, 403);
  }

  const filenameHeader = request.headers.get('X-Apk-Filename') ?? '';
  let filename = 'app.apk';
  try {
    filename = filenameHeader ? decodeURIComponent(filenameHeader) : filename;
  } catch {
    // malformed encoding — keep the fallback name, the bytes still upload fine
  }

  const bytes = await request.arrayBuffer();
  const res = await uploadApkBinary(env, bytes, filename);
  return json(res);
}
