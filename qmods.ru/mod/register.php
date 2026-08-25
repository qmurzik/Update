<?php
require __DIR__ . '/includes/bootstrap.php';
require_once __DIR__ . '/includes/telegram.php';
require_once __DIR__ . '/includes/shutdown.php';
require_once __DIR__ . '/includes/referrals.php';

if (is_logged_in()) redirect('cabinet.php');
if (is_shutdown()) { redirect('login.php'); exit; }

$device_id = trim((string)($_REQUEST['device_id'] ?? ''));
$client_ip = trim((string)($_SERVER['REMOTE_ADDR'] ?? ''));

// Код из ссылки запоминаем сразу: иначе он теряется при переходе
// на вход и обратно, а из приложения его в URL вообще нет.
if (isset($_GET['ref'])) ref_remember((string)$_GET['ref']);
$ref = ref_current();
$refError = false;

function make_ref_code(array $users): string {
    do {
        $code = strtoupper(substr(bin2hex(random_bytes(4)), 0, 6));
        $exists = false;
        foreach ($users as $u) if (($u['ref_code'] ?? '') === $code) { $exists = true; break; }
    } while ($exists);
    return $code;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST') {
    if (!csrf_ok()) {
        flash('error', 'Ошибка безопасности. Обновите страницу.');
    } else {
        $username = trim((string)($_POST['username'] ?? ''));
        $password = (string)($_POST['password'] ?? '');
        $repeat   = (string)($_POST['repeat_password'] ?? '');
        $ref      = ref_current();

        if (!validate_username($username)) {
            flash('error', 'Некорректный ник. 3-32 символа: буквы, цифры, _ - .');
        } elseif (strlen($password) < 6) {
            flash('error', 'Пароль минимум 6 символов.');
        } elseif ($password !== $repeat) {
            flash('error', 'Пароли не совпадают.');
        } else {
            $users = load_users();
            if (find_user_by_username($users, $username) !== null) {
                flash('error', 'Этот ник уже занят.');
            } elseif ($device_id !== '' && find_user_by_device($users, $device_id) !== null) {
                // Один device_id = один аккаунт. Это важно для приложения:
                // иначе find_user_by_device() не сможет однозначно определить владельца.
                flash('error', 'На этом устройстве уже зарегистрирован аккаунт. Войдите в существующий аккаунт.');
                log_action("Register blocked: duplicate device={$device_id}");
            } else {
                $fraud = trial_fraud_check($device_id, $client_ip);
                if (!$fraud['allowed']) {
                    flash('error', 'Пробный период уже использовался на этом устройстве. Войдите в существующий аккаунт или оформите подписку.');
                    log_action("Trial blocked: {$username} reason={$fraud['reason']}");
                } else {
                    $referred_by = '';
                    if ($ref !== '') {
                        $owner = ref_find_owner($users, $ref);
                        if ($owner === null) {
                            // Молча терять приглашение нельзя — сообщаем и даём исправить.
                            $refError = true;
                            flash('error', 'Код приглашения «' . e($ref) . '» не найден. Проверьте его или очистите поле.');
                            log_action("Register: unknown ref code {$ref} ({$username})");
                        } else {
                            $referred_by = (string)$owner['username'];
                        }
                    }

                    if (!$refError) {
                    $newUser = [
                        'id' => bin2hex(random_bytes(16)),
                        'username' => $username,
                        'username_lower' => strtolower($username),
                        'pass_hash' => password_hash($password, PASSWORD_DEFAULT),
                        'device_id' => $device_id,
                        'subscription' => $device_id !== ''
                            ? ['plan' => 'trial', 'expires_at' => time() + 86400]
                            : ['plan' => 'none', 'expires_at' => 0],
                        'created_at' => time(),
                        'ref_code' => make_ref_code($users),
                        'referred_by' => $referred_by,
                        'ref_bonus_given' => false,
                        'payments' => [],
                    ];

                    [$ok, $createResult] = update_users(function($users) use ($newUser, $username, $device_id) {
                        // Повторная проверка под LOCK_EX защищает от двух одновременных регистраций.
                        if (find_user_by_username($users, $username) !== null) {
                            return [$users, 'duplicate_username'];
                        }
                        if ($device_id !== '' && find_user_by_device($users, $device_id) !== null) {
                            return [$users, 'duplicate_device'];
                        }
                        $users[] = $newUser;
                        return [$users, 'created'];
                    });

                    if (!$ok) {
                        flash('error', 'Не удалось сохранить. Попробуйте позже.');
                    } elseif ($createResult === 'duplicate_username') {
                        flash('error', 'Этот ник уже занят.');
                    } elseif ($createResult === 'duplicate_device') {
                        flash('error', 'На этом устройстве уже зарегистрирован аккаунт. Войдите в существующий аккаунт.');
                        log_action("Register blocked: duplicate device={$device_id}");
                    } else {
                        trial_fraud_mark($device_id, $client_ip, (string)$newUser['id']);
                        log_action("Register: {$username}" . ($referred_by ? " (ref: {$referred_by})" : ''));
                        tg_notify_register($username, $referred_by);
                        ref_forget();
                        flash('success', $referred_by !== ''
                            ? 'Аккаунт создан! Приглашение от ' . $referred_by . ' учтено. Теперь войдите.'
                            : 'Аккаунт создан! Теперь войдите.');
                        redirect('login.php?device_id=' . urlencode($device_id));
                        exit;
                    }
                    }
                }
            }
        }
    }
}

$refOwner = $ref !== '' ? ref_find_owner(load_users(), $ref) : null;

render_header('Регистрация');
?>
<div class="au au-register">

  <section class="au-stage">
    <a class="au-brand" href="index.php"><span>Q</span>QMODS</a>

    <div class="au-visual" aria-hidden="true">
      <div class="kira-stage">
        <span class="kira-orbit"></span>
        <img class="kira-art" src="assets/kira/register.webp" alt="" width="296" height="364">
      </div>
      <div class="kira-plate">
        <img src="assets/kira/avatar.webp" alt="" width="32" height="32">
        <div><b>KIRA</b><small>AI ASSISTANT</small></div>
        <span class="kira-online">ONLINE</span>
      </div>
    </div>

    <div class="au-stage-copy">
      <span>// NEW PLAYER</span>
      <h2>Твой QMODS начинается здесь.</h2>
      <p>Создай профиль и получи стартовый доступ к платформе прямо на своём устройстве.</p>
    </div>

    <div class="au-chips">
      <span class="au-chip"><b>●</b> Пробный доступ с устройства</span>
      <span class="au-chip">Один аккаунт — одно устройство</span>
    </div>
  </section>

  <section class="au-panel">
    <div class="au-head">
      <span class="kicker">Создание профиля</span>
      <h1>Займёмся ником.</h1>
      <p>Три шага — и твой аккаунт готов к работе.</p>
    </div>

    <div class="au-steps" aria-hidden="true">
      <span class="active">01</span><i></i><span>02</span><i></i><span>03</span>
    </div>

    <form class="au-form" method="post" action="register.php?device_id=<?= e($device_id) ?>">
      <?= csrf_field() ?>

      <div class="au-field">
        <label for="reg-username">Придумай никнейм</label>
        <div class="au-input">
          <b>@</b>
          <input id="reg-username" type="text" name="username" minlength="3" maxlength="32"
                 autocomplete="username" placeholder="qmurzik" required>
        </div>
      </div>

      <div class="au-field">
        <label for="reg-password">Создай пароль</label>
        <div class="au-input">
          <b>✦</b>
          <input id="reg-password" type="password" name="password" minlength="6"
                 autocomplete="new-password" placeholder="Минимум 6 символов" required>
        </div>
      </div>

      <div class="au-field">
        <label for="reg-repeat">Повтори пароль</label>
        <div class="au-input">
          <b>✓</b>
          <input id="reg-repeat" type="password" name="repeat_password" minlength="6"
                 autocomplete="new-password" placeholder="Ещё раз" required>
        </div>
      </div>

      <div class="au-field">
        <label for="reg-ref">Код приглашения <em>— если есть</em></label>
        <div class="au-input">
          <b>↗</b>
          <input id="reg-ref" type="text" name="ref" value="<?= e($ref) ?>" maxlength="12"
                 autocomplete="off" spellcheck="false" placeholder="Например, 92946C">
        </div>
      </div>

      <?php if ($refOwner !== null): ?>
        <div class="au-ref">
          <span>↗</span>
          <div>
            <b>Приглашение от <?= e((string)$refOwner['username']) ?></b>
            <small>После вашей первой оплаты другу начислим +<?= REF_BONUS_DAYS ?> дн.</small>
          </div>
        </div>
      <?php elseif ($ref !== ''): ?>
        <div class="au-ref au-ref-bad">
          <span>!</span>
          <div>
            <b>Код «<?= e($ref) ?>» не найден</b>
            <small>Проверьте код или очистите поле — без него регистрация тоже пройдёт.</small>
          </div>
        </div>
      <?php endif; ?>

      <button class="au-submit primary-cta" type="submit"><span>Создать пространство</span><b>→</b></button>
    </form>

    <div class="au-switch">
      <span>Уже есть профиль?</span>
      <a href="login.php?device_id=<?= e($device_id) ?><?= $ref !== '' ? '&ref=' . urlencode($ref) : '' ?>">Войти</a>
    </div>

    <div class="au-note">
      <span>01</span>
      <p>Аккаунт привязывается к устройству — так пробный период остаётся честным для всех участников.</p>
    </div>
  </section>

</div>
<?php render_footer(); ?>
