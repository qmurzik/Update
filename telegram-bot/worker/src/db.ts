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
