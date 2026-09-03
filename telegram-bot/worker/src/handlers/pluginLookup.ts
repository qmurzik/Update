import type { Env } from '../config';
import { getTelegramUsername } from '../db';
import { QmodsAdminApi } from '../qmodsApi';
import { verifyPluginLookupToken } from '../security';

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
}

/**
 * GET /plugin/lookup?telegram_id=<id> — the exteraGram plugin's direct,
 * unattended account lookup (see README "Быстрый переход из
 * Telegram-клиента"). Auth is PLUGIN_LOOKUP_TOKEN, not the admin bot token —
 * see config.ts for why. Deliberately returns only a minimal, read-only
 * subset of AdminUserCard (no payments, no device_id, no curator wards) —
 * this runs from a plugin file on the admin's phone with no session behind
 * it, so it should leak as little as possible if that file or token ever
 * gets out.
 */
export async function handlePluginLookup(request: Request, env: Env): Promise<Response> {
  if (!verifyPluginLookupToken(request, env)) {
    return json({ success: false, error: 'Forbidden' }, 403);
  }

  const url = new URL(request.url);
  const telegramId = (url.searchParams.get('telegram_id') ?? '').trim();
  if (!/^\d{1,20}$/.test(telegramId)) {
    return json({ success: false, error: 'Bad telegram_id' }, 400);
  }

  const adminApi = new QmodsAdminApi(env);
  const res = await adminApi.userByTelegramId(telegramId);
  if (!res.found || !res.user) {
    return json({ success: true, found: false });
  }

  const telegramUsername = await getTelegramUsername(env, telegramId);
  return json({
    success: true,
    found: true,
    username: res.user.username,
    telegram_id: res.user.telegram_id,
    telegram_username: telegramUsername,
    subscription: res.user.subscription,
    is_curator: res.user.is_curator,
    curator_username: res.user.curator_username,
  });
}
