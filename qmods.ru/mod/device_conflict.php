<?php
require __DIR__ . '/includes/bootstrap.php';

if (empty($_SESSION['pending_user_id'])) redirect('login.php');

$pending_device = (string)($_SESSION['pending_device_id'] ?? '');

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST' && csrf_ok()) {
    if (($_POST['action'] ?? '') === 'kick') {
        $uid = $_SESSION['pending_user_id'];
        $user = null;
        $allUsers = load_users();
        foreach ($allUsers as $candidate) {
            if (($candidate['id'] ?? '') === $uid) {
                $user = $candidate;
                break;
            }
        }

        // Не переносим устройство для просроченного аккаунта.
        if (!$user) {
            unset($_SESSION['pending_user_id'], $_SESSION['pending_device_id']);
            redirect('login.php?device_id=' . urlencode($pending_device));
        }
        $sub = subscription_info($user);
        if (!$sub['active']) {
            unset($_SESSION['pending_user_id'], $_SESSION['pending_device_id']);
            redirect('no_sub.php?device_id=' . urlencode($pending_device));
        }

        $user = null;
        update_users(function($users) use ($uid, $pending_device, &$user) {
            foreach ($users as &$u) {
                if ($u['id'] === $uid) {
                    $u['device_id'] = $pending_device;
                    $user = $u;
                    break;
                }
            }
            unset($u);
            return [$users, null];
        });

        unset($_SESSION['pending_user_id'], $_SESSION['pending_device_id']);

        if ($user) {
            log_action("Kick: {$user['username']} -> device {$pending_device}");

            session_regenerate_id(true);
            $_SESSION['user_id'] = $user['id'];
            $_SESSION['username'] = $user['username'];

            redirect('app_callback.php?status=ok&username=' . urlencode($user['username']) . '&expires_at=' . $sub['expires_at'] . '&app=1');
        }

        redirect('login.php?device_id=' . urlencode($pending_device));

    } elseif (($_POST['action'] ?? '') === 'cancel') {
        unset($_SESSION['pending_user_id'], $_SESSION['pending_device_id']);
        redirect('login.php?device_id=' . urlencode($pending_device));
    }
}

render_header('Конфликт устройств');
?>
<div class="state-screen tone-warning">
  <section class="state-card has-kira">
    <div class="state-kira" aria-hidden="true">
      <div class="kira-stage">
        <img class="kira-art" src="assets/kira/error.webp" alt="" width="239" height="331">
      </div>
    </div>

    <h1>Другое устройство</h1>
    <p>Ваш аккаунт уже используется на другом устройстве. Вы можете войти здесь — сессия на старом устройстве будет завершена.</p>

    <div class="state-facts">
      <div><span>Правило</span><strong>1 аккаунт — 1 устройство</strong></div>
      <div class="hot"><span>Новое устройство</span><strong><?= e($pending_device !== '' ? substr($pending_device, 0, 6) . '…' . substr($pending_device, -4) : '—') ?></strong></div>
    </div>

    <div class="state-actions">
      <form method="post" action="device_conflict.php">
        <?= csrf_field() ?>
        <input type="hidden" name="action" value="kick">
        <button type="submit" class="primary-cta full">Войти здесь и выйти везде</button>
      </form>
      <form method="post" action="device_conflict.php">
        <?= csrf_field() ?>
        <input type="hidden" name="action" value="cancel">
        <button type="submit" class="soft-cta full">Отмена</button>
      </form>
    </div>
  </section>
</div>

<?php render_footer(); ?>
