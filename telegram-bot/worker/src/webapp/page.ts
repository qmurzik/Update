/**
 * The QMods Mini App — a single self-contained page (no build step, no
 * framework) served at GET /app. Talks only to POST /app/api, authenticated
 * via Telegram's initData (see validate.ts) — never trusts a client-supplied
 * telegram_id.
 */
export const APP_HTML = `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no">
<title>QMods</title>
<script src="https://telegram.org/js/telegram-web-app.js"></script>
<style>
  :root {
    --bg: var(--tg-theme-bg-color, #0a0e1a);
    --bg2: var(--tg-theme-secondary-bg-color, #10162a);
    --text: var(--tg-theme-text-color, #f1f5f9);
    --hint: var(--tg-theme-hint-color, #7c8aa5);
    --link: var(--tg-theme-link-color, #5b8cff);
    --btn: var(--tg-theme-button-color, #3157ff);
    --btn-text: var(--tg-theme-button-text-color, #ffffff);
    --accent: #3157ff;
    --success: #22c55e;
    --danger: #ef4444;
    --card: rgba(255,255,255,.045);
    --card-border: rgba(255,255,255,.08);
  }
  * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
  html, body { margin: 0; padding: 0; }
  body {
    background: var(--bg);
    color: var(--text);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    padding-bottom: 78px;
    min-height: 100vh;
  }
  a { color: var(--link); }
  .header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 16px 16px 8px;
  }
  .logo { display: flex; align-items: center; gap: 8px; font-weight: 800; font-size: 18px; }
  .logo .mark {
    width: 28px; height: 28px; border-radius: 8px;
    background: linear-gradient(135deg, var(--accent), #7c3aed);
    display: flex; align-items: center; justify-content: center; font-size: 14px;
  }
  .pill {
    display: inline-flex; align-items: center; gap: 5px;
    padding: 4px 10px; border-radius: 999px; font-size: 12px; font-weight: 600;
    background: var(--card); border: 1px solid var(--card-border);
  }
  .pill.ok { color: var(--success); }
  .pill.bad { color: var(--danger); }
  .content { padding: 8px 16px 16px; }
  .card {
    background: var(--card); border: 1px solid var(--card-border);
    border-radius: 16px; padding: 16px; margin-bottom: 12px;
  }
  .card h3 { margin: 0 0 12px; font-size: 14px; color: var(--hint); font-weight: 600; text-transform: uppercase; letter-spacing: .03em; }
  .row { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid var(--card-border); font-size: 14px; }
  .row:last-child { border-bottom: none; }
  .row .k { color: var(--hint); }
  .row .v { font-weight: 600; text-align: right; }
  .big-stat { font-size: 28px; font-weight: 800; margin: 2px 0; }
  .muted { color: var(--hint); font-size: 13px; }
  .btn {
    display: block; width: 100%; text-align: center; padding: 12px; border-radius: 12px;
    border: none; font-weight: 700; font-size: 14px; cursor: pointer; margin-top: 10px;
    background: var(--card); color: var(--text); border: 1px solid var(--card-border);
  }
  .btn.primary { background: var(--btn); color: var(--btn-text); }
  .btn.danger { background: rgba(239,68,68,.12); color: var(--danger); border-color: rgba(239,68,68,.3); }
  input[type=text] {
    width: 100%; padding: 12px 14px; border-radius: 12px; border: 1px solid var(--card-border);
    background: var(--bg2); color: var(--text); font-size: 16px; letter-spacing: .08em; text-align: center;
    text-transform: uppercase;
  }
  .skeleton { background: linear-gradient(90deg, var(--card) 25%, rgba(255,255,255,.09) 37%, var(--card) 63%); background-size: 400% 100%; animation: sk 1.4s ease infinite; border-radius: 8px; height: 14px; margin: 6px 0; }
  @keyframes sk { 0% { background-position: 100% 50%; } 100% { background-position: 0 50%; } }
  .tabs {
    position: fixed; left: 0; right: 0; bottom: 0;
    display: flex; background: var(--bg2); border-top: 1px solid var(--card-border);
    padding: 6px 4px calc(6px + env(safe-area-inset-bottom));
  }
  .tab {
    flex: 1; display: flex; flex-direction: column; align-items: center; gap: 2px;
    padding: 6px 2px; border-radius: 10px; color: var(--hint); font-size: 10px; font-weight: 600;
    background: none; border: none; cursor: pointer;
  }
  .tab .ic { font-size: 18px; }
  .tab.active { color: var(--accent); }
  .notif { padding: 10px 0; border-bottom: 1px solid var(--card-border); }
  .notif:last-child { border-bottom: none; }
  .notif .t { font-weight: 700; font-size: 14px; display: flex; align-items: center; gap: 6px; }
  .notif .m { font-size: 13px; color: var(--hint); margin-top: 2px; }
  .notif .d { font-size: 11px; color: var(--hint); margin-top: 4px; }
  .dot { width: 6px; height: 6px; border-radius: 50%; background: var(--accent); flex: none; }
  .center-screen { min-height: 70vh; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 24px; }
  .hidden { display: none !important; }
  .bar { height: 8px; border-radius: 999px; background: var(--card-border); overflow: hidden; margin: 10px 0 4px; }
  .bar > span { display: block; height: 100%; background: linear-gradient(90deg, var(--accent), #7c3aed); }
  .ach-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 4px; }
  .ach-item { text-align: center; padding: 10px 4px; border-radius: 12px; background: var(--card); border: 1px solid var(--card-border); }
  .ach-item.locked { opacity: .35; }
  .ach-item .ic { font-size: 22px; }
  .ach-item .t { font-size: 10px; margin-top: 4px; font-weight: 600; line-height: 1.25; }
  .stars { display: flex; gap: 6px; justify-content: center; margin: 8px 0; }
  .stars button { font-size: 26px; background: none; border: none; cursor: pointer; opacity: .3; padding: 2px; }
  .stars button.on { opacity: 1; }
  textarea { width: 100%; padding: 10px 12px; border-radius: 12px; border: 1px solid var(--card-border); background: var(--bg2); color: var(--text); font-size: 14px; font-family: inherit; resize: vertical; }
  .copy-row { display: flex; gap: 8px; align-items: center; background: var(--bg2); border-radius: 10px; padding: 8px 10px; margin-top: 6px; }
  .copy-row code { flex: 1; font-size: 12px; word-break: break-all; }
  .copy-row button { flex: none; background: var(--card); border: 1px solid var(--card-border); color: var(--text); border-radius: 8px; padding: 6px 10px; font-size: 12px; cursor: pointer; }
  .stat-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 4px; }
  .stat-tile { background: var(--bg2); border-radius: 10px; padding: 8px; text-align: center; }
  .stat-tile b { display: block; font-size: 18px; }
  .stat-tile small { color: var(--hint); font-size: 10px; }
  .chart { display: flex; align-items: flex-end; gap: 3px; height: 60px; margin-top: 10px; }
  .chart-bar { flex: 1; background: linear-gradient(180deg, var(--accent), #7c3aed); border-radius: 3px 3px 0 0; min-height: 2px; }
  input[type=search] {
    width: 100%; padding: 10px 12px; border-radius: 10px; border: 1px solid var(--card-border);
    background: var(--bg2); color: var(--text); font-size: 14px; margin-bottom: 8px;
  }
  .user-row {
    display: flex; justify-content: space-between; align-items: center; width: 100%;
    padding: 10px 4px; border-bottom: 1px solid var(--card-border); background: none; border-left: none; border-right: none; border-top: none;
    color: var(--text); font-size: 13px; text-align: left; cursor: pointer;
  }
  .user-row:last-child { border-bottom: none; }
  .user-list { max-height: 320px; overflow-y: auto; }
  .admin-form { margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--card-border); }
  .admin-form input[type=text], .admin-form input[type=number] {
    width: 100%; padding: 10px 12px; border-radius: 10px; border: 1px solid var(--card-border);
    background: var(--bg2); color: var(--text); font-size: 14px; margin-bottom: 8px;
  }
</style>
</head>
<body>

<div id="loading" class="center-screen">
  <div class="skeleton" style="width:120px;height:20px"></div>
</div>

<div id="linkScreen" class="center-screen hidden">
  <div class="logo" style="font-size:22px;margin-bottom:6px"><span class="mark">Q</span>QMods</div>
  <p class="muted" style="max-width:280px">Аккаунт ещё не привязан. Введите одноразовый код из личного кабинета qmods.ru/mod.</p>
  <input type="text" id="codeInput" maxlength="10" placeholder="ХХХХХХХХХХ" style="max-width:220px;margin-top:14px">
  <button class="btn primary" style="max-width:220px" onclick="doLink()">Привязать</button>
  <p id="linkError" class="muted" style="color:var(--danger)"></p>
</div>

<div id="app" class="hidden">
  <div class="header">
    <div class="logo"><span class="mark">Q</span>QMods</div>
    <span id="statusPill" class="pill">…</span>
  </div>

  <div class="content">
    <div id="tab-profile" class="tabpanel"></div>
    <div id="tab-sub" class="tabpanel hidden"></div>
    <div id="tab-devices" class="tabpanel hidden"></div>
    <div id="tab-ach" class="tabpanel hidden"></div>
    <div id="tab-pay" class="tabpanel hidden"></div>
    <div id="tab-notif" class="tabpanel hidden"></div>
    <div id="tab-admin" class="tabpanel hidden"></div>
  </div>

  <div class="tabs">
    <button class="tab active" data-tab="profile" onclick="switchTab('profile')"><span class="ic">👤</span>Профиль</button>
    <button class="tab" data-tab="sub" onclick="switchTab('sub')"><span class="ic">⭐</span>Подписка</button>
    <button class="tab" data-tab="devices" onclick="switchTab('devices')"><span class="ic">📱</span>Устройства</button>
    <button class="tab" data-tab="ach" onclick="switchTab('ach')"><span class="ic">🏆</span>Награды</button>
    <button class="tab" data-tab="pay" onclick="switchTab('pay')"><span class="ic">💳</span>Оплата</button>
    <button class="tab" data-tab="notif" onclick="switchTab('notif')"><span class="ic">🔔</span>Увед.</button>
    <button class="tab hidden" data-tab="admin" id="adminTabBtn" onclick="switchTab('admin')"><span class="ic">🛠</span>Админ</button>
  </div>
</div>

<script>
var tg = window.Telegram && window.Telegram.WebApp;
if (tg) { tg.ready(); tg.expand(); }
var initData = tg ? tg.initData : '';
var SUBSCRIBE_URL = '__SUBSCRIBE_URL__';
var me = null;
var isAdminUser = false;

function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function api(action, params) {
  var body = Object.assign({ action: action }, params || {});
  return fetch('/app/api', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'tma ' + initData },
    body: JSON.stringify(body)
  }).then(function (r) { return r.json(); });
}

function haptic(style) {
  if (tg && tg.HapticFeedback) tg.HapticFeedback.impactOccurred(style || 'light');
}

function show(id) { document.getElementById(id).classList.remove('hidden'); }
function hide(id) { document.getElementById(id).classList.add('hidden'); }

function boot() {
  api('me', {}).then(function (res) {
    hide('loading');
    if (!res.success) {
      document.getElementById('linkError').textContent = 'Не удалось связаться с сервером QMods.';
      show('linkScreen');
      return;
    }
    if (!res.linked) {
      show('linkScreen');
      return;
    }
    me = res.user;
    isAdminUser = !!res.is_admin;
    if (isAdminUser) document.getElementById('adminTabBtn').classList.remove('hidden');
    show('app');
    renderStatusPill();
    renderProfile();
  });
}

function doLink() {
  var code = document.getElementById('codeInput').value.trim().toUpperCase();
  var err = document.getElementById('linkError');
  err.textContent = '';
  if (code.length !== 10) { err.textContent = 'Код должен содержать 10 символов.'; return; }
  api('link', { code: code }).then(function (res) {
    if (res.success && res.linked) {
      haptic('medium');
      hide('linkScreen');
      show('loading');
      boot();
    } else {
      err.textContent = res.error || 'Неверный или просроченный код.';
      haptic('rigid');
    }
  });
}

function renderStatusPill() {
  var pill = document.getElementById('statusPill');
  var active = me.subscription && me.subscription.active;
  pill.className = 'pill ' + (active ? 'ok' : 'bad');
  pill.textContent = (active ? '🟢 ' : '🔴 ') + esc(me.username);
}

var loaded = {};

function switchTab(name) {
  haptic('light');
  ['profile', 'sub', 'devices', 'ach', 'pay', 'notif', 'admin'].forEach(function (t) {
    document.getElementById('tab-' + t).classList.toggle('hidden', t !== name);
  });
  document.querySelectorAll('.tab').forEach(function (btn) {
    btn.classList.toggle('active', btn.getAttribute('data-tab') === name);
  });
  if (!loaded[name]) {
    loaded[name] = true;
    if (name === 'profile') renderProfile();
    if (name === 'sub') renderSub();
    if (name === 'devices') renderDevices();
    if (name === 'ach') renderAch();
    if (name === 'pay') renderPay();
    if (name === 'notif') renderNotif();
    if (name === 'admin') renderAdmin();
  }
  updateMainButton(name);
}

function updateMainButton(name) {
  if (!tg || !tg.MainButton) return;
  tg.MainButton.offClick(mainButtonClick);
  if (name === 'sub' || name === 'pay') {
    tg.MainButton.setText('💳 Продлить подписку');
    tg.MainButton.onClick(mainButtonClick);
    tg.MainButton.show();
  } else {
    tg.MainButton.hide();
  }
}
function mainButtonClick() {
  if (tg.openLink) tg.openLink(SUBSCRIBE_URL); else window.open(SUBSCRIBE_URL, '_blank');
}

function renderProfile() {
  var lvl = me.level || { icon: '🌱', title: '—' };
  document.getElementById('tab-profile').innerHTML =
    '<div class="card"><h3>Профиль</h3>' +
    row('Логин', '<b>' + esc(me.username) + '</b>') +
    row('ID', '<code>' + esc(me.id) + '</code>') +
    row('Регистрация', esc(me.created_text)) +
    row('Статус', me.status === 'active' ? '🟢 активен' : '🔴 не активен') +
    row('Уровень', lvl.icon + ' ' + esc(lvl.title)) +
    '</div>' +
    '<div class="card"><h3>Приложение</h3><p class="muted">Мобильное приложение QMods — быстрый доступ к модификациям с телефона.</p>' +
    '<button class="btn primary" onclick="openApp()">⬇️ Скачать APK</button></div>' +
    '<div id="reviewCard"></div>';
  renderReview();
}

function openApp() {
  api('app_release', {}).then(function (res) {
    var url = (res && (res.download_url || res.cabinet_url)) || SUBSCRIBE_URL;
    if (tg && tg.openLink) tg.openLink(url); else window.open(url, '_blank');
  });
}

function renderReview() {
  var el = document.getElementById('reviewCard');
  el.innerHTML = '<div class="card"><h3>Отзыв</h3><div class="skeleton"></div></div>';
  api('review', {}).then(function (res) {
    if (res && res.review) {
      var stars = '';
      for (var i = 1; i <= 5; i++) stars += (i <= res.review.rating ? '★' : '☆');
      el.innerHTML = '<div class="card"><h3>Ваш отзыв</h3><p>' + stars + '</p><p class="muted">' + esc(res.review.text) + '</p>' +
        '<p class="muted">' + (res.review.status === 'approved' ? '✅ опубликован' : '⏳ на модерации') + '</p></div>';
      return;
    }
    var starsHtml = '<div class="stars" id="starPicker">';
    for (var s = 1; s <= 5; s++) starsHtml += '<button type="button" data-star="' + s + '" onclick="pickStar(' + s + ')">★</button>';
    starsHtml += '</div>';
    el.innerHTML = '<div class="card"><h3>Оставить отзыв</h3><p class="muted">Поделитесь впечатлением о QMods.</p>' +
      starsHtml +
      '<textarea id="reviewText" rows="3" placeholder="Что думаете о QMods?"></textarea>' +
      '<button class="btn primary" onclick="submitReview()">Отправить</button></div>';
    window.__reviewRating = 0;
  });
}

function pickStar(n) {
  window.__reviewRating = n;
  document.querySelectorAll('#starPicker button').forEach(function (btn) {
    btn.classList.toggle('on', Number(btn.getAttribute('data-star')) <= n);
  });
}

function submitReview() {
  var rating = window.__reviewRating || 0;
  var text = document.getElementById('reviewText').value.trim();
  if (rating < 1) { alert('Выберите оценку.'); return; }
  if (text.length < 10) { alert('Текст отзыва — минимум 10 символов.'); return; }
  api('review_add', { rating: rating, text: text }).then(function (res) {
    if (res && res.success) { haptic('medium'); renderReview(); }
    else alert((res && res.error) || 'Не удалось отправить отзыв.');
  });
}

function renderSub() {
  var s = me.subscription;
  var html = '<div class="card"><h3>Подписка</h3>';
  if (!s.plan || s.plan === 'none') {
    html += '<p class="muted">Подписка не активна.</p>';
  } else {
    html += row('Тариф', '<b>' + esc(s.plan) + '</b>') +
      row('Статус', s.active ? '🟢 активна' : '🔴 истекла') +
      row('Окончание', esc(s.expires_text));
    if (s.active) html += row('Осталось', s.days_left + ' дн.');
  }
  html += '</div>';
  document.getElementById('tab-sub').innerHTML = html;
}

function renderDevices() {
  var el = document.getElementById('tab-devices');
  el.innerHTML = '<div class="skeleton"></div>';
  api('devices', {}).then(function (res) {
    var devices = (res && res.devices) || [];
    if (devices.length === 0) {
      el.innerHTML = '<div class="card"><h3>Устройства</h3><p class="muted">Устройство ещё не привязано.</p></div>';
      return;
    }
    var d = devices[0];
    el.innerHTML = '<div class="card"><h3>Устройство</h3>' +
      row('ID', '<code>' + esc(d.id_short) + '</code>') +
      row('Android', esc(d.android_version || 'неизвестно')) +
      '<button class="btn danger" onclick="removeDevice(\\'' + esc(d.id) + '\\')">🗑 Отвязать устройство</button>' +
      '</div>';
  });
}
function removeDevice(id) {
  if (!confirm('Отвязать устройство?')) return;
  api('device_remove', { device_id: id }).then(function () { loaded.devices = false; switchTab('devices'); });
}

function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).then(function () { haptic('light'); alert('Скопировано'); });
  } else {
    prompt('Скопируйте:', text);
  }
}

function renderAch() {
  var el = document.getElementById('tab-ach');
  el.innerHTML = '<div class="skeleton"></div><div class="skeleton"></div>';
  Promise.all([api('achievements', {}), api('referrals', {})]).then(function (results) {
    var a = results[0], r = results[1];
    if (!a || !a.success) { el.innerHTML = '<div class="card"><p class="muted">Не удалось загрузить.</p></div>'; return; }

    var progressText = a.progress.next_code
      ? (a.progress.closest ? (a.progress.closest.current + '/' + a.progress.closest.min + ' ' + esc(a.progress.closest.label)) : (a.progress.percent + '%')) + ' → ' + esc(a.progress.next_title || '')
      : 'Максимальный уровень достигнут';

    var html = '<div class="card"><h3>Уровень</h3>' +
      '<div class="big-stat">' + a.level.icon + ' ' + esc(a.level.title) + '</div>' +
      '<p class="muted">' + esc(a.level.perks) + '</p>' +
      '<div class="bar"><span style="width:' + a.progress.percent + '%"></span></div>' +
      '<p class="muted">' + progressText + '</p></div>';

    html += '<div class="card"><h3>Достижения ' + a.achievements.filter(function (x) { return x.earned; }).length + '/' + a.achievements.length + '</h3><div class="ach-grid">';
    a.achievements.forEach(function (item) {
      html += '<div class="ach-item' + (item.earned ? '' : ' locked') + '" title="' + esc(item.desc) + '">' +
        '<div class="ic">' + item.icon + '</div><div class="t">' + esc(item.title) + '</div></div>';
    });
    html += '</div></div>';

    if (r && r.success) {
      html += '<div class="card"><h3>Рефералы</h3><p class="muted">Приглашено: <b>' + r.ref_count + '</b></p>' +
        '<p class="muted">Достижения и бонусные дни за друзей начисляются автоматически.</p>' +
        '<div class="copy-row"><code>' + esc(r.ref_link) + '</code><button onclick="copyText(\\'' + esc(r.ref_link) + '\\')">Копия</button></div></div>';
    }

    el.innerHTML = html;
  });
}

function renderPay() {
  var payments = me.payments || [];
  var html = '<div class="card"><h3>История платежей</h3>';
  if (payments.length === 0) {
    html += '<p class="muted">Платежей пока не было.</p>';
  } else {
    payments.slice(0, 10).forEach(function (p) {
      html += row(esc(p.date_text), esc(p.plan) + ' · ' + p.amount + ' ₽');
    });
  }
  html += '<a class="btn primary" href="' + SUBSCRIBE_URL + '" target="_blank">💳 Продлить подписку</a></div>';
  document.getElementById('tab-pay').innerHTML = html;
}

function renderNotif() {
  var el = document.getElementById('tab-notif');
  el.innerHTML = '<div class="skeleton"></div>';
  api('notifications', {}).then(function (res) {
    var items = (res && res.notifications) || [];
    if (items.length === 0) {
      el.innerHTML = '<div class="card"><h3>Уведомления</h3><p class="muted">Уведомлений пока нет.</p></div>';
      return;
    }
    var html = '<div class="card"><h3>Уведомления</h3>';
    items.forEach(function (n) {
      html += '<div class="notif"><div class="t">' + (n.unread ? '<span class="dot"></span>' : '') + esc(n.title) + '</div>' +
        '<div class="m">' + esc(n.message) + '</div></div>';
    });
    html += '<button class="btn" onclick="markAllRead()">✅ Отметить всё прочитанным</button></div>';
    el.innerHTML = html;
    var unreadIds = items.filter(function (n) { return n.unread; }).map(function (n) { return n.id; });
    if (unreadIds.length) api('notifications_ack', { ids: unreadIds });
  });
}
function markAllRead() { loaded.notif = false; switchTab('notif'); }

var adminUsers = [];

function renderAdmin() {
  var el = document.getElementById('tab-admin');
  el.innerHTML = '<div class="skeleton"></div><div class="skeleton"></div>';
  Promise.all([api('admin_stats', {}), api('admin_users', {})]).then(function (results) {
    var sRes = results[0], uRes = results[1];
    var stats = (sRes && sRes.stats) || {};
    adminUsers = (uRes && uRes.users) || [];

    var html = '<div class="card"><h3>Статистика</h3><div class="stat-grid">' +
      statTile(stats.total, 'всего') +
      statTile(stats.active, 'активных') +
      statTile(stats.expiring, 'истекают') +
      statTile(stats.telegram_linked, 'в Telegram') +
      statTile(Math.round(stats.revenue || 0) + ' ₽', 'выручка') +
      statTile(stats.payment_count, 'платежей') +
      '</div>' + buildChart(stats.series || []) + '</div>';

    html += '<div class="card"><h3>Пользователи (' + adminUsers.length + ')</h3>' +
      '<input type="search" id="userSearch" placeholder="Поиск по нику…" oninput="filterUsers()">' +
      '<div class="user-list" id="userList"></div></div>';

    html += '<div id="userDetail"></div>';

    html += '<div class="card"><h3>Рассылка всем</h3>' +
      '<input type="text" id="bcTitle" placeholder="Заголовок">' +
      '<textarea id="bcText" rows="3" placeholder="Текст рассылки"></textarea>' +
      '<button class="btn primary" onclick="sendBroadcast()">📣 Отправить всем привязанным</button></div>';

    el.innerHTML = html;
    renderUserList(adminUsers);
  });
}

function statTile(value, label) {
  return '<div class="stat-tile"><b>' + (value == null ? 0 : value) + '</b><small>' + label + '</small></div>';
}

function buildChart(series) {
  var last = series.slice(-14);
  if (!last.length) return '';
  var max = 1;
  last.forEach(function (d) { if (d.revenue > max) max = d.revenue; });
  var bars = last.map(function (d) {
    var h = Math.max(2, Math.round((d.revenue / max) * 60));
    return '<div class="chart-bar" style="height:' + h + 'px" title="' + esc(d.label) + ': ' + Math.round(d.revenue) + ' ₽"></div>';
  }).join('');
  return '<div class="chart">' + bars + '</div><p class="muted" style="margin-top:4px">Выручка, последние 14 дней</p>';
}

function renderUserList(list) {
  var el = document.getElementById('userList');
  if (!list.length) { el.innerHTML = '<p class="muted">Никого не найдено.</p>'; return; }
  el.innerHTML = list.slice(0, 100).map(function (u) {
    return '<button class="user-row" onclick="selectAdminUser(\\'' + esc(u.username) + '\\')">' +
      '<span>' + (u.active ? '🟢' : '🔴') + ' ' + esc(u.username) + '</span>' +
      '<span class="muted">' + (u.active ? u.days_left + 'д' : '') + '</span></button>';
  }).join('');
}

function filterUsers() {
  var q = document.getElementById('userSearch').value.trim().toLowerCase();
  var filtered = q ? adminUsers.filter(function (u) { return u.username.toLowerCase().indexOf(q) !== -1; }) : adminUsers;
  renderUserList(filtered);
}

function selectAdminUser(username) {
  haptic('light');
  var el = document.getElementById('userDetail');
  el.innerHTML = '<div class="card"><div class="skeleton"></div></div>';
  api('admin_user', { username: username }).then(function (res) {
    if (!res.success || !res.found) { el.innerHTML = '<div class="card"><p class="muted">Не найден.</p></div>'; return; }
    renderUserDetail(res.user);
  });
}

function renderUserDetail(u) {
  var el = document.getElementById('userDetail');
  var html = '<div class="card"><h3>' + esc(u.username) + '</h3>' +
    row('ID', '<code>' + esc(u.id) + '</code>') +
    row('Telegram', u.telegram_id ? '<code>' + esc(u.telegram_id) + '</code>' : 'не привязан') +
    row('Устройство', u.device_id ? '✅' : '—') +
    row('Тариф', esc(u.subscription.plan) + ' (' + (u.subscription.active ? '🟢' : '🔴') + ')') +
    row('Окончание', esc(u.subscription.expires_text));

  if (u.payments && u.payments.length) {
    html += '<p class="muted" style="margin-top:8px"><b>Платежи:</b></p>';
    u.payments.slice(0, 5).forEach(function (p) {
      html += row(esc(p.date_text), esc(p.plan) + ' · ' + p.amount + ' ₽');
    });
  }

  html += '<div class="admin-form">' +
    '<input type="number" id="issueDays" placeholder="Дней продлить" min="1" max="3650">' +
    '<button class="btn primary" onclick="adminIssue(\\'' + esc(u.username) + '\\')">➕ Продлить подписку</button>' +
    '</div>' +
    '<div class="admin-form">' +
    '<textarea id="msgText" rows="2" placeholder="Сообщение пользователю"></textarea>' +
    '<button class="btn" onclick="adminMessage(\\'' + esc(u.username) + '\\')">📨 Написать</button>' +
    '</div>' +
    '<div class="admin-form">' +
    '<button class="btn" onclick="adminRemove(\\'' + esc(u.username) + '\\')">🚫 Снять подписку</button>' +
    '<button class="btn danger" onclick="adminDelete(\\'' + esc(u.username) + '\\')">🗑 Удалить аккаунт</button>' +
    '</div>' +
    '<p id="adminMsg" class="muted"></p>' +
    '</div>';
  el.innerHTML = html;
}

function adminIssue(username) {
  var days = Number(document.getElementById('issueDays').value || 0);
  if (days < 1) { alert('Укажите число дней.'); return; }
  api('admin_issue', { username: username, days: days }).then(function (res) {
    showAdminResult(res);
    if (res.success) selectAdminUser(username);
  });
}

function adminRemove(username) {
  if (!confirm('Снять подписку с ' + username + '?')) return;
  api('admin_remove', { username: username }).then(function (res) {
    showAdminResult(res);
    if (res.success) selectAdminUser(username);
  });
}

function adminDelete(username) {
  if (!confirm('Полностью удалить аккаунт ' + username + '? Действие необратимо.')) return;
  api('admin_delete_user', { username: username }).then(function (res) {
    if (!res.success) { alert(res.error || 'Ошибка'); return; }
    haptic('medium');
    document.getElementById('userDetail').innerHTML = '';
    loaded.admin = false;
    switchTab('admin');
  });
}

function adminMessage(username) {
  var text = document.getElementById('msgText').value.trim();
  if (text.length < 2) { alert('Введите текст сообщения.'); return; }
  api('admin_send_notification', { title: '📨 Сообщение от администрации', message: text, target: username }).then(function (res) {
    showAdminResult(res);
  });
}

function showAdminResult(res) {
  haptic(res.success ? 'medium' : 'rigid');
  var el = document.getElementById('adminMsg');
  if (el) el.textContent = res.success ? '✅ Готово' : '❌ ' + (res.error || 'Ошибка');
}

function sendBroadcast() {
  var title = document.getElementById('bcTitle').value.trim();
  var text = document.getElementById('bcText').value.trim();
  if (!title || text.length < 2) { alert('Заполните заголовок и текст.'); return; }
  api('admin_send_notification', { title: title, message: text }).then(function (res) {
    if (res.success) {
      alert('Рассылка отправлена.');
      document.getElementById('bcTitle').value = '';
      document.getElementById('bcText').value = '';
    } else {
      alert(res.error || 'Ошибка');
    }
  });
}

function row(k, v) {
  return '<div class="row"><span class="k">' + k + '</span><span class="v">' + v + '</span></div>';
}

boot();
</script>
</body>
</html>`;
