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
 * flock()-protected read-modify-write for the flat JSON files this file
 * owns directly (app_version.json, admin_payment_alerts.json) — unlike
 * notifications.json/users.json, these aren't covered by bootstrap.php's
 * own locked update_notifications()/update_users() helpers, and a plain
 * file_get_contents()+file_put_contents(..., LOCK_EX) pair only serializes
 * the write, not the read-then-write as a whole: a write landing between
 * another caller's read and write is silently lost (lost-update race).
 * $mutator receives the current decoded array (empty array if the file is
 * missing/invalid) and returns [$newData, $returnValue].
 */
function with_locked_json_file(string $path, callable $mutator)
{
    $fh = fopen($path, 'c+');
    if ($fh === false) throw new RuntimeException("Cannot open {$path}");

    try {
        flock($fh, LOCK_EX);

        $size = filesize($path) ?: 0;
        $raw = $size > 0 ? fread($fh, $size) : '';
        $data = $raw !== '' ? json_decode($raw, true) : null;
        if (!is_array($data)) $data = [];

        [$newData, $returnValue] = $mutator($data);

        rewind($fh);
        ftruncate($fh, 0);
        fwrite($fh, json_encode($newData, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
        fflush($fh);

        return $returnValue;
    } finally {
        flock($fh, LOCK_UN);
        fclose($fh);
    }
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
/**
 * Возвращает id созданного уведомления (пусто при невалидных аргументах) —
 * нужен, чтобы вызывающий код (личное сообщение из бота, отправленное
 * сразу же через ctx.tg.sendMessage) мог тут же пометить его доставленным
 * через mark_telegram_sent() и не получить то же самое повторно от
 * cron-джобы в течение следующих 5 минут.
 */
function notify_user_event(string $usernameLower, string $title, string $message): string
{
    $usernameLower = strtolower(trim($usernameLower));
    if ($usernameLower === '' || $title === '' || $message === '') return '';

    $id = bin2hex(random_bytes(16));
    update_notifications(function (array $notifications) use ($usernameLower, $title, $message, $id): array {
        $notifications[] = [
            'id' => $id,
            'title' => $title,
            'message' => $message,
            'created_at' => time(),
            'read_by' => [],        // прочитано в кабинете (PWA)
            'sent_via_telegram' => [], // доставлено через бота
            'target' => $usernameLower, // персональное уведомление
        ];
        return [$notifications, null];
    });

    return $id;
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

/**
 * Уведомления для нативного Android-приложения (device_token -> username,
 * не telegram_id) — тот же data/notifications.json, что и бот/кабинет, но
 * с собственным флагом доставки sent_via_app, т.к. устройство опрашивает
 * сервер синхронно (GET /device/subscription) и не нуждается в отдельном
 * cron+ack, как доставка в Telegram (get_pending_telegram_pushes). Помечает
 * возвращённые записи доставленными сразу же, в одном вызове.
 */
function get_and_mark_app_notifications(string $usernameLower, int $limit = 20): array
{
    $usernameLower = strtolower(trim($usernameLower));
    if ($usernameLower === '') return [];

    $result = [];
    update_notifications(function (array $notifications) use ($usernameLower, $limit, &$result): array {
        foreach ($notifications as &$n) {
            if (count($result) >= $limit) break;

            $target = strtolower((string)($n['target'] ?? ''));
            if ($target !== '' && $target !== $usernameLower) continue;

            $sentTo = $n['sent_via_app'] ?? [];
            if (!is_array($sentTo)) $sentTo = [];
            if (in_array($usernameLower, $sentTo, true)) continue;

            $result[] = [
                'id' => (string)($n['id'] ?? ''),
                'title' => (string)($n['title'] ?? ''),
                'message' => (string)($n['message'] ?? ''),
                'created_at' => (int)($n['created_at'] ?? 0),
            ];

            $sentTo[] = $usernameLower;
            $n['sent_via_app'] = $sentTo;
        }
        unset($n);
        return [$notifications, null];
    });

    return $result;
}

/**
 * Принудительное обновление приложения — data/app_version.json.
 * min_version_code = 0 отключает гейт (пропускать все версии). Хранится
 * отдельно от app_release.json (там только текст для страницы скачивания,
 * без версии-числа и без какого-либо admin-действия на запись).
 */
function get_app_version_gate(): array
{
    return with_locked_json_file(DATA_DIR . '/app_version.json', function (array $data): array {
        return [$data, [
            'min_version_code' => (int)($data['min_version_code'] ?? 0),
            'message' => (string)($data['message'] ?? ''),
        ]];
    });
}

function set_app_version_gate(int $minVersionCode, string $message): void
{
    with_locked_json_file(DATA_DIR . '/app_version.json', function () use ($minVersionCode, $message): array {
        $data = [
            'min_version_code' => max(0, $minVersionCode),
            'message' => $message,
            'updated_at' => time(),
        ];
        return [$data, null];
    });
}

/**
 * Админский алерт "кто/когда/что купил" — отдельная очередь от персональных
 * уведомлений пользователя (data/admin_payment_alerts.json, не
 * notifications.json), т.к. это НЕ предназначено для получателя-покупателя:
 * не показывается в его кабинете/боте, уходит только в ADMIN_TELEGRAM_IDS
 * воркера (см. worker/src/index.ts deliverPendingPaymentAlerts). Вызывать
 * из событий успешной оплаты — см. INTEGRATION.md "Алерт админу об оплате".
 */
function notify_admin_payment_event(string $usernameLower, string $planTitle, float $amount, int $days = 0): void
{
    $usernameLower = strtolower(trim($usernameLower));
    if ($usernameLower === '') return;

    $telegramId = '';
    foreach (load_users() as $u) {
        if (strtolower((string)($u['username'] ?? '')) === $usernameLower) {
            $telegramId = (string)($u['telegram_id'] ?? '');
            break;
        }
    }

    with_locked_json_file(DATA_DIR . '/admin_payment_alerts.json', function (array $alerts) use ($usernameLower, $telegramId, $planTitle, $amount, $days): array {
        $alerts[] = [
            'id' => bin2hex(random_bytes(16)),
            'username' => $usernameLower,
            'telegram_id' => $telegramId,
            'plan' => $planTitle,
            'amount' => $amount,
            'days' => $days,
            'created_at' => time(),
        ];
        return [$alerts, null];
    });
}

/**
 * Отдаёт и сразу же очищает недоставленные алерты (один запрос вместо
 * fetch+ack — если сама доставка в Telegram потом не удастся, алерт
 * теряется, а не повторяется бесконечно; это админское "приятно знать",
 * а не критичное событие, так что такой компромисс — ок).
 */
function get_and_clear_payment_alerts(int $limit = 100): array
{
    return with_locked_json_file(DATA_DIR . '/admin_payment_alerts.json', function (array $alerts) use ($limit): array {
        if (empty($alerts)) return [$alerts, []];

        $out = array_slice($alerts, 0, $limit);
        $remaining = array_slice($alerts, count($out));
        return [$remaining, $out];
    });
}
