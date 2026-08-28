import type { Env } from '../config';
import type { InlineKeyboard } from './types';

export const mainMenu = (env: Env, linked: boolean, isAdmin: boolean): InlineKeyboard => {
  const kb: InlineKeyboard = [];
  const webAppButton: InlineKeyboard[number] | null = env.PUBLIC_URL
    ? [{ text: '🖥 Открыть в Mini App', web_app: { url: `${env.PUBLIC_URL}/app` } }]
    : null;

  if (!linked) {
    kb.push([{ text: '🔗 Привязать аккаунт QMods', callback_data: 'link:start' }]);
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

export const subscriptionKeyboard = (env: Env): InlineKeyboard => [
  [{ text: '💳 Купить/продлить в боте', callback_data: 'pay:plans' }],
  [{ text: '🌐 Страница оплаты на сайте', url: env.QMODS_SUBSCRIBE_URL }],
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

export const devicesKeyboard = (hasDevice: boolean): InlineKeyboard => {
  const kb: InlineKeyboard = [];
  if (hasDevice) kb.push([{ text: '🗑 Отвязать устройство', callback_data: 'dev:rm:ask' }]);
  kb.push([{ text: '‹ Назад', callback_data: 'm:main' }]);
  return kb;
};

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

export const supportKeyboard = (env: Env): InlineKeyboard => [
  [{ text: '🆘 Страница поддержки', url: env.QMODS_SUPPORT_URL }],
  [{ text: '💬 Сообщество в Telegram', url: 'https://t.me/qmurzik' }],
  [{ text: '‹ Назад', callback_data: 'm:main' }],
];

export const linkStartKeyboard = (): InlineKeyboard => [[{ text: '❌ Отмена', callback_data: 'link:cancel' }]];

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
  [{ text: '‹ Назад', callback_data: 'm:main' }],
];

export const adminUserCardKeyboard = (): InlineKeyboard => [
  [
    { text: '➕ Продлить', callback_data: 'adm:issue' },
    { text: '📨 Написать', callback_data: 'adm:msg' },
  ],
  [
    { text: '🚫 Снять подписку', callback_data: 'adm:rm:ask' },
    { text: '🗑 Удалить', callback_data: 'adm:del:ask' },
  ],
  [
    { text: '🔍 Поиск', callback_data: 'adm:search' },
    { text: '📋 Список', callback_data: 'adm:users:0' },
  ],
  [{ text: '‹ В админ-меню', callback_data: 'adm:menu' }],
];

export interface AdminUserRow {
  username: string;
  active: boolean;
  days_left: number;
}

/** Browsable, click-through list of users — the alternative to typing a username every time. */
export const adminUsersListKeyboard = (rows: AdminUserRow[], page: number, hasPrev: boolean, hasNext: boolean): InlineKeyboard => {
  const kb: InlineKeyboard = rows.map((u) => [
    {
      text: `${u.active ? '🟢' : '🔴'} ${u.username}${u.active ? ` · ${u.days_left}д` : ''}`,
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
