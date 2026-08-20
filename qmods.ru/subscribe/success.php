<?php
require_once __DIR__ . '/config.php';
$user = current_user();
$label = trim((string)($_GET['label'] ?? ''));
$status = 'pending';
$order = null;
$sub = null;

if ($label !== '') {
    foreach (load_orders() as $o) {
        if (($o['label'] ?? '') === $label) { $order = $o; break; }
    }
}
if ($order && $user && strtolower((string)$order['username_lower']) === strtolower((string)$user['username_lower'])) {
    $status = (($order['status'] ?? '') === 'paid') ? 'success' : 'pending';
    $user = current_user();
    $sub = $user ? subscription_info($user) : null;
} elseif ($user === null) {
    $status = 'login';
} else {
    $status = 'error';
}
?><!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#05060f">
<meta name="color-scheme" content="dark">
<title>Оплата — QMods</title>
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
      <span><b>QMods</b><small>PAYMENT RESULT</small></span>
    </a>
  </header>

  <main class="result">
    <section class="result-card <?= e($status) ?>">
      <?php if ($status === 'success'): ?>
        <div class="result-icon">✓</div>
        <h1>Оплата прошла</h1>
        <p>Тариф «<?= e((string)($order['plan'] ?? '')) ?>» активирован.<br>Доступ действует до <b><?= e($sub['expires_text'] ?? '—') ?></b>.</p>
        <a class="result-btn" href="/mod/cabinet.php">Вернуться в кабинет →</a>
        <script>window.addEventListener('load',function(){if(window.qmodsConfetti)window.qmodsConfetti(110);});</script>

      <?php elseif ($status === 'pending'): ?>
        <div class="result-icon">⏳</div>
        <h1>Платёж обрабатывается</h1>
        <p>ЮMoney ещё не передал подтверждение. Обычно это занимает несколько секунд — мы проверим статус автоматически.</p>
        <a class="result-btn" href="/subscribe/success.php?label=<?= rawurlencode($label) ?>">Проверить ещё раз</a>
        <div class="result-meta">Можно вернуться в кабинет — доступ обновится сам.</div>
        <script>setTimeout(function(){location.reload();},4000)</script>

      <?php elseif ($status === 'login'): ?>
        <div class="result-icon">→</div>
        <h1>Войдите в аккаунт</h1>
        <p>Для просмотра результата оплаты нужно войти в QMods.</p>
        <a class="result-btn" href="/mod/login.php">Войти в QMods →</a>

      <?php else: ?>
        <div class="result-icon">!</div>
        <h1>Не удалось найти заказ</h1>
        <p>Проверьте, что вы открыли ссылку из этого платежа и вошли в правильный аккаунт.</p>
        <a class="result-btn" href="/mod/cabinet.php">В кабинет →</a>
      <?php endif; ?>
    </section>
  </main>

  <footer><span>QMods</span><i>•</i><a href="/mod/cabinet.php">Личный кабинет</a><i>•</i><span>Безопасная оплата</span></footer>
</div>
<script src="/mod/assets/script.js?v=aurora-1"></script>
</body>
</html>
