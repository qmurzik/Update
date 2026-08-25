<?php
/**
 * Реферальная система QMODS.
 *
 * Решает три проблемы прежней реализации:
 *  1. код приглашения жил только в URL и терялся при любом переходе
 *     (в том числе при регистрации из приложения);
 *  2. код сравнивался с учётом регистра и молча игнорировался, если не совпал;
 *  3. бонусные дни не начислялись — код начисления отсутствовал.
 *
 * Правило: +REF_BONUS_DAYS дней пригласившему после ПЕРВОЙ оплаты приглашённого.
 */

const REF_COOKIE     = 'qmods_ref';
const REF_COOKIE_TTL = 30 * 86400;
const REF_BONUS_DAYS = 3;

/** Код в каноническом виде: без пробелов, в верхнем регистре. */
function ref_normalize(string $code): string
{
    return strtoupper(trim($code));
}

/** Запоминаем код из ссылки, чтобы он пережил переходы по сайту. */
function ref_remember(string $code): void
{
    $code = ref_normalize($code);
    if ($code === '') return;

    $_SESSION['ref_code'] = $code;

    $secure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (($_SERVER['SERVER_PORT'] ?? '') === '443');

    @setcookie(REF_COOKIE, $code, [
        'expires'  => time() + REF_COOKIE_TTL,
        'path'     => '/',
        'secure'   => $secure,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
}

/** Текущий код: из формы, из ссылки, из сессии или из куки — что найдётся первым. */
function ref_current(): string
{
    $sources = [
        $_POST['ref']          ?? null,
        $_GET['ref']           ?? null,
        $_SESSION['ref_code']  ?? null,
        $_COOKIE[REF_COOKIE]   ?? null,
    ];
    foreach ($sources as $value) {
        if (!is_string($value)) continue;
        $code = ref_normalize($value);
        if ($code !== '') return $code;
    }
    return '';
}

/** Забываем код — после успешной регистрации он больше не нужен. */
function ref_forget(): void
{
    unset($_SESSION['ref_code']);
    @setcookie(REF_COOKIE, '', ['expires' => time() - 3600, 'path' => '/']);
}

/** Владелец кода. Сравнение без учёта регистра. */
function ref_find_owner(array $users, string $code): ?array
{
    $code = ref_normalize($code);
    if ($code === '') return null;
    foreach ($users as $user) {
        if (ref_normalize((string)($user['ref_code'] ?? '')) === $code) return $user;
    }
    return null;
}

/**
 * Начисляет бонус пригласившему за первую оплату приглашённого.
 * Массив пользователей меняется по ссылке — вызывать внутри update_users().
 *
 * @return array{awarded:bool, reason?:string, referrer?:string, days?:int}
 */
function ref_award_first_payment(array &$users, string $buyerUsernameLower): array
{
    $buyerIdx = null;
    foreach ($users as $i => $u) {
        if (($u['username_lower'] ?? '') === $buyerUsernameLower) { $buyerIdx = $i; break; }
    }
    if ($buyerIdx === null) return ['awarded' => false, 'reason' => 'buyer_not_found'];

    if (!empty($users[$buyerIdx]['ref_bonus_given'])) {
        return ['awarded' => false, 'reason' => 'already_given'];
    }

    $inviterName = trim((string)($users[$buyerIdx]['referred_by'] ?? ''));
    if ($inviterName === '') return ['awarded' => false, 'reason' => 'no_referrer'];

    // Бонус только за первую оплату: к этому моменту платёж уже добавлен в массив.
    $payments = $users[$buyerIdx]['payments'] ?? [];
    if (!is_array($payments) || count($payments) > 1) {
        return ['awarded' => false, 'reason' => 'not_first_payment'];
    }

    $inviterIdx = null;
    foreach ($users as $i => $u) {
        if (strcasecmp((string)($u['username'] ?? ''), $inviterName) === 0) { $inviterIdx = $i; break; }
    }
    if ($inviterIdx === null)      return ['awarded' => false, 'reason' => 'referrer_not_found'];
    if ($inviterIdx === $buyerIdx) return ['awarded' => false, 'reason' => 'self_referral'];

    // Одно и то же устройство у обоих — накрутка, бонус не начисляем.
    $buyerDevice   = trim((string)($users[$buyerIdx]['device_id'] ?? ''));
    $inviterDevice = trim((string)($users[$inviterIdx]['device_id'] ?? ''));
    if ($buyerDevice !== '' && $buyerDevice === $inviterDevice) {
        return ['awarded' => false, 'reason' => 'same_device'];
    }

    $now     = time();
    $expires = (int)($users[$inviterIdx]['subscription']['expires_at'] ?? 0);
    $base    = $expires > $now ? $expires : $now;

    $users[$inviterIdx]['subscription']['expires_at'] = $base + REF_BONUS_DAYS * 86400;
    $plan = (string)($users[$inviterIdx]['subscription']['plan'] ?? '');
    if ($plan === '' || $plan === 'none') {
        $users[$inviterIdx]['subscription']['plan'] = 'bonus';
    }

    $users[$buyerIdx]['ref_bonus_given'] = true;

    return [
        'awarded'  => true,
        'referrer' => (string)$users[$inviterIdx]['username'],
        'days'     => REF_BONUS_DAYS,
    ];
}

/**
 * Сводка по рефералам пользователя для кабинета.
 *
 * @return array{invited:int, paid:int, days:int}
 */
function ref_stats(array $users, string $username): array
{
    $invited = 0;
    $paid    = 0;
    foreach ($users as $u) {
        if (strcasecmp((string)($u['referred_by'] ?? ''), $username) !== 0) continue;
        $invited++;
        if (!empty($u['ref_bonus_given'])) $paid++;
    }
    return ['invited' => $invited, 'paid' => $paid, 'days' => $paid * REF_BONUS_DAYS];
}
