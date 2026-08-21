<?php
require __DIR__ . '/includes/bootstrap.php';
unset($_SESSION['pending_user_id'], $_SESSION['pending_device_id']);
$device_id = $_GET['device_id'] ?? '';
render_header('Доступ ограничен');
?>
<div class="state-screen tone-danger">
  <section class="state-card">
    <div class="state-icon">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
        <rect x="3" y="11" width="18" height="11" rx="2.5"/>
        <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
      </svg>
    </div>

    <h1>Подписка неактивна</h1>
    <p>Для использования приложения требуется активная подписка. Оформите или продлите доступ — активация занимает считанные секунды.</p>

    <div class="state-actions">
      <a class="primary-cta" href="../subscribe/">Оформить подписку <b>→</b></a>
      <a class="soft-cta" href="login.php?device_id=<?= e($device_id) ?>">Вернуться к входу</a>
    </div>

    <p class="state-note">Уже оплатили? Подождите несколько секунд и войдите снова — статус обновится автоматически.</p>
  </section>
</div>

<?php render_footer(); ?>
