<?php
declare(strict_types=1);

/**
 * mod/admin/bot.php — API для АДМИН-раздела Telegram-бота QMods.
 *
 * Дополненная версия существовавшего файла: старые действия (ping, stats,
 * users, user, payments, issue, remove, delete_user, notifications,
 * send_notification) сохранены, добавлены:
 *   - send_notification: необязательный параметр target (username) —
 *     личное уведомление вместо рассылки всем;
 *   - pending_telegram_pushes / ack_telegram_push: очередь уведомлений,
 *     которые воркер обязан доставить в Telegram (оплата, окончание
 *     подписки, новости) и подтверждение доставки.
 *
 * Это ОТДЕЛЬНЫЙ токен от mod/api/bot.php — его держит только Cloudflare
 * Worker админ-модуль, не выдаётся обычным пользователям бота.
 */

require dirname(__DIR__) . '/includes/bootstrap.php';
require_once dirname(__DIR__) . '/includes/bot_notify.php';
require_once dirname(__DIR__) . '/subscribe/config.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

// ============================================================
// CONFIG
// ============================================================

// Сгенерируй токен через generate_token.php (отдельный от пользовательского
// bot.php!) и вставь сюда только хеш. Сам токен — в секретах воркера.
const BOT_API_TOKEN_HASH = 'PASTE_ADMIN_BOT_TOKEN_HASH_HERE';

// ============================================================
// JSON / AUTH
// ============================================================

function bot_json(array $data, int $status = 200): never
{
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function get_bot_token(): string
{
    return trim((string)($_SERVER['HTTP_X_QMODS_BOT_TOKEN'] ?? ''));
}

function authorize_bot(): void
{
    $token = get_bot_token();
    if ($token === '') {
        bot_json(['success' => false, 'error' => 'Unauthorized'], 401);
    }
    if (BOT_API_TOKEN_HASH === '' || BOT_API_TOKEN_HASH === 'PASTE_ADMIN_BOT_TOKEN_HASH_HERE') {
        bot_json(['success' => false, 'error' => 'Bot API hash is not configured'], 500);
    }
    if (!password_verify($token, BOT_API_TOKEN_HASH)) {
        bot_json(['success' => false, 'error' => 'Unauthorized'], 401);
    }
}

authorize_bot();

// ============================================================
// INPUT
// ============================================================

$input = [];
$raw = file_get_contents('php://input');
if (is_string($raw) && trim($raw) !== '') {
    $decoded = json_decode($raw, true);
    if (is_array($decoded)) $input = $decoded;
}
$request = array_merge($_GET, $_POST, $input);
$action = trim((string)($request['action'] ?? ''));

function req_string(array $request, string $key, string $default = ''): string
{
    return trim((string)($request[$key] ?? $default));
}

function req_int(array $request, string $key, int $default = 0): int
{
    return (int)($request[$key] ?? $default);
}

function need_post(): void
{
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
        bot_json(['success' => false, 'error' => 'Only POST allowed'], 405);
    }
}

// ============================================================
// PING
// ============================================================

if ($action === 'ping') {
    bot_json(['success' => true, 'service' => 'QMods Admin Bot API', 'version' => '1.1.0', 'time' => time()]);
}

// ============================================================
// STATS
// ============================================================

if ($action === 'stats') {
    $stats = get_stats();
    $users = load_users();
    $telegramLinked = 0;
    foreach ($users as $u) {
        if (!empty($u['telegram_id'])) $telegramLinked++;
    }
    $stats['telegram_linked'] = $telegramLinked;
    bot_json(['success' => true, 'stats' => $stats]);
}

// ============================================================
// USERS — список (для быстрого обзора/поиска в админке бота)
// ============================================================

if ($action === 'users') {
    $users = load_users();
    usort($users, static function (array $a, array $b): int {
        $aExp = (int)($a['subscription']['expires_at'] ?? 0);
        $bExp = (int)($b['subscription']['expires_at'] ?? 0);
        return $bExp <=> $aExp;
    });

    $out = [];
    foreach ($users as $user) {
        $sub = subscription_info($user);
        $out[] = [
            'id' => (string)($user['id'] ?? ''),
            'username' => (string)($user['username'] ?? ''),
            'username_lower' => (string)($user['username_lower'] ?? ''),
            'plan' => $sub['plan'],
            'active' => (bool)$sub['active'],
            'days_left' => (int)$sub['days_left'],
            'expires_at' => $sub['expires_at'],
            'expires_text' => $sub['expires_text'],
            'telegram_id' => (string)($user['telegram_id'] ?? ''),
            'device_id' => (string)($user['device_id'] ?? ''),
            'created_text' => !empty($user['created_at']) ? date('d.m.Y', (int)$user['created_at']) : '—',
        ];
    }

    bot_json(['success' => true, 'users' => $out, 'count' => count($out)]);
}

// ============================================================
// USER — карточка пользователя по логину (поиск в /admin)
// ============================================================

if ($action === 'user') {
    $username = req_string($request, 'username');
    if (!validate_username($username)) {
        bot_json(['success' => false, 'error' => 'Некорректный ник.'], 400);
    }

    $needle = strtolower($username);
    foreach (load_users() as $user) {
        if (($user['username_lower'] ?? '') !== $needle) continue;

        $sub = subscription_info($user);
        $payments = [];
        foreach (($user['payments'] ?? []) as $payment) {
            $date = (int)($payment['date'] ?? 0);
            $payments[] = [
                'plan' => (string)($payment['plan'] ?? ''),
                'amount' => (float)($payment['amount'] ?? 0),
                'date' => $date,
                'date_text' => $date > 0 ? date('d.m.Y H:i', $date) : '—',
            ];
        }

        bot_json([
            'success' => true,
            'found' => true,
            'user' => [
                'id' => (string)($user['id'] ?? ''),
                'username' => (string)($user['username'] ?? ''),
                'telegram_id' => (string)($user['telegram_id'] ?? ''),
                'device_id' => (string)($user['device_id'] ?? ''),
                'created_at' => (int)($user['created_at'] ?? 0),
                'subscription' => [
                    'plan' => $sub['plan'],
                    'active' => (bool)$sub['active'],
                    'days_left' => (int)$sub['days_left'],
                    'expires_at' => $sub['expires_at'],
                    'expires_text' => $sub['expires_text'],
                ],
                'payments' => $payments,
            ],
        ]);
    }

    bot_json(['success' => true, 'found' => false, 'user' => null]);
}

// ============================================================
// PAYMENTS — последние 100 платежей по всем пользователям
// ============================================================

if ($action === 'payments') {
    $users = load_users();
    $rows = [];
    $total = 0.0;

    foreach ($users as $user) {
        foreach (($user['payments'] ?? []) as $payment) {
            $amount = (float)($payment['amount'] ?? 0);
            $date = (int)($payment['date'] ?? 0);
            $rows[] = [
                'username' => (string)($user['username'] ?? ''),
                'date' => $date,
                'date_text' => $date > 0 ? date('d.m.Y H:i', $date) : '—',
                'plan' => (string)($payment['plan'] ?? ''),
                'amount' => $amount,
                'op' => (string)($payment['op'] ?? ''),
            ];
            $total += $amount;
        }
    }

    usort($rows, static fn(array $a, array $b): int => $b['date'] <=> $a['date']);
    bot_json(['success' => true, 'total' => $total, 'payments' => array_slice($rows, 0, 100)]);
}

// ============================================================
// ISSUE — выдать/продлить подписку
// ============================================================

if ($action === 'issue') {
    need_post();

    $username = req_string($request, 'username');
    $plan = req_string($request, 'plan', 'default');
    $days = req_int($request, 'days');
    $expiresDate = req_string($request, 'expires_date');
    $create = in_array(strtolower(req_string($request, 'create')), ['1', 'true', 'yes', 'on'], true);

    if (!validate_username($username)) {
        bot_json(['success' => false, 'error' => 'Некорректный ник.'], 400);
    }
    if (!preg_match('/^[A-Za-z0-9_\-]{1,32}$/', $plan)) {
        bot_json(['success' => false, 'error' => 'Некорректный тариф.'], 400);
    }

    $expiresAt = 0;
    $useDays = false;

    if ($expiresDate !== '') {
        $timestamp = strtotime($expiresDate . ' 23:59:59');
        if ($timestamp === false) {
            bot_json(['success' => false, 'error' => 'Неверный формат даты.'], 400);
        }
        $expiresAt = $timestamp;
    } elseif ($days >= 1 && $days <= 3650) {
        $useDays = true;
    } else {
        bot_json(['success' => false, 'error' => 'Укажите дни или дату.'], 400);
    }

    // Для продления по дням отсчитываем от ТЕКУЩЕГО окончания подписки
    // (а не от "сейчас"), иначе у пользователя с ещё активной подпиской
    // "+N дней" стирает уже оплаченный остаток вместо того, чтобы его
    // нарастить — этот $finalExpiresAt заполняется внутри замыкания, где
    // виден текущий expires_at пользователя.
    $finalExpiresAt = null;

    [$ok, $result] = update_users(function (array $users) use ($username, $expiresAt, $plan, $create, $useDays, $days, &$finalExpiresAt): array {
        $found = false;
        foreach ($users as &$user) {
            if (($user['username_lower'] ?? '') === strtolower(trim($username))) {
                $found = true;
                $user['subscription']['plan'] = $plan;
                if ($useDays) {
                    $currentExpiresAt = (int)($user['subscription']['expires_at'] ?? 0);
                    $base = max(time(), $currentExpiresAt);
                    $user['subscription']['expires_at'] = $base + ($days * 86400);
                } else {
                    $user['subscription']['expires_at'] = $expiresAt;
                }
                $finalExpiresAt = $user['subscription']['expires_at'];
                break;
            }
        }
        unset($user);

        if (!$found && $create) {
            $newExpiresAt = $useDays ? (time() + ($days * 86400)) : $expiresAt;
            $finalExpiresAt = $newExpiresAt;
            $users[] = [
                'id' => bin2hex(random_bytes(16)),
                'username' => $username,
                'username_lower' => strtolower(trim($username)),
                'created_at' => time(),
                'device_id' => '',
                'subscription' => ['plan' => $plan, 'expires_at' => $newExpiresAt],
                'payments' => [],
            ];
            return [$users, ['success' => true, 'created' => true]];
        }

        if (!$found) {
            return [$users, ['error' => 'Пользователь не найден.']];
        }
        return [$users, ['success' => true]];
    });

    if (!$ok) bot_json(['success' => false, 'error' => 'Ошибка хранилища.'], 500);
    if (!empty($result['error'])) bot_json(['success' => false, 'error' => $result['error']], 404);

    $message = $useDays
        ? "Подписка {$username} продлена на {$days} дн. до " . date('d.m.Y', $finalExpiresAt)
        : "Подписка {$username} продлена до " . date('d.m.Y', $finalExpiresAt);

    log_action("Telegram API issue: {$username}");
    notify_user_event(strtolower($username), '⭐ Подписка обновлена', $message);
    bot_json(['success' => true, 'message' => $message, 'created' => !empty($result['created'])]);
}

// ============================================================
// REMOVE — снять подписку и устройство
// ============================================================

if ($action === 'remove') {
    need_post();
    $username = req_string($request, 'username');
    if (!validate_username($username)) {
        bot_json(['success' => false, 'error' => 'Некорректный ник.'], 400);
    }

    [$ok, $result] = update_users(function (array $users) use ($username): array {
        $found = false;
        foreach ($users as &$user) {
            if (($user['username_lower'] ?? '') === strtolower(trim($username))) {
                $found = true;
                $user['subscription']['plan'] = 'none';
                $user['subscription']['expires_at'] = 0;
                $user['device_id'] = '';
                break;
            }
        }
        unset($user);
        if (!$found) return [$users, ['error' => 'Пользователь не найден.']];
        return [$users, ['success' => true]];
    });

    if (!$ok) bot_json(['success' => false, 'error' => 'Ошибка хранилища.'], 500);
    if (!empty($result['error'])) bot_json(['success' => false, 'error' => $result['error']], 404);

    log_action("Telegram API remove: {$username}");
    bot_json(['success' => true, 'message' => "Подписка снята с {$username}"]);
}

// ============================================================
// DELETE_USER
// ============================================================

if ($action === 'delete_user') {
    need_post();
    $username = req_string($request, 'username');
    if (!validate_username($username)) {
        bot_json(['success' => false, 'error' => 'Некорректный ник.'], 400);
    }

    [$ok, $result] = update_users(function (array $users) use ($username): array {
        $before = count($users);
        $users = array_values(array_filter($users, static fn($user) =>
            ($user['username_lower'] ?? '') !== strtolower(trim($username))
        ));
        if (count($users) === $before) return [$users, ['error' => 'Пользователь не найден.']];
        return [$users, ['success' => true]];
    });

    if (!$ok) bot_json(['success' => false, 'error' => 'Ошибка хранилища.'], 500);
    if (!empty($result['error'])) bot_json(['success' => false, 'error' => $result['error']], 404);

    log_action("Telegram API delete user: {$username}");
    bot_json(['success' => true, 'message' => "Пользователь {$username} удалён"]);
}

// ============================================================
// NOTIFICATIONS — список всех уведомлений (лента для админа)
// ============================================================

if ($action === 'notifications') {
    $notifications = load_notifications();
    usort($notifications, static fn($a, $b) => ($b['created_at'] ?? 0) <=> ($a['created_at'] ?? 0));

    $out = [];
    foreach ($notifications as $notification) {
        $out[] = [
            'id' => $notification['id'] ?? '',
            'title' => $notification['title'] ?? '',
            'message' => $notification['message'] ?? '',
            'target' => $notification['target'] ?? '',
            'created_at' => (int)($notification['created_at'] ?? 0),
            'date' => !empty($notification['created_at']) ? date('d.m.Y H:i', (int)$notification['created_at']) : '—',
        ];
    }

    bot_json(['success' => true, 'notifications' => $out]);
}

// ============================================================
// SEND_NOTIFICATION — рассылка всем или конкретному пользователю
// ============================================================

if ($action === 'send_notification') {
    need_post();
    $title = req_string($request, 'title');
    $message = req_string($request, 'message');
    $target = req_string($request, 'target'); // username, опционально

    if ($title === '' || $message === '') {
        bot_json(['success' => false, 'error' => 'Заполните заголовок и текст.'], 400);
    }

    $notificationId = '';
    if ($target !== '') {
        if (!validate_username($target)) {
            bot_json(['success' => false, 'error' => 'Некорректный ник получателя.'], 400);
        }
        $exists = find_user_by_username(load_users(), $target);
        if ($exists === null) {
            bot_json(['success' => false, 'error' => 'Пользователь не найден.'], 404);
        }
        $notificationId = notify_user_event(strtolower($target), $title, $message);
    } else {
        notify_broadcast_event($title, $message);
    }

    log_action("Telegram notification: {$title}" . ($target !== '' ? " -> {$target}" : ' (всем)'));
    // notification_id is only set for a personal message (target !== '') —
    // lets the caller immediately mark_telegram_sent() after its own
    // best-effort direct send, so the 5-min cron doesn't deliver it again.
    bot_json(['success' => true, 'message' => 'Уведомление создано', 'notification_id' => $notificationId]);
}

// ============================================================
// GET_APP_VERSION / SET_APP_VERSION — принудительное обновление приложения
// ============================================================

if ($action === 'get_app_version') {
    bot_json(['success' => true] + get_app_version_gate());
}

if ($action === 'set_app_version') {
    need_post();
    $minVersionCode = req_int($request, 'min_version_code', 0);
    $message = req_string($request, 'message');

    if ($minVersionCode < 0) {
        bot_json(['success' => false, 'error' => 'min_version_code must be >= 0'], 400);
    }

    set_app_version_gate($minVersionCode, $message);
    log_action("Telegram admin: set_app_version min_version_code={$minVersionCode}");
    bot_json(['success' => true]);
}

// ============================================================
// PENDING_PAYMENT_ALERTS — "кто/когда/что купил" для админа (cron воркера)
// ============================================================

if ($action === 'pending_payment_alerts') {
    $limit = req_int($request, 'limit', 100);
    $limit = $limit > 0 && $limit <= 500 ? $limit : 100;
    bot_json(['success' => true, 'items' => get_and_clear_payment_alerts($limit)]);
}

// ============================================================
// PENDING_TELEGRAM_PUSHES — очередь на доставку ботом (cron воркера)
// ============================================================

if ($action === 'pending_telegram_pushes') {
    $limit = req_int($request, 'limit', 200);
    $limit = $limit > 0 && $limit <= 500 ? $limit : 200;
    bot_json(['success' => true, 'items' => get_pending_telegram_pushes($limit)]);
}

// ============================================================
// ACK_TELEGRAM_PUSH — подтверждение доставки (после успешной отправки)
// ============================================================

if ($action === 'ack_telegram_push') {
    need_post();
    $items = $request['items'] ?? [];
    if (!is_array($items)) {
        bot_json(['success' => false, 'error' => 'Invalid items'], 400);
    }

    $count = 0;
    foreach ($items as $item) {
        if (!is_array($item)) continue;
        $notificationId = (string)($item['notification_id'] ?? '');
        $userId = (string)($item['user_id'] ?? '');
        if ($notificationId === '' || $userId === '') continue;
        mark_telegram_sent($notificationId, $userId);
        $count++;
    }

    bot_json(['success' => true, 'acked' => $count]);
}

// ============================================================
// UNKNOWN
// ============================================================

bot_json(['success' => false, 'error' => 'Unknown action'], 404);
