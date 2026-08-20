import type { Env } from '../config';
import { QmodsUserApi } from '../qmodsApi';
import { checkRateLimit } from '../db';
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
  const api = new QmodsUserApi(env);

  switch (action) {
    case 'me':
      return json(await api.me(telegramId));

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

    default:
      return json({ success: false, error: 'Unknown action' }, 400);
  }
}
