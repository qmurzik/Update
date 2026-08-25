<?php
require __DIR__ . '/includes/bootstrap.php';
require_once __DIR__ . '/includes/reminders.php';
require_once __DIR__ . '/includes/achievements.php';
require_once __DIR__ . '/includes/reviews.php';
require_once __DIR__ . '/includes/referrals.php';
require_once __DIR__ . '/subscribe/config.php';

if (!defined('SUPPORT_GROUP_URL')) define('SUPPORT_GROUP_URL', 'https://t.me/qmurzik');

$user = current_user();
if ($user === null) redirect('login.php');

function make_ref_code(array $users): string {
    do {
        $code = strtoupper(substr(bin2hex(random_bytes(4)), 0, 6));
        $exists = false;
        foreach ($users as $u) {
            if (($u['ref_code'] ?? '') === $code) { $exists = true; break; }
        }
    } while ($exists);
    return $code;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST' && csrf_ok()) {
    $action = (string)($_POST['action'] ?? '');

    if ($action === 'unbind_device') {
        [$ok] = update_users(function (array $users) use ($user) {
            foreach ($users as &$u) {
                if (($u['id'] ?? '') === $user['id']) { $u['device_id'] = ''; break; }
            }
            unset($u);
            return [$users, null];
        });
        flash($ok ? 'success' : 'error', $ok ? 'Устройство отвязано.' : 'Не удалось отвязать.');
        redirect('cabinet.php'); exit;
    }

    if ($action === 'create_telegram_link') {
        // Одноразовый код для привязки Telegram.
        // Действует 10 минут и хранится только у текущего пользователя.
        $code = strtoupper(substr(bin2hex(random_bytes(5)), 0, 10));
        $expires = time() + 600;

        [$ok] = update_users(function (array $users) use ($user, $code, $expires) {
            foreach ($users as &$u) {
                if (($u['id'] ?? '') !== ($user['id'] ?? '')) {
                    continue;
                }

                $u['telegram_link_code'] = $code;
                $u['telegram_link_expires'] = $expires;
                break;
            }
            unset($u);
            return [$users, null];
        });

        if ($ok) {
            flash(
                'success',
                'Код для Telegram: ' . $code . ' — действует 10 минут.'
            );
        } else {
            flash('error', 'Не удалось создать код для Telegram.');
        }

        redirect('cabinet.php#profile');
        exit;
    }

    if ($action === 'logout') {
        $_SESSION = [];
        session_destroy();
        redirect('index.php'); exit;
    }

    if ($action === 'change_password') {
        $cur = (string)($_POST['current_password'] ?? '');
        $new = (string)($_POST['new_password'] ?? '');
        $rep = (string)($_POST['repeat_password'] ?? '');
        if (!password_verify($cur, (string)($user['pass_hash'] ?? ''))) {
            flash('error', 'Текущий пароль неверен.');
        } elseif (strlen($new) < 6) {
            flash('error', 'Новый пароль минимум 6 символов.');
        } elseif ($new !== $rep) {
            flash('error', 'Пароли не совпадают.');
        } else {
            [$ok] = update_users(function (array $users) use ($user, $new) {
                foreach ($users as &$u) {
                    if (($u['id'] ?? '') === $user['id']) {
                        $u['pass_hash'] = password_hash($new, PASSWORD_DEFAULT);
                        break;
                    }
                }
                unset($u);
                return [$users, null];
            });
            flash($ok ? 'success' : 'error', $ok ? 'Пароль изменён.' : 'Не удалось сменить пароль.');
        }
        redirect('cabinet.php#profile'); exit;
    }

    if ($action === 'add_review') {
        $rating = (int)($_POST['rating'] ?? 0);
        $text = trim((string)($_POST['text'] ?? ''));
        $subNow = subscription_info($user);
        if ($rating < 1 || $rating > 5) {
            flash('error', 'Поставьте оценку от 1 до 5 звёзд.');
        } elseif (mb_strlen($text) < 10) {
            flash('error', 'Отзыв слишком короткий (минимум 10 символов).');
        } else {
            $reviews = load_reviews();
            $reviews = array_values(array_filter($reviews, function ($r) use ($user) {
                return ($r['username'] ?? '') !== $user['username'];
            }));
            $reviews[] = [
                'id' => bin2hex(random_bytes(16)),
                'username' => $user['username'],
                'rating' => $rating,
                'text' => $text,
                'created_at' => time(),
                'status' => 'pending',
                'verified' => !empty($user['payments']) || $subNow['active'],
            ];
            save_reviews($reviews);
            flash('success', 'Спасибо! Отзыв отправлен на модерацию.');
        }
        redirect('cabinet.php#profile'); exit;
    }
}

$user = current_user();
run_expiry_reminders();

$releaseFile = DATA_DIR . '/app_release.json';
$release = is_file($releaseFile) ? json_decode((string)file_get_contents($releaseFile), true) : null;

if (empty($user['ref_code'])) {
    update_users(function (array $users) use ($user) {
        foreach ($users as &$u) {
            if (($u['id'] ?? '') === $user['id'] && empty($u['ref_code'])) {
                $u['ref_code'] = make_ref_code($users);
                break;
            }
        }
        unset($u);
        return [$users, null];
    });
    $user = current_user();
}

$allUsers = load_users();
$syncResult = sync_achievements_and_level($user, $allUsers);
$user = current_user();

$sub = subscription_info($user);
$stats = user_stats($user, $allUsers);
$currentLevel = $user['level'] ?? 'newbie';
$levelInfo = LEVELS[$currentLevel] ?? LEVELS['newbie'];
$progress = level_progress($stats, $currentLevel);
$userAchievements = $user['achievements'] ?? [];
if (!is_array($userAchievements)) $userAchievements = [];

$created = !empty($user['created_at']) ? date('d.m.Y', (int)$user['created_at']) : '—';
$firstLetter = mb_strtoupper(mb_substr((string)$user['username'], 0, 1));
$device_id = (string)($user['device_id'] ?? '');
$deviceShort = $device_id !== '' ? substr($device_id, 0, 6) . '…' . substr($device_id, -4) : '';
$percent = $sub['active'] ? min(100, max(3, (int)round(($sub['days_left'] / 30) * 100))) : 0;
$refLink = 'https://qmods.ru/mod/register.php?ref=' . urlencode((string)$user['ref_code']);

$refStats = ref_stats($allUsers, (string)$user['username']);
$refCount = $refStats['invited'];

$payments = array_slice(array_reverse($user['payments'] ?? []), 0, 10);

$all = load_notifications();
$visible = [];
foreach ($all as $n) {
    $target = (string)($n['target'] ?? '');
    if ($target === '' || $target === $user['username']) $visible[] = $n;
}
usort($visible, function ($a, $b) { return ($b['created_at'] ?? 0) <=> ($a['created_at'] ?? 0); });
$visible = array_slice($visible, 0, 20);
if ($visible) mark_notifications_read((string)$user['id'], array_map(fn($n) => $n['id'], $visible));

$myReview = null;
foreach (load_reviews() as $r) {
    if (($r['username'] ?? '') === $user['username']) { $myReview = $r; break; }
}

$nextTitle = $progress['next'] ? (LEVELS[$progress['next']]['title'] ?? 'следующего уровня') : 'максимального уровня';
$levelAccent = $levelInfo['color'] ?? '#b6ff2e';
$planLabel = $sub['plan'] === 'none' ? 'Без подписки' : ucfirst((string)$sub['plan']);

render_header('Кабинет', ['user' => $user]);
?>

<div class="dash" id="home"<?= (!empty($syncResult['new_achievements']) || !empty($syncResult['level_up'])) ? ' data-celebrate' : '' ?>>

  <!-- ══ Приветствие ══ -->
  <section class="dash-hero">
    <div class="dash-hero-copy">
      <span class="eyebrow">Личный центр · <span data-clock>--:--:--</span></span>
      <h1>Привет, <?= e($user['username']) ?> <span>✦</span></h1>
      <p>Здесь всё важное: доступ, достижения, устройство и история аккаунта.</p>
      <div class="dash-hero-chips">
        <span class="hero-chip <?= $sub['active'] ? 'ok' : 'off' ?>">
          <?= $sub['active'] ? 'Доступ активен' : 'Доступ закончился' ?>
        </span>
        <span class="hero-chip"><?= e($levelInfo['icon']) ?> <b><?= e($levelInfo['title']) ?></b></span>
        <span class="hero-chip">С нами с <b><?= e($created) ?></b></span>
      </div>
    </div>
    <div class="dash-hero-kira" aria-hidden="true">
      <div class="kira-stage">
        <img class="kira-art" src="assets/kira/cabinet.webp" alt="" width="317" height="358">
      </div>
    </div>
  </section>

  <!-- ══ Доступ ══ -->
  <section class="access <?= $sub['active'] ? 'is-active' : 'is-off' ?>" id="subscription">
    <div class="access-top">
      <span class="status-pill"><i></i><?= $sub['active'] ? 'Доступ активен' : 'Доступ закончился' ?></span>
      <span class="plan-badge"><?= e($planLabel) ?></span>
    </div>

    <div class="access-main">
      <div>
        <span class="access-kicker">Ваш доступ</span>
        <strong class="days-big"><span data-count="<?= $sub['active'] ? (int)$sub['days_left'] : 0 ?>">0</span><em>дней</em></strong>
        <p><?= $sub['active']
              ? 'До ' . e($sub['expires_text'])
              : 'Продлите подписку, чтобы продолжить пользоваться приложением.' ?></p>
      </div>
      <div class="gauge" data-progress="<?= $percent * 3.6 ?>deg" style="--progress:<?= $percent * 3.6 ?>deg" aria-hidden="true">
        <span><?= $sub['active'] ? $percent . '%' : 'OFF' ?></span>
      </div>
    </div>

    <div class="rail" aria-hidden="true"><span style="width:<?= $percent ?>%"></span></div>

    <div class="access-actions">
      <a href="../subscribe/" class="primary-cta">Продлить доступ <b>→</b></a>
      <?php if ($release && !empty($release['has_file'])): ?>
        <a href="download.php" class="soft-cta">Скачать APK</a>
      <?php endif; ?>
    </div>
  </section>

  <!-- ══ Kira · цифровой ассистент ══ -->
  <?php
  $kiraLines = [];
  if ($sub['active']) {
      $kiraLines[] = 'Доступ активен. Осталось ' . (int)$sub['days_left'] . ' дн. — всё под контролем.';
      if ((int)$sub['days_left'] <= 7) {
          $kiraLines[] = 'Подписка скоро закончится. Советую продлить заранее.';
      }
  } else {
      $kiraLines[] = 'Доступ приостановлен. Активируйте подписку — я открою систему сразу.';
  }
  $kiraLines[] = $device_id !== ''
      ? 'Устройство привязано. Вход с другого завершит текущую сессию.'
      : 'Устройство ещё не привязано. Войдите из приложения — я его запомню.';
  $kiraLines[] = 'Открыто достижений: ' . count($userAchievements) . ' из ' . count(ACHIEVEMENTS) . '. Продолжаем.';
  if ((int)$refCount > 0) {
      $kiraLines[] = 'Вы пригласили ' . (int)$refCount . ' — бонусные дни уже учтены.';
  } else {
      $kiraLines[] = 'Пригласите друга — начислю +3 дня после его первой оплаты.';
  }
  ?>
  <section class="kira-widget hud">
    <img class="kira-widget-ava" src="assets/kira/avatar.webp" alt="Kira" width="58" height="58" loading="lazy">
    <div class="kira-widget-body">
      <span class="eyebrow">// KIRA · AI ASSISTANT</span>
      <p class="kira-widget-say"><span data-type="<?= e(implode('|', $kiraLines)) ?>"></span><i></i></p>
    </div>
    <a class="soft-cta btn-sm" href="support.php">Нужна помощь</a>
  </section>

  <?php if (!empty($syncResult['new_achievements']) || !empty($syncResult['level_up'])): ?>
  <!-- ══ Новое достижение ══ -->
  <section class="celebrate">
    <div class="celebrate-icon">✦</div>
    <div>
      <span class="eyebrow">Новое достижение</span>
      <h2><?= $syncResult['level_up']
            ? 'Уровень повышен до ' . e(LEVELS[$syncResult['level_up']]['title'])
            : 'Вы открыли новые награды' ?></h2>
      <p><?= (int)($syncResult['bonus_days'] ?? 0) ?> бонусных дней добавлено к аккаунту.</p>
    </div>
  </section>
  <?php endif; ?>

  <!-- ══ Сводка ══ -->
  <section class="stat-row" aria-label="Сводка">
    <a class="stat-tile" href="#achievements">
      <span class="stat-ico purple">✦</span>
      <b><span data-count="<?= count($userAchievements) ?>">0</span>/<?= count(ACHIEVEMENTS) ?></b>
      <small>Достижений</small>
    </a>
    <a class="stat-tile" href="#level">
      <span class="stat-ico blue">⚡</span>
      <b><?= e($levelInfo['title']) ?></b>
      <small>Ваш уровень</small>
    </a>
    <a class="stat-tile" href="#referrals">
      <span class="stat-ico pink">↗</span>
      <b data-count="<?= (int)$refCount ?>">0</b>
      <small>Приглашено</small>
    </a>
    <a class="stat-tile" href="#payments">
      <span class="stat-ico gold">₽</span>
      <b data-count="<?= count($payments) ?>">0</b>
      <small>Платежей</small>
    </a>
  </section>

  <!-- ══ Поддержка ══ -->
  <a class="support-cta" href="support.php">
    <span class="support-cta-icon">🆘</span>
    <div><b>Нужна помощь?</b><small>Соберём обращение за вас и откроем Telegram</small></div>
    <strong aria-hidden="true">→</strong>
  </a>

  <!-- ══ Подсказки ══ -->
  <section class="insight-row" aria-label="Подсказки">
    <article class="insight-card">
      <span class="insight-ico">◈</span>
      <div>
        <small>Следующее действие</small>
        <b><?= $sub['active'] ? 'Продлите заранее' : 'Активируйте доступ' ?></b>
        <p><?= $sub['active']
              ? 'Чтобы не потерять доступ после ' . e($sub['expires_text'])
              : 'Выберите тариф и оплатите через ЮMoney.' ?></p>
      </div>
      <a href="../subscribe/">Открыть →</a>
    </article>
    <article class="insight-card">
      <span class="insight-ico green">₽</span>
      <div>
        <small>Последний платёж</small>
        <b><?= $payments ? number_format((float)$payments[0]['amount'], 0, '.', ' ') . ' ₽' : 'Пока нет' ?></b>
        <p><?= $payments ? date('d.m.Y H:i', (int)$payments[0]['date']) : 'История появится после первой оплаты.' ?></p>
      </div>
    </article>
    <article class="insight-card">
      <span class="insight-ico blue">▣</span>
      <div>
        <small>Устройство</small>
        <b><?= $device_id !== '' ? 'Привязано' : 'Не привязано' ?></b>
        <p><?= $device_id !== '' ? e($deviceShort) : 'Появится после входа из приложения.' ?></p>
      </div>
    </article>
  </section>

  <!-- ══ Уровень ══ -->
  <section class="section-block" id="level">
    <div class="section-head">
      <div><span class="eyebrow">Прогресс</span><h2><?= e($levelInfo['icon']) ?> <?= e($levelInfo['title']) ?></h2></div>
      <span class="level-chip" style="--level:<?= e($levelAccent) ?>"><?= e($levelInfo['title']) ?></span>
    </div>
    <div class="level-panel" style="--level:<?= e($levelAccent) ?>">
      <div class="level-symbol"><?= e($levelInfo['icon']) ?></div>
      <div class="level-content">
        <div class="level-meta">
          <span><?= e($levelInfo['perks']) ?></span>
          <strong><?= $progress['next'] ? $progress['best_progress'] . '%' : '100%' ?></strong>
        </div>
        <div class="level-bar"><span style="width:<?= $progress['best_progress'] ?>%"></span></div>
        <p><?= $progress['next']
              ? 'Ближайшая цель: ' . e((string)$progress['closest']['current']) . '/' . e((string)$progress['closest']['min']) . ' ' . e($progress['closest']['label']) . ' → ' . e($nextTitle)
              : 'Максимальный уровень достигнут.' ?></p>
      </div>
    </div>
  </section>

  <!-- ══ Достижения ══ -->
  <section class="section-block" id="achievements">
    <div class="section-head">
      <div><span class="eyebrow">Коллекция</span><h2>Достижения</h2></div>
      <span class="muted-count"><?= count($userAchievements) ?>/<?= count(ACHIEVEMENTS) ?></span>
    </div>
    <div class="ach-grid">
      <?php foreach (ACHIEVEMENTS as $code => $ach): $has = in_array($code, $userAchievements, true); ?>
      <article class="ach <?= $has ? 'earned' : 'locked' ?>" style="--ach:<?= e($ach['color']) ?>" title="<?= e($ach['desc']) ?>">
        <div class="ach-icon"><?= $ach['icon'] ?></div>
        <div class="ach-text">
          <b><?= e($ach['title']) ?></b>
          <small><?= $has ? 'Получено · +' . $ach['bonus'] . ' дн.' : 'Награда +' . $ach['bonus'] . ' дн.' ?></small>
        </div>
        <span class="ach-state"><?= $has ? '✓' : '○' ?></span>
      </article>
      <?php endforeach; ?>
    </div>
  </section>

  <!-- ══ Рефералы + приложение ══ -->
  <section class="section-block split-section" id="referrals">
    <div class="feature-panel referral-panel">
      <span class="eyebrow">Рефералы</span>
      <h2>+<?= REF_BONUS_DAYS ?> дня за друга</h2>
      <p>Поделитесь ссылкой или продиктуйте код. Бонус начислится после первой оплаты приглашённого.</p>
      <div class="ref-row">
        <code><?= e($user['ref_code']) ?></code>
        <button type="button" class="copy-button" onclick="copyText('<?= e($refLink) ?>','Ссылка скопирована')">Копировать ссылку</button>
      </div>
      <div class="ref-stats">
        <div><span>Приглашено</span><strong data-count="<?= (int)$refStats['invited'] ?>">0</strong></div>
        <div><span>Оплатили</span><strong data-count="<?= (int)$refStats['paid'] ?>">0</strong></div>
        <div><span>Начислено дней</span><strong data-count="<?= (int)$refStats['days'] ?>">0</strong></div>
      </div>
      <?php if ($refStats['invited'] > $refStats['paid']): ?>
        <?php
          $refPending = (int)($refStats['invited'] - $refStats['paid']);
          $refTail = $refPending % 10;
          $refWord = ($refPending % 100 >= 11 && $refPending % 100 <= 14) ? 'приглашённых ещё не оформили'
                   : ($refTail === 1 ? 'приглашённый ещё не оформил'
                   : ($refTail >= 2 && $refTail <= 4 ? 'приглашённых ещё не оформили' : 'приглашённых ещё не оформили'));
        ?>
        <p class="ref-note">
          <?= $refPending ?> <?= $refWord ?> подписку — бонус за них придёт после первой оплаты.
        </p>
      <?php endif; ?>
    </div>

    <div class="feature-panel app-panel">
      <span class="eyebrow">Приложение</span>
      <h2><?= $release && !empty($release['version']) ? 'QMODS v' . e($release['version']) : 'Мобильное приложение' ?></h2>
      <p><?= $release && !empty($release['changelog'])
            ? e(trim(explode("\n", $release['changelog'])[0]))
            : 'Быстрый доступ к модификациям прямо с телефона.' ?></p>
      <?php if ($release && !empty($release['has_file'])): ?>
        <div style="margin-top:20px"><a href="download.php" class="soft-cta full">↓ Скачать APK</a></div>
      <?php endif; ?>
    </div>
  </section>

  <!-- ══ Платежи ══ -->
  <section class="section-block" id="payments">
    <div class="section-head">
      <div><span class="eyebrow">Финансы</span><h2>История платежей</h2></div>
      <span class="muted-count"><?= count($payments) ?></span>
    </div>
    <div class="list-panel">
      <?php if (!$payments): ?>
        <div class="empty-state with-kira">
          <div class="kira-stage"><img class="kira-art" src="assets/kira/empty.webp" alt="" width="221" height="296" loading="lazy"></div>
          <span>Платежей пока нет</span>
        </div>
      <?php else: foreach ($payments as $p): ?>
        <div class="list-row">
          <span class="row-icon">₽</span>
          <div>
            <b><?= e(defined('PLANS') && isset(PLANS[$p['plan']]) ? PLANS[$p['plan']]['title'] : (string)$p['plan']) ?></b>
            <small><?= date('d.m.Y H:i', (int)$p['date']) ?></small>
          </div>
          <strong><?= number_format((float)$p['amount'], 0, '.', ' ') ?> ₽</strong>
        </div>
      <?php endforeach; endif; ?>
    </div>
  </section>

  <!-- ══ Уведомления ══ -->
  <section class="section-block">
    <div class="section-head">
      <div><span class="eyebrow">Центр</span><h2>Уведомления</h2></div>
      <a href="notification.php" class="text-link">Все →</a>
    </div>
    <div class="notification-stack">
      <?php if (!$visible): ?>
        <div class="empty-state with-kira">
          <div class="kira-stage"><img class="kira-art" src="assets/kira/empty.webp" alt="" width="221" height="296" loading="lazy"></div>
          <span>Новых уведомлений нет</span>
        </div>
      <?php else: foreach (array_slice($visible, 0, 5) as $n): ?>
        <article class="notice-row">
          <span class="notice-dot" aria-hidden="true"></span>
          <div>
            <b><?= e($n['title']) ?></b>
            <p><?= nl2br(e($n['message'])) ?></p>
            <small><?= date('d.m.Y', (int)($n['created_at'] ?? 0)) ?></small>
          </div>
        </article>
      <?php endforeach; endif; ?>
    </div>
  </section>

  <!-- ══ Профиль ══ -->
  <section class="section-block" id="profile">
    <div class="section-head"><div><span class="eyebrow">Аккаунт</span><h2>Профиль</h2></div></div>
    <div class="profile-panel">
      <div class="profile-main">
        <div class="avatar-xl"><?= e($firstLetter) ?></div>
        <div><h3><?= e($user['username']) ?></h3><p>Участник с <?= e($created) ?></p></div>
        <button type="button" class="copy-button" onclick="copyText('<?= e($user['username']) ?>','Ник скопирован')">Копировать ник</button>
      </div>
      <div class="profile-facts">
        <div><span>Устройство</span><b><?= $device_id !== '' ? e($deviceShort) : 'Не привязано' ?></b></div>
        <div><span>Тариф</span><b><?= e($planLabel) ?></b></div>
        <div><span>Действует до</span><b><?= e($sub['expires_text']) ?></b></div>
      </div>
      <?php if ($device_id !== ''): ?>
        <form method="post" class="inline-form" onsubmit="return confirm('Отвязать устройство?');">
          <?= csrf_field() ?>
          <input type="hidden" name="action" value="unbind_device">
          <button class="danger-link" type="submit">Отвязать устройство</button>
        </form>
      <?php endif; ?>
    </div>
  </section>

  <!-- ══ Telegram ══ -->
  <section class="section-block account-actions" id="telegram">
    <details class="settings-drawer">
      <summary>🤖 Telegram <span aria-hidden="true">⌄</span></summary>
      <div>
        <?php if (!empty($user['telegram_id'])): ?>
          <p style="margin:0 0 8px">🟢 <b>Telegram привязан</b></p>
          <p style="margin:0;color:var(--muted)">Telegram ID: <code><?= e((string)$user['telegram_id']) ?></code></p>
        <?php else: ?>
          <p style="margin:0 0 16px;color:var(--muted)">Привяжи Telegram, чтобы смотреть подписку, платежи и данные аккаунта прямо в боте QMods.</p>
          <form method="post">
            <?= csrf_field() ?>
            <input type="hidden" name="action" value="create_telegram_link">
            <button class="primary-cta full" type="submit">🤖 Получить код привязки</button>
          </form>
        <?php endif; ?>
      </div>
    </details>
  </section>

  <!-- ══ Безопасность / отзыв / выход ══ -->
  <section class="section-block account-actions">
    <details class="settings-drawer">
      <summary>🔐 Безопасность и пароль <span aria-hidden="true">⌄</span></summary>
      <form method="post" class="settings-form">
        <?= csrf_field() ?>
        <input type="hidden" name="action" value="change_password">
        <label>Текущий пароль<input type="password" name="current_password" class="form-input" required></label>
        <label>Новый пароль<input type="password" name="new_password" class="form-input" minlength="6" required></label>
        <label>Повторите новый<input type="password" name="repeat_password" class="form-input" minlength="6" required></label>
        <button class="primary-cta full" type="submit">Сменить пароль</button>
      </form>
    </details>

    <?php if ($myReview): ?>
    <div class="review-current">
      <span>Ваш отзыв <?= render_stars((int)$myReview['rating']) ?></span>
      <p><?= e($myReview['text']) ?></p>
      <small><?= ($myReview['status'] ?? '') === 'approved' ? '✓ Опубликован' : '⏳ На модерации' ?></small>
    </div>
    <?php endif; ?>

    <form method="post" class="review-form">
      <span class="eyebrow">Обратная связь</span>
      <h2>Оставить отзыв</h2>
      <?= csrf_field() ?>
      <input type="hidden" name="action" value="add_review">
      <div class="stars-input">
        <?php for ($i = 5; $i >= 1; $i--): ?>
          <input type="radio" name="rating" id="star<?= $i ?>" value="<?= $i ?>" required>
          <label for="star<?= $i ?>" title="<?= $i ?>">★</label>
        <?php endfor; ?>
      </div>
      <textarea name="text" class="form-input" rows="3" minlength="10" placeholder="Что думаете о QMods?" required></textarea>
      <button class="soft-cta full" type="submit">Отправить отзыв</button>
    </form>

    <form method="post" class="logout-form">
      <?= csrf_field() ?>
      <input type="hidden" name="action" value="logout">
      <button type="submit">Выйти из аккаунта</button>
    </form>
  </section>

</div>

<nav class="mobile-bottom-nav" aria-label="Навигация кабинета">
  <a href="#home" class="active"><span>⌂</span><small>Главная</small></a>
  <a href="#subscription"><span>◈</span><small>Доступ</small></a>
  <a href="#achievements"><span>✦</span><small>Награды</small></a>
  <a href="#profile"><span>○</span><small>Профиль</small></a>
</nav>

<?php render_footer(); ?>
