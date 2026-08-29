import type { Ctx } from './context';
import {
  adminMenuKeyboard,
  adminUserCardKeyboard,
  adminUsersListKeyboard,
  appManagerKeyboard,
  cancelKeyboard,
  confirmKeyboard,
  siteAuthGateKeyboard,
} from '../telegram/keyboards';
import { DIVIDER, esc, splitTitleBody } from '../util';
import { isAdmin } from '../config';
import { clearState, getState, logAdminAction, revokeDeviceTokensForUsername, setState } from '../db';
import type { AdminUserCard, AdminUserSummary } from '../qmodsApi';
import { uploadApkBinary } from '../qmodsApi';
import type { TgDocument } from '../telegram/types';
import { reply } from './reply';

const APK_BOT_UPLOAD_LIMIT = 20 * 1024 * 1024; // Bot API's hard cap on getFile downloads, not our choice.

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1048576).toFixed(1)} MB`;
}

const USERS_PAGE_SIZE = 8;

async function requireAdmin(ctx: Ctx): Promise<boolean> {
  if (isAdmin(ctx.env, ctx.telegramId)) return true;
  await reply(ctx, '⛔ Тут только для своих — недостаточно прав.');
  return false;
}

export async function showAdminMenu(ctx: Ctx): Promise<void> {
  if (!(await requireAdmin(ctx))) return;
  await clearState(ctx.env, ctx.chatId);
  await reply(ctx, `<b>🛠 Админ-панель QMods</b>\n${DIVIDER}\n\nЯ тут, чем займёмся?`, adminMenuKeyboard());
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
  // PHP только удаляет строку в users.json — понятия не имеет о D1
  // воркера. Без этого у любого привязанного устройства device_token
  // остаётся "живым" (резолвится в username, который больше не
  // существует) — android-client получает found:false и раньше
  // застревал на бессрочном экране ошибки вместо экрана привязки (см.
  // SubscriptionCheckRunnable в android-client — теперь она сама себя
  // лечит через not_paired, но лучше вообще не оставлять токен висеть).
  if (res.success) await revokeDeviceTokensForUsername(ctx.env, username);
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

  await reply(ctx, res.success ? '✅ Отправила.' : `❌ ${esc(String(res.error ?? ''))}`, cancelKeyboard('adm:card'));
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
      ? '✅ Готово, разнесу всем привязанным пользователям в течение нескольких минут, а в приложении появится при следующей проверке подписки.'
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

/**
 * Site-side login/registration kill switch — part of the migration to
 * Telegram-only accounts (see php-api/INTEGRATION.md "Выключатель входа/
 * регистрации на сайте"). Only gates qmods.ru's own forms: the bot's own
 * /link (existing accounts) and /start's "🆕 Зарегистрироваться" (new
 * accounts) keep working regardless of this flag.
 */
export async function showSiteAuthGate(ctx: Ctx): Promise<void> {
  if (!(await requireAdmin(ctx))) return;
  const current = await ctx.adminApi.getSiteAuthGate();
  const enabled = !!current.enabled;

  const lines = [
    '<b>🌐 Вход и регистрация на сайте</b>',
    DIVIDER,
    '',
    `Сейчас: ${enabled ? '🟢 включены' : '🔴 выключены'}.`,
    '',
    enabled
      ? 'Пользователи всё ещё могут входить и регистрироваться на qmods.ru напрямую. Выключайте, когда будете готовы окончательно переехать в бота — я справлюсь.'
      : 'Формы входа/регистрации на сайте показывают подсказку перейти в Telegram-бота. Привязка уже существующих аккаунтов по коду продолжает работать как обычно, и новые аккаунты по-прежнему можно создать прямо здесь, у меня.',
  ];

  await reply(ctx, lines.join('\n'), siteAuthGateKeyboard(enabled));
}

export async function toggleSiteAuthGate(ctx: Ctx, enabled: boolean): Promise<void> {
  if (!(await requireAdmin(ctx))) return;
  const res = await ctx.adminApi.setSiteAuthGate(enabled);
  await logAdminAction(ctx.env, ctx.telegramId, 'set_site_auth_gate', { enabled, success: res.success });
  await showSiteAuthGate(ctx);
}

/**
 * "📦 Приложение (APK)" — publish a new build straight from the chat, and
 * generate the "pretty" public landing page (`${PUBLIC_URL}/app/download`,
 * see index.ts and webapp/downloadPage.ts). That URL never changes between
 * releases — only the underlying share token it points at does — so it's
 * safe to pin anywhere (channel description, pinned message) once.
 *
 * Telegram's Bot API caps file downloads (getFile) at 20MB regardless of
 * account type, so a real APK often can't come through the bot at all —
 * for those, admin/app.php's existing drag-and-drop uploader on the site
 * still does the heavy lifting; this screen just picks up its result
 * (has_file/apk_size) and handles version/changelog + the share link either way.
 */
export async function showAppManager(ctx: Ctx): Promise<void> {
  if (!(await requireAdmin(ctx))) return;
  await clearState(ctx.env, ctx.chatId);
  const res = await ctx.adminApi.getAppRelease();

  const lines = ['<b>📦 Приложение QMods</b>', DIVIDER, ''];
  lines.push(`Версия: <b>${esc(res.version || '—')}</b>`);
  lines.push(`APK: ${res.has_file ? `✅ загружен (${fmtBytes(res.apk_size)})` : '⛔ не загружен'}`);
  lines.push(`Публичная ссылка: ${res.share_enabled ? '🟢 активна' : '🔴 выключена'}`);
  if (res.changelog) lines.push('', '<b>Что нового:</b>', esc(res.changelog));
  lines.push(
    '',
    `Через бота можно загрузить APK до 20 МБ (ограничение Telegram). Файл больше — загрузите через <a href="https://qmods.ru/admin/app.php">веб-панель сайта</a>, потом просто откройте этот экран ещё раз — карточка обновится сама.`
  );

  await reply(ctx, lines.join('\n'), appManagerKeyboard(res, ctx.env.PUBLIC_URL));
}

export async function askReleaseInfo(ctx: Ctx): Promise<void> {
  if (!(await requireAdmin(ctx))) return;
  await setState(ctx.env, ctx.chatId, 'admin_release_text');
  await reply(
    ctx,
    'Введите версию первой строкой (например 2.4.1), а со второй строки — список изменений (по желанию).',
    cancelKeyboard('adm:app')
  );
}

export async function handleReleaseInfoInput(ctx: Ctx, text: string): Promise<void> {
  const { title: version, body: changelog } = splitTitleBody(text);
  if (!version) {
    await reply(ctx, 'Первая строка должна быть номером версии.', cancelKeyboard('adm:app'));
    return;
  }

  const res = await ctx.adminApi.setAppRelease(version, changelog);
  await logAdminAction(ctx.env, ctx.telegramId, 'set_app_release', { version, success: res.success });
  await clearState(ctx.env, ctx.chatId);
  if (!res.success) {
    await reply(ctx, `❌ ${esc(String(res.error ?? 'Ошибка'))}`, cancelKeyboard('adm:app'));
    return;
  }
  await showAppManager(ctx);
}

export async function askApkUpload(ctx: Ctx): Promise<void> {
  if (!(await requireAdmin(ctx))) return;
  await setState(ctx.env, ctx.chatId, 'admin_apk_upload_wait');
  await reply(
    ctx,
    'Пришлите файл <b>.apk</b> в этот чат как документ (не фото).\n\nОграничение Telegram — 20 МБ на файл, который бот может скачать. Если ваша сборка больше, загрузите её через <a href="https://qmods.ru/admin/app.php">веб-панель сайта</a> и вернитесь на экран «📦 Приложение» — карточка подхватит её сама.',
    cancelKeyboard('adm:app')
  );
}

export async function handleApkDocument(ctx: Ctx, document: TgDocument): Promise<void> {
  if (!(await requireAdmin(ctx))) return;

  const name = document.file_name ?? '';
  const looksLikeApk = /\.apk$/i.test(name) || document.mime_type === 'application/vnd.android.package-archive';
  if (!looksLikeApk) {
    await reply(ctx, 'Это не похоже на .apk файл. Пришлите APK-файл документом.', cancelKeyboard('adm:app'));
    return;
  }

  const size = document.file_size ?? 0;
  if (size > APK_BOT_UPLOAD_LIMIT) {
    await clearState(ctx.env, ctx.chatId);
    await reply(
      ctx,
      `Файл весит ${fmtBytes(size)} — Telegram не даёт боту скачать больше 20 МБ. Загрузите его через <a href="https://qmods.ru/admin/app.php">веб-панель сайта</a>, потом откройте «📦 Приложение» ещё раз.`,
      cancelKeyboard('adm:app')
    );
    return;
  }

  await clearState(ctx.env, ctx.chatId);
  let bytes: ArrayBuffer;
  try {
    bytes = await ctx.tg.downloadFile(document.file_id);
  } catch (err) {
    console.error('handleApkDocument: downloadFile failed', err);
    await reply(ctx, '❌ Не удалось скачать файл из Telegram. Попробуйте ещё раз.', cancelKeyboard('adm:app'));
    return;
  }

  const res = await uploadApkBinary(ctx.env, bytes, name || 'app.apk');
  await logAdminAction(ctx.env, ctx.telegramId, 'apk_upload', { filename: name, size: bytes.byteLength, success: res.success });
  if (!res.success) {
    await reply(ctx, `❌ ${esc(res.error ?? 'Не удалось сохранить APK на сервере.')}`, cancelKeyboard('adm:app'));
    return;
  }

  if (ctx.incomingMessageId) {
    await ctx.tg.setMessageReaction(ctx.chatId, ctx.incomingMessageId, '🎉').catch(() => undefined);
  }
  await reply(
    ctx,
    `✅ APK загружен: ${fmtBytes(res.size ?? bytes.byteLength)}${res.sha256 ? `\nSHA-256: <code>${esc(res.sha256.slice(0, 16))}…</code>` : ''}\n\nТеперь создайте публичную ссылку, если её ещё нет.`,
    cancelKeyboard('adm:app')
  );
  await showAppManager(ctx);
}

export async function generateApkShareLink(ctx: Ctx): Promise<void> {
  if (!(await requireAdmin(ctx))) return;
  const res = await ctx.adminApi.generateApkShareLink();
  await logAdminAction(ctx.env, ctx.telegramId, 'generate_apk_share_link', { success: res.success });
  if (!res.success) {
    await reply(ctx, `❌ ${esc(String(res.error ?? 'Ошибка'))}`, cancelKeyboard('adm:app'));
    return;
  }
  await showAppManager(ctx);
}

export async function revokeApkShareLink(ctx: Ctx): Promise<void> {
  if (!(await requireAdmin(ctx))) return;
  const res = await ctx.adminApi.revokeApkShareLink();
  await logAdminAction(ctx.env, ctx.telegramId, 'revoke_apk_share_link', { success: res.success });
  await showAppManager(ctx);
}
