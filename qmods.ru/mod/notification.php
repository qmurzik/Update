<?php
require __DIR__ . '/includes/bootstrap.php';

$device_id = $_GET['device_id'] ?? '';
$title = $_GET['title'] ?? 'Уведомление';
$message = $_GET['message'] ?? '';

render_header('Уведомление', ['is_admin' => false]);
?>
<div class="state-screen tone-iris">
  <section class="state-card has-kira">
    <div class="state-kira" aria-hidden="true">
      <div class="kira-stage">
        <img class="kira-art" src="assets/kira/neutral.webp" alt="" width="242" height="314">
      </div>
    </div>

    <h1><?= e($title) ?></h1>

    <?php if (trim((string)$message) !== ''): ?>
      <div class="state-facts" style="display:block;padding:20px 22px;text-align:left;color:var(--muted);line-height:1.7;font-size:14.5px">
        <?= nl2br(e($message)) ?>
      </div>
    <?php endif; ?>

    <div class="state-actions">
      <button class="primary-cta" type="button" onclick="closeApp()">Понятно</button>
    </div>
  </section>
</div>

<script>function closeApp(){window.location.href='app://close';}</script>

<?php render_footer(); ?>
