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
  <section class="state-card has-kira">
    <div class="state-kira" aria-hidden="true">
      <div class="kira-stage">
        <img class="kira-art" src="assets/kira/neutral.webp" alt="" width="242" height="314">
      </div>
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
