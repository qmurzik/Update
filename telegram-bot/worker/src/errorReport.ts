import type { Env } from './config';
import { adminIds } from './config';
import { TelegramClient } from './telegram/client';
import { esc } from './util';

const COOLDOWN_MS = 10 * 60 * 1000; // one alert per distinct error per 10 minutes

function signatureOf(error: unknown, context: string): string {
  const message = error instanceof Error ? `${error.name}:${error.message}` : String(error);
  const topFrame = error instanceof Error && error.stack ? (error.stack.split('\n')[1] ?? '').trim() : '';
  return `${context}|${message}|${topFrame}`.slice(0, 500);
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Reports an otherwise-invisible exception straight to the admins' Telegram
 * chats. Everything the bot used to just `console.error` only surfaced in
 * `wrangler tail`, which nobody watches live — this is the "hidden errors"
 * fix. Deduped per error signature (where it happened + error name/message +
 * top stack frame, hashed) with a cooldown tracked in D1, so a hot failure
 * loop sends one alert per window instead of flooding admins; the D1 row
 * also counts total occurrences, included in the message once it repeats.
 *
 * Never throws — the reporting path failing must not cascade into more
 * unhandled failures, so any error here is swallowed after a local log.
 *
 * signatureOverride lets a caller decouple "what counts as the same error"
 * from `context` — used by the Android crash-report route (/device/crash):
 * context there carries per-report details (device model, app version,
 * username) for the alert TEXT, which would otherwise make every user's
 * hit of the very same crash dedupe as a separate signature. Omit it for
 * the normal case (Worker-side errors), where context IS the right thing
 * to dedupe on.
 */
export async function reportError(env: Env, error: unknown, context: string, signatureOverride?: string): Promise<void> {
  try {
    const hash = await sha256Hex(signatureOverride ?? signatureOf(error, context));
    const now = Date.now();

    const row = await env.DB.prepare('SELECT last_sent_at, count FROM error_alerts WHERE signature = ?')
      .bind(hash)
      .first<{ last_sent_at: number; count: number }>();

    if (!row) {
      await env.DB.prepare(
        'INSERT INTO error_alerts (signature, first_seen_at, last_seen_at, last_sent_at, count) VALUES (?, ?, ?, ?, 1)'
      )
        .bind(hash, now, now, now)
        .run();
      await sendAlert(env, error, context, 1);
      return;
    }

    const shouldSend = now - row.last_sent_at > COOLDOWN_MS;
    if (shouldSend) {
      await env.DB.prepare('UPDATE error_alerts SET last_seen_at = ?, last_sent_at = ?, count = count + 1 WHERE signature = ?')
        .bind(now, now, hash)
        .run();
      await sendAlert(env, error, context, row.count + 1);
    } else {
      await env.DB.prepare('UPDATE error_alerts SET last_seen_at = ?, count = count + 1 WHERE signature = ?').bind(now, hash).run();
    }
  } catch (metaErr) {
    console.error('reportError itself failed', metaErr, error);
  }
}

async function sendAlert(env: Env, error: unknown, context: string, occurrences: number): Promise<void> {
  const ids = adminIds(env);
  if (ids.length === 0) return;

  const name = error instanceof Error ? error.name : 'Error';
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error && error.stack ? error.stack.split('\n').slice(0, 6).join('\n') : '';

  const lines = [
    '🚨 <b>Скрытая ошибка в боте</b>',
    `<b>Где:</b> ${esc(context)}`,
    `<b>Тип:</b> ${esc(name)}: ${esc(message)}`,
  ];
  if (occurrences > 1) lines.push(`<b>Повторов:</b> ${occurrences} (за последние 10 мин алерт шлётся не чаще раза)`);
  if (stack) lines.push(`<pre>${esc(stack)}</pre>`);

  const tg = new TelegramClient(env);
  for (const id of ids) {
    await tg.sendMessage(id, lines.join('\n')).catch((e) => console.error('failed to deliver error alert', e));
  }
}
