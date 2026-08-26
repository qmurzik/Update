import type { Env } from './config';

export interface QmodsApiResult {
  success: boolean;
  error?: string;
  [key: string]: unknown;
}

async function callApi<T = Record<string, unknown>>(
  url: string,
  token: string,
  action: string,
  params: Record<string, unknown> = {},
  method: 'GET' | 'POST' = 'GET'
): Promise<T & QmodsApiResult> {
  const headers: Record<string, string> = { 'X-QMods-Bot-Token': token };
  let target = url;
  let body: string | undefined;

  if (method === 'GET') {
    const qs = new URLSearchParams({ action, ...flatten(params) });
    target = `${url}?${qs.toString()}`;
  } else {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify({ action, ...params });
  }

  const res = await fetch(target, { method, headers, body });
  const json = (await res.json().catch(() => ({ success: false, error: 'Invalid JSON response' }))) as T & QmodsApiResult;
  return json;
}

function flatten(params: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    out[k] = Array.isArray(v) ? JSON.stringify(v) : String(v);
  }
  return out;
}

/** Client for mod/api/bot.php — user-facing actions, scoped by telegram_id. */
export class QmodsUserApi {
  private readonly url: string;
  private readonly token: string;

  constructor(env: Env) {
    this.url = `${env.QMODS_API_BASE}/mod/api/bot.php`;
    this.token = env.QMODS_BOT_API_TOKEN;
  }

  ping() {
    return callApi(this.url, this.token, 'ping');
  }

  plans() {
    return callApi<{ plans: Array<{ id: string; title: string; price: number; days: number }> }>(this.url, this.token, 'plans');
  }

  me(telegramId: string) {
    return callApi<{
      linked: boolean;
      user: null | {
        id: string;
        username: string;
        created_text: string;
        status: string;
        subscription: { plan: string; active: boolean; days_left: number; expires_at: number; expires_text: string };
        device: { linked: boolean; id: string };
        payments: Array<{ plan: string; amount: number; date: number; date_text: string }>;
        level: { code: string; title: string; icon: string; perks: string };
        achievements_unlocked: number;
        achievements_total: number;
        ref_count: number;
      };
    }>(this.url, this.token, 'me', { telegram_id: telegramId });
  }

  link(telegramId: string, code: string) {
    return callApi<{ linked: boolean; username?: string }>(this.url, this.token, 'link', { telegram_id: telegramId, code }, 'POST');
  }

  unlink(telegramId: string) {
    return callApi(this.url, this.token, 'unlink', { telegram_id: telegramId }, 'POST');
  }

  devices(telegramId: string) {
    return callApi<{
      devices: Array<{ id: string; id_short: string; name: string | null; android_version: string | null; added_at: number; last_seen: number }>;
    }>(this.url, this.token, 'devices', { telegram_id: telegramId });
  }

  deviceRemove(telegramId: string, deviceId: string) {
    return callApi(this.url, this.token, 'device_remove', { telegram_id: telegramId, device_id: deviceId }, 'POST');
  }

  notifications(telegramId: string) {
    return callApi<{ notifications: Array<{ id: string; title: string; message: string; created_at: number; unread: boolean }> }>(
      this.url,
      this.token,
      'notifications',
      { telegram_id: telegramId }
    );
  }

  notificationsAck(telegramId: string, ids: string[]) {
    return callApi(this.url, this.token, 'notifications_ack', { telegram_id: telegramId, ids }, 'POST');
  }

  achievements(telegramId: string) {
    return callApi<{
      level: { code: string; title: string; icon: string; perks: string };
      progress: {
        next_code: string | null;
        next_title: string | null;
        percent: number;
        closest: { label: string; current: number; min: number } | null;
      };
      stats: { payments: number; spent: number; days: number; refs: number };
      achievements: Array<{ code: string; title: string; desc: string; icon: string; bonus: number; earned: boolean }>;
      newly_unlocked: string[];
      level_up: string | null;
      bonus_days: number;
    }>(this.url, this.token, 'achievements', { telegram_id: telegramId });
  }

  referrals(telegramId: string) {
    return callApi<{ ref_code: string; ref_link: string; ref_count: number }>(this.url, this.token, 'referrals', {
      telegram_id: telegramId,
    });
  }

  appRelease() {
    return callApi<{ version: string; changelog: string; has_file: boolean; download_url: string | null; cabinet_url: string }>(
      this.url,
      this.token,
      'app_release'
    );
  }

  review(telegramId: string) {
    return callApi<{ review: { rating: number; text: string; status: string } | null }>(this.url, this.token, 'review', {
      telegram_id: telegramId,
    });
  }

  reviewAdd(telegramId: string, rating: number, text: string) {
    return callApi(this.url, this.token, 'review_add', { telegram_id: telegramId, rating, text }, 'POST');
  }

  /**
   * Narrow subscription-only lookup by username — backs `/device/subscription`
   * for the native app's device-auth flow (see db.ts). Server-to-server only:
   * the app never sees this call or this class's token, only the Worker does.
   */
  subscriptionByUsername(username: string) {
    return callApi<{
      found: boolean;
      subscription: { plan: string; active: boolean; days_left: number; expires_at: number; expires_text: string } | null;
    }>(this.url, this.token, 'device_subscription', { username });
  }
}

export interface AdminUserCard {
  id: string;
  username: string;
  telegram_id: string;
  device_id: string;
  subscription: { plan: string; active: boolean; days_left: number; expires_text: string };
  payments: Array<{ plan: string; amount: number; date_text: string }>;
}

export interface AdminUserSummary {
  id: string;
  username: string;
  plan: string;
  active: boolean;
  days_left: number;
  expires_text: string;
  telegram_id: string;
  device_id: string;
  created_text: string;
}

/** Client for mod/admin/bot.php — admin-only actions, separate token. */
export class QmodsAdminApi {
  private readonly url: string;
  private readonly token: string;

  constructor(env: Env) {
    this.url = `${env.QMODS_API_BASE}/mod/admin/bot.php`;
    this.token = env.QMODS_ADMIN_BOT_API_TOKEN;
  }

  stats() {
    return callApi<{ stats: Record<string, unknown> }>(this.url, this.token, 'stats');
  }

  users() {
    return callApi<{ users: AdminUserSummary[]; count: number }>(this.url, this.token, 'users');
  }

  user(username: string) {
    return callApi<{ found: boolean; user: AdminUserCard | null }>(this.url, this.token, 'user', { username });
  }

  issue(username: string, days: number) {
    return callApi<{ message: string }>(this.url, this.token, 'issue', { username, days }, 'POST');
  }

  remove(username: string) {
    return callApi<{ message: string }>(this.url, this.token, 'remove', { username }, 'POST');
  }

  deleteUser(username: string) {
    return callApi<{ message: string }>(this.url, this.token, 'delete_user', { username }, 'POST');
  }

  sendNotification(title: string, message: string, target?: string) {
    return callApi(this.url, this.token, 'send_notification', { title, message, target }, 'POST');
  }

  pendingTelegramPushes(limit = 100) {
    return callApi<{
      items: Array<{ notification_id: string; user_id: string; telegram_id: string; title: string; message: string; created_at: number }>;
    }>(this.url, this.token, 'pending_telegram_pushes', { limit });
  }

  ackTelegramPush(items: Array<{ notification_id: string; user_id: string }>) {
    return callApi(this.url, this.token, 'ack_telegram_push', { items }, 'POST');
  }
}
