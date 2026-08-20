<?php
require __DIR__ . '/includes/bootstrap.php';

$device_id = $_GET['device_id'] ?? '';
$username = '';
$plan = '';
$days_left = 0;

if ($device_id !== '') {
    $users = load_users();
    foreach ($users as $u) {
        if (($u['device_id'] ?? '') === $device_id) {
            $sub = subscription_info($u);
            $username = $u['username'];
            $plan = $sub['plan'];
            $days_left = $sub['days_left'];
            break;
        }
    }
}

render_header('Внимание', ['is_admin' => false]);
?>
<div class="state-screen tone-warning">
  <section class="state-card">
    <div class="state-icon">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
        <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
        <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
    </div>

    <h1>Подписка скоро закончится</h1>
    <p>Продлите доступ заранее — оставшиеся дни не сгорают, новый срок складывается с текущим.</p>

    <div class="state-facts">
      <div><span>Пользователь</span><strong><?= e($username !== '' ? $username : '—') ?></strong></div>
      <div><span>Тариф</span><strong><?= e($plan !== '' ? $plan : '—') ?></strong></div>
      <div class="hot"><span>Осталось дней</span><strong><?= (int)$days_left ?></strong></div>
    </div>

    <div class="state-actions">
      <a class="primary-cta" href="../subscribe/">Продлить сейчас <b>→</b></a>
      <button class="soft-cta" type="button" onclick="closeApp()">Понятно</button>
    </div>
  </section>
</div>

<script>function closeApp(){window.location.href='app://close';}</script>

<?php render_footer(); ?>
