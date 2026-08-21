<?php
require __DIR__ . '/includes/bootstrap.php';

$device_id = $_GET['device_id'] ?? '';
$username = '';

if ($device_id !== '') {
    $users = load_users();
    foreach ($users as $u) {
        if (($u['device_id'] ?? '') === $device_id) {
            $username = $u['username'];
            break;
        }
    }
}

render_header('Доступ ограничен', ['is_admin' => false]);
?>

<div class="state-screen tone-danger">
  <section class="state-card has-kira">
    <div class="state-kira" aria-hidden="true">
      <div class="kira-stage">
        <img class="kira-art" src="assets/kira/error.webp" alt="" width="239" height="331">
      </div>
    </div>

    <h1>Подписка неактивна</h1>
    <p>Доступ к приложению приостановлен. Продлите подписку, чтобы продолжить работу.</p>

    <div class="state-facts">
      <div><span>Пользователь</span><strong><?= e($username !== '' ? $username : '—') ?></strong></div>
      <div class="hot"><span>Статус</span><strong>Истекла</strong></div>
    </div>

    <div class="state-actions">
      <a class="primary-cta" href="../subscribe/">Продлить подписку <b>→</b></a>
      <button class="soft-cta" type="button" onclick="closeApp()">Выйти</button>
    </div>

    <p class="state-note">После оплаты доступ откроется автоматически — перезапускать приложение не нужно.</p>
  </section>
</div>

<script>function closeApp(){window.location.href='app://close';}</script>

<?php render_footer(); ?>
