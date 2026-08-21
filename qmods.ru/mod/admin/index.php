<?php
require dirname(__DIR__) . '/includes/bootstrap.php';
require dirname(__DIR__) . '/subscribe/config.php';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'POST' && csrf_ok()) {
    $action = (string)($_POST['action'] ?? '');

    if ($action === 'admin_login') {
        $password = (string)($_POST['admin_password'] ?? '');
        if (ADMIN_PASSWORD_HASH === 'PASTE_PASSWORD_HASH_HERE') {
            flash('error', 'Задайте ADMIN_PASSWORD_HASH в includes/bootstrap.php');
        } elseif (password_verify($password, ADMIN_PASSWORD_HASH)) {
            session_regenerate_id(true);
            $_SESSION['qmods_admin'] = true;
            log_action('Admin login');
            redirect('index.php');
        } else {
            flash('error', 'Неверный админ-пароль.');
        }
    } elseif ($action === 'admin_logout') {
        unset($_SESSION['qmods_admin']);
        log_action('Admin logout');
        redirect('index.php');
    } elseif (!is_admin()) {
        flash('error', 'Нет прав.');
    } elseif ($action === 'issue') {
        $username = trim((string)($_POST['username'] ?? ''));
        $plan = trim((string)($_POST['plan'] ?? 'default')) ?: 'default';
        $days = (int)($_POST['days'] ?? 0);
        $expires_date = trim((string)($_POST['expires_date'] ?? ''));
        $expires_at = 0;
        $success_msg = '';

        if ($expires_date !== '') {
            $ts = strtotime($expires_date . ' 23:59:59');
            if ($ts === false) {
                flash('error', 'Неверный формат даты.'); redirect('index.php'); exit;
            }
            $today_start = strtotime(date('Y-m-d') . ' 00:00:00');
            if ($ts < $today_start) {
                flash('error', 'Дата должна быть сегодня или позже.'); redirect('index.php'); exit;
            }
            $expires_at = $ts;
            $success_msg = "Подписка {$username} продлена до " . date('d.m.Y', $expires_at);
        } elseif ($days >= 1 && $days <= 3650) {
            $expires_at = time() + ($days * 86400);
            $success_msg = "Подписка {$username} продлена на {$days} дн. до " . date('d.m.Y', $expires_at);
        } else {
            flash('error', 'Укажите дни или дату.'); redirect('index.php'); exit;
        }

        if (!validate_username($username)) { flash('error', 'Некорректный ник.'); redirect('index.php'); exit; }
        if (!preg_match('/^[A-Za-z0-9_\-]{1,32}$/', $plan)) { flash('error', 'Некорректное название тарифа.'); redirect('index.php'); exit; }

        [$ok, $result] = update_users(function (array $users) use ($username, $expires_at, $plan): array {
            $found = false;
            foreach ($users as &$u) {
                if (($u['username_lower'] ?? '') === strtolower(trim($username))) {
                    $found = true;
                    $u['subscription']['plan'] = $plan;
                    $u['subscription']['expires_at'] = $expires_at;
                    break;
                }
            }
            unset($u);
            return [$users, $found ? ['success' => true] : ['error' => 'Пользователь не найден.']];
        });
        if (!$ok) flash('error', 'Ошибка хранилища.');
        elseif (!empty($result['error'])) flash('error', $result['error']);
        else { log_action("Issue sub: {$username} until " . date('Y-m-d H:i', $expires_at)); flash('success', $success_msg); }
        redirect('index.php'); exit;

    } elseif ($action === 'remove') {
        $username = trim((string)($_POST['username'] ?? ''));
        if (!validate_username($username)) { flash('error', 'Некорректный ник.'); redirect('index.php'); exit; }
        [$ok, $result] = update_users(function (array $users) use ($username): array {
            $found = false;
            foreach ($users as &$u) {
                if (($u['username_lower'] ?? '') === strtolower(trim($username))) {
                    $found = true;
                    $u['subscription']['plan'] = 'none';
                    $u['subscription']['expires_at'] = 0;
                    $u['device_id'] = '';
                    break;
                }
            }
            unset($u);
            return [$users, $found ? ['success' => true] : ['error' => 'Пользователь не найден.']];
        });
        if (!$ok) flash('error', 'Ошибка.');
        elseif (!empty($result['error'])) flash('error', $result['error']);
        else { log_action("Remove sub: {$username}"); flash('success', "Подписка снята с {$username}"); }
        redirect('index.php'); exit;

    } elseif ($action === 'delete_user') {
        $username = trim((string)($_POST['username'] ?? ''));
        if (!validate_username($username)) { flash('error', 'Некорректный ник.'); redirect('index.php'); exit; }
        [$ok, $result] = update_users(function (array $users) use ($username): array {
            $newUsers = array_values(array_filter($users, function ($u) use ($username) {
                return ($u['username_lower'] ?? '') !== strtolower(trim($username));
            }));
            return [ $newUsers, count($newUsers) === count($users) ? ['error' => 'Пользователь не найден.'] : ['success' => true] ];
        });
        if (!$ok) flash('error', 'Ошибка.');
        elseif (!empty($result['error'])) flash('error', $result['error']);
        else { log_action("Delete user: {$username}"); flash('success', "Пользователь {$username} удалён"); }
        redirect('index.php'); exit;

    } elseif ($action === 'send_notification') {
        $title = trim((string)($_POST['title'] ?? ''));
        $message = trim((string)($_POST['message'] ?? ''));
        if ($title === '' || $message === '') { flash('error', 'Заполните заголовок и текст.'); redirect('index.php'); exit; }
        [$ok] = update_notifications(function ($notifications) use ($title, $message) {
            $notifications[] = ['id'=>bin2hex(random_bytes(16)), 'title'=>$title, 'message'=>$message, 'created_at'=>time(), 'read_by'=>[]];
            return [$notifications, ['success'=>true]];
        });
        if (!$ok) flash('error', 'Ошибка сохранения.');
        else { log_action("Notification sent: {$title}"); flash('success', 'Рассылка отправлена всем пользователям'); }
        redirect('index.php'); exit;

    } elseif ($action === 'delete_notification') {
        $notification_id = trim((string)($_POST['notification_id'] ?? ''));
        [$ok] = update_notifications(function ($notifications) use ($notification_id) {
            $new = array_values(array_filter($notifications, fn($n) => ($n['id'] ?? '') !== $notification_id));
            return [$new, ['success'=>true]];
        });
        if (!$ok) flash('error', 'Ошибка удаления.');
        else { log_action("Notification deleted: {$notification_id}"); flash('success', 'Уведомление удалено'); }
        redirect('index.php'); exit;
    }
}

if (!is_admin()) {
    render_header('QMods Admin', ['is_admin' => false]);
    ?>
    <link rel="stylesheet" href="../assets/style.css?v=cyber-1">
    <link rel="stylesheet" href="../assets/admin.css?v=cyber-1">
    <main class="admin-auth-v5">
        <div class="admin-auth-art"><div class="admin-mark">Q</div><span>CONTROL DECK</span><strong>QMods<br>Admin</strong><p>Центр управления пользователями, подписками и приложением.</p></div>
        <div class="admin-auth-form">
            <div class="admin-eyebrow">SECURE AREA / 01</div>
            <h1>Добро пожаловать.</h1>
            <p>Войдите в панель управления QMods.</p>
            <form method="post" class="admin-login-form">
                <?= csrf_field() ?><input type="hidden" name="action" value="admin_login">
                <label>Пароль<input type="password" name="admin_password" class="admin-input" placeholder="Введите пароль" required autofocus autocomplete="current-password"></label>
                <button class="admin-primary" type="submit"><span>Войти в панель</span><b>↗</b></button>
            </form>
            <div class="admin-auth-foot"><span>●</span> Защищённая сессия</div>
        </div>
    </main>
    <?php render_footer(['is_admin'=>false]); exit;
}

$users = load_users();
$stats = get_stats();
$today = date('Y-m-d');
$notifications = load_notifications();
usort($notifications, fn($a,$b)=>(int)($b['created_at']??0)<=>(int)($a['created_at']??0));
$recentNotifications = array_slice($notifications, 0, 4);
$recentUsers = $users;
usort($recentUsers, fn($a,$b)=>(int)($b['created_at']??0)<=>(int)($a['created_at']??0));
$recentUsers = array_slice($recentUsers, 0, 5);
$activeRate = $stats['total'] ? round(($stats['active'] / $stats['total']) * 100) : 0;

render_header('QMods Admin', ['is_admin'=>true, 'user'=>current_user()]);
?>
<link rel="stylesheet" href="../assets/admin.css?v=cyber-1">

<style>
.analytics-grid{display:grid;grid-template-columns:minmax(0,1.65fr) minmax(280px,.8fr);gap:14px;margin:14px 0}.analytics-panel{padding:20px}.analytics-average{font-size:10px;color:#8b5cf6;font-weight:900}.chart-wrap{display:flex;gap:10px;height:220px;margin-top:10px}.chart-y{width:55px;display:flex;flex-direction:column;justify-content:space-between;color:#68716d;font-size:8px;text-transform:uppercase;letter-spacing:.08em;padding:4px 0 25px}.bar-chart{flex:1;display:flex;align-items:flex-end;gap:clamp(3px,.7vw,10px);border-bottom:1px solid rgba(255,255,255,.07);overflow:hidden}.chart-day{height:100%;flex:1;min-width:6px;display:flex;flex-direction:column;justify-content:flex-end;align-items:center}.bars{height:calc(100% - 23px);width:100%;display:flex;align-items:flex-end;justify-content:center;gap:2px}.bars i,.bars b{display:block;width:42%;max-width:10px;border-radius:4px 4px 1px 1px;background:linear-gradient(180deg,#a78bfa,#7c3aed);min-height:1px}.bars b{background:linear-gradient(180deg,#67e8d0,#14b8a6)}.chart-day small{height:20px;font-size:7px;color:#59615e;margin-top:4px}.analytics-foot{display:flex;justify-content:space-between;gap:12px;margin-top:13px;padding-top:13px;border-top:1px solid rgba(255,255,255,.06);color:#68716d;font-size:9px}.analytics-foot b{color:#c7d0cb}.plan-line{margin:18px 0}.plan-line>div:first-child{display:flex;justify-content:space-between;gap:10px}.plan-line b{font-size:12px}.plan-line span{font-size:9px;color:#68716d}.plan-line>strong{display:block;text-align:right;font-size:10px;color:#a78bfa;margin-top:-15px}.plan-progress{height:7px;border-radius:99px;background:#0b1110;margin-top:8px;overflow:hidden}.plan-progress i{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#8b5cf6,#67e8d0)}@media(max-width:900px){.analytics-grid{grid-template-columns:1fr}}@media(max-width:560px){.analytics-panel{padding:15px}.chart-wrap{height:190px}.chart-day small:nth-last-child(-n+15){display:none}.analytics-foot{display:block}.analytics-foot span{display:block;margin-top:6px}}
</style>
<div class="admin-shell">
    <aside class="admin-sidebar">
        <a class="admin-logo" href="index.php"><span>Q</span><div><b>QMods</b><small>CONTROL DECK</small></div></a>
        <nav class="admin-nav">
            <a class="active" href="index.php"><i>⌂</i><span>Обзор</span></a>
            <a href="payments.php"><i>₽</i><span>Платежи</span></a>
            <a href="refs.php"><i>↗</i><span>Рефералы</span></a>
            <a href="reviews.php"><i>★</i><span>Отзывы</span></a>
            <a href="activity.php"><i>◷</i><span>Активность</span></a>
            <a href="app.php"><i>▣</i><span>Приложение</span></a>
            <a href="shutdown.php"><i>⚙</i><span>Конструктор</span></a>
        </nav>
        <div class="admin-side-bottom">
            <div class="admin-online"><span></span> Панель онлайн</div>
            <form method="post"><input type="hidden" name="action" value="admin_logout"><?= csrf_field() ?><button class="admin-logout" type="submit">Выйти <b>↗</b></button></form>
        </div>
    </aside>

    <main class="admin-main">
        <header class="admin-mobile-head">
            <a class="admin-logo" href="index.php"><span>Q</span><div><b>QMods</b><small>ADMIN</small></div></a>
            <form method="post"><input type="hidden" name="action" value="admin_logout"><?= csrf_field() ?><button class="admin-icon-btn" type="submit" aria-label="Выйти">↗</button></form>
        </header>

        <section class="admin-hero">
            <div><div class="admin-eyebrow">CONTROL DECK / <?= date('d.m.Y') ?></div><h1>Панель управления.</h1><p>Всё состояние QMods в одном месте. Управляй доступом, пользователями и приложением без лишних переходов.</p></div>
            <div class="hero-pulse"><span></span><b>LIVE</b><small><?= e(current_user()['username'] ?? 'admin') ?></small></div>
        </section>

        <section class="admin-stat-grid">
            <article class="admin-stat stat-main"><small>ПОЛЬЗОВАТЕЛИ</small><strong><?= $stats['total'] ?></strong><span>в базе</span><div class="stat-mark">◎</div></article>
            <article class="admin-stat stat-good"><small>АКТИВНЫЕ</small><strong><?= $stats['active'] ?></strong><span><?= e((string)$stats['active_rate']) ?>% аудитории</span><div class="stat-mark">✓</div></article>
            <article class="admin-stat stat-warn"><small>ЗАКАНЧИВАЮТСЯ</small><strong><?= $stats['expiring'] ?></strong><span>в ближайшие 7 дней</span><div class="stat-mark">!</div></article>
            <article class="admin-stat stat-bad"><small>ВЫРУЧКА</small><strong><?= number_format((float)$stats['revenue'],0,'.',' ') ?> ₽</strong><span><?= (int)$stats['payment_count'] ?> подтверждённых платежей</span><div class="stat-mark">₽</div></article>
        </section>

        <section class="analytics-grid">
            <div class="admin-panel analytics-panel">
                <div class="panel-head"><div><div class="admin-eyebrow">ANALYTICS / 30 DAYS</div><h2>Динамика проекта</h2></div><span class="analytics-average">≈ <?= number_format((float)$stats['average_payment'],0,'.',' ') ?> ₽ / платёж</span></div>
                <div class="chart-wrap"><div class="chart-y"><span>регистрации</span><span>платежи</span></div><div class="bar-chart" id="barChart">
                    <?php $maxDay = 1; foreach ($stats['series'] as $d) $maxDay = max($maxDay, (int)$d['registrations'], (int)$d['payments']); ?>
                    <?php foreach ($stats['series'] as $d): $regH = round(($d['registrations']/$maxDay)*100); $payH = round(($d['payments']/$maxDay)*100); ?>
                        <div class="chart-day" title="<?= e($d['label']) ?>: <?= (int)$d['registrations'] ?> рег. / <?= (int)$d['payments'] ?> платежей"><div class="bars"><i style="height:<?= $regH ?>%"></i><b style="height:<?= $payH ?>%"></b></div><small><?= e($d['label']) ?></small></div>
                    <?php endforeach; ?>
                </div></div>
                <div class="analytics-foot"><span>Последний платёж: <b><?= $stats['last_payment_at'] ? date('d.m.Y H:i',(int)$stats['last_payment_at']) : '—' ?></b></span><span>Оплаченных заказов: <b><?= (int)$stats['paid_orders'] ?></b></span></div>
            </div>
            <div class="admin-panel analytics-panel plan-analytics">
                <div class="panel-head"><div><div class="admin-eyebrow">PLANS</div><h2>Популярность тарифов</h2></div></div>
                <?php $planTotal=max(1,array_sum($stats['plan_counts'])); foreach ($stats['plan_counts'] as $planCode=>$count): $planTitle=isset(PLANS[$planCode])?PLANS[$planCode]['title']:$planCode; $share=round(($count/$planTotal)*100); ?>
                <div class="plan-line"><div><b><?= e($planTitle) ?></b><span><?= (int)$count ?> платежей</span></div><strong><?= $share ?>%</strong><div class="plan-progress"><i style="width:<?= $share ?>%"></i></div></div>
                <?php endforeach; if (!$stats['plan_counts']): ?><div class="admin-muted">Данных по платежам пока нет.</div><?php endif; ?>
            </div>
        </section>

        <section class="admin-actions-row">
            <button class="admin-action-card mint" id="openIssue"><span>＋</span><div><b>Выдать доступ</b><small>Продлить подписку пользователю</small></div><em>→</em></button>
            <button class="admin-action-card coral" id="openBroadcast"><span>✦</span><div><b>Новая рассылка</b><small>Отправить сообщение пользователям</small></div><em>→</em></button>
            <a class="admin-action-card dark" href="app.php"><span>▣</span><div><b>Управление APK</b><small>Версия и публичная загрузка</small></div><em>→</em></a>
        </section>

        <section class="admin-content-grid">
            <div class="admin-panel users-panel">
                <div class="panel-head"><div><div class="admin-eyebrow">DATABASE</div><h2>Пользователи</h2></div><button id="refreshUsers" class="admin-icon-btn" title="Обновить">↻</button></div>
                <div class="admin-search"><span>⌕</span><input id="adminSearch" type="search" placeholder="Найти пользователя…" autocomplete="off"></div>
                <div class="user-feed" id="userFeed">
                <?php foreach ($users as $u):
                    $sub = subscription_info($u);
                    $name = (string)($u['username'] ?? '');
                    $status = $sub['active'] ? (($sub['days_left'] <= 7) ? 'expiring' : 'active') : 'expired';
                    $statusText = $sub['active'] ? ($sub['days_left'] . ' дн.') : 'Нет доступа';
                    $letter = mb_strtoupper(mb_substr($name,0,1));
                    $created = !empty($u['created_at']) ? date('d.m.Y', (int)$u['created_at']) : '—';
                    $quickPlan = $sub['plan'] !== 'none' ? $sub['plan'] : 'default';
                ?>
                    <article class="user-row" data-user="<?= e(strtolower($name)) ?>">
                        <button class="user-row-main" type="button">
                            <span class="user-avatar <?= $status ?>"><?= e($letter) ?></span>
                            <span class="user-ident"><b><?= e($name) ?></b><small><?= e($sub['plan']) ?> · с <?= e($created) ?></small></span>
                            <span class="user-status <?= $status ?>"><i></i><?= e($statusText) ?></span><span class="row-arrow">⌄</span>
                        </button>
                        <div class="user-row-detail">
                            <div class="detail-grid"><div><small>Тариф</small><b><?= e($sub['plan']) ?></b></div><div><small>Доступ до</small><b><?= e($sub['expires_text']) ?></b></div><div><small>Устройство</small><b><?= !empty($u['device_id']) ? e(substr((string)$u['device_id'],0,8).'…') : 'не привязано' ?></b></div></div>
                            <div class="quick-label">Быстро продлить</div>
                            <div class="quick-days">
                                <?php foreach ([7,30,90,365] as $d): ?><form method="post"><?= csrf_field() ?><input type="hidden" name="action" value="issue"><input type="hidden" name="username" value="<?= e($name) ?>"><input type="hidden" name="days" value="<?= $d ?>"><input type="hidden" name="plan" value="<?= e($quickPlan) ?>"><button type="submit">+<?= $d ?>д</button></form><?php endforeach; ?>
                            </div>
                            <div class="detail-actions"><form method="post" class="detail-date"><?= csrf_field() ?><input type="hidden" name="action" value="issue"><input type="hidden" name="username" value="<?= e($name) ?>"><input type="hidden" name="plan" value="<?= e($quickPlan) ?>"><input type="date" name="expires_date" min="<?= $today ?>" required><button type="submit">До даты</button></form><form method="post"><?= csrf_field() ?><input type="hidden" name="action" value="remove"><input type="hidden" name="username" value="<?= e($name) ?>"><button class="danger-lite" type="submit" onclick="return confirm('Снять подписку?')">Снять</button></form><form method="post"><?= csrf_field() ?><input type="hidden" name="action" value="delete_user"><input type="hidden" name="username" value="<?= e($name) ?>"><button class="danger" type="submit" onclick="return confirm('Удалить пользователя полностью?')">Удалить</button></form></div>
                        </div>
                    </article>
                <?php endforeach; ?>
                </div>
                <div id="emptySearch" class="admin-empty" hidden>Пользователь не найден.</div>
            </div>

            <aside class="admin-side-stack">
                <div class="admin-panel mini-panel"><div class="panel-head"><div><div class="admin-eyebrow">QUICK LINKS</div><h2>Разделы</h2></div></div><div class="link-list"><a href="payments.php"><span>₽</span><div><b>Платежи</b><small>История оплат</small></div><em>→</em></a><a href="refs.php"><span>↗</span><div><b>Рефералы</b><small>Приглашения и бонусы</small></div><em>→</em></a><a href="reviews.php"><span>★</span><div><b>Отзывы</b><small>Модерация</small></div><em>→</em></a><a href="activity.php"><span>◷</span><div><b>Активность</b><small>Журнал действий</small></div><em>→</em></a></div></div>
                <div class="admin-panel mini-panel"><div class="panel-head"><div><div class="admin-eyebrow">NOTIFICATIONS</div><h2>Последние</h2></div><button id="openBroadcast2" class="admin-text-btn">＋</button></div>
                    <?php if (!$recentNotifications): ?><div class="admin-muted">Рассылок пока нет.</div><?php else: foreach ($recentNotifications as $n): ?><div class="notification-mini"><span>✦</span><div><b><?= e($n['title']) ?></b><small><?= e(mb_strimwidth($n['message'],0,70,'…')) ?></small><time><?= date('d.m H:i',(int)$n['created_at']) ?></time></div></div><?php endforeach; endif; ?>
                </div>
            </aside>
        </section>
    </main>
</div>

<nav class="admin-mobile-nav"><a class="active" href="index.php"><i>⌂</i>Обзор</a><a href="payments.php"><i>₽</i>Платежи</a><button id="mobileIssue"><i>＋</i>Выдать</button><a href="reviews.php"><i>★</i>Отзывы</a><a href="app.php"><i>▣</i>APK</a></nav>

<div class="admin-modal" id="issueModal"><div class="admin-modal-box"><button class="modal-x" data-close="issueModal">×</button><div class="admin-eyebrow">ACCESS / ISSUE</div><h2>Выдать доступ</h2><p>Продлите подписку пользователю.</p><form method="post" class="admin-modal-form"><input type="hidden" name="action" value="issue"><?= csrf_field() ?><label>Пользователь<input class="admin-input" name="username" placeholder="username" required maxlength="32"></label><label>Тариф<input class="admin-input" name="plan" value="default" required></label><div class="modal-two"><label>Дней<input class="admin-input" type="number" name="days" min="1" max="3650" placeholder="30"></label><label>Или до даты<input class="admin-input" type="date" name="expires_date" min="<?= $today ?>"></label></div><button class="admin-primary" type="submit"><span>Применить</span><b>→</b></button></form></div></div>

<div class="admin-modal" id="broadcastModal"><div class="admin-modal-box"><button class="modal-x" data-close="broadcastModal">×</button><div class="admin-eyebrow">BROADCAST / ALL USERS</div><h2>Новая рассылка</h2><p>Сообщение будет доступно всем пользователям.</p><form method="post" class="admin-modal-form"><input type="hidden" name="action" value="send_notification"><?= csrf_field() ?><label>Заголовок<input class="admin-input" name="title" maxlength="100" placeholder="Важное обновление" required></label><label>Сообщение<textarea class="admin-input" name="message" maxlength="500" rows="5" placeholder="Напишите сообщение…" required></textarea></label><button class="admin-primary coral-submit" type="submit"><span>Отправить</span><b>↗</b></button></form><div class="broadcast-history"><?php foreach ($recentNotifications as $n): ?><div><b><?= e($n['title']) ?></b><small><?= date('d.m.Y H:i',(int)$n['created_at']) ?></small></div><?php endforeach; ?></div></div></div>

<script>
(function(){
'use strict';
const $=s=>document.querySelector(s), $$=s=>document.querySelectorAll(s);
function open(id){$(id).classList.add('show');document.body.classList.add('modal-open')}
function close(id){$(id).classList.remove('show');if(!$$('.admin-modal.show').length)document.body.classList.remove('modal-open')}
$('#openIssue')?.addEventListener('click',()=>open('#issueModal'));$('#mobileIssue')?.addEventListener('click',()=>open('#issueModal'));
$('#openBroadcast')?.addEventListener('click',()=>open('#broadcastModal'));$('#openBroadcast2')?.addEventListener('click',()=>open('#broadcastModal'));
$$('[data-close]').forEach(b=>b.addEventListener('click',()=>close('#'+b.dataset.close)));
$$('.admin-modal').forEach(m=>m.addEventListener('click',e=>{if(e.target===m)close('#'+m.id)}));
document.addEventListener('keydown',e=>{if(e.key==='Escape')$$('.admin-modal.show').forEach(m=>close('#'+m.id))});
$$('.user-row-main').forEach(b=>b.addEventListener('click',()=>{const row=b.closest('.user-row');$$('.user-row.open').forEach(r=>{if(r!==row)r.classList.remove('open')});row.classList.toggle('open');}));
const search=$('#adminSearch'), empty=$('#emptySearch');
search?.addEventListener('input',()=>{const q=search.value.trim().toLowerCase();let shown=0;$$('.user-row').forEach(r=>{const yes=(r.dataset.user||'').includes(q);r.style.display=yes?'':'none';if(yes)shown++});empty.hidden=shown!==0});
$('#refreshUsers')?.addEventListener('click',e=>{e.currentTarget.classList.add('spin');setTimeout(()=>location.reload(),350)});
if('serviceWorker' in navigator){navigator.serviceWorker.register('../sw.js').catch(()=>{});}
})();
</script>
<?php render_footer(['is_admin'=>true]); ?>
