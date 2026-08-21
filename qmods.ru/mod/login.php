<?php
require __DIR__ . '/includes/bootstrap.php';
require_once __DIR__ . '/includes/reviews.php';
require_once __DIR__ . '/includes/shutdown.php';

$c = cfg();
$device_id = $_REQUEST['device_id'] ?? '';

function page_block(string $msg): void {
    header('Content-Type: text/html; charset=utf-8');
    echo '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{margin:0;background:#050508;color:#f1f5f9;font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh}.b{text-align:center;padding:24px}.i{font-size:56px}.t{font-size:18px;font-weight:700;margin:12px 0}.d{color:#94a3b8;font-size:14px;line-height:1.6}</style></head><body><div class="b"><div class="i">🛑</div><div class="t">Мод недоступен</div><div class="d">' . htmlspecialchars($msg) . '</div></div></body></html>';
    exit;
}
function page_error(): void {
    header('Content-Type: text/html; charset=utf-8');
    echo '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="refresh" content="15"><style>body{margin:0;background:#050508;color:#f1f5f9;font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh}.b{text-align:center;padding:24px}.i{font-size:56px}.t{font-size:18px;font-weight:700;margin:12px 0}.d{color:#94a3b8;font-size:14px;line-height:1.6}</style></head><body><div class="b"><div class="i">📡</div><div class="t">Ошибка подключения (504)</div><div class="d">Сервер временно недоступен.<br>Повторная попытка через несколько секунд…</div></div></body></html>';
    exit;
}
function page_update(): void {
    header('Content-Type: text/html; charset=utf-8');
    echo '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{margin:0;background:#050508;color:#f1f5f9;font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh}.b{text-align:center;padding:24px}.i{font-size:56px}.t{font-size:18px;font-weight:700;margin:12px 0}.d{color:#94a3b8;font-size:14px;line-height:1.6}a{display:inline-block;margin-top:16px;padding:12px 24px;background:#6366f1;color:#fff;border-radius:12px;text-decoration:none;font-weight:600}</style></head><body><div class="b"><div class="i">⬇️</div><div class="t">Требуется обновление</div><div class="d">Ваша версия устарела.<br>Обновите приложение до актуальной версии.</div><a href="https://qmods.ru/#trial">Скачать новую версию</a></div></body></html>';
    exit;
}

if ($c['mode'] === 'full') page_block($c['message'] !== '' ? $c['message'] : 'Закончился срок оплаты сервера, поэтому мод больше недоступен.');

if ($device_id !== '') {
    $u = find_user_by_device(load_users(), $device_id);
    $beh = login_behavior($c, $u, $device_id);
    if ($beh === 'block') page_block($c['message']);
    if ($beh === 'error') page_error();
    if ($beh === 'update') page_update();
    if ($beh === 'autologin' && $u) {
        $sub = subscription_info($u);
        if ($sub['active']) {
            session_regenerate_id(true);
            $_SESSION['user_id'] = (string)$u['id'];
            $_SESSION['username'] = (string)$u['username'];
            redirect('app_callback.php?status=ok&username=' . urlencode($u['username']) . '&expires_at=' . $sub['expires_at'] . '&app=1');
            exit;
        }
    }
}

if (is_logged_in() && $device_id === '') redirect('cabinet.php');

function rate_file(): string { return DATA_DIR . '/rate.json'; }
function rate_load(): array { $f = rate_file(); $d = is_file($f) ? json_decode((string)file_get_contents($f), true) : []; return is_array($d) ? $d : []; }
function rate_check(string $key): bool { $d = rate_load(); $now = time(); $r = $d[$key] ?? ['c'=>0,'t'=>$now]; if ($now-$r['t']>600) return true; return $r['c']<5; }
function rate_fail(string $key): void { $d = rate_load(); $now = time(); $r = $d[$key] ?? ['c'=>0,'t'=>$now]; if ($now-$r['t']>600) $r=['c'=>0,'t'=>$now]; $r['c']++; $r['t']=$now; $d[$key]=$r; file_put_contents(rate_file(), json_encode($d)); }

$failedUsername = '';
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST') {
    if (!csrf_ok()) { flash('error', 'Ошибка безопасности. Обновите страницу.'); }
    else {
        $username = trim((string)($_POST['username'] ?? ''));
        $password = (string)($_POST['password'] ?? '');
        $rateKey = md5(($_SERVER['REMOTE_ADDR'] ?? '') . '|' . strtolower($username));
        if (!rate_check($rateKey)) { flash('error', 'Слишком много попыток. Подождите 10 минут.'); redirect('login.php?device_id=' . urlencode($device_id)); exit; }

        $users = load_users();
        $user = find_user_by_username($users, $username);
        if ($user !== null && password_verify($password, (string)($user['pass_hash'] ?? ''))) {
            $current_device = (string)($user['device_id'] ?? '');
            $sub = subscription_info($user);

            // Вход из приложения: сначала проверяем подписку, и только потом
            // меняем устройство/создаём авторизованную сессию. Это не позволяет
            // просроченному пользователю случайно получить доступ к кабинету.
            if ($device_id !== '' && !$sub['active']) {
                unset($_SESSION['user_id'], $_SESSION['username']);
                redirect('no_sub.php?device_id=' . urlencode($device_id));
            }

            if ($device_id !== '' && $current_device !== '' && $current_device !== $device_id && empty($_POST['force'])) {
                $_SESSION['pending_user_id'] = $user['id'];
                $_SESSION['pending_device_id'] = $device_id;
                redirect('device_conflict.php');
            }

            if ($device_id !== '' && $current_device !== $device_id) {
                update_users(function($users) use ($user, $device_id) {
                    foreach ($users as &$u) {
                        if ($u['id'] === $user['id']) {
                            $u['device_id'] = $device_id;
                            break;
                        }
                    }
                    unset($u);
                    return [$users, null];
                });
                log_action("Login: {$user['username']} device={$device_id}");
            }

            session_regenerate_id(true);
            $_SESSION['user_id'] = (string)$user['id'];
            $_SESSION['username'] = (string)$user['username'];
            update_users(function (array $users) use ($user) {
                foreach ($users as &$u) {
                    if (($u['id'] ?? '') === $user['id']) {
                        $u['last_seen'] = time();
                        break;
                    }
                }
                unset($u);
                return [$users, null];
            });

            if ($device_id !== '') {
                redirect('app_callback.php?status=ok&username=' . urlencode($user['username']) . '&expires_at=' . $sub['expires_at'] . '&app=1');
            }
            redirect('cabinet.php');
        } else { rate_fail($rateKey); flash('error', 'Неверный ник или пароль.'); $failedUsername = $username; }
    }
}

$reviewsList = approved_reviews(); $reviewsAvg = reviews_average($reviewsList); $topReviews = array_slice($reviewsList, 0, 3);
render_header('Вход');
?>
<div class="au au-login">

  <section class="au-stage">
    <a class="au-brand" href="index.php"><span>Q</span>QMODS</a>

    <div class="au-visual" aria-hidden="true">
      <div class="kira-frame">
        <img src="assets/kira-hero.webp" alt="" width="880" height="1100">
        <span class="bracket tl"></span><span class="bracket tr"></span>
        <span class="bracket bl"></span><span class="bracket br"></span>
        <div class="kira-plate">
          <img src="assets/kira-avatar.webp" alt="" width="34" height="34">
          <div><b>KIRA</b><small>AI ASSISTANT</small></div>
          <span class="kira-online">ONLINE</span>
        </div>
      </div>
    </div>

    <div class="au-stage-copy">
      <span>// SECURE LOGIN</span>
      <h2>Система ждёт вас.</h2>
      <p>Один аккаунт, одно устройство, полный контроль. Kira проверит доступ до того, как вы войдёте.</p>
    </div>

    <div class="au-chips">
      <span class="au-chip"><b>●</b> Защищённая сессия</span>
      <span class="au-chip">Одно устройство</span>
      <?php if ($reviewsAvg > 0): ?>
        <span class="au-chip">★ <?= number_format($reviewsAvg, 1, ',', '') ?> по отзывам</span>
      <?php endif; ?>
    </div>
  </section>

  <section class="au-panel">
    <div class="au-head">
      <span class="kicker">Возвращение</span>
      <h1>Снова здесь.</h1>
      <p>Введите данные аккаунта, чтобы открыть свой QMODS.</p>
    </div>

    <form class="au-form" method="post" action="login.php?device_id=<?= e($device_id) ?>">
      <?= csrf_field() ?>
      <div class="au-field">
        <label for="au-username">Никнейм</label>
        <div class="au-input">
          <b>@</b>
          <input id="au-username" type="text" name="username" value="<?= e($failedUsername) ?>"
                 autocomplete="username" placeholder="your_nickname" required>
        </div>
      </div>
      <div class="au-field">
        <label for="au-password">Пароль</label>
        <div class="au-input">
          <b>⌁</b>
          <input id="au-password" type="password" name="password"
                 autocomplete="current-password" placeholder="Введите пароль" required>
        </div>
      </div>
      <button class="au-submit primary-cta" type="submit"><span>Открыть QMODS</span><b>↗</b></button>
    </form>

    <div class="au-switch">
      <span>Первый раз?</span>
      <a href="register.php?device_id=<?= e($device_id) ?>">Создать аккаунт</a>
    </div>

    <div class="au-note">
      <span>✓</span>
      <p>Подписка и устройство проверяются сервером до выдачи доступа. Данные передаются только по защищённому соединению.</p>
    </div>
  </section>

</div>
<?php render_footer(); ?>
