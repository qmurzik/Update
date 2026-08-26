import type { Env } from '../config';
import { isAdmin } from '../config';
import { QmodsAdminApi, QmodsUserApi } from '../qmodsApi';
import { checkRateLimit } from '../db';
import { reportError } from '../errorReport';
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
      return json(await api.deviceRemove(telegramId, deviceId));
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

    // ============================================================
    // Admin — gated on isAdmin(), same ADMIN_TELEGRAM_IDS as the chat bot.
    // ============================================================

    case 'admin_stats':
    case 'admin_users':
    case 'admin_user':
    case 'admin_issue':
    case 'admin_remove':
    case 'admin_delete_user':
    case 'admin_send_notification': {
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

    case 'admin_delete_user':
      return json(await adminApi.deleteUser(String(body.username ?? '')));

    case 'admin_send_notification': {
      const target = body.target ? String(body.target) : undefined;
      return json(await adminApi.sendNotification(String(body.title ?? ''), String(body.message ?? ''), target));
    }

    default:
      return json({ success: false, error: 'Unknown action' }, 400);
  }
}
