export interface Env {
  DB: D1Database;

  // Secrets (wrangler secret put)
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_WEBHOOK_SECRET: string;
  QMODS_BOT_API_TOKEN: string;
  QMODS_ADMIN_BOT_API_TOKEN: string;

  // Vars (wrangler.toml)
  QMODS_API_BASE: string;
  QMODS_CABINET_URL: string;
  QMODS_SUBSCRIBE_URL: string;
  QMODS_SUPPORT_URL: string;
  ADMIN_TELEGRAM_IDS: string;
  /** Bot's @username (no leading @), e.g. "qmods_bot" — used to build t.me deep links (device pairing, /start link_...). */
  BOT_USERNAME: string;
  /**
   * This Worker's own public origin, e.g.
   * "https://qmods-telegram-bot.<account>.workers.dev" (no trailing slash,
   * no path). Only known after the first deploy, so it's optional — leave
   * empty to hide the Mini App button and skip sending Kira's photos until
   * it's set. Powers both the Mini App URL (`${PUBLIC_URL}/app`) and the
   * mascot image URLs (`${PUBLIC_URL}/img/...`, served by Workers Assets).
   */
  PUBLIC_URL: string;
}

export function adminIds(env: Env): string[] {
  return env.ADMIN_TELEGRAM_IDS.split(',').map((s) => s.trim()).filter(Boolean);
}

export function isAdmin(env: Env, telegramId: string): boolean {
  return adminIds(env).includes(telegramId);
}
