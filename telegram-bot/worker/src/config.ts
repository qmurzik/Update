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
}

export function adminIds(env: Env): string[] {
  return env.ADMIN_TELEGRAM_IDS.split(',').map((s) => s.trim()).filter(Boolean);
}

export function isAdmin(env: Env, telegramId: string): boolean {
  return adminIds(env).includes(telegramId);
}
