import type { Env } from './config';
import { verifyWebhookSecret } from './security';
import { handleUpdate } from './handlers/router';
import { TelegramClient } from './telegram/client';
import { QmodsAdminApi } from './qmodsApi';
import { esc } from './util';
import type { TgUpdate } from './telegram/types';
import { APP_HTML } from './webapp/page';
import { handleWebAppApi } from './webapp/api';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // One-off convenience endpoint to (re)register the webhook with Telegram.
    // Gated by the webhook secret itself, so it's only usable by whoever can
    // already read the deployed secret (i.e. the operator running curl/browser
    // right after `wrangler secret put`), never by a random visitor.
    if (url.pathname === '/setup-webhook' && request.method === 'GET') {
      if (url.searchParams.get('token') !== env.TELEGRAM_WEBHOOK_SECRET) {
        return new Response('Forbidden', { status: 403 });
      }
      const tg = new TelegramClient(env);
      await tg.setWebhook(`${url.origin}/webhook`, env.TELEGRAM_WEBHOOK_SECRET);
      return new Response('Webhook registered', { status: 200 });
    }

    // Mini App — static page + its one JSON API endpoint.
    if (url.pathname === '/app' && request.method === 'GET') {
      const html = APP_HTML.replace('__SUBSCRIBE_URL__', env.QMODS_SUBSCRIBE_URL);
      return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }
    if (url.pathname === '/app/api') {
      return handleWebAppApi(request, env);
    }

    if (url.pathname !== '/webhook' || request.method !== 'POST') {
      return new Response('Not found', { status: 404 });
    }

    if (!verifyWebhookSecret(request, env)) {
      return new Response('Forbidden', { status: 403 });
    }

    let update: TgUpdate;
    try {
      update = await request.json();
    } catch {
      return new Response('Bad request', { status: 400 });
    }

    // Ack Telegram immediately; do the actual work in the background so a
    // slow downstream call to qmods.ru never causes Telegram to retry/duplicate.
    ctx.waitUntil(
      handleUpdate(update, env).catch((err) => {
        console.error('handleUpdate failed', err);
      })
    );

    return new Response('OK', { status: 200 });
  },

  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(deliverPendingNotifications(env));
  },
};

/**
 * Runs on the Cron Trigger (see wrangler.toml). Pulls notifications created
 * by site-side events (payment success, expiring subscription, admin
 * broadcasts/messages — anything that called notify_user_event() /
 * notify_broadcast_event() in bot_notify.php) that haven't reached Telegram
 * yet, and delivers them.
 */
async function deliverPendingNotifications(env: Env): Promise<void> {
  const tg = new TelegramClient(env);
  const adminApi = new QmodsAdminApi(env);

  const res = await adminApi.pendingTelegramPushes(100);
  const items = res.items ?? [];
  if (items.length === 0) return;

  const acked: Array<{ notification_id: string; user_id: string }> = [];

  for (const item of items) {
    try {
      await tg.sendMessage(item.telegram_id, `<b>${esc(item.title)}</b>\n\n${esc(item.message)}`);
    } catch (err) {
      // Most common cause: user blocked the bot. Ack anyway so this item
      // doesn't get retried forever; the failure is still visible in `wrangler tail`.
      console.error('push delivery failed', item.telegram_id, err);
    }
    acked.push({ notification_id: item.notification_id, user_id: item.user_id });
  }

  if (acked.length > 0) {
    await adminApi.ackTelegramPush(acked);
  }
}
