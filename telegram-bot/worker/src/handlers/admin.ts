import type { Ctx } from './context';
import { adminMenuKeyboard, adminUserCardKeyboard, adminUsersListKeyboard, cancelKeyboard, confirmKeyboard } from '../telegram/keyboards';
import { DIVIDER, esc, splitTitleBody } from '../util';
import { isAdmin } from '../config';
import { clearState, getState, logAdminAction, setState } from '../db';
import type { AdminUserCard, AdminUserSummary } from '../qmodsApi';
import { reply } from './reply';

const USERS_PAGE_SIZE = 8;

async function requireAdmin(ctx: Ctx): Promise<boolean> {
  if (isAdmin(ctx.env, ctx.telegramId)) return true;
  await reply(ctx, '⛔ Недостаточно прав.');
  return false;
}

export async function showAdminMenu(ctx: Ctx): Promise<void> {
  if (!(await requireAdmin(ctx))) return;
  await clearState(ctx.env, ctx.chatId);
  await reply(ctx, `<b>🛠 Админ-панель QMods</b>\n${DIVIDER}`, adminMenuKeyboard());
}

export async function showStats(ctx: Ctx): Promise<void> {
  if (!(await requireAdmin(ctx))) return;
  const res = await ctx.adminApi.stats();
  const s = (res.stats ?? {}) as Record<string, unknown>;

  const lines = [
    '<b>📊 Статистика QMods</b>',
    DIVIDER,
    '',
    `Всего пользователей: <b>${s.total ?? 0}</b>`,
    `Активных подписок: <b>${s.active ?? 0}</b>`,
    `Истёкших: <b>${s.expired ?? 0}</b>`,
    `Скоро истекут (≤7 дн.): <b>${s.expiring ?? 0}</b>`,
    `Привязано Telegram: <b>${s.telegram_linked ?? 0}</b>`,
    `Выручка всего: <b>${s.revenue ?? 0} ₽</b>`,
    `Платежей: <b>${s.payment_count ?? 0}</b>`,
  ];

  await reply(ctx, lines.join('\n'), cancelKeyboard('adm:menu'));
}

/** Browsable list of all users — the click-through alternative to typing a username. */
export async function showUsersList(ctx: Ctx, page: number): Promise<void> {
  if (!(await requireAdmin(ctx))) return;

  const res = await ctx.adminApi.users();
  const all: AdminUserSummary[] = res.users ?? [];

  const totalPages = Math.max(1, Math.ceil(all.length / USERS_PAGE_SIZE));
  const safePage = Math.min(Math.max(page, 0), totalPages - 1);
  const start = safePage * USERS_PAGE_SIZE;
  const pageRows = all.slice(start, start + USERS_PAGE_SIZE);

  const lines = [
    '<b>📋 Пользователи</b>',
    DIVIDER,
    `Страница ${safePage + 1} из ${totalPages} · всего ${all.length}`,
    '',
    pageRows.length > 0 ? 'Нажмите на пользователя, чтобы открыть карточку:' : 'Пользователей пока нет.',
  ];

  await reply(ctx, lines.join('\n'), adminUsersListKeyboard(pageRows, safePage, safePage > 0, safePage < totalPages - 1));
}

export async function askSearch(ctx: Ctx): Promise<void> {
  if (!(await requireAdmin(ctx))) return;
  await setState(ctx.env, ctx.chatId, 'admin_search');
  await reply(ctx, 'Введите логин пользователя для поиска:', cancelKeyboard('adm:menu'));
}

function userCardText(u: AdminUserCard): string {
  const lines = [
    `<b>👤 ${esc(u.username)}</b>`,
    DIVIDER,
    `ID: <code>${esc(u.id)}</code>`,
    `Telegram: ${u.telegram_id ? `<code>${esc(u.telegram_id)}</code>` : 'не привязан'}`,
    `Устройство: ${u.device_id ? '✅ привязано' : '—'}`,
    `Тариф: ${esc(u.subscription.plan)} (${u.subscription.active ? '🟢 активна' : '🔴 истекла'})`,
    `Окончание: ${esc(u.subscription.expires_text)}`,
  ];
  if (u.payments.length > 0) {
    lines.push('', '<b>Последние платежи:</b>');
    for (const p of u.payments.slice(0, 5)) {
      lines.push(`${esc(p.date_text)} — ${esc(p.plan)} — ${p.amount} ₽`);
    }
  }
  return lines.join('\n');
}

export async function handleSearchInput(ctx: Ctx, username: string): Promise<void> {
  const res = await ctx.adminApi.user(username.trim());
  if (!res.found || !res.user) {
    await reply(ctx, `Пользователь <code>${esc(username)}</code> не найден.`, cancelKeyboard('adm:menu'));
    return;
  }

  await setState(ctx.env, ctx.chatId, 'admin_user_card', { username: res.user.username });
  await reply(ctx, userCardText(res.user), adminUserCardKeyboard());
}

/** Re-renders the currently open card — used as the "back"/cancel target from card sub-actions. */
export async function showCurrentCard(ctx: Ctx): Promise<void> {
  const username = await currentCardUsername(ctx);
  if (!username) return showAdminMenu(ctx);
  await handleSearchInput(ctx, username);
}

async function currentCardUsername(ctx: Ctx): Promise<string | null> {
  const state = await getState(ctx.env, ctx.chatId);
  const username = state?.payload?.username;
  return typeof username === 'string' && username !== '' ? username : null;
}

export async function askIssue(ctx: Ctx): Promise<void> {
  const username = await currentCardUsername(ctx);
  if (!username) return showAdminMenu(ctx);
  await setState(ctx.env, ctx.chatId, 'admin_issue_days', { username });
  await reply(ctx, `На сколько дней продлить подписку для <b>${esc(username)}</b>? Введите число.`, cancelKeyboard('adm:card'));
}

export async function handleIssueInput(ctx: Ctx, username: string, daysText: string): Promise<void> {
  const days = parseInt(daysText.trim(), 10);
  if (!Number.isFinite(days) || days < 1 || days > 3650) {
    await reply(ctx, 'Введите целое число дней от 1 до 3650.', cancelKeyboard('adm:card'));
    return;
  }

  const res = await ctx.adminApi.issue(username, days);
  await logAdminAction(ctx.env, ctx.telegramId, 'issue', { username, days, success: res.success });
  await setState(ctx.env, ctx.chatId, 'admin_user_card', { username });

  if (!res.success) {
    await reply(ctx, `❌ ${esc(String(res.error ?? 'Ошибка'))}`, cancelKeyboard('adm:card'));
    return;
  }
  await reply(ctx, `✅ ${esc(String(res.message ?? 'Готово'))}`, cancelKeyboard('adm:card'));
}

export async function askRemove(ctx: Ctx): Promise<void> {
  const username = await currentCardUsername(ctx);
  if (!username) return showAdminMenu(ctx);
  await reply(ctx, `Снять подписку с <b>${esc(username)}</b>?`, confirmKeyboard('adm:rm:yes', 'adm:card'));
}

export async function confirmRemove(ctx: Ctx): Promise<void> {
  const username = await currentCardUsername(ctx);
  if (!username) return showAdminMenu(ctx);

  const res = await ctx.adminApi.remove(username);
  await logAdminAction(ctx.env, ctx.telegramId, 'remove', { username, success: res.success });
  await setState(ctx.env, ctx.chatId, 'admin_user_card', { username });
  await reply(ctx, res.success ? `✅ ${esc(String(res.message ?? ''))}` : `❌ ${esc(String(res.error ?? ''))}`, cancelKeyboard('adm:card'));
}

export async function askDelete(ctx: Ctx): Promise<void> {
  const username = await currentCardUsername(ctx);
  if (!username) return showAdminMenu(ctx);
  await reply(ctx, `⚠️ Полностью удалить аккаунт <b>${esc(username)}</b>? Действие необратимо.`, confirmKeyboard('adm:del:yes', 'adm:card'));
}

export async function confirmDelete(ctx: Ctx): Promise<void> {
  const username = await currentCardUsername(ctx);
  if (!username) return showAdminMenu(ctx);

  const res = await ctx.adminApi.deleteUser(username);
  await logAdminAction(ctx.env, ctx.telegramId, 'delete_user', { username, success: res.success });
  await clearState(ctx.env, ctx.chatId); // аккаунт удалён — карточка больше не существует
  await reply(ctx, res.success ? `✅ ${esc(String(res.message ?? ''))}` : `❌ ${esc(String(res.error ?? ''))}`, cancelKeyboard('adm:menu'));
}

export async function askMessage(ctx: Ctx): Promise<void> {
  const username = await currentCardUsername(ctx);
  if (!username) return showAdminMenu(ctx);
  await setState(ctx.env, ctx.chatId, 'admin_msg_text', { username });
  await reply(
    ctx,
    `Введите сообщение для <b>${esc(username)}</b>. Первая строка станет заголовком, остальное — текстом.`,
    cancelKeyboard('adm:card')
  );
}

export async function handleMessageInput(ctx: Ctx, username: string, text: string): Promise<void> {
  const { title, body } = splitTitleBody(text);
  if (!title || !body) {
    await reply(ctx, 'Нужны и заголовок, и текст (минимум 2 строки).', cancelKeyboard('adm:card'));
    return;
  }

  // Пишем в data/notifications.json (видно в кабинете) — это же уведомление
  // подхватит крон-джоба воркера (pending_telegram_pushes) и доставит в Telegram.
  const res = await ctx.adminApi.sendNotification(title, body, username);
  await logAdminAction(ctx.env, ctx.telegramId, 'send_notification', { username, title, success: res.success });
  await setState(ctx.env, ctx.chatId, 'admin_user_card', { username });

  // Пытаемся доставить сразу же, не дожидаясь ближайшего запуска крона.
  const userInfo = await ctx.adminApi.user(username);
  if (userInfo.found && userInfo.user?.telegram_id) {
    await ctx.tg.sendMessage(userInfo.user.telegram_id, `<b>${esc(title)}</b>\n\n${esc(body)}`).catch(() => undefined);
  }

  await reply(ctx, res.success ? '✅ Сообщение отправлено.' : `❌ ${esc(String(res.error ?? ''))}`, cancelKeyboard('adm:card'));
}

export async function askBroadcast(ctx: Ctx): Promise<void> {
  if (!(await requireAdmin(ctx))) return;
  await setState(ctx.env, ctx.chatId, 'admin_broadcast_text');
  await reply(ctx, 'Введите текст рассылки. Первая строка — заголовок, остальное — текст.', cancelKeyboard('adm:menu'));
}

export async function handleBroadcastInput(ctx: Ctx, text: string): Promise<void> {
  const { title, body } = splitTitleBody(text);
  if (!title || !body) {
    await reply(ctx, 'Нужны и заголовок, и текст (минимум 2 строки).', cancelKeyboard('adm:menu'));
    return;
  }

  const res = await ctx.adminApi.sendNotification(title, body);
  await logAdminAction(ctx.env, ctx.telegramId, 'broadcast', { title, success: res.success });
  await clearState(ctx.env, ctx.chatId);
  await reply(
    ctx,
    res.success ? '✅ Рассылка создана и уйдёт всем привязанным пользователям в течение нескольких минут.' : `❌ ${esc(String(res.error ?? ''))}`,
    cancelKeyboard('adm:menu')
  );
}
