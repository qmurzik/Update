import type { Env } from '../config';
import type { InlineKeyboard } from './types';

export const mainMenu = (env: Env, linked: boolean, isAdmin: boolean): InlineKeyboard => {
  const kb: InlineKeyboard = [];
  const webAppButton: InlineKeyboard[number] | null = env.PUBLIC_URL
    ? [{ text: '🖥 Открыть в Mini App', web_app: { url: `${env.PUBLIC_URL}/app` } }]
    : null;

  if (!linked) {
    kb.push([{ text: '🔗 Привязать аккаунт с сайта', callback_data: 'link:start' }]);
    kb.push([{ text: '🔑 Войти по логину и паролю', callback_data: 'link:pw' }]);
    kb.push([{ text: '🆕 Зарегистрироваться в Telegram', callback_data: 'reg:start' }]);
    if (webAppButton) kb.push(webAppButton);
    kb.push([{ text: '🆘 Поддержка', callback_data: 'm:support' }]);
  } else {
    if (webAppButton) kb.push(webAppButton);
    kb.push([
      { text: '👤 Профиль', callback_data: 'm:profile' },
      { text: '⭐ Подписка', callback_data: 'm:sub' },
    ]);
    kb.push([
      { text: '📱 Устройства', callback_data: 'm:devices' },
      { text: '🏆 Достижения', callback_data: 'm:ach' },
    ]);
    kb.push([
      { text: '🎁 Рефералы', callback_data: 'm:ref' },
      { text: '💳 Оплата', callback_data: 'm:pay' },
    ]);
    kb.push([
      { text: '🔔 Уведомления', callback_data: 'm:notif' },
      { text: '🆘 Поддержка', callback_data: 'm:support' },
    ]);
    kb.push([{ text: '👔 Кураторство', callback_data: 'm:curator' }]);
  }
  if (isAdmin) kb.push([{ text: '🛠 Админ-панель', callback_data: 'adm:menu' }]);
  return kb;
};

export const backButton = (target = 'm:main'): InlineKeyboard => [[{ text: '‹ Назад', callback_data: target }]];

export const profileKeyboard = (): InlineKeyboard => [
  [
    { text: '⬇️ Скачать APK', callback_data: 'm:app' },
    { text: '⭐ Отзыв', callback_data: 'm:review' },
  ],
  [{ text: '🔓 Отвязать Telegram', callback_data: 'link:unlink:ask' }],
  [{ text: '‹ Назад', callback_data: 'm:main' }],
];

export const reviewStarsKeyboard = (hasExisting: boolean): InlineKeyboard => {
  const kb: InlineKeyboard = [[1, 2, 3, 4, 5].map((n) => ({ text: `${n} ⭐️`, callback_data: `rev:star:${n}` }))];
  kb.push([{ text: '‹ Назад', callback_data: hasExisting ? 'm:profile' : 'm:main' }]);
  return kb;
};

export const subscriptionKeyboard = (): InlineKeyboard => [
  [{ text: '💳 Купить/продлить в боте', callback_data: 'pay:plans' }],
  [{ text: '‹ Назад', callback_data: 'm:main' }],
];

// "Подписка" and "Оплата" are different sections but there's no reason for
// their keyboards to diverge — was two identical function bodies before.
export const paymentsKeyboard = subscriptionKeyboard;

export interface PlanRow {
  id: string;
  title: string;
  price: number;
  days: number;
}

export const planPickerKeyboard = (plans: PlanRow[]): InlineKeyboard => {
  const kb: InlineKeyboard = plans.map((p) => [{ text: `${p.title} — ${p.price} ₽ / ${p.days} дн.`, callback_data: `pay:plan:${p.id}` }]);
  kb.push([{ text: '‹ Назад', callback_data: 'm:pay' }]);
  return kb;
};

export const payOrderKeyboard = (url: string, orderId: string): InlineKeyboard => [
  [{ text: '💳 Оплатить', url }],
  [{ text: '🔄 Проверить оплату', callback_data: `pay:check:${orderId}` }],
  [{ text: '‹ Назад', callback_data: 'm:pay' }],
];

export const devicesKeyboard = (hasDevice: boolean, hasCloneSlot: boolean, downloadRow: InlineKeyboard[number] | null = null): InlineKeyboard => {
  const kb: InlineKeyboard = [];
  if (hasDevice) kb.push([{ text: '🗑 Отвязать устройство', callback_data: 'dev:rm:ask' }]);
  if (!hasCloneSlot) kb.push([{ text: '🧬 Купить клона — 200 ₽', callback_data: 'dev:clone' }]);
  if (downloadRow) kb.push(downloadRow);
  kb.push([{ text: '‹ Назад', callback_data: 'm:main' }]);
  return kb;
};

// ============================================================
// "Кураторство" — see handlers/curator.ts.
// ============================================================

export interface CuratorWardRow {
  username: string;
}

export const curatorMenuKeyboard = (isCurator: boolean, wards: CuratorWardRow[], hasCurator: boolean): InlineKeyboard => {
  const kb: InlineKeyboard = [];
  if (isCurator) {
    for (const w of wards) kb.push([{ text: `👤 ${w.username}`, callback_data: `cur:ward:${w.username}` }]);
    kb.push([{ text: '➕ Пригласить подопечного', callback_data: 'cur:invite' }]);
  }
  if (hasCurator) kb.push([{ text: '❌ Отвязать куратора', callback_data: 'cur:unlink:ask' }]);
  kb.push([{ text: '‹ Назад', callback_data: 'm:main' }]);
  return kb;
};

export const curatorWardDetailKeyboard = (username: string): InlineKeyboard => [
  [{ text: '💳 Купить подписку', callback_data: `cur:buyask:${username}` }],
  [{ text: '‹ Назад', callback_data: 'm:curator' }],
];

export const curatorPlanPickerKeyboard = (plans: PlanRow[]): InlineKeyboard => {
  const kb: InlineKeyboard = plans.map((p) => [{ text: `${p.title} — ${p.price} ₽ / ${p.days} дн.`, callback_data: `cur:buyplan:${p.id}` }]);
  kb.push([{ text: '‹ Назад', callback_data: 'm:curator' }]);
  return kb;
};

export const curatorInviteAnswerKeyboard = (code: string): InlineKeyboard => [
  [
    { text: '✅ Подтвердить', callback_data: `curatorlink:confirm:${code}` },
    { text: '❌ Отклонить', callback_data: `curatorlink:reject:${code}` },
  ],
];

export const confirmKeyboard = (yesData: string, noData: string): InlineKeyboard => [
  [
    { text: '✅ Да', callback_data: yesData },
    { text: '❌ Отмена', callback_data: noData },
  ],
];

export const notificationsKeyboard = (hasUnread: boolean): InlineKeyboard => {
  const kb: InlineKeyboard = [];
  if (hasUnread) kb.push([{ text: '✅ Отметить всё прочитанным', callback_data: 'notif:readall' }]);
  kb.push([{ text: '‹ Назад', callback_data: 'm:main' }]);
  return kb;
};

// Сайтовая "Страница поддержки" убрана намеренно — тикет теперь пишется
// прямо в боте (см. handlers/support.ts askSupportMessage), сайт для этого
// больше не нужен. Сообщество в Telegram остаётся — это тоже Telegram, не
// уход "на сторону".
export const supportKeyboard = (): InlineKeyboard => [
  [{ text: '✍️ Написать в поддержку', callback_data: 'sup:ask' }],
  [{ text: '💬 Сообщество в Telegram', url: 'https://t.me/qmurzik' }],
  [{ text: '‹ Назад', callback_data: 'm:main' }],
];

export const linkStartKeyboard = (): InlineKeyboard => [
  [{ text: '🔑 Войти по паролю вместо кода', callback_data: 'link:pw' }],
  [{ text: '❌ Отмена', callback_data: 'link:cancel' }],
];

export const linkPasswordKeyboard = (): InlineKeyboard => [
  [{ text: '🔗 Ввести код вместо этого', callback_data: 'link:start' }],
  [{ text: '❌ Отмена', callback_data: 'link:cancel' }],
];

export const registerStartKeyboard = (): InlineKeyboard => [[{ text: '❌ Отмена', callback_data: 'reg:cancel' }]];

export const adminMenuKeyboard = (): InlineKeyboard => [
  [
    { text: '📊 Статистика', callback_data: 'adm:stats' },
    { text: '📋 Пользователи', callback_data: 'adm:users:0' },
  ],
  [
    { text: '🔍 Поиск по нику', callback_data: 'adm:search' },
    { text: '📣 Рассылка всем', callback_data: 'adm:broadcast' },
  ],
  [{ text: '🚧 Мин. версия приложения', callback_data: 'adm:appver' }],
  [{ text: '📦 Приложение (APK)', callback_data: 'adm:app' }],
  [{ text: '🌐 Вход/регистрация на сайте', callback_data: 'adm:siteauth' }],
  [{ text: '👔 Кураторы', callback_data: 'adm:curators' }],
  [{ text: '‹ Назад', callback_data: 'm:main' }],
];

/**
 * "📦 Приложение (APK)" screen — publish a new build straight from the bot
 * (small files) or from the site's drag-and-drop uploader (large ones), then
 * generate the pretty public landing page. See handlers/admin.ts showAppManager.
 */
export const appManagerKeyboard = (release: { has_file: boolean; share_enabled: boolean }, publicUrl: string): InlineKeyboard => {
  const kb: InlineKeyboard = [
    [{ text: '✏️ Версия и описание', callback_data: 'adm:app:release' }],
    [{ text: '📤 Загрузить APK через бота', callback_data: 'adm:app:upload' }],
  ];
  if (release.has_file) {
    kb.push([
      release.share_enabled
        ? { text: '🚫 Отключить публичную ссылку', callback_data: 'adm:app:revoke' }
        : { text: '🔗 Создать публичную ссылку', callback_data: 'adm:app:share' },
    ]);
  }
  if (release.share_enabled && publicUrl) {
    kb.push([{ text: '🌐 Открыть красивую страницу', url: `${publicUrl}/app/download` }]);
  }
  kb.push([{ text: '‹ В админ-меню', callback_data: 'adm:menu' }]);
  return kb;
};

/** Toggle screen for get_site_auth_gate/set_site_auth_gate — see handlers/admin.ts showSiteAuthGate. */
export const siteAuthGateKeyboard = (enabled: boolean): InlineKeyboard => [
  [
    enabled
      ? { text: '🔴 Выключить вход на сайте', callback_data: 'adm:siteauth:set:0' }
      : { text: '🟢 Включить вход на сайте', callback_data: 'adm:siteauth:set:1' },
  ],
  [{ text: '‹ В админ-меню', callback_data: 'adm:menu' }],
];

export const adminUserCardKeyboard = (hasCloneSlot: boolean, isCurator: boolean, hasCurator: boolean): InlineKeyboard => {
  const kb: InlineKeyboard = [
    [
      { text: '➕ Продлить', callback_data: 'adm:issue' },
      { text: '📨 Написать', callback_data: 'adm:msg' },
    ],
  ];
  if (!hasCloneSlot) kb.push([{ text: '🧬 Выдать клона', callback_data: 'adm:devslot:ask' }]);
  kb.push([
    isCurator
      ? { text: '🚫 Снять кураторство', callback_data: 'adm:cur:revoke:ask' }
      : { text: '👔 Сделать куратором', callback_data: 'adm:cur:grant:ask' },
  ]);
  if (hasCurator) kb.push([{ text: '❌ Отвязать его куратора', callback_data: 'adm:cur:unlinkward:ask' }]);
  kb.push(
    [
      { text: '🚫 Снять подписку', callback_data: 'adm:rm:ask' },
      { text: '🗑 Удалить', callback_data: 'adm:del:ask' },
    ],
    [
      { text: '🔍 Поиск', callback_data: 'adm:search' },
      { text: '📋 Список', callback_data: 'adm:users:0' },
    ],
    [{ text: '‹ В админ-меню', callback_data: 'adm:menu' }]
  );
  return kb;
};

export interface AdminUserRow {
  username: string;
  active: boolean;
  days_left: number;
  telegram_id: string;
}

/** Browsable, click-through list of users — the alternative to typing a username every time. */
export const adminUsersListKeyboard = (rows: AdminUserRow[], page: number, hasPrev: boolean, hasNext: boolean): InlineKeyboard => {
  const kb: InlineKeyboard = rows.map((u) => [
    {
      // telegram_id тоже виден прямо в списке — не только на карточке —
      // чтобы не открывать каждого по очереди, если ищут конкретный id.
      text: `${u.active ? '🟢' : '🔴'} ${u.username}${u.active ? ` · ${u.days_left}д` : ''}${u.telegram_id ? ` · id${u.telegram_id}` : ''}`,
      callback_data: `adm:u:${u.username}`,
    },
  ]);

  const nav: InlineKeyboard[number] = [];
  if (hasPrev) nav.push({ text: '◀️', callback_data: `adm:users:${page - 1}` });
  nav.push({ text: '🔍 Поиск', callback_data: 'adm:search' });
  if (hasNext) nav.push({ text: '▶️', callback_data: `adm:users:${page + 1}` });
  kb.push(nav);
  kb.push([{ text: '‹ В админ-меню', callback_data: 'adm:menu' }]);
  return kb;
};

export const cancelKeyboard = (target: string): InlineKeyboard => [[{ text: '❌ Отмена', callback_data: target }]];
