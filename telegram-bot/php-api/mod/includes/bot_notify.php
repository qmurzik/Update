<?php

declare(strict_types=1);

/**
 * bot_notify.php — дополнение к includes/bootstrap.php для Telegram-бота QMods.
 *
 * Файл НЕ заменяет и не изменяет bootstrap.php — только использует уже
 * существующие функции (load_users, update_users, load_notifications,
 * update_notifications) и хранилище data/notifications.json, чтобы не
 * плодить отдельную базу пользователей/уведомлений.
 *
 * Подключать после bootstrap.php:
 *   require_once dirname(__DIR__) . '/includes/bootstrap.php';
 *   require_once dirname(__DIR__) . '/includes/bot_notify.php';
 */

if (!function_exists('load_users')) {
    throw new RuntimeException('bot_notify.php требует includes/bootstrap.php');
}

/**
 * Создаёт персональное уведомление для пользователя (по username).
 * Уведомление появляется и в кабинете (колокольчик), и в Telegram-боте —
 * оба канала читают один и тот же data/notifications.json.
 *
 * Используется для событий: успешная оплата, привязка устройства,
 * привязка Telegram и т.п. Вызывайте из существующих обработчиков событий
 * (см. INTEGRATION.md), ничего в самих событиях менять не нужно.
 */
function notify_user_event(string $usernameLower, string $title, string $message): void
{
    $usernameLower = strtolower(trim($usernameLower));
    if ($usernameLower === '' || $title === '' || $message === '') return;

    update_notifications(function (array $notifications) use ($usernameLower, $title, $message): array {
        $notifications[] = [
            'id' => bin2hex(random_bytes(16)),
            'title' => $title,
            'message' => $message,
            'created_at' => time(),
            'read_by' => [],        // прочитано в кабинете (PWA)
            'sent_via_telegram' => [], // доставлено через бота
            'target' => $usernameLower, // персональное уведомление
        ];
        return [$notifications, null];
    });
}

/**
 * Широковещательное уведомление (новости проекта) — видно всем пользователям.
 */
function notify_broadcast_event(string $title, string $message): void
{
    if ($title === '' || $message === '') return;

    update_notifications(function (array $notifications) use ($title, $message): array {
        $notifications[] = [
            'id' => bin2hex(random_bytes(16)),
            'title' => $title,
            'message' => $message,
            'created_at' => time(),
            'read_by' => [],
            'sent_via_telegram' => [],
            'target' => '', // пусто = для всех
        ];
        return [$notifications, null];
    });
}

/**
 * Уведомления, ещё не доставленные через Telegram, для пользователей,
 * у которых привязан telegram_id. Используется cron-джобой воркера
 * (Cloudflare Cron Trigger -> POST admin/bot.php?action=pending_telegram_pushes).
 *
 * Возвращает плоский список "отправок": одна запись на пару
 * (уведомление, получатель), т.к. широковещательные уведомления должны
 * уйти каждому привязанному пользователю по отдельности.
 */
function get_pending_telegram_pushes(int $limit = 200): array
{
    $notifications = load_notifications();
    $users = load_users();

    // username_lower -> telegram_id, только для привязанных аккаунтов
    $telegramByUsername = [];
    $idByUsername = [];
    foreach ($users as $u) {
        $tid = (string)($u['telegram_id'] ?? '');
        $uname = (string)($u['username_lower'] ?? '');
        if ($tid === '' || $uname === '') continue;
        $telegramByUsername[$uname] = $tid;
        $idByUsername[$uname] = (string)($u['id'] ?? '');
    }

    $pending = [];
    foreach ($notifications as $n) {
        $sentTo = $n['sent_via_telegram'] ?? [];
        if (!is_array($sentTo)) $sentTo = [];
        $target = strtolower((string)($n['target'] ?? ''));

        $recipients = $target === ''
            ? array_keys($telegramByUsername) // broadcast -> всем привязанным
            : (isset($telegramByUsername[$target]) ? [$target] : []);

        foreach ($recipients as $uname) {
            $userId = $idByUsername[$uname] ?? '';
            if ($userId === '' || in_array($userId, $sentTo, true)) continue;

            $pending[] = [
                'notification_id' => (string)($n['id'] ?? ''),
                'user_id' => $userId,
                'telegram_id' => $telegramByUsername[$uname],
                'title' => (string)($n['title'] ?? ''),
                'message' => (string)($n['message'] ?? ''),
                'created_at' => (int)($n['created_at'] ?? 0),
            ];

            if (count($pending) >= $limit) {
                return $pending;
            }
        }
    }

    return $pending;
}

/**
 * Помечает уведомление доставленным конкретному пользователю через Telegram.
 * Не трогает read_by (статус прочтения в кабинете остаётся независимым).
 */
function mark_telegram_sent(string $notificationId, string $userId): void
{
    if ($notificationId === '' || $userId === '') return;

    update_notifications(function (array $notifications) use ($notificationId, $userId): array {
        foreach ($notifications as &$n) {
            if ((string)($n['id'] ?? '') !== $notificationId) continue;
            if (!isset($n['sent_via_telegram']) || !is_array($n['sent_via_telegram'])) {
                $n['sent_via_telegram'] = [];
            }
            if (!in_array($userId, $n['sent_via_telegram'], true)) {
                $n['sent_via_telegram'][] = $userId;
            }
            break;
        }
        unset($n);
        return [$notifications, null];
    });
}

/**
 * Личные (не прочитанные в боте) уведомления пользователя — для раздела
 * "🔔 Уведомления" в главном меню бота. В отличие от get_unread_notifications()
 * из bootstrap.php (используется PWA и помечает всё прочитанным сразу),
 * здесь читаем/пишем независимый флаг read_by_telegram, чтобы открытие
 * раздела в боте не "съедало" непрочитанные уведомления в кабинете и наоборот.
 */
function get_bot_notifications_for_user(string $userId, string $usernameLower, int $limit = 10): array
{
    $notifications = load_notifications();
    $usernameLower = strtolower($usernameLower);
    $out = [];

    foreach ($notifications as $n) {
        $target = strtolower((string)($n['target'] ?? ''));
        if ($target !== '' && $target !== $usernameLower) continue;

        $readByBot = $n['read_by_telegram'] ?? [];
        if (!is_array($readByBot)) $readByBot = [];

        $out[] = [
            'id' => (string)($n['id'] ?? ''),
            'title' => (string)($n['title'] ?? ''),
            'message' => (string)($n['message'] ?? ''),
            'created_at' => (int)($n['created_at'] ?? 0),
            'unread' => !in_array($userId, $readByBot, true),
        ];
    }

    usort($out, static fn(array $a, array $b): int => $b['created_at'] <=> $a['created_at']);
    return array_slice($out, 0, $limit);
}

function mark_bot_notifications_read(string $userId, array $notificationIds): void
{
    if ($userId === '' || empty($notificationIds)) return;

    update_notifications(function (array $notifications) use ($userId, $notificationIds): array {
        foreach ($notifications as &$n) {
            if (!in_array((string)($n['id'] ?? ''), $notificationIds, true)) continue;
            if (!isset($n['read_by_telegram']) || !is_array($n['read_by_telegram'])) {
                $n['read_by_telegram'] = [];
            }
            if (!in_array($userId, $n['read_by_telegram'], true)) {
                $n['read_by_telegram'][] = $userId;
            }
        }
        unset($n);
        return [$notifications, null];
    });
}
