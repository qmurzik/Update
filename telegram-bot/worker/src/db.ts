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
  status: 'pending' | 'claimed';
  device_token: string | null;
  created_at: number;
}

export async function getDevicePairing(env: Env, code: string): Promise<DevicePairingRow | null> {
  const row = await env.DB.prepare('SELECT status, device_token, created_at FROM device_pairings WHERE code = ?')
    .bind(code)
    .first<DevicePairingRow>();
  if (!row) return null;
  if (row.status === 'pending' && Date.now() - row.created_at > PAIRING_TTL_MS) return null; // expired, treat as gone
  return row;
}

/**
 * Called from the bot's `/start devicelink_<CODE>` handler once the
 * chat's Telegram account is confirmed linked to `username`. Mints a new
 * long-lived device_token and marks the pairing claimed. Returns null for
 * an unknown/expired/already-claimed code — best-effort double-claim
 * protection via the WHERE clause (same accepted race-window tradeoff as
 * checkRateLimit above; a real collision would need two claims landing
 * within milliseconds of each other on the same freshly-generated code).
 */
export async function claimDevicePairing(env: Env, code: string, username: string): Promise<string | null> {
  const row = await getDevicePairing(env, code);
  if (!row || row.status !== 'pending') return null;

  const token = randomHex(24);
  const now = Date.now();
  const update = await env.DB.prepare("UPDATE device_pairings SET status = 'claimed', device_token = ?, claimed_at = ? WHERE code = ? AND status = 'pending'")
    .bind(token, now, code)
    .run();
  if (!update.meta.changes) return null;

  await env.DB.prepare('INSERT INTO device_tokens (token, username, created_at, last_seen) VALUES (?, ?, ?, ?)').bind(token, username, now, now).run();
  return token;
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
