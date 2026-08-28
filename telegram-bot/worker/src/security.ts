import type { Env } from './config';

/** Constant-time string compare — avoids timing side-channels on the secret. */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Every webhook request must carry the secret token Telegram was told to
 * send via setWebhook(secret_token=...). Anyone who guesses the bot's
 * webhook URL without this header is rejected before touching any handler.
 */
export function verifyWebhookSecret(request: Request, env: Env): boolean {
  const header = request.headers.get('X-Telegram-Bot-Api-Secret-Token') ?? '';
  return header !== '' && timingSafeEqual(header, env.TELEGRAM_WEBHOOK_SECRET);
}
