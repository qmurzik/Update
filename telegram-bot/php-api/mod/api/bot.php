<?php
declare(strict_types=1);

/**
 * mod/api/bot.php — API для пользовательского Telegram-бота QMods.
 *
 * Это ДОПОЛНЕННАЯ версия уже существовавшего на сайте файла: все прежние
 * действия (ping, plans, me, link, stats) сохранены без изменений в
 * поведении, добавлены новые действия для раздела бота "Устройства" и
 * "Уведомления" (devices, device_remove, notifications, notifications_ack,
 * unlink). Бот работает поверх существующих пользователей/подписок из
 * data/users.json — отдельной базы пользователей для Telegram не создаётся.
 *
 * Авторизация: заголовок X-QMods-Bot-Token, сверяется через password_verify()
 * с BOT_API_TOKEN_HASH ниже. Токен хранит только Cloudflare Worker (секрет
 * в `wrangler secret put QMODS_BOT_API_TOKEN`), сайт никогда не отдаёт его
 * обратно — только сверяет хеш.
 */

require dirname(__DIR__) . '/includes/bootstrap.php';
require_once dirname(__DIR__) . '/includes/bot_notify.php';
require_once dirname(__DIR__) . '/subscribe/config.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

// ============================================================
// CONFIG
// ============================================================

// Сгенерируй НОВЫЙ токен через mod/admin/generate_token.php (не переиспользуй
// старый, если он когда-либо мог "засветиться" в бэкапах/архивах) и вставь
// сюда только его bcrypt-хеш. Сам токен уходит только в секреты воркера.
const BOT_API_TOKEN_HASH = 'PASTE_BOT_TOKEN_HASH_HERE';

// Лимит попыток ввода кода привязки на один telegram_id (защита от перебора
// 10-значного кода уже на уровне сайта, помимо лимитов в самом боте).
const LINK_ATTEMPTS_MAX = 8;
const LINK_ATTEMPTS_WINDOW = 900; // 15 минут
const LINK_ATTEMPTS_FILE = DATA_DIR . '/bot_link_attempts.json';

// ============================================================
// JSON / ВВОД
// ============================================================

function bot_json(array $data, int $code = 200): never
{
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function bot_request_data(): array
{
    $data = array_merge($_GET, $_POST);
    $raw = file_get_contents('php://input');
    if (is_string($raw) && trim($raw) !== '') {
        $json = json_decode($raw, true);
        if (is_array($json)) $data = array_merge($data, $json);
    }
    return $data;
}

function bot_header_token(): string
{
    $token = $_SERVER['HTTP_X_QMODS_BOT_TOKEN'] ?? '';
    return is_string($token) ? trim($token) : '';
}

function bot_authorized(): bool
{
    $token = bot_header_token();
    if ($token === '' || BOT_API_TOKEN_HASH === '' || BOT_API_TOKEN_HASH === 'PASTE_BOT_TOKEN_HASH_HERE') {
        return false;
    }
    return password_verify($token, BOT_API_TOKEN_HASH);
}

if (!bot_authorized()) {
    bot_json(['success' => false, 'error' => 'Unauthorized'], 401);
}

function valid_telegram_id(string $id): bool
{
    return preg_match('/^[0-9]{1,20}$/', $id) === 1;
}

// ============================================================
// АНТИБРУТФОРС ДЛЯ /link (по telegram_id)
// ============================================================

function link_attempts_data(): array
{
    $raw = @file_get_contents(LINK_ATTEMPTS_FILE);
    $data = $raw !== false ? json_decode($raw, true) : null;
    return is_array($data) ? $data : [];
}

/** true, если лимит попыток исчерпан */
function link_attempts_blocked(string $telegramId): bool
{
    $data = link_attempts_data();
    $entry = $data[$telegramId] ?? null;
    if (!is_array($entry)) return false;
    $now = time();
    $recent = array_filter((array)($entry['attempts'] ?? []), static fn($ts) => (int)$ts >= $now - LINK_ATTEMPTS_WINDOW);
    return count($recent) >= LINK_ATTEMPTS_MAX;
}

function link_attempts_register(string $telegramId): void
{
    $fp = @fopen(LINK_ATTEMPTS_FILE, 'c+');
    if ($fp === false) return;
    if (!flock($fp, LOCK_EX)) { fclose($fp); return; }
    $raw = stream_get_contents($fp);
    $data = json_decode($raw === false ? '' : $raw, true);
    if (!is_array($data)) $data = [];

    $now = time();
    $entry = $data[$telegramId] ?? ['attempts' => []];
    $attempts = array_filter((array)($entry['attempts'] ?? []), static fn($ts) => (int)$ts >= $now - LINK_ATTEMPTS_WINDOW);
    $attempts[] = $now;
    $data[$telegramId] = ['attempts' => array_values($attempts)];

    // чистим старые записи, чтобы файл не рос бесконечно
    foreach ($data as $tid => $e) {
        $left = array_filter((array)($e['attempts'] ?? []), static fn($ts) => (int)$ts >= $now - LINK_ATTEMPTS_WINDOW);
        if (empty($left)) unset($data[$tid]); else $data[$tid] = ['attempts' => array_values($left)];
    }

    rewind($fp);
    ftruncate($fp, 0);
    fwrite($fp, json_encode($data));
    fflush($fp);
    flock($fp, LOCK_UN);
    fclose($fp);
}

function find_user_by_telegram_id(array $users, string $telegramId): ?array
{
    foreach ($users as $u) {
        if ((string)($u['telegram_id'] ?? '') === $telegramId) return $u;
    }
    return null;
}

$req = bot_request_data();
$action = trim((string)($req['action'] ?? ''));

// ============================================================
// PING
// ============================================================

if ($action === 'ping') {
    bot_json([
        'success' => true,
        'service' => 'QMods Bot API',
        'time' => time(),
    ]);
}

// ============================================================
// PLANS — тарифы для раздела "Оплата"
// ============================================================

if ($action === 'plans') {
    $plans = [];
    foreach (PLANS as $id => $plan) {
        $plans[] = [
            'id' => (string)$id,
            'title' => (string)($plan['title'] ?? $id),
            'price' => (float)($plan['price'] ?? 0),
            'days' => (int)($plan['days'] ?? 0),
        ];
    }
    bot_json(['success' => true, 'plans' => $plans]);
}

// ============================================================
// ME — профиль/подписка привязанного пользователя
// ============================================================

if ($action === 'me') {
    $telegramId = trim((string)($req['telegram_id'] ?? ''));
    if (!valid_telegram_id($telegramId)) {
        bot_json(['success' => false, 'error' => 'Invalid telegram_id'], 400);
    }

    foreach (load_users() as $user) {
        if ((string)($user['telegram_id'] ?? '') !== $telegramId) continue;

        $sub = subscription_info($user);
        $payments = [];
        foreach (($user['payments'] ?? []) as $payment) {
            $date = (int)($payment['date'] ?? 0);
            $payments[] = [
                'plan' => (string)($payment['plan'] ?? ''),
                'amount' => (float)($payment['amount'] ?? 0),
                'date' => $date,
                'date_text' => $date ? date('d.m.Y H:i', $date) : '—',
            ];
        }
        usort($payments, static fn(array $a, array $b): int => $b['date'] <=> $a['date']);

        bot_json([
            'success' => true,
            'linked' => true,
            'user' => [
                'id' => (string)($user['id'] ?? ''),
                'username' => (string)($user['username'] ?? ''),
                'created_at' => (int)($user['created_at'] ?? 0),
                'created_text' => !empty($user['created_at']) ? date('d.m.Y', (int)$user['created_at']) : '—',
                'status' => $sub['active'] ? 'active' : 'inactive',
                'subscription' => [
                    'plan' => $sub['plan'],
                    'active' => $sub['active'],
                    'days_left' => $sub['days_left'],
                    'expires_at' => $sub['expires_at'],
                    'expires_text' => $sub['expires_text'],
                ],
                'device' => [
                    'linked' => !empty($user['device_id']),
                    'id' => (string)($user['device_id'] ?? ''),
                ],
                'payments' => $payments,
            ],
        ]);
    }

    bot_json(['success' => true, 'linked' => false, 'user' => null]);
}

// ============================================================
// LINK — привязка Telegram по одноразовому коду из кабинета
// ============================================================

if ($action === 'link') {
    $telegramId = trim((string)($req['telegram_id'] ?? ''));
    $code = strtoupper(trim((string)($req['code'] ?? '')));

    if (!valid_telegram_id($telegramId)) {
        bot_json(['success' => false, 'error' => 'Invalid telegram_id'], 400);
    }

    if (link_attempts_blocked($telegramId)) {
        log_action('Bot link: rate limit hit for telegram_id ' . $telegramId);
        bot_json(['success' => false, 'error' => 'Слишком много попыток. Попробуйте позже.'], 429);
    }

    if (!preg_match('/^[A-Z0-9]{10}$/', $code)) {
        link_attempts_register($telegramId);
        bot_json(['success' => false, 'error' => 'Invalid code format'], 400);
    }

    $users = load_users();
    foreach ($users as $u) {
        if ((string)($u['telegram_id'] ?? '') === $telegramId) {
            bot_json([
                'success' => false,
                'error' => 'Telegram already linked',
                'username' => (string)($u['username'] ?? ''),
            ], 409);
        }
    }

    $foundId = '';
    $foundUsername = '';
    $now = time();

    foreach ($users as $u) {
        $savedCode = strtoupper(trim((string)($u['telegram_link_code'] ?? '')));
        $expires = (int)($u['telegram_link_expires'] ?? 0);
        if ($savedCode !== $code) continue;
        if ($expires < $now) {
            link_attempts_register($telegramId);
            bot_json(['success' => false, 'error' => 'Invalid or expired code'], 404);
        }
        $foundId = (string)($u['id'] ?? '');
        $foundUsername = (string)($u['username'] ?? '');
        break;
    }

    if ($foundId === '') {
        link_attempts_register($telegramId);
        bot_json(['success' => false, 'error' => 'Invalid or expired code'], 404);
    }

    [$ok, $result] = update_users(function (array $users) use ($foundId, $telegramId, $code): array {
        foreach ($users as &$u) {
            if ((string)($u['id'] ?? '') !== $foundId) continue;
            $savedCode = strtoupper(trim((string)($u['telegram_link_code'] ?? '')));
            $expires = (int)($u['telegram_link_expires'] ?? 0);
            if ($savedCode !== $code || $expires < time()) {
                return [$users, ['error' => 'Invalid or expired code']];
            }
            $u['telegram_id'] = $telegramId;
            unset($u['telegram_link_code'], $u['telegram_link_expires']);
            break;
        }
        unset($u);
        return [$users, ['success' => true]];
    });

    if (!$ok) bot_json(['success' => false, 'error' => 'Storage error'], 500);
    if (($result['error'] ?? '') !== '') {
        link_attempts_register($telegramId);
        bot_json(['success' => false, 'error' => $result['error']], 409);
    }

    log_action('Telegram linked: ' . $foundUsername . ' / ' . $telegramId);
    notify_user_event(strtolower($foundUsername), '🔗 Telegram привязан', 'Ваш аккаунт успешно привязан к Telegram-боту QMods.');
    bot_json(['success' => true, 'linked' => true, 'username' => $foundUsername]);
}

// ============================================================
// UNLINK — самостоятельная отвязка Telegram от аккаунта
// ============================================================

if ($action === 'unlink') {
    $telegramId = trim((string)($req['telegram_id'] ?? ''));
    if (!valid_telegram_id($telegramId)) {
        bot_json(['success' => false, 'error' => 'Invalid telegram_id'], 400);
    }

    [$ok, $result] = update_users(function (array $users) use ($telegramId): array {
        $found = false;
        foreach ($users as &$u) {
            if ((string)($u['telegram_id'] ?? '') !== $telegramId) continue;
            $found = true;
            unset($u['telegram_id']);
            break;
        }
        unset($u);
        return [$users, ['success' => $found]];
    });

    if (!$ok) bot_json(['success' => false, 'error' => 'Storage error'], 500);
    if (empty($result['success'])) bot_json(['success' => false, 'error' => 'Not linked'], 404);

    log_action('Telegram unlinked: ' . $telegramId);
    bot_json(['success' => true]);
}

// ============================================================
// DEVICES — устройства привязанного пользователя
// ============================================================

if ($action === 'devices') {
    $telegramId = trim((string)($req['telegram_id'] ?? ''));
    if (!valid_telegram_id($telegramId)) {
        bot_json(['success' => false, 'error' => 'Invalid telegram_id'], 400);
    }

    $user = find_user_by_telegram_id(load_users(), $telegramId);
    if ($user === null) {
        bot_json(['success' => false, 'error' => 'Not linked'], 404);
    }

    $devices = [];
    $deviceId = (string)($user['device_id'] ?? '');
    if ($deviceId !== '') {
        // Текущая архитектура сайта хранит одно устройство на аккаунт
        // (device_id). Формат ответа уже рассчитан на массив устройств,
        // чтобы при будущем переходе на data/devices.json (несколько
        // устройств на аккаунт) бот не пришлось переделывать.
        $devices[] = [
            'id' => $deviceId,
            'id_short' => substr($deviceId, 0, 8) . '…',
            'name' => $user['device_name'] ?? null,           // пока не собирается приложением
            'android_version' => $user['device_android'] ?? null, // пока не собирается приложением
            'added_at' => (int)($user['device_added_at'] ?? ($user['created_at'] ?? 0)),
            'last_seen' => (int)($user['last_seen'] ?? 0),
        ];
    }

    bot_json(['success' => true, 'devices' => $devices]);
}

// ============================================================
// DEVICE_REMOVE — отвязка устройства (без сброса подписки)
// ============================================================

if ($action === 'device_remove') {
    $telegramId = trim((string)($req['telegram_id'] ?? ''));
    $deviceId = trim((string)($req['device_id'] ?? ''));
    if (!valid_telegram_id($telegramId)) {
        bot_json(['success' => false, 'error' => 'Invalid telegram_id'], 400);
    }

    [$ok, $result] = update_users(function (array $users) use ($telegramId, $deviceId): array {
        foreach ($users as &$u) {
            if ((string)($u['telegram_id'] ?? '') !== $telegramId) continue;
            $current = (string)($u['device_id'] ?? '');
            if ($current === '' || ($deviceId !== '' && $current !== $deviceId)) {
                return [$users, ['error' => 'Device not found']];
            }
            $u['device_id'] = '';
            unset($u['device_name'], $u['device_android'], $u['device_added_at']);
            return [$users, ['success' => true, 'username' => (string)($u['username'] ?? '')]];
        }
        unset($u);
        return [$users, ['error' => 'Not linked']];
    });

    if (!$ok) bot_json(['success' => false, 'error' => 'Storage error'], 500);
    if (($result['error'] ?? '') !== '') bot_json(['success' => false, 'error' => $result['error']], 404);

    log_action('Bot device_remove: telegram_id ' . $telegramId);
    if (!empty($result['username'])) {
        notify_user_event(strtolower($result['username']), '📱 Устройство отвязано', 'Устройство было отвязано от аккаунта через Telegram-бота.');
    }
    bot_json(['success' => true]);
}

// ============================================================
// NOTIFICATIONS — личные уведомления для раздела бота
// ============================================================

if ($action === 'notifications') {
    $telegramId = trim((string)($req['telegram_id'] ?? ''));
    if (!valid_telegram_id($telegramId)) {
        bot_json(['success' => false, 'error' => 'Invalid telegram_id'], 400);
    }

    $user = find_user_by_telegram_id(load_users(), $telegramId);
    if ($user === null) {
        bot_json(['success' => false, 'error' => 'Not linked'], 404);
    }

    $items = get_bot_notifications_for_user((string)($user['id'] ?? ''), (string)($user['username_lower'] ?? ''));
    bot_json(['success' => true, 'notifications' => $items]);
}

if ($action === 'notifications_ack') {
    $telegramId = trim((string)($req['telegram_id'] ?? ''));
    $ids = $req['ids'] ?? [];
    if (!valid_telegram_id($telegramId) || !is_array($ids)) {
        bot_json(['success' => false, 'error' => 'Invalid request'], 400);
    }

    $user = find_user_by_telegram_id(load_users(), $telegramId);
    if ($user === null) {
        bot_json(['success' => false, 'error' => 'Not linked'], 404);
    }

    mark_bot_notifications_read((string)($user['id'] ?? ''), array_map('strval', $ids));
    bot_json(['success' => true]);
}

// ============================================================
// STATS — общая (нечувствительная) статистика для приветствия/раздела
// ============================================================

if ($action === 'stats') {
    $stats = get_stats();
    bot_json([
        'success' => true,
        'stats' => [
            'total' => (int)($stats['total'] ?? 0),
            'active' => (int)($stats['active'] ?? 0),
            'expired' => (int)($stats['expired'] ?? 0),
            'expiring' => (int)($stats['expiring'] ?? 0),
            'revenue' => (float)($stats['revenue'] ?? 0),
            'payment_count' => (int)($stats['payment_count'] ?? 0),
            'paid_orders' => (int)($stats['paid_orders'] ?? 0),
        ],
    ]);
}

bot_json(['success' => false, 'error' => 'Unknown action'], 400);
