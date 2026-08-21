import type { Env } from './config';

/** Thin divider under a bolded section header, e.g. `<b>Title</b>\n${DIVIDER}\n\n...`. */
export const DIVIDER = '┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄';

/**
 * URL of one of the mascot (Kira) images served from worker/public/img/ via
 * Workers Assets. Null when PUBLIC_URL isn't configured yet — callers should
 * skip sending/rendering the image rather than send a broken link.
 */
export function kiraImage(env: Env, filename: string): string | null {
  return env.PUBLIC_URL ? `${env.PUBLIC_URL}/img/${filename}` : null;
}

/** Escape user-controlled text before embedding it into an HTML-mode Telegram message. */
export function esc(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Russian pluralization: 1 день / 2 дня / 5 дней. */
export function daysRu(n: number): string {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return `${n} дней`;
  if (last === 1) return `${n} день`;
  if (last >= 2 && last <= 4) return `${n} дня`;
  return `${n} дней`;
}

export function money(amount: number): string {
  return `${amount.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ₽`;
}

/** First line = title, rest = body — used for the free-form admin "compose message" flow. */
export function splitTitleBody(text: string): { title: string; body: string } {
  const trimmed = text.trim();
  const idx = trimmed.indexOf('\n');
  if (idx === -1) return { title: trimmed.slice(0, 80), body: trimmed };
  return { title: trimmed.slice(0, idx).trim().slice(0, 80), body: trimmed.slice(idx + 1).trim() };
}
