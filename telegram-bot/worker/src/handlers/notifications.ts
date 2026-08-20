import type { Ctx } from './context';
import { notificationsKeyboard } from '../telegram/keyboards';
import { esc } from '../util';
import { requireLinked } from './guard';
import { reply } from './reply';

function fmtDate(ts: number): string {
  if (!ts) return '';
  return new Date(ts * 1000).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export async function showNotifications(ctx: Ctx): Promise<void> {
  const me = await ctx.api.me(ctx.telegramId);
  if (!(await requireLinked(ctx, me))) return;

  const res = await ctx.api.notifications(ctx.telegramId);
  const items = res.notifications ?? [];
  const lines = ['<b>🔔 Уведомления</b>', ''];

  if (items.length === 0) {
    lines.push('Уведомлений пока нет.');
  } else {
    for (const n of items) {
      const mark = n.unread ? '🆕 ' : '';
      lines.push(`${mark}<b>${esc(n.title)}</b>`);
      lines.push(esc(n.message));
      lines.push(`<i>${fmtDate(n.created_at)}</i>`);
      lines.push('');
    }
  }

  const hasUnread = items.some((n) => n.unread);
  await reply(ctx, lines.join('\n').trim(), notificationsKeyboard(hasUnread));
}

export async function markAllRead(ctx: Ctx): Promise<void> {
  const res = await ctx.api.notifications(ctx.telegramId);
  const ids = (res.notifications ?? []).filter((n) => n.unread).map((n) => n.id);
  if (ids.length > 0) await ctx.api.notificationsAck(ctx.telegramId, ids);
  await showNotifications(ctx);
}
