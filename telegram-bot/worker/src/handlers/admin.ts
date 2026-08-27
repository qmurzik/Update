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
    `<blockquote>👥 Всего: <b>${s.total ?? 0}</b>  ·  🟢 активных: <b>${s.active ?? 0}</b>  ·  🔴 истёкших: <b>${s.expired ?? 0}</b></blockquote>`,
    '',
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
  if (ctx.incomingMessageId) {
    await ctx.tg.setMessageReaction(ctx.chatId, ctx.incomingMessageId, '👍').catch(() => undefined);
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

  // Пытаемся доставить сразу же, не дожидаясь ближайшего запуска крона — и,
  // если получилось, сразу помечаем доставленным через ackTelegramPush,
  // иначе тот же крон (раз в 5 мин) присылает пользователю то же самое
  // сообщение ещё раз, выглядит как "пришло с большой задержкой дублем".
  const userInfo = await ctx.adminApi.user(username);
  if (res.success && res.notification_id && userInfo.found && userInfo.user?.telegram_id) {
    const sent = await ctx.tg
      .sendMessage(userInfo.user.telegram_id, `<b>${esc(title)}</b>\n\n${esc(body)}`)
      .then(() => true)
      .catch(() => false);
    if (sent) {
      await ctx.adminApi.ackTelegramPush([{ notification_id: res.notification_id, user_id: userInfo.user.id }]).catch(() => undefined);
    }
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
    res.success
      ? '✅ Рассылка создана — уйдёт в Telegram всем привязанным пользователям в течение нескольких минут, а в приложении появится при следующей проверке подписки.'
      : `❌ ${esc(String(res.error ?? ''))}`,
    cancelKeyboard('adm:menu')
  );
}

/**
 * Forced-update gate for the native app (android-client/GateActivity's
 * "update" mode) — a second line below the version code becomes the
 * message shown in the app; min_version_code 0 disables the gate.
 */
export async function askAppVersion(ctx: Ctx): Promise<void> {
  if (!(await requireAdmin(ctx))) return;
  const current = await ctx.adminApi.getAppVersion();
  await setState(ctx.env, ctx.chatId, 'admin_app_version_text');
  await reply(
    ctx,
    `Текущий минимум: <b>${esc(String(current.min_version_code ?? 0))}</b>` +
      (current.message ? `\nСообщение: ${esc(String(current.message))}` : '') +
      `\n\nВведите новый минимальный versionCode первой строкой, дальше — текст для пользователей со старой версией. 0 — выключить принудительное обновление.`,
    cancelKeyboard('adm:menu')
  );
}

export async function handleAppVersionInput(ctx: Ctx, text: string): Promise<void> {
  const { title: codeText, body: message } = splitTitleBody(text);
  const minVersionCode = Number.parseInt(codeText, 10);
  if (!Number.isFinite(minVersionCode) || minVersionCode < 0) {
    await reply(ctx, 'Первая строка должна быть целым числом ≥ 0 (versionCode).', cancelKeyboard('adm:menu'));
    return;
  }
  if (minVersionCode > 0 && !message) {
    await reply(ctx, 'Нужен текст сообщения для пользователей со старой версией (вторая строка).', cancelKeyboard('adm:menu'));
    return;
  }

  const res = await ctx.adminApi.setAppVersion(minVersionCode, message);
  await logAdminAction(ctx.env, ctx.telegramId, 'set_app_version', { min_version_code: minVersionCode, success: res.success });
  await clearState(ctx.env, ctx.chatId);
  await reply(
    ctx,
    res.success
      ? minVersionCode > 0
        ? `✅ Приложения с versionCode меньше ${minVersionCode} теперь заблокированы до обновления.`
        : '✅ Принудительное обновление выключено.'
      : `❌ ${esc(String(res.error ?? ''))}`,
    cancelKeyboard('adm:menu')
  );
}
