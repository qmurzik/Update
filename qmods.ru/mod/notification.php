<?php
require __DIR__ . '/includes/bootstrap.php';

$device_id = $_GET['device_id'] ?? '';
$title = $_GET['title'] ?? 'Уведомление';
$message = $_GET['message'] ?? '';

render_header('Уведомление', ['is_admin' => false]);
?>
<div class="state-screen tone-iris">
  <section class="state-card">
    <div class="state-icon">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
        <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
      </svg>
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
