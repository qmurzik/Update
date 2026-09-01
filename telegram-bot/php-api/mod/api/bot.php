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
require_once dirname(__DIR__) . '/includes/achievements.php';
require_once dirname(__DIR__) . '/includes/reviews.php';
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

/** Тот же алгоритм, что и make_ref_code() в mod/cabinet.php. */
function bot_make_ref_code(array $users): string
{
    do {
        $code = strtoupper(substr(bin2hex(random_bytes(4)), 0, 6));
        $exists = false;
        foreach ($users as $u) {
            if (($u['ref_code'] ?? '') === $code) { $exists = true; break; }
        }
    } while ($exists);
    return $code;
}

/** Тот же алгоритм, что и ref_find_owner() в includes/referrals.php — регистронезависимое сравнение ref_code. */
function bot_find_ref_owner(array $users, string $code): ?array
{
    $code = strtoupper(trim($code));
    if ($code === '') return null;
    foreach ($users as $u) {
        if (strtoupper((string)($u['ref_code'] ?? '')) === $code) return $u;
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

    $users = load_users();
    foreach ($users as $user) {
        if ((string)($user['telegram_id'] ?? '') !== $telegramId) continue;

        // Та же синхронизация ачивок/уровня/бонусных дней, что и на cabinet.php
        // при открытии страницы — без неё бот-only пользователи никогда бы
        // не получали бонусы за стаж/платежи/рефералов.
        sync_achievements_and_level($user, $users);
        foreach (load_users() as $fresh) {
            if ((string)($fresh['id'] ?? '') === (string)($user['id'] ?? '')) { $user = $fresh; break; }
        }

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

        $stats = user_stats($user, $users);
        $levelCode = (string)($user['level'] ?? calc_level($stats));
        $levelInfo = LEVELS[$levelCode] ?? LEVELS['newbie'];
        $achievements = is_array($user['achievements'] ?? null) ? $user['achievements'] : [];
        $refCount = 0;
        foreach ($users as $u) {
            if ((string)($u['referred_by'] ?? '') === (string)($user['username'] ?? '')) $refCount++;
        }

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
                // Клон — разовая покупка (см. grant_device_slot в
                // mod/admin/bot.php), навсегда поднимает лимит устройств до
                // 2. Сам лимит считает и проверяет воркер по количеству
                // живых device_token в D1 (worker/src/db.ts
                // claimDevicePairing), это поле только источник правды для
                // него — здесь ничего не считается и не хранится отдельно.
                'extra_device_slot' => !empty($user['extra_device_slot']),
                'max_devices' => 1 + (!empty($user['extra_device_slot']) ? 1 : 0),
                // Кураторство (см. "Кураторы" в README) — is_curator выдаётся
                // ТОЛЬКО админом (set_curator в mod/admin/bot.php);
                // curator_username выставляет сам подопечный, только своим
                // согласием (set_curator_for_ward ниже), никогда не админ и
                // не сам куратор напрямую.
                'is_curator' => !empty($user['is_curator']),
                'curator_username' => (string)($user['curator_username'] ?? '') !== '' ? (string)$user['curator_username'] : null,
                'payments' => $payments,
                'level' => [
                    'code' => $levelCode,
                    'title' => (string)($levelInfo['title'] ?? ''),
                    'icon' => (string)($levelInfo['icon'] ?? ''),
                    'perks' => (string)($levelInfo['perks'] ?? ''),
                ],
                'achievements_unlocked' => count($achievements),
                'achievements_total' => count(ACHIEVEMENTS),
                'ref_count' => $refCount,
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
// LINK_BY_PASSWORD — привязка Telegram по логину+паролю от сайта, без
// одноразового кода из кабинета (тот приходится получать НА сайте, что
// противоречит цели "бот — единственный доступ к QMods", если вход на
// сайте вообще выключен — см. README "Известный оставшийся разрыв").
// Пароль сверяется тем же password_verify()/pass_hash, что и login.php.
//
// Общий бюджет попыток с обычным `link` (link_attempts_blocked/register,
// ключ — telegram_id): подбор кода и подбор пароля — это один и тот же
// сценарий атаки (угадать доступ к чужому аккаунту), лимит один на оба.
// ============================================================

if ($action === 'link_by_password') {
    $telegramId = trim((string)($req['telegram_id'] ?? ''));
    $username = trim((string)($req['username'] ?? ''));
    $password = (string)($req['password'] ?? '');

    if (!valid_telegram_id($telegramId)) {
        bot_json(['success' => false, 'error' => 'Invalid telegram_id'], 400);
    }
    if ($username === '' || $password === '') {
        bot_json(['success' => false, 'error' => 'Укажите логин и пароль'], 400);
    }

    if (link_attempts_blocked($telegramId)) {
        log_action('Bot link_by_password: rate limit hit for telegram_id ' . $telegramId);
        bot_json(['success' => false, 'error' => 'Слишком много попыток. Попробуйте позже.'], 429);
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

    // Один и тот же ответ на "нет такого логина" и "неверный пароль" —
    // не даём угадывающему отличить существующий аккаунт от несуществующего.
    $user = find_user_by_username($users, $username);
    if ($user === null || !password_verify($password, (string)($user['pass_hash'] ?? ''))) {
        link_attempts_register($telegramId);
        bot_json(['success' => false, 'error' => 'Неверный логин или пароль.'], 401);
    }

    if (!empty($user['telegram_id'])) {
        bot_json(['success' => false, 'error' => 'Этот аккаунт уже привязан к другому Telegram.'], 409);
    }

    $foundId = (string)($user['id'] ?? '');
    $foundUsername = (string)($user['username'] ?? '');

    [$ok, $result] = update_users(function (array $users) use ($foundId, $telegramId): array {
        foreach ($users as &$u) {
            if ((string)($u['id'] ?? '') !== $foundId) continue;
            // Авторитетная перепроверка внутри блокировки — аккаунт мог
            // быть привязан кем-то ещё между load_users() и этим update.
            if (!empty($u['telegram_id'])) {
                return [$users, ['error' => 'Этот аккаунт уже привязан к другому Telegram.']];
            }
            $u['telegram_id'] = $telegramId;
            break;
        }
        unset($u);
        return [$users, ['success' => true]];
    });

    if (!$ok) bot_json(['success' => false, 'error' => 'Storage error'], 500);
    if (($result['error'] ?? '') !== '') {
        bot_json(['success' => false, 'error' => $result['error']], 409);
    }

    log_action('Telegram linked by password: ' . $foundUsername . ' / ' . $telegramId);
    notify_user_event(
        strtolower($foundUsername),
        '🔗 Telegram привязан',
        'Ваш аккаунт успешно привязан к Telegram-боту QMods (вход по логину и паролю).'
    );
    bot_json(['success' => true, 'linked' => true, 'username' => $foundUsername]);
}

// ============================================================
// REGISTER — регистрация НОВОГО аккаунта прямо из бота, без сайта
// (миграция: альтернатива /link для тех, кто ещё не заводил аккаунт на
// qmods.ru). Создаёт пользователя без поля password — тот же формат, что
// и create-ветка admin/bot.php?action=issue (админские бот-аккаунты уже
// годами создаются так же, это не новый паттерн). Даёт пробный период
// 24 часа — как и device_id-регистрация на сайте (register.php,
// 'plan' => 'trial', expires_at = time() + 86400) — но не более ОДНОГО
// раза на telegram_id, независимо от того, сколько раз аккаунт с этим
// telegram_id создавался/удалялся/отвязывался (см.
// bot_trial_already_claimed()/bot_trial_mark_claimed() в bot_notify.php —
// у бота нет device_id/IP для антифрода, как у сайта, поэтому ключ —
// сам telegram_id).
// ============================================================

if ($action === 'register') {
    $telegramId = trim((string)($req['telegram_id'] ?? ''));
    $username = trim((string)($req['username'] ?? ''));
    // Код из t.me/qmods_bot?start=ref_<CODE> (bot deep link) — см. handlers/
    // register.ts startWithReferral(). Неизвестный/пустой код НЕ блокирует
    // регистрацию (в отличие от register.php на сайте) — битая реферальная
    // ссылка не должна стоить нам живого пользователя, просто не начислится
    // бонус приглашавшему.
    $refCode = trim((string)($req['ref'] ?? ''));

    if (!valid_telegram_id($telegramId)) {
        bot_json(['success' => false, 'error' => 'Invalid telegram_id'], 400);
    }
    if (!validate_username($username)) {
        bot_json(['success' => false, 'error' => 'Никнейм должен быть 3–20 символов: латиница, цифры, _ и -.'], 400);
    }

    $usernameLower = strtolower($username);
    $users = load_users();
    $referredBy = '';
    if ($refCode !== '') {
        $refOwner = bot_find_ref_owner($users, $refCode);
        if ($refOwner !== null) $referredBy = (string)($refOwner['username'] ?? '');
    }

    foreach ($users as $u) {
        if ((string)($u['telegram_id'] ?? '') === $telegramId) {
            bot_json([
                'success' => false,
                'error' => 'Telegram already linked',
                'username' => (string)($u['username'] ?? ''),
            ], 409);
        }
        if (($u['username_lower'] ?? '') === $usernameLower) {
            bot_json(['success' => false, 'error' => 'Этот никнейм уже занят.'], 409);
        }
    }

    // Считаем ДО lock'а на users.json — не страшно, если решение по гонке
    // окажется на волосок устаревшим (отдельный лок-файл), а не наоборот:
    // отмечаем "использовано" только ПОСЛЕ подтверждённого создания аккаунта.
    $grantTrial = !bot_trial_already_claimed($telegramId);
    $subscription = $grantTrial
        ? ['plan' => 'trial', 'expires_at' => time() + 86400]
        : ['plan' => 'none', 'expires_at' => 0];

    [$ok, $result] = update_users(function (array $users) use ($username, $usernameLower, $telegramId, $subscription, $referredBy): array {
        // Авторитетная перепроверка внутри блокировки — то, что уже
        // проверено выше на устаревшем снимке, могло измениться между
        // load_users() и получением lock'а.
        foreach ($users as $u) {
            if ((string)($u['telegram_id'] ?? '') === $telegramId) {
                return [$users, ['error' => 'Telegram already linked']];
            }
            if (($u['username_lower'] ?? '') === $usernameLower) {
                return [$users, ['error' => 'Этот никнейм уже занят.']];
            }
        }

        $users[] = [
            'id' => bin2hex(random_bytes(16)),
            'username' => $username,
            'username_lower' => $usernameLower,
            'created_at' => time(),
            'telegram_id' => $telegramId,
            'device_id' => '',
            'subscription' => $subscription,
            'payments' => [],
            'referred_by' => $referredBy,
        ];
        return [$users, ['success' => true]];
    });

    if (!$ok) bot_json(['success' => false, 'error' => 'Storage error'], 500);
    if (($result['error'] ?? '') !== '') {
        bot_json(['success' => false, 'error' => $result['error']], 409);
    }

    if ($grantTrial) {
        bot_trial_mark_claimed($telegramId);
    }

    log_action('Telegram register: ' . $username . ' / ' . $telegramId . ($grantTrial ? ' (+trial 24h)' : ' (trial already used)'));
    bot_json(['success' => true, 'username' => $username, 'trial' => $grantTrial]);
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
// DEVICE_REMOVE_BY_USERNAME — то же самое, но по username вместо
// telegram_id. Вызывается ТОЛЬКО воркером — из самостоятельной отвязки
// устройства ПРЯМО ИЗ ПРИЛОЖЕНИЯ (POST /device/unlink), где известен
// только device_token -> username (D1), а не telegram_id аккаунта (тот же
// паттерн, что и у device_subscription). Не трогает D1 device_tokens —
// это только зеркало на стороне qmods.ru для разделов "Устройства" в
// боте/кабинете; фактическую отзыв делает воркер отдельно.
// ============================================================

if ($action === 'device_remove_by_username') {
    $username = trim((string)($req['username'] ?? ''));
    if ($username === '') {
        bot_json(['success' => false, 'error' => 'Invalid username'], 400);
    }

    [$ok, $result] = update_users(function (array $users) use ($username): array {
        foreach ($users as &$u) {
            if (strtolower((string)($u['username'] ?? '')) !== strtolower($username)) continue;
            $u['device_id'] = '';
            unset($u['device_name'], $u['device_android'], $u['device_added_at']);
            return [$users, ['success' => true]];
        }
        unset($u);
        return [$users, ['error' => 'Not found']];
    });

    if (!$ok) bot_json(['success' => false, 'error' => 'Storage error'], 500);
    if (($result['error'] ?? '') !== '') bot_json(['success' => false, 'error' => $result['error']], 404);

    log_action('Bot device_remove_by_username: ' . $username);
    bot_json(['success' => true]);
}

// ============================================================
// DEVICE_REGISTER — привязывает device_id к аккаунту по telegram_id.
// Вызывается ТОЛЬКО воркером — из хендшейка device-auth для нативного
// приложения (см. worker/src/handlers/devicePair.ts), сразу после
// успешной привязки через deep-link в бота. device_id здесь — это
// device_token, который воркер выдал приложению, поэтому раздел
// "Устройства" в боте/кабинете и обычное действие device_remove
// работают с ним без каких-либо изменений.
// ============================================================

if ($action === 'device_register') {
    $telegramId = trim((string)($req['telegram_id'] ?? ''));
    $deviceId = trim((string)($req['device_id'] ?? ''));
    if (!valid_telegram_id($telegramId)) {
        bot_json(['success' => false, 'error' => 'Invalid telegram_id'], 400);
    }
    if ($deviceId === '') {
        bot_json(['success' => false, 'error' => 'Invalid device_id'], 400);
    }

    [$ok, $result] = update_users(function (array $users) use ($telegramId, $deviceId): array {
        foreach ($users as &$u) {
            if ((string)($u['telegram_id'] ?? '') !== $telegramId) continue;
            $u['device_id'] = $deviceId;
            $u['device_name'] = 'Android-приложение';
            $u['device_added_at'] = time();
            return [$users, ['success' => true]];
        }
        unset($u);
        return [$users, ['error' => 'Not linked']];
    });

    if (!$ok) bot_json(['success' => false, 'error' => 'Storage error'], 500);
    if (($result['error'] ?? '') !== '') bot_json(['success' => false, 'error' => $result['error']], 404);

    log_action('Bot device_register: telegram_id ' . $telegramId);
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
// ACHIEVEMENTS — уровень, прогресс, полный каталог наград
// ============================================================

if ($action === 'achievements') {
    $telegramId = trim((string)($req['telegram_id'] ?? ''));
    if (!valid_telegram_id($telegramId)) {
        bot_json(['success' => false, 'error' => 'Invalid telegram_id'], 400);
    }

    $users = load_users();
    $user = find_user_by_telegram_id($users, $telegramId);
    if ($user === null) {
        bot_json(['success' => false, 'error' => 'Not linked'], 404);
    }

    // Синхронизация здесь тоже нужна: пользователь может открыть раздел
    // "Достижения" сразу после оплаты, до следующего вызова action=me.
    $sync = sync_achievements_and_level($user, $users);
    $users = load_users();
    $user = find_user_by_telegram_id($users, $telegramId);

    $stats = user_stats($user, $users);
    $levelCode = (string)($user['level'] ?? calc_level($stats));
    $levelInfo = LEVELS[$levelCode] ?? LEVELS['newbie'];
    $progress = level_progress($stats, $levelCode);
    $earned = is_array($user['achievements'] ?? null) ? $user['achievements'] : [];

    $catalog = [];
    foreach (ACHIEVEMENTS as $code => $ach) {
        $catalog[] = [
            'code' => $code,
            'title' => (string)($ach['title'] ?? ''),
            'desc' => (string)($ach['desc'] ?? ''),
            'icon' => (string)($ach['icon'] ?? ''),
            'bonus' => (int)($ach['bonus'] ?? 0),
            'earned' => in_array($code, $earned, true),
        ];
    }

    bot_json([
        'success' => true,
        'level' => [
            'code' => $levelCode,
            'title' => (string)($levelInfo['title'] ?? ''),
            'icon' => (string)($levelInfo['icon'] ?? ''),
            'perks' => (string)($levelInfo['perks'] ?? ''),
        ],
        'progress' => [
            'next_code' => $progress['next'],
            'next_title' => $progress['next'] ? (string)(LEVELS[$progress['next']]['title'] ?? '') : null,
            'percent' => (int)$progress['best_progress'],
            'closest' => $progress['closest'],
        ],
        'stats' => $stats,
        'achievements' => $catalog,
        'newly_unlocked' => $sync['new_achievements'],
        'level_up' => $sync['level_up'],
        'bonus_days' => $sync['bonus_days'],
    ]);
}

// ============================================================
// REFERRALS — реферальный код, ссылка, счётчик приглашённых
// ============================================================

if ($action === 'referrals') {
    $telegramId = trim((string)($req['telegram_id'] ?? ''));
    if (!valid_telegram_id($telegramId)) {
        bot_json(['success' => false, 'error' => 'Invalid telegram_id'], 400);
    }

    $user = find_user_by_telegram_id(load_users(), $telegramId);
    if ($user === null) {
        bot_json(['success' => false, 'error' => 'Not linked'], 404);
    }

    // Лениво генерируем код при первом обращении — как cabinet.php.
    if (empty($user['ref_code'])) {
        [$ok] = update_users(function (array $users) use ($user): array {
            foreach ($users as &$u) {
                if (($u['id'] ?? '') === $user['id'] && empty($u['ref_code'])) {
                    $u['ref_code'] = bot_make_ref_code($users);
                    break;
                }
            }
            unset($u);
            return [$users, null];
        });
        if (!$ok) bot_json(['success' => false, 'error' => 'Storage error'], 500);
        $user = find_user_by_telegram_id(load_users(), $telegramId);
    }

    $users = load_users();
    $refCount = 0;
    foreach ($users as $u) {
        if ((string)($u['referred_by'] ?? '') === (string)($user['username'] ?? '')) $refCount++;
    }

    bot_json([
        'success' => true,
        'ref_code' => (string)($user['ref_code'] ?? ''),
        // Ссылка ведёт в БОТА (t.me/qmods_bot?start=ref_<CODE>), не на сайт —
        // register.ts startWithReferral() ловит ref_<CODE> и передаёт его в
        // action=register как `ref`. До этой правки вела на mod/register.php,
        // что уводило приглашённых мимо бота (миграция на Telegram-only доступ).
        'ref_link' => 'https://t.me/qmods_bot?start=ref_' . urlencode((string)($user['ref_code'] ?? '')),
        'ref_count' => $refCount,
    ]);
}

// ============================================================
// SET_CURATOR_FOR_WARD — подопечный ЛИЧНО соглашается на кураторство.
// Вызывается ТОЛЬКО воркером, только после того, как сам подопечный нажал
// «Подтвердить» на приглашение куратора (см. worker/src/handlers/
// curator.ts handleCuratorLinkConfirm, worker/src/db.ts curator_invites) —
// значит telegram_id здесь всегда принадлежит именно подопечному, куратор
// никогда не может выставить это поле сам себе или кому-то ещё.
// ============================================================

if ($action === 'set_curator_for_ward') {
    need_post();

    $telegramId = trim((string)($req['telegram_id'] ?? ''));
    $curatorUsername = trim((string)($req['curator_username'] ?? ''));
    if (!valid_telegram_id($telegramId)) {
        bot_json(['success' => false, 'error' => 'Invalid telegram_id'], 400);
    }
    if (!validate_username($curatorUsername)) {
        bot_json(['success' => false, 'error' => 'Некорректный ник куратора.'], 400);
    }

    $users = load_users();
    $ward = find_user_by_telegram_id($users, $telegramId);
    if ($ward === null) {
        bot_json(['success' => false, 'error' => 'Not linked'], 404);
    }

    $curator = null;
    foreach ($users as $u) {
        if (strtolower((string)($u['username'] ?? '')) === strtolower($curatorUsername)) { $curator = $u; break; }
    }
    if ($curator === null || empty($curator['is_curator'])) {
        bot_json(['success' => false, 'error' => 'Куратор не найден.'], 404);
    }
    if (strtolower((string)($curator['username'] ?? '')) === strtolower((string)($ward['username'] ?? ''))) {
        bot_json(['success' => false, 'error' => 'Нельзя быть куратором самому себе.'], 400);
    }

    [$ok, $result] = update_users(function (array $users) use ($telegramId, $curator): array {
        foreach ($users as &$u) {
            if ((string)($u['telegram_id'] ?? '') !== $telegramId) continue;
            $u['curator_username'] = (string)($curator['username'] ?? '');
            return [$users, ['success' => true]];
        }
        unset($u);
        return [$users, ['error' => 'Not linked']];
    });

    if (!$ok) bot_json(['success' => false, 'error' => 'Ошибка хранилища.'], 500);
    if (($result['error'] ?? '') !== '') bot_json(['success' => false, 'error' => $result['error']], 404);

    log_action('Bot set_curator_for_ward: ' . $ward['username'] . ' -> ' . $curator['username']);
    bot_json(['success' => true, 'curator_username' => (string)($curator['username'] ?? '')]);
}

// ============================================================
// UNLINK_CURATOR — подопечный сам отвязывает своего куратора в любой
// момент, без согласия куратора — та же логика "согласие можно отозвать",
// что и у самого приглашения. Идемпотентно.
// ============================================================

if ($action === 'unlink_curator') {
    need_post();

    $telegramId = trim((string)($req['telegram_id'] ?? ''));
    if (!valid_telegram_id($telegramId)) {
        bot_json(['success' => false, 'error' => 'Invalid telegram_id'], 400);
    }

    [$ok, $result] = update_users(function (array $users) use ($telegramId): array {
        foreach ($users as &$u) {
            if ((string)($u['telegram_id'] ?? '') !== $telegramId) continue;
            $u['curator_username'] = '';
            return [$users, ['success' => true]];
        }
        unset($u);
        return [$users, ['error' => 'Not linked']];
    });

    if (!$ok) bot_json(['success' => false, 'error' => 'Ошибка хранилища.'], 500);
    if (($result['error'] ?? '') !== '') bot_json(['success' => false, 'error' => $result['error']], 404);

    bot_json(['success' => true]);
}

// ============================================================
// CURATOR_WARDS — список подопечных куратора: подписка + устройство.
// Только для is_curator=true (см. set_curator в mod/admin/bot.php).
// Отдаёт device.id_short, НЕ полный device_id — это, по сути, bearer-
// токен устройства (см. device_tokens в D1), куратору его знать незачем и
// небезопасно передавать третьей стороне.
// ============================================================

if ($action === 'curator_wards') {
    $telegramId = trim((string)($req['telegram_id'] ?? ''));
    if (!valid_telegram_id($telegramId)) {
        bot_json(['success' => false, 'error' => 'Invalid telegram_id'], 400);
    }

    $users = load_users();
    $curator = find_user_by_telegram_id($users, $telegramId);
    if ($curator === null) {
        bot_json(['success' => false, 'error' => 'Not linked'], 404);
    }
    if (empty($curator['is_curator'])) {
        bot_json(['success' => false, 'error' => 'Доступ только для кураторов.'], 403);
    }

    $curatorUsernameLower = strtolower((string)($curator['username'] ?? ''));
    $wards = [];
    foreach ($users as $u) {
        if (strtolower((string)($u['curator_username'] ?? '')) !== $curatorUsernameLower) continue;
        $sub = subscription_info($u);
        $deviceId = (string)($u['device_id'] ?? '');
        $wards[] = [
            'username' => (string)($u['username'] ?? ''),
            'subscription' => [
                'plan' => $sub['plan'],
                'active' => $sub['active'],
                'days_left' => $sub['days_left'],
                'expires_at' => $sub['expires_at'],
                'expires_text' => $sub['expires_text'],
            ],
            'device' => [
                'linked' => $deviceId !== '',
                'id_short' => $deviceId !== '' ? substr($deviceId, 0, 8) . '…' : '',
                'android_version' => $u['device_android'] ?? null,
                'last_seen' => (int)($u['last_seen'] ?? 0),
            ],
        ];
    }

    bot_json(['success' => true, 'wards' => $wards]);
}

// ============================================================
// APP_RELEASE — версия приложения + публичная ссылка на APK (если включена)
// ============================================================

if ($action === 'app_release') {
    $releaseFile = DATA_DIR . '/app_release.json';
    $shareFile = DATA_DIR . '/download_link.json';
    $apkFile = APP_ROOT . '/downloads/app.apk';

    $release = is_file($releaseFile) ? json_decode((string)file_get_contents($releaseFile), true) : null;
    if (!is_array($release)) $release = [];

    $share = is_file($shareFile) ? json_decode((string)file_get_contents($shareFile), true) : null;
    $downloadUrl = null;
    if (is_array($share) && !empty($share['enabled']) && !empty($share['token'])) {
        $downloadUrl = 'https://qmods.ru/mod/download.php?share=' . urlencode((string)$share['token']);
    }

    bot_json([
        'success' => true,
        'version' => (string)($release['version'] ?? ''),
        'changelog' => (string)($release['changelog'] ?? ''),
        'has_file' => !empty($release['has_file']),
        'apk_size' => (is_file($apkFile) && filesize($apkFile) > 0) ? (int)filesize($apkFile) : 0,
        'download_url' => $downloadUrl,
        // Без публичной share-ссылки скачивание требует активной сессии на
        // сайте (обычный логин) — бот не может её подделать, поэтому в
        // этом случае отдаём только страницу кабинета для скачивания.
        'cabinet_url' => 'https://qmods.ru/mod/download.php',
    ]);
}

// ============================================================
// REVIEW / REVIEW_ADD — отзыв пользователя
// ============================================================

if ($action === 'review') {
    $telegramId = trim((string)($req['telegram_id'] ?? ''));
    if (!valid_telegram_id($telegramId)) {
        bot_json(['success' => false, 'error' => 'Invalid telegram_id'], 400);
    }

    $user = find_user_by_telegram_id(load_users(), $telegramId);
    if ($user === null) {
        bot_json(['success' => false, 'error' => 'Not linked'], 404);
    }

    foreach (load_reviews() as $r) {
        if (($r['username'] ?? '') !== ($user['username'] ?? '')) continue;
        bot_json([
            'success' => true,
            'review' => [
                'rating' => (int)($r['rating'] ?? 0),
                'text' => (string)($r['text'] ?? ''),
                'status' => (string)($r['status'] ?? 'pending'),
            ],
        ]);
    }

    bot_json(['success' => true, 'review' => null]);
}

if ($action === 'review_add') {
    $telegramId = trim((string)($req['telegram_id'] ?? ''));
    $rating = (int)($req['rating'] ?? 0);
    $text = trim((string)($req['text'] ?? ''));

    if (!valid_telegram_id($telegramId)) {
        bot_json(['success' => false, 'error' => 'Invalid telegram_id'], 400);
    }
    if ($rating < 1 || $rating > 5) {
        bot_json(['success' => false, 'error' => 'Оценка должна быть от 1 до 5.'], 400);
    }
    if (mb_strlen($text) < 10) {
        bot_json(['success' => false, 'error' => 'Отзыв слишком короткий (минимум 10 символов).'], 400);
    }

    $user = find_user_by_telegram_id(load_users(), $telegramId);
    if ($user === null) {
        bot_json(['success' => false, 'error' => 'Not linked'], 404);
    }

    $sub = subscription_info($user);
    $reviews = load_reviews();
    $reviews = array_values(array_filter($reviews, static fn($r) => ($r['username'] ?? '') !== $user['username']));
    $reviews[] = [
        'id' => bin2hex(random_bytes(16)),
        'username' => $user['username'],
        'rating' => $rating,
        'text' => $text,
        'created_at' => time(),
        'status' => 'pending',
        'verified' => !empty($user['payments']) || $sub['active'],
    ];

    if (!save_reviews($reviews)) {
        bot_json(['success' => false, 'error' => 'Не удалось сохранить отзыв.'], 500);
    }

    log_action('Bot review_add: ' . $user['username']);
    bot_json(['success' => true]);
}

// ============================================================
// STATS — общая (нечувствительная) статистика для приветствия/раздела
// ============================================================

// ============================================================
// DEVICE_SUBSCRIPTION — узкий срез подписки по username, только для
// сервер-сервер вызова с Cloudflare Worker (device-auth хендшейм для
// нативного Android-приложения через бота, см. worker/src/db.ts и
// README «Авторизация приложения через бота»). Никогда не вызывается
// напрямую из приложения — оно знает только device_token, который
// проверяется на воркере, а сюда воркер обращается уже со своим
// собственным бот-токеном. Отдаёт минимум полей (без id/платежей/
// устройства) — приложению для гейта по подписке больше ничего не нужно.
// ============================================================

if ($action === 'device_subscription') {
    $username = trim((string)($req['username'] ?? ''));
    if ($username === '') {
        bot_json(['success' => false, 'error' => 'Invalid username'], 400);
    }

    // Sent on every call (cold start AND the app's periodic in-use recheck,
    // see android-client/README.md "Проверка во время использования") so
    // this one action can also gate old app builds and deliver in-app
    // notifications — without a separate endpoint/round-trip.
    $versionCode = (int)($req['version_code'] ?? 0);
    $gate = get_app_version_gate();
    $forceUpdate = [
        'required' => $gate['min_version_code'] > 0 && $versionCode > 0 && $versionCode < $gate['min_version_code'],
        'message' => $gate['message'],
    ];

    $user = null;
    foreach (load_users() as $u) {
        if (strtolower((string)($u['username'] ?? '')) === strtolower($username)) { $user = $u; break; }
    }
    if ($user === null) {
        bot_json(['success' => true, 'found' => false, 'subscription' => null, 'notifications' => [], 'force_update' => $forceUpdate]);
    }

    $sub = subscription_info($user);
    $notifications = get_and_mark_app_notifications(strtolower($username), 20);

    bot_json([
        'success' => true,
        'found' => true,
        'subscription' => [
            'plan' => $sub['plan'],
            'active' => $sub['active'],
            'days_left' => $sub['days_left'],
            'expires_at' => $sub['expires_at'],
            'expires_text' => $sub['expires_text'],
        ],
        'notifications' => $notifications,
        'force_update' => $forceUpdate,
    ]);
}

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
