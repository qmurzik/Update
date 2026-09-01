import type { Env } from './config';

export interface BotState {
  awaiting: string;
  payload: Record<string, unknown>;
}

/** Read the pending conversation state for a chat (e.g. "waiting for /link code"). */
export async function getState(env: Env, chatId: number): Promise<BotState | null> {
  const row = await env.DB.prepare('SELECT awaiting, payload FROM bot_state WHERE chat_id = ?')
    .bind(chatId)
    .first<{ awaiting: string; payload: string | null }>();
  if (!row) return null;
  return { awaiting: row.awaiting, payload: row.payload ? JSON.parse(row.payload) : {} };
}

export async function setState(env: Env, chatId: number, awaiting: string, payload: Record<string, unknown> = {}): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO bot_state (chat_id, awaiting, payload, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(chat_id) DO UPDATE SET awaiting = excluded.awaiting, payload = excluded.payload, updated_at = excluded.updated_at`
  )
    .bind(chatId, awaiting, JSON.stringify(payload), Date.now())
    .run();
}

export async function clearState(env: Env, chatId: number): Promise<void> {
  await env.DB.prepare('DELETE FROM bot_state WHERE chat_id = ?').bind(chatId).run();
}

/**
 * Sliding-window rate limit. Best-effort (read-then-write, not a single
 * atomic statement) — acceptable here because Telegram delivers updates for
 * one chat sequentially and the hard security boundary is the bcrypt-token
 * check + attempt counter on the PHP side (mod/api/bot.php). This just
 * stops obvious flooding/bruteforce from a single chat cheaply.
 */
export async function checkRateLimit(env: Env, key: string, max: number, windowSeconds: number): Promise<boolean> {
  const now = Date.now();
  const row = await env.DB.prepare('SELECT count, window_start FROM rate_limits WHERE key = ?')
    .bind(key)
    .first<{ count: number; window_start: number }>();

  if (!row || now - row.window_start > windowSeconds * 1000) {
    await env.DB.prepare(
      `INSERT INTO rate_limits (key, count, window_start) VALUES (?, 1, ?)
       ON CONFLICT(key) DO UPDATE SET count = 1, window_start = excluded.window_start`
    )
      .bind(key, now)
      .run();
    return true;
  }

  if (row.count >= max) return false;

  await env.DB.prepare('UPDATE rate_limits SET count = count + 1 WHERE key = ?').bind(key).run();
  return true;
}

export async function logAdminAction(env: Env, adminTelegramId: string, action: string, payload: Record<string, unknown> = {}): Promise<void> {
  await env.DB.prepare('INSERT INTO admin_audit_log (admin_telegram_id, action, payload, created_at) VALUES (?, ?, ?, ?)')
    .bind(adminTelegramId, action, JSON.stringify(payload), Date.now())
    .run();
}

// ============================================================
// Device-auth handshake for the native app — see handlers/devicePair.ts and
// README "Авторизация приложения через бота". Three moves: the app starts a
// pairing (gets a short code + deep link), the account owner claims it by
// opening that deep link in the bot, the app polls for the resulting
// device_token and uses it for subscription checks from then on.
// ============================================================

const PAIRING_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // no 0/O/1/I — avoids visual ambiguity if ever shown as text
const PAIRING_TTL_MS = 10 * 60 * 1000;

function randomHex(byteLength: number): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function randomPairingCode(length = 8): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => PAIRING_ALPHABET[b % PAIRING_ALPHABET.length]).join('');
}

export async function createDevicePairing(env: Env): Promise<string> {
  const code = randomPairingCode();
  await env.DB.prepare('INSERT INTO device_pairings (code, status, created_at) VALUES (?, ?, ?)').bind(code, 'pending', Date.now()).run();
  return code;
}

export interface DevicePairingRow {
  status: 'pending' | 'claimed' | 'rejected';
  device_token: string | null;
  reason: string | null;
  created_at: number;
}

export async function getDevicePairing(env: Env, code: string): Promise<DevicePairingRow | null> {
  const row = await env.DB.prepare('SELECT status, device_token, reason, created_at FROM device_pairings WHERE code = ?')
    .bind(code)
    .first<DevicePairingRow>();
  if (!row) return null;
  if (row.status === 'pending' && Date.now() - row.created_at > PAIRING_TTL_MS) return null; // expired, treat as gone
  return row;
}

/** Live device_token count for `username` — the basis for the device-cap check in claimDevicePairing() below. */
export async function countActiveDeviceTokens(env: Env, username: string): Promise<number> {
  const row = await env.DB.prepare('SELECT COUNT(*) as c FROM device_tokens WHERE username = ?').bind(username).first<{ c: number }>();
  return row?.c ?? 0;
}

export type ClaimResult = { ok: true; token: string } | { ok: false; reason: 'invalid' | 'device_limit' };

/**
 * Called from the bot's `/start devicelink_<CODE>` handler once the
 * chat's Telegram account is confirmed linked to `username`. Mints a new
 * long-lived device_token and marks the pairing claimed.
 *
 * DEVICE_PER_ACCOUNT cap: an account may have at most `maxDevices` live
 * device_tokens at a time (default 1) — a pairing attempt beyond that is
 * rejected (not silently replaced), so the app must either be unlinked via
 * "Устройства" or the account must buy a second slot ("клон", see
 * mod/admin/bot.php grant_device_slot / handlers/payment.ts
 * handleBuyDeviceSlot) before a new one can pair. Callers pass the
 * account's actual cap — see handlers/devicePair.ts, which reads it off
 * `me.user.max_devices`. The pairing row is marked 'rejected' (with a
 * reason) rather than left 'pending' so the app's poll sees this
 * immediately instead of just timing out after 5 minutes.
 *
 * Returns `{ ok: false, reason: 'invalid' }` for an unknown/expired/
 * already-claimed code — best-effort double-claim protection via the WHERE
 * clause (same accepted race-window tradeoff as checkRateLimit above; a
 * real collision would need two claims landing within milliseconds of each
 * other on the same freshly-generated code).
 */
export async function claimDevicePairing(env: Env, code: string, username: string, maxDevices = 1): Promise<ClaimResult> {
  const row = await getDevicePairing(env, code);
  if (!row || row.status !== 'pending') return { ok: false, reason: 'invalid' };

  if ((await countActiveDeviceTokens(env, username)) >= maxDevices) {
    await env.DB.prepare("UPDATE device_pairings SET status = 'rejected', reason = 'device_limit' WHERE code = ? AND status = 'pending'")
      .bind(code)
      .run();
    return { ok: false, reason: 'device_limit' };
  }

  const token = randomHex(24);
  const now = Date.now();
  const update = await env.DB.prepare("UPDATE device_pairings SET status = 'claimed', device_token = ?, claimed_at = ? WHERE code = ? AND status = 'pending'")
    .bind(token, now, code)
    .run();
  if (!update.meta.changes) return { ok: false, reason: 'invalid' };

  await env.DB.prepare('INSERT INTO device_tokens (token, username, created_at, last_seen) VALUES (?, ?, ?, ?)').bind(token, username, now, now).run();
  return { ok: true, token };
}

/** Resolves a device_token to its qmods.ru username, or null if unknown. Touches last_seen for observability. */
export async function getUsernameByDeviceToken(env: Env, token: string): Promise<string | null> {
  if (!token) return null;
  const row = await env.DB.prepare('SELECT username FROM device_tokens WHERE token = ?').bind(token).first<{ username: string }>();
  if (!row) return null;
  await env.DB.prepare('UPDATE device_tokens SET last_seen = ? WHERE token = ?').bind(Date.now(), token).run();
  return row.username;
}

/**
 * Revokes a device_token — called whenever a device is unlinked through the
 * existing "Устройства" flow (chat bot or Mini App), since that device_id
 * IS the token (see handlers/devicePair.ts). Without this, unlinking on
 * qmods.ru wouldn't actually cut the app's access: `/device/subscription`
 * only ever checks this table, not qmods.ru's own device_id field. No-op
 * (not an error) if the id isn't a device_token at all — plain devices
 * registered by other means never had a row here to begin with.
 */
export async function revokeDeviceToken(env: Env, deviceId: string): Promise<void> {
  if (!deviceId) return;
  await env.DB.prepare('DELETE FROM device_tokens WHERE token = ?').bind(deviceId).run();
}

/**
 * Clears ALL device_tokens for an account, not just the one mirrored into
 * qmods.ru's device_id field. Needed because that mirroring
 * (deviceRegister() in handlers/devicePair.ts) is best-effort — if it ever
 * fails, or a token predates it, D1 ends up with a row qmods.ru's own
 * device_id never reflected. Since ONE_DEVICE_PER_ACCOUNT then blocks any
 * new pairing on that orphaned row with no way to see or remove it from
 * "Устройства" (that list is driven by qmods.ru's device_id, not this
 * table), the "отвязать устройство" flow calls this unconditionally —
 * not just when qmods.ru itself shows a device — see handlers/devices.ts.
 */
export async function revokeDeviceTokensForUsername(env: Env, username: string): Promise<void> {
  if (!username) return;
  await env.DB.prepare('DELETE FROM device_tokens WHERE username = ?').bind(username).run();
}

export interface PaymentOrderRow {
  id: string;
  telegram_id: string;
  username: string;
  plan_id: string;
  plan_title: string;
  days: number;
  amount: number;
  status: 'pending' | 'paid';
  operation_id: string | null;
  created_at: number;
  paid_at: number | null;
}

/**
 * Starts a "Купить подписку" attempt (bot inline buttons or the Mini App's
 * "Оплата" tab) — see yoomoney.ts. The generated id is also used as
 * ЮMoney's Quickpay `label` param, so the webhook can resolve an incoming
 * notification back to who/what/how-much from OUR OWN record rather than
 * trusting the notification's own claims about the order.
 */
export async function createPaymentOrder(
  env: Env,
  args: { telegramId: string; username: string; planId: string; planTitle: string; days: number; amount: number }
): Promise<string> {
  const id = randomHex(16);
  await env.DB.prepare(
    'INSERT INTO payment_orders (id, telegram_id, username, plan_id, plan_title, days, amount, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  )
    .bind(id, args.telegramId, args.username, args.planId, args.planTitle, args.days, args.amount, 'pending', Date.now())
    .run();
  return id;
}

export async function getPaymentOrder(env: Env, id: string): Promise<PaymentOrderRow | null> {
  if (!id) return null;
  return env.DB.prepare('SELECT * FROM payment_orders WHERE id = ?').bind(id).first<PaymentOrderRow>();
}

/**
 * Marks an order paid — guarded by `AND status = 'pending'` so a retried
 * ЮMoney notification (it repeats delivery until it gets HTTP 200) can
 * never grant the same order's days twice. Returns true only for the
 * transition that actually happened (the caller should only extend the
 * subscription / send confirmations on a true result).
 */
export async function markPaymentOrderPaid(env: Env, id: string, operationId: string): Promise<boolean> {
  const res = await env.DB.prepare("UPDATE payment_orders SET status = 'paid', operation_id = ?, paid_at = ? WHERE id = ? AND status = 'pending'")
    .bind(operationId, Date.now(), id)
    .run();
  return (res.meta.changes ?? 0) > 0;
}

/**
 * Upserted on every single incoming update (handlers/router.ts
 * handleUpdate), regardless of whether the chat is linked — this is the
 * only way to later resolve a typed @username to a chat_id (see
 * getChatIdByUsername), since Telegram bots can't message a chat_id
 * they've never received an update from.
 */
export async function upsertTelegramUser(env: Env, chatId: string, username: string | null, firstName: string): Promise<void> {
  const usernameLower = username ? username.toLowerCase() : null;
  await env.DB.prepare(
    `INSERT INTO telegram_users (chat_id, username, first_name, last_seen) VALUES (?, ?, ?, ?)
     ON CONFLICT(chat_id) DO UPDATE SET username = excluded.username, first_name = excluded.first_name, last_seen = excluded.last_seen`
  )
    .bind(chatId, usernameLower, firstName, Date.now())
    .run();
}

/** Resolves a @username (leading @ optional, case-insensitive) to a chat_id — null if that account has never messaged the bot. */
export async function getChatIdByUsername(env: Env, username: string): Promise<string | null> {
  const usernameLower = username
    .trim()
    .replace(/^@/, '')
    .toLowerCase();
  if (!usernameLower) return null;
  const row = await env.DB.prepare('SELECT chat_id FROM telegram_users WHERE username = ?').bind(usernameLower).first<{ chat_id: string }>();
  return row ? row.chat_id : null;
}

/** Declines a device-pairing-by-username request — the app's poll sees status 'rejected' with this reason (same field DevicePairingRunnable already reads for ONE_DEVICE_PER_ACCOUNT). */
export async function rejectDevicePairing(env: Env, code: string): Promise<void> {
  await env.DB.prepare("UPDATE device_pairings SET status = 'rejected', reason = 'declined_by_user' WHERE code = ? AND status = 'pending'").bind(code).run();
}

// ============================================================
// "Кураторство" — see README "Кураторы" and handlers/curator.ts. Same
// pending/claimed/rejected + 10-minute-TTL shape as device_pairings above:
// a curator generates a code, shares `t.me/<bot>?start=curatorlink_<code>`
// with a ward, and the ward's own tap on "Подтвердить" is their consent —
// nothing links the two accounts without it. The actual curator_username
// <-> ward relationship then lives on qmods.ru's user record (see
// mod/api/bot.php set_curator_for_ward), not here — this table is only the
// ephemeral handshake.
// ============================================================

const CURATOR_INVITE_TTL_MS = 10 * 60 * 1000;

export async function createCuratorInvite(env: Env, curatorUsername: string, curatorTelegramId: string): Promise<string> {
  const code = randomPairingCode();
  await env.DB.prepare('INSERT INTO curator_invites (code, curator_username, curator_telegram_id, status, created_at) VALUES (?, ?, ?, ?, ?)')
    .bind(code, curatorUsername, curatorTelegramId, 'pending', Date.now())
    .run();
  return code;
}

export interface CuratorInviteRow {
  curator_username: string;
  curator_telegram_id: string;
  status: 'pending' | 'claimed' | 'rejected';
  ward_username: string | null;
  created_at: number;
}

export async function getCuratorInvite(env: Env, code: string): Promise<CuratorInviteRow | null> {
  const row = await env.DB.prepare('SELECT curator_username, curator_telegram_id, status, ward_username, created_at FROM curator_invites WHERE code = ?')
    .bind(code)
    .first<CuratorInviteRow>();
  if (!row) return null;
  if (row.status === 'pending' && Date.now() - row.created_at > CURATOR_INVITE_TTL_MS) return null; // expired, treat as gone
  return row;
}

/**
 * Marks an invite claimed once the ward has confirmed AND the
 * curator_username write on their qmods.ru record succeeded (see
 * handlers/curator.ts handleCuratorLinkConfirm — PHP is called first,
 * this is called only after it reports success, so a claimed row here
 * always has a real relationship behind it). Guarded WHERE clause is the
 * same best-effort double-claim protection as claimDevicePairing.
 */
export async function claimCuratorInvite(env: Env, code: string, wardUsername: string): Promise<boolean> {
  const res = await env.DB.prepare("UPDATE curator_invites SET status = 'claimed', ward_username = ?, claimed_at = ? WHERE code = ? AND status = 'pending'")
    .bind(wardUsername, Date.now(), code)
    .run();
  return (res.meta.changes ?? 0) > 0;
}

export async function rejectCuratorInvite(env: Env, code: string): Promise<void> {
  await env.DB.prepare("UPDATE curator_invites SET status = 'rejected' WHERE code = ? AND status = 'pending'").bind(code).run();
}
