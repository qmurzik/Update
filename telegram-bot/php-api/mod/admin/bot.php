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
// RECORD_PAYMENT — реальная оплата (ЮMoney через бота): продлевает
// подписку И пишет запись в историю платежей (в отличие от `issue`,
// который только продлевает — админские ручные грант-дни не оплата).
// Вызывается ТОЛЬКО воркером после проверки sha1-подписи HTTP-уведомления
// ЮMoney (см. worker/src/yoomoney.ts), никогда напрямую из бота/приложения.
// ============================================================

if ($action === 'record_payment') {
    need_post();

    $username = req_string($request, 'username');
    $plan = req_string($request, 'plan');
    $days = req_int($request, 'days');
    $amount = (float)($request['amount'] ?? 0);

    if (!validate_username($username)) {
        bot_json(['success' => false, 'error' => 'Некорректный ник.'], 400);
    }
    if ($plan === '' || $days < 1 || $days > 3650 || $amount <= 0) {
        bot_json(['success' => false, 'error' => 'Некорректные параметры оплаты.'], 400);
    }

    $finalExpiresAt = null;
    $userId = '';
    [$ok, $result] = update_users(function (array $users) use ($username, $plan, $days, $amount, &$finalExpiresAt, &$userId): array {
        $found = false;
        foreach ($users as &$user) {
            if (($user['username_lower'] ?? '') === strtolower(trim($username))) {
                $found = true;
                $userId = (string)($user['id'] ?? '');
                $currentExpiresAt = (int)($user['subscription']['expires_at'] ?? 0);
                // Тот же принцип, что и в `issue`: отсчитываем от текущего
                // окончания подписки, а не от "сейчас" — иначе оплата
                // при ещё активной подписке стирает уже оплаченный остаток.
                $base = max(time(), $currentExpiresAt);
                $user['subscription']['plan'] = $plan;
                $user['subscription']['expires_at'] = $base + ($days * 86400);
                $finalExpiresAt = $user['subscription']['expires_at'];
                if (!isset($user['payments']) || !is_array($user['payments'])) {
                    $user['payments'] = [];
                }
                $user['payments'][] = ['plan' => $plan, 'amount' => $amount, 'date' => time()];
                break;
            }
        }
        unset($user);

        if (!$found) return [$users, ['error' => 'Пользователь не найден.']];
        return [$users, ['success' => true]];
    });

    if (!$ok) bot_json(['success' => false, 'error' => 'Ошибка хранилища.'], 500);
    if (!empty($result['error'])) bot_json(['success' => false, 'error' => $result['error']], 404);

    $message = "Оплата принята. Подписка «{$plan}» продлена на {$days} дн. до " . date('d.m.Y', $finalExpiresAt);
    log_action("Telegram bot payment: {$username} +{$days}d, {$amount} RUB ({$plan})");
    // notification_id + user_id let the caller (the Worker, right after its
    // own immediate confirmation message) ack this via ack_telegram_push so
    // the 5-min cron doesn't deliver the same "оплата прошла" a second time
    // — same fix as handleMessageInput's duplicate-delivery bug.
    $notificationId = notify_user_event(strtolower($username), '💰 Оплата прошла успешно', $message);
    notify_admin_payment_event(strtolower($username), $plan, $amount, $days);

    bot_json(['success' => true, 'message' => $message, 'expires_at' => $finalExpiresAt, 'user_id' => $userId, 'notification_id' => $notificationId]);
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
// GET_SITE_AUTH_GATE / SET_SITE_AUTH_GATE — вход/регистрация на сайте
// (миграция в бота, см. INTEGRATION.md "Выключатель входа/регистрации на сайте")
// ============================================================

if ($action === 'get_site_auth_gate') {
    bot_json(['success' => true] + get_site_auth_gate());
}

if ($action === 'set_site_auth_gate') {
    need_post();
    $enabled = in_array(strtolower(req_string($request, 'enabled')), ['1', 'true', 'yes', 'on'], true);
    set_site_auth_gate($enabled);
    log_action('Telegram admin: set_site_auth_gate enabled=' . ($enabled ? '1' : '0'));
    bot_json(['success' => true, 'enabled' => $enabled]);
}

// ============================================================
// APP_RELEASE (admin) — карточка версии/APK/публичной ссылки прямо из
// Telegram-бота — зеркало веб-панели admin/app.php (не заменяет её: файлы
// больше 20 МБ по-прежнему грузятся через сайт, см. apk_upload ниже и
// android-client/../README "Публикация APK из бота").
// ============================================================

if ($action === 'get_app_release') {
    $releaseFile = DATA_DIR . '/app_release.json';
    $shareFile = DATA_DIR . '/download_link.json';
    $apkFile = APP_ROOT . '/downloads/app.apk';

    $release = is_file($releaseFile) ? json_decode((string)file_get_contents($releaseFile), true) : [];
    if (!is_array($release)) $release = [];
    $share = is_file($shareFile) ? json_decode((string)file_get_contents($shareFile), true) : null;

    $apkExists = is_file($apkFile) && filesize($apkFile) > 0;
    $shareEnabled = is_array($share) && !empty($share['enabled']) && !empty($share['token']);

    bot_json([
        'success' => true,
        'version' => (string)($release['version'] ?? ''),
        'changelog' => (string)($release['changelog'] ?? ''),
        'has_file' => $apkExists,
        'apk_size' => $apkExists ? (int)filesize($apkFile) : 0,
        'share_enabled' => $shareEnabled,
        'download_url' => $shareEnabled ? ('https://qmods.ru/mod/download.php?share=' . urlencode((string)$share['token'])) : null,
    ]);
}

if ($action === 'set_app_release') {
    need_post();
    $version = req_string($request, 'version');
    $changelog = req_string($request, 'changelog');
    if ($version === '') {
        bot_json(['success' => false, 'error' => 'Укажите версию'], 400);
    }

    $releaseFile = DATA_DIR . '/app_release.json';
    $apkFile = APP_ROOT . '/downloads/app.apk';
    $data = [
        'version' => $version,
        'changelog' => $changelog,
        'updated_at' => time(),
        'has_file' => is_file($apkFile) && filesize($apkFile) > 0,
    ];
    file_put_contents($releaseFile, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), LOCK_EX);
    log_action("Telegram admin: app release updated to v{$version}");
    bot_json(['success' => true]);
}

if ($action === 'generate_apk_share_link') {
    need_post();
    $apkFile = APP_ROOT . '/downloads/app.apk';
    if (!is_file($apkFile) || filesize($apkFile) <= 0) {
        bot_json(['success' => false, 'error' => 'Сначала загрузите APK'], 400);
    }
    $token = bin2hex(random_bytes(32));
    $shareFile = DATA_DIR . '/download_link.json';
    file_put_contents(
        $shareFile,
        json_encode(['token' => $token, 'enabled' => true, 'created_at' => time()], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        LOCK_EX
    );
    log_action('Telegram admin: public APK download link generated');
    bot_json(['success' => true, 'download_url' => 'https://qmods.ru/mod/download.php?share=' . urlencode($token)]);
}

if ($action === 'revoke_apk_share_link') {
    need_post();
    $shareFile = DATA_DIR . '/download_link.json';
    if (is_file($shareFile)) @unlink($shareFile);
    log_action('Telegram admin: public APK download link revoked');
    bot_json(['success' => true]);
}

// ============================================================
// APK_UPLOAD — приём файла APK, отправленного администратором боту как
// документ (см. worker/src/handlers/admin.ts handleApkDocument). Тело
// запроса — СЫРЫЕ байты APK, а не JSON, поэтому action передаётся через
// query-string (?action=apk_upload), а не через тело; авторизация — тот же
// заголовок X-QMods-Bot-Token, что и у всех остальных действий этого файла.
//
// Ограничение 20 МБ — не наша прихоть, а потолок Bot API на скачивание
// файлов ботом (getFile); Worker уже отсекает более крупные файлы до
// отправки сюда, эта проверка — просто defense in depth.
// ============================================================

if ($action === 'apk_upload') {
    need_post();

    $downloadDir = APP_ROOT . '/downloads';
    if (!is_dir($downloadDir)) @mkdir($downloadDir, 0755, true);

    $bytes = $raw; // сырое тело запроса, уже прочитанное выше в $raw
    $size = strlen($bytes);
    if ($size <= 0) {
        bot_json(['success' => false, 'error' => 'Пустое тело запроса'], 400);
    }
    if ($size > 20 * 1024 * 1024) {
        bot_json(['success' => false, 'error' => 'Файл больше 20 МБ'], 413);
    }

    $magic = substr($bytes, 0, 4);
    if ($magic !== "PK\x03\x04" && $magic !== "PK\x05\x06" && $magic !== "PK\x07\x08") {
        bot_json(['success' => false, 'error' => 'Файл не похож на настоящий APK (ZIP-заголовок не найден)'], 400);
    }

    $target = $downloadDir . '/app.apk';
    $tempTarget = $downloadDir . '/.app-upload-' . bin2hex(random_bytes(10)) . '.tmp';
    if (@file_put_contents($tempTarget, $bytes, LOCK_EX) === false) {
        @unlink($tempTarget);
        bot_json(['success' => false, 'error' => 'Не удалось сохранить APK на сервере'], 500);
    }
    // Атомарная замена: текущий опубликованный APK остаётся доступен, пока новый не записан целиком.
    if (!@rename($tempTarget, $target)) {
        @unlink($tempTarget);
        bot_json(['success' => false, 'error' => 'Не удалось заменить текущий APK'], 500);
    }

    $sha256 = @hash_file('sha256', $target) ?: '';
    $sizeStored = (int)@filesize($target);
    $filename = trim((string)($_SERVER['HTTP_X_APK_FILENAME'] ?? ''));
    log_action('APK uploaded via bot' . ($filename !== '' ? ': ' . $filename : '') . ' (' . $sizeStored . ' bytes)');

    $releaseFile = DATA_DIR . '/app_release.json';
    $release = is_file($releaseFile) ? json_decode((string)file_get_contents($releaseFile), true) : [];
    if (!is_array($release)) $release = [];
    $release['has_file'] = true;
    file_put_contents($releaseFile, json_encode($release, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), LOCK_EX);

    bot_json(['success' => true, 'size' => $sizeStored, 'sha256' => $sha256]);
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
