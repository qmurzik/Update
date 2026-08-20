<?php
declare(strict_types=1);
require_once __DIR__ . '/config.php';

$user = current_user();
if ($user === null) {
    redirect('/mod/login.php');
}

$sub = subscription_info($user);
$error = '';
$paymentOrder = null;
$paymentPlan = null;

function plan_badge(string $code): string {
    return match ($code) {
        'm3' => 'ПОПУЛЯРНЫЙ',
        'm6' => 'МАКСИМУМ ВЫГОДЫ',
        default => '',
    };
}

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST') {
    if (!csrf_ok()) {
        $error = 'Сессия устарела. Обновите страницу и попробуйте снова.';
    } else {
        $planCode = strtolower(trim((string)($_POST['plan'] ?? '')));
        if (!isset(PLANS[$planCode])) {
            $error = 'Этот тариф сейчас недоступен.';
        } else {
            $plan = PLANS[$planCode];
            $orderId = strtoupper(bin2hex(random_bytes(12)));
            $label = 'QMODS-' . $orderId;
            $order = [
                'id' => strtolower($orderId),
                'label' => $label,
                'username' => (string)$user['username'],
                'username_lower' => (string)$user['username_lower'],
                'plan' => $planCode,
                'amount' => (float)$plan['price'],
                'days' => (int)$plan['days'],
                'status' => 'pending',
                'operation_id' => '',
                'created_at' => time(),
                'paid_at' => 0,
            ];

            [$ok] = update_orders(function (array $orders) use ($order): array {
                $orders[] = $order;
                $cutoff = time() - (180 * 86400);
                $orders = array_values(array_filter($orders, static function ($o) use ($cutoff): bool {
                    $created = (int)($o['created_at'] ?? 0);
                    if (($o['status'] ?? '') === 'pending') {
                        return $created >= ($cutoff - 7 * 86400);
                    }
                    return $created >= $cutoff;
                }));
                return [$orders, null];
            });

            if ($ok) {
                $paymentOrder = $order;
                $paymentPlan = $plan;
            } else {
                $error = 'Не удалось создать заказ. Попробуйте ещё раз.';
            }
        }
    }
}

$daysLeft = max(0, (int)$sub['days_left']);
$expires = $sub['active'] ? $sub['expires_text'] : 'Подписка не активна';
$first = mb_strtoupper(mb_substr((string)$user['username'], 0, 1));
$successUrl = '/subscribe/success.php?label=' . rawurlencode((string)($paymentOrder['label'] ?? ''));
?>
<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#05060f">
<meta name="color-scheme" content="dark">
<title>Продление подписки — QMods</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<link rel="icon" href="/mod/assets/icon-192.png">
<link rel="stylesheet" href="styles.css?v=aurora-1">
</head>
<body>
<div class="ambient ambient-a"></div><div class="ambient ambient-b"></div>
<div class="shell">
    <header class="topbar">
        <a class="brand" href="/mod/cabinet.php" aria-label="QMods">
            <span class="brand-icon">
                <svg viewBox="0 0 40 40" fill="none"><path d="M20 3 5 10.5 20 18l15-7.5L20 3Z" stroke="currentColor" stroke-width="2.8"/><path d="M5 20.5 20 28l15-7.5M5 30.5 20 38l15-7.5" stroke="currentColor" stroke-width="2.8"/></svg>
            </span>
            <span><b>QMods</b><small>SECURE CHECKOUT</small></span>
        </a>
        <a class="account" href="/mod/cabinet.php"><span class="avatar"><?= e($first) ?></span><span class="account-name">@<?= e($user['username']) ?></span><span class="chevron">›</span></a>
    </header>

    <main>
        <section class="intro">
            <div class="eyebrow"><span></span> ДОСТУП QMODS</div>
            <h1>Продлите доступ<br><em>без лишних движений.</em></h1>
            <p>Выберите срок, оплатите через ЮMoney — новый срок добавится к вашей текущей подписке автоматически.</p>
        </section>

        <section class="status-card">
            <div class="status-icon <?= $sub['active'] ? 'active' : 'off' ?>">
                <?= $sub['active'] ? '✓' : '!' ?>
            </div>
            <div class="status-copy">
                <span>ТЕКУЩИЙ СТАТУС</span>
                <strong><?= $sub['active'] ? 'Доступ активен' : 'Доступ не активен' ?></strong>
                <small><?= $sub['active'] ? 'До ' . e($expires) : 'Выберите тариф ниже, чтобы активировать доступ' ?></small>
            </div>
            <?php if ($sub['active']): ?>
                <div class="days-pill"><b><?= $daysLeft ?></b><span>дн.</span></div>
            <?php endif; ?>
        </section>

        <?php if ($error): ?><div class="error-box">⚠ <?= e($error) ?></div><?php endif; ?>

        <?php if ($paymentOrder && $paymentPlan): ?>
            <section class="checkout-card">
                <div class="checkout-top">
                    <div><span class="section-label">ЗАКАЗ СОЗДАН</span><h2>Всё готово к оплате</h2><p><?= e($paymentPlan['title']) ?> · <?= number_format((float)$paymentPlan['price'], 0, ',', ' ') ?> ₽</p></div>
                    <div class="checkout-price"><?= number_format((float)$paymentPlan['price'], 0, ',', ' ') ?><small>₽</small></div>
                </div>
                <div class="method-title">Способ оплаты</div>
                <form method="POST" action="https://yoomoney.ru/quickpay/confirm" class="payment-form">
                    <input type="hidden" name="receiver" value="<?= e(YOOMONEY_WALLET) ?>">
                    <input type="hidden" name="quickpay-form" value="button">
                    <input type="hidden" name="label" value="<?= e($paymentOrder['label']) ?>">
                    <input type="hidden" name="sum" value="<?= e((string)$paymentPlan['price']) ?>">
                    <input type="hidden" name="successURL" value="<?= e('https://qmods.ru' . $successUrl) ?>">
                    <div class="method-grid">
                        <label class="method"><input type="radio" name="paymentType" value="AC" checked><span class="method-mark">▣</span><span><b>Банковская карта</b><small>Visa / Mastercard / МИР</small></span><i>✓</i></label>
                        <label class="method"><input type="radio" name="paymentType" value="PC"><span class="method-mark">Ю</span><span><b>ЮMoney</b><small>Оплата из кошелька</small></span><i>✓</i></label>
                    </div>
                    <button class="pay-button" type="submit"><span>Перейти к оплате</span><b><?= number_format((float)$paymentPlan['price'], 0, ',', ' ') ?> ₽</b></button>
                </form>
                <a class="back-link" href="/subscribe/">← Выбрать другой тариф</a>
                <div class="secure-note"><span>🔒</span> Данные карты вводятся только на стороне ЮMoney. QMods их не получает.</div>
            </section>
        <?php else: ?>
            <section class="plans-head"><div><span class="section-label">ТАРИФЫ</span><h2>Выберите свой срок</h2></div><span class="hint">Чем дольше — тем выгоднее</span></section>
            <section class="plans">
                <?php foreach (PLANS as $code => $plan):
                    $perDay = (float)$plan['price'] / max(1, (int)$plan['days']);
                    $badge = plan_badge($code);
                    $featured = $code === 'm3';
                    $saving = $code === 'm2' ? 31 : ($code === 'm3' ? 68 : ($code === 'm6' ? 341 : 0));
                ?>
                <form method="POST" class="plan <?= $featured ? 'featured' : '' ?>">
                    <?= csrf_field() ?>
                    <input type="hidden" name="plan" value="<?= e($code) ?>">
                    <?php if ($badge): ?><div class="badge <?= $code === 'm6' ? 'green' : '' ?>"><?= e($badge) ?></div><?php endif; ?>
                    <div class="plan-top"><span class="plan-number">0<?= substr($code, 1) === '1' ? '1' : (substr($code, 1) === '2' ? '2' : (substr($code, 1) === '3' ? '3' : '6')) ?></span><span class="plan-days"><?= (int)$plan['days'] ?> дней</span></div>
                    <h3><?= e($plan['title']) ?></h3>
                    <div class="price"><?= number_format((float)$plan['price'], 0, ',', ' ') ?><span>₽</span></div>
                    <div class="per-day">≈ <?= number_format($perDay, 2, ',', ' ') ?> ₽ в день</div>
                    <?php if ($saving > 0): ?><div class="saving">Экономия до <?= $saving ?> ₽</div><?php else: ?><div class="saving ghost">Базовый тариф</div><?php endif; ?>
                    <button type="submit">Выбрать тариф <span>→</span></button>
                </form>
                <?php endforeach; ?>
            </section>

            <section class="benefits">
                <div><span>✦</span><b>Мгновенная активация</b><small>После подтверждения платежа</small></div>
                <div><span>↗</span><b>Срок складывается</b><small>Продление не сгорает</small></div>
                <div><span>⌁</span><b>Безопасная оплата</b><small>Через защищённую страницу ЮMoney</small></div>
            </section>
        <?php endif; ?>
    </main>

    <footer><span>QMods</span><a href="/mod/cabinet.php">Личный кабинет</a><i>•</i><span>Безопасная оплата</span></footer>
</div>
<script src="/mod/assets/script.js?v=aurora-1"></script>
</body>
</html>
