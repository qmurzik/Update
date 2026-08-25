<?php
require_once __DIR__ . '/config.php';

// Каталог includes/ лежит либо в mod/, либо рядом с subscribe/ — ищем оба
// варианта, как это делает config.php. Жёсткий require здесь ронял весь
// обработчик оплаты с 500-й ошибкой, если раскладка отличалась.
function subscribe_require(string $relative): bool
{
    foreach ([__DIR__ . '/../mod/includes/', __DIR__ . '/../includes/'] as $dir) {
        if (file_exists($dir . $relative)) { require_once $dir . $relative; return true; }
    }
    return false;
}
subscribe_require('telegram.php');
subscribe_require('referrals.php');

$logFile = __DIR__ . '/notify.log';
function logMsg(string $msg): void { global $logFile; @file_put_contents($logFile, date('Y-m-d H:i:s') . ' | ' . $msg . "\n", FILE_APPEND | LOCK_EX); }
function verifySignature(array $post, string $secret): bool {
    $sign = (string)($post['sign'] ?? '');
    if ($sign === '') return false;
    unset($post['sign']); ksort($post); $parts=[];
    foreach ($post as $k=>$v) $parts[]=$k.'='.rawurlencode((string)$v);
    return hash_equals(hash_hmac('sha256', implode('&',$parts), $secret), $sign);
}

logMsg('=== Новое уведомление от ЮMoney ===');
if (!isset($_POST['sign'])) { http_response_code(403); exit('Missing sign'); }
if (!verifySignature($_POST, YOOMONEY_SECRET)) { http_response_code(403); exit('Invalid signature'); }

$label = trim((string)($_POST['label'] ?? ''));
$amount = (float)($_POST['withdraw_amount'] ?? 0);
$opId = trim((string)($_POST['operation_id'] ?? ''));
if ($label === '' || $opId === '') { http_response_code(400); exit('Missing payment data'); }

$orders = load_orders();
$order = null;
foreach ($orders as $o) {
    if (($o['label'] ?? '') === $label) { $order = $o; break; }
}
if (!$order) { http_response_code(404); exit('Order not found'); }
if (($order['status'] ?? '') === 'paid') { http_response_code(200); echo 'OK'; exit; }
if (($order['status'] ?? '') !== 'pending') { http_response_code(409); exit('Order is not pending'); }
if (abs($amount - (float)$order['amount']) > 0.01) { http_response_code(400); exit('Wrong amount'); }
if (!isset(PLANS[(string)$order['plan']])) { http_response_code(400); exit('Unknown plan'); }

$plan = PLANS[(string)$order['plan']];
$usernameLower = strtolower((string)$order['username_lower']);

[$ok, $result] = update_orders(function (array $orders) use ($label, $opId, $usernameLower, $amount, $plan): array {
    $target = null;
    foreach ($orders as $idx => $o) {
        if (($o['label'] ?? '') === $label) { $target = $idx; break; }
    }
    if ($target === null) return [$orders, ['error' => 'Order not found']];
    if (($orders[$target]['status'] ?? '') === 'paid') return [$orders, ['already' => true]];

    $users = load_users();
    $found = false;
    foreach ($users as $u) if (($u['username_lower'] ?? '') === $usernameLower) { $found = true; break; }
    if (!$found) return [$orders, ['error' => 'User not found']];

    $updatedUsers = $users;
    foreach ($updatedUsers as &$u) {
        if (($u['username_lower'] ?? '') !== $usernameLower) continue;
        $now = time();
        $expires = (int)($u['subscription']['expires_at'] ?? 0);
        $base = $expires > $now ? $expires : $now;
        $u['subscription']['plan'] = 'premium';
        $u['subscription']['expires_at'] = $base + ((int)$plan['days'] * 86400);
        if (!isset($u['payments']) || !is_array($u['payments'])) $u['payments'] = [];
        $u['payments'][] = ['date'=>$now,'plan'=>$orders[$target]['plan'],'amount'=>$amount,'op'=>$opId];
        break;
    }
    unset($u);

    // Реферальный бонус: +N дней пригласившему за первую оплату приглашённого.
    $ref = function_exists('ref_award_first_payment')
        ? ref_award_first_payment($updatedUsers, $usernameLower)
        : ['awarded' => false, 'reason' => 'module_missing'];

    [$usersOk] = update_users(fn(array $ignored) => [$updatedUsers, null]);
    if (!$usersOk) return [$orders, ['error' => 'User update failed']];

    $orders[$target]['status'] = 'paid';
    $orders[$target]['operation_id'] = $opId;
    $orders[$target]['paid_at'] = time();
    return [$orders, ['success' => true, 'username' => $usernameLower, 'ref' => $ref]];
});

if (!$ok || !is_array($result) || !empty($result['error'])) { http_response_code(500); exit('Activation failed'); }
if (!empty($result['already'])) { http_response_code(200); echo 'OK'; exit; }

$username = (string)($order['username'] ?? $usernameLower);
log_action("Auto-subscribe: {$username} +{$plan['days']} days (payment {$opId})");
logMsg("✓ Подписка продлена для {$username}");
if (function_exists('tg_notify_payment')) tg_notify_payment($username, $amount, $plan['title']);

$ref = $result['ref'] ?? [];
if (!empty($ref['awarded'])) {
    $referrer = (string)$ref['referrer'];
    $days     = (int)$ref['days'];

    log_action("Ref bonus: {$referrer} +{$days} days (invited {$username} paid)");
    logMsg("🎁 Реферальный бонус: {$referrer} +{$days} дн. за оплату {$username}");

    update_notifications(function (array $notifications) use ($referrer, $days, $username): array {
        $notifications[] = [
            'id' => bin2hex(random_bytes(16)),
            'title' => 'Реферальный бонус',
            'message' => "Приглашённый вами {$username} оформил подписку. Начислено +{$days} дн. к вашему доступу.",
            'created_at' => time(),
            'read_by' => [],
            'target' => $referrer,
        ];
        return [$notifications, null];
    });

    if (function_exists('send_telegram')) {
        send_telegram("🎁 <b>Реферальный бонус</b>\n👤 <code>{$referrer}</code> +{$days} дн.\n💳 За оплату: <code>{$username}</code>");
    }
} elseif (!empty($ref['reason']) && $ref['reason'] !== 'no_referrer' && $ref['reason'] !== 'not_first_payment') {
    logMsg("Реферальный бонус не начислен: {$ref['reason']}");
}

http_response_code(200);
echo 'OK';
