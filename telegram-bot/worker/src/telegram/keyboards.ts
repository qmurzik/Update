import type { Env } from '../config';
import type { InlineKeyboard } from './types';

export const mainMenu = (linked: boolean, isAdmin: boolean): InlineKeyboard => {
  const kb: InlineKeyboard = [];
  if (!linked) {
    kb.push([{ text: '🔗 Привязать аккаунт QMods', callback_data: 'link:start' }]);
  } else {
    kb.push([{ text: '👤 Мой профиль', callback_data: 'm:profile' }]);
    kb.push([{ text: '⭐ Моя подписка', callback_data: 'm:sub' }]);
    kb.push([{ text: '📱 Мои устройства', callback_data: 'm:devices' }]);
    kb.push([{ text: '💳 Оплата / продление', callback_data: 'm:pay' }]);
    kb.push([{ text: '🔔 Уведомления', callback_data: 'm:notif' }]);
  }
  kb.push([{ text: '🆘 Поддержка', callback_data: 'm:support' }]);
  if (isAdmin) kb.push([{ text: '🛠 Админ-панель', callback_data: 'adm:menu' }]);
  return kb;
};

export const backButton = (target = 'm:main'): InlineKeyboard => [[{ text: '‹ Назад', callback_data: target }]];

export const profileKeyboard = (): InlineKeyboard => [
  [{ text: '🔓 Отвязать Telegram', callback_data: 'link:unlink:ask' }],
  [{ text: '‹ Назад', callback_data: 'm:main' }],
];

export const subscriptionKeyboard = (env: Env): InlineKeyboard => [
  [{ text: '💳 Продлить подписку', url: env.QMODS_SUBSCRIBE_URL }],
  [{ text: '‹ Назад', callback_data: 'm:main' }],
];

export const paymentsKeyboard = (env: Env): InlineKeyboard => [
  [{ text: '💳 Продлить подписку', url: env.QMODS_SUBSCRIBE_URL }],
  [{ text: '‹ Назад', callback_data: 'm:main' }],
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
  [{ text: '‹ Назад', callback_data: 'm:main' }],
];

export const linkStartKeyboard = (): InlineKeyboard => [[{ text: '❌ Отмена', callback_data: 'link:cancel' }]];

export const adminMenuKeyboard = (): InlineKeyboard => [
  [{ text: '📊 Статистика', callback_data: 'adm:stats' }],
  [{ text: '🔍 Поиск пользователя', callback_data: 'adm:search' }],
  [{ text: '📣 Рассылка всем', callback_data: 'adm:broadcast' }],
  [{ text: '‹ Назад', callback_data: 'm:main' }],
];

export const adminUserCardKeyboard = (): InlineKeyboard => [
  [{ text: '➕ Продлить подписку', callback_data: 'adm:issue' }],
  [{ text: '📨 Написать пользователю', callback_data: 'adm:msg' }],
  [{ text: '🚫 Снять подписку', callback_data: 'adm:rm:ask' }],
  [{ text: '🗑 Удалить аккаунт', callback_data: 'adm:del:ask' }],
  [{ text: '🔍 Новый поиск', callback_data: 'adm:search' }],
  [{ text: '‹ В админ-меню', callback_data: 'adm:menu' }],
];

export const cancelKeyboard = (target: string): InlineKeyboard => [[{ text: '❌ Отмена', callback_data: target }]];
