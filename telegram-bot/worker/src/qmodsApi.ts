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
        extra_device_slot: boolean;
        max_devices: number;
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

  /**
   * Alternative to `link()` for an existing site account when getting a
   * one-time code isn't practical (no site access, site login disabled,
   * etc.) — verifies straight against the site's own password hash
   * (`pass_hash`, same `password_verify()` as login.php), no code round
   * trip. Shares link's rate-limit budget server-side (`link_attempts_*`
   * in mod/api/bot.php) since both are "guess access to someone else's
   * account" attempts. See handlers/link.ts handleLinkPasswordInput.
   */
  linkByPassword(telegramId: string, username: string, password: string) {
    return callApi<{ linked?: boolean; username?: string }>(
      this.url,
      this.token,
      'link_by_password',
      { telegram_id: telegramId, username, password },
      'POST'
    );
  }

  unlink(telegramId: string) {
    return callApi(this.url, this.token, 'unlink', { telegram_id: telegramId }, 'POST');
  }

  /**
   * Creates a brand-new qmods.ru account straight from the bot — the
   * migration-era alternative to `link()` for people who never had a site
   * account. See handlers/register.ts. mod/api/bot.php's `register` action
   * links telegram_id immediately, no site password involved.
   */
  register(telegramId: string, username: string, ref?: string) {
    return callApi<{ username?: string; trial?: boolean }>(
      this.url,
      this.token,
      'register',
      { telegram_id: telegramId, username, ref },
      'POST'
    );
  }

  devices(telegramId: string) {
    return callApi<{
      devices: Array<{ id: string; id_short: string; name: string | null; android_version: string | null; added_at: number; last_seen: number }>;
    }>(this.url, this.token, 'devices', { telegram_id: telegramId });
  }

  deviceRemove(telegramId: string, deviceId: string) {
    return callApi(this.url, this.token, 'device_remove', { telegram_id: telegramId, device_id: deviceId }, 'POST');
  }

  /**
   * Registers a device_id on qmods.ru for a linked account — used by the
   * device-auth handshake (see db.ts / handlers/devicePair.ts) right after
   * a successful pairing claim, so the app shows up in the bot's/cabinet's
   * "Устройства" section like any other device.
   */
  deviceRegister(telegramId: string, deviceId: string) {
    return callApi(this.url, this.token, 'device_register', { telegram_id: telegramId, device_id: deviceId }, 'POST');
  }

  /**
   * Same as deviceRemove(), but keyed by username instead of telegram_id —
   * used by the self-service in-app "log out" (POST /device/unlink), which
   * only knows the device_token -> username mapping (D1), not the account's
   * telegram_id. See mod/api/bot.php `device_remove_by_username`.
   */
  deviceRemoveByUsername(username: string) {
    return callApi(this.url, this.token, 'device_remove_by_username', { username }, 'POST');
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
    return callApi<{ version: string; changelog: string; has_file: boolean; apk_size: number; download_url: string | null; cabinet_url: string }>(
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
   *
   * Also carries the app's own `versionCode` (0 if the client didn't send
   * one) so this single call can return the forced-update gate, and pulls
   * any pending in-app notifications for `username` — see android-client/
   * README.md "Проверка во время использования" for why these three
   * concerns share one round-trip instead of three.
   */
  subscriptionByUsername(username: string, versionCode = 0) {
    return callApi<{
      found: boolean;
      subscription: { plan: string; active: boolean; days_left: number; expires_at: number; expires_text: string } | null;
      notifications: Array<{ id: string; title: string; message: string; created_at: number }>;
      force_update: { required: boolean; message: string };
    }>(this.url, this.token, 'device_subscription', { username, version_code: versionCode });
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
    return callApi<{ notification_id?: string }>(this.url, this.token, 'send_notification', { title, message, target }, 'POST');
  }

  pendingTelegramPushes(limit = 100) {
    return callApi<{
      items: Array<{ notification_id: string; user_id: string; telegram_id: string; title: string; message: string; created_at: number }>;
    }>(this.url, this.token, 'pending_telegram_pushes', { limit });
  }

  ackTelegramPush(items: Array<{ notification_id: string; user_id: string }>) {
    return callApi(this.url, this.token, 'ack_telegram_push', { items }, 'POST');
  }

  /**
   * Records a REAL confirmed payment (ЮMoney webhook, sha1-verified) —
   * extends the subscription AND appends a payments[] entry (unlike
   * `issue`, which only extends — a manual admin grant isn't a purchase).
   * Also fires both notify_user_event (buyer) and notify_admin_payment_event
   * (owner alert) server-side, so the Worker doesn't need to duplicate that.
   */
  recordPayment(username: string, plan: string, days: number, amount: number) {
    return callApi<{ message: string; expires_at: number; user_id: string; notification_id: string }>(
      this.url,
      this.token,
      'record_payment',
      { username, plan, days, amount },
      'POST'
    );
  }

  /**
   * Grants the "клон" — a one-time purchase that raises the account's
   * device cap from 1 to 2 forever (see mod/admin/bot.php
   * grant_device_slot / db.ts claimDevicePairing). Unlike recordPayment(),
   * never touches subscription.expires_at. Fails with `already_granted` if
   * called twice for the same account (see handlers/payment.ts
   * handleBuyDeviceSlot, which also checks this before creating an order).
   */
  grantDeviceSlot(username: string, amount: number) {
    return callApi<{ message: string; user_id: string; notification_id: string }>(
      this.url,
      this.token,
      'grant_device_slot',
      { username, amount },
      'POST'
    );
  }

  /** "Кто/когда/что купил" alerts queued by notify_admin_payment_event() — see index.ts deliverPendingPaymentAlerts. */
  pendingPaymentAlerts(limit = 100) {
    return callApi<{
      items: Array<{ id: string; username: string; telegram_id: string; plan: string; amount: number; days: number; created_at: number }>;
    }>(this.url, this.token, 'pending_payment_alerts', { limit });
  }

  /** Current forced-update gate (0 = disabled) — for showing the admin the current value before they change it. */
  getAppVersion() {
    return callApi<{ min_version_code: number; message: string }>(this.url, this.token, 'get_app_version');
  }

  /**
   * Sets the minimum app versionCode allowed to keep running — the native
   * app compares this against its own PackageInfo.versionCode on every
   * subscription check (cold start AND the periodic in-use recheck) and
   * blocks with `message` if it's below this. 0 disables the gate.
   */
  setAppVersion(minVersionCode: number, message: string) {
    return callApi(this.url, this.token, 'set_app_version', { min_version_code: minVersionCode, message }, 'POST');
  }

  /** Current state of qmods.ru's own login/register forms (see handlers/admin.ts showSiteAuthGate). */
  getSiteAuthGate() {
    return callApi<{ enabled: boolean }>(this.url, this.token, 'get_site_auth_gate');
  }

  /**
   * Toggles whether qmods.ru's own login.php/register.php accept site-based
   * sign-ins — part of the migration to Telegram-only accounts. Never
   * touches already-linked accounts or the bot's own /link and /register
   * flows, which keep working regardless of this flag.
   */
  setSiteAuthGate(enabled: boolean) {
    return callApi<{ enabled: boolean }>(this.url, this.token, 'set_site_auth_gate', { enabled: enabled ? 1 : 0 }, 'POST');
  }

  /** Version/changelog/APK/share-link status — mirrors the site's admin/app.php panel. See handlers/admin.ts showAppManager. */
  getAppRelease() {
    return callApi<{
      version: string;
      changelog: string;
      has_file: boolean;
      apk_size: number;
      share_enabled: boolean;
      download_url: string | null;
    }>(this.url, this.token, 'get_app_release');
  }

  setAppRelease(version: string, changelog: string) {
    return callApi(this.url, this.token, 'set_app_release', { version, changelog }, 'POST');
  }

  /** (Re)generates the public APK download token — any previous link stops working immediately. */
  generateApkShareLink() {
    return callApi<{ download_url: string }>(this.url, this.token, 'generate_apk_share_link', {}, 'POST');
  }

  revokeApkShareLink() {
    return callApi(this.url, this.token, 'revoke_apk_share_link', {}, 'POST');
  }
}

/**
 * Uploads raw APK bytes straight from a Telegram document to
 * mod/admin/bot.php's apk_upload action — NOT through callApi() above,
 * since that helper always JSON-encodes the request body. Here the body
 * IS the file, so `action` travels in the query string instead (see the
 * PHP action's own comment for why). See handlers/admin.ts handleApkDocument.
 */
export async function uploadApkBinary(
  env: Env,
  bytes: ArrayBuffer,
  filename: string
): Promise<{ success: boolean; error?: string; size?: number; sha256?: string }> {
  const url = `${env.QMODS_API_BASE}/mod/admin/bot.php?action=apk_upload`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'X-QMods-Bot-Token': env.QMODS_ADMIN_BOT_API_TOKEN,
      'Content-Type': 'application/octet-stream',
      'X-Apk-Filename': encodeURIComponent(filename).slice(0, 500),
    },
    body: bytes,
  });
  return (await res.json().catch(() => ({ success: false, error: 'Invalid JSON response' }))) as {
    success: boolean;
    error?: string;
    size?: number;
    sha256?: string;
  };
}
