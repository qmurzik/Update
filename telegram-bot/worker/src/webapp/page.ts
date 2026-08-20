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
    <div id="tab-pay" class="tabpanel hidden"></div>
    <div id="tab-notif" class="tabpanel hidden"></div>
  </div>

  <div class="tabs">
    <button class="tab active" data-tab="profile" onclick="switchTab('profile')"><span class="ic">👤</span>Профиль</button>
    <button class="tab" data-tab="sub" onclick="switchTab('sub')"><span class="ic">⭐</span>Подписка</button>
    <button class="tab" data-tab="devices" onclick="switchTab('devices')"><span class="ic">📱</span>Устройства</button>
    <button class="tab" data-tab="pay" onclick="switchTab('pay')"><span class="ic">💳</span>Оплата</button>
    <button class="tab" data-tab="notif" onclick="switchTab('notif')"><span class="ic">🔔</span>Увед.</button>
  </div>
</div>

<script>
var tg = window.Telegram && window.Telegram.WebApp;
if (tg) { tg.ready(); tg.expand(); }
var initData = tg ? tg.initData : '';
var SUBSCRIBE_URL = '__SUBSCRIBE_URL__';
var me = null;

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
  ['profile', 'sub', 'devices', 'pay', 'notif'].forEach(function (t) {
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
    if (name === 'pay') renderPay();
    if (name === 'notif') renderNotif();
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
  document.getElementById('tab-profile').innerHTML =
    '<div class="card"><h3>Профиль</h3>' +
    row('Логин', '<b>' + esc(me.username) + '</b>') +
    row('ID', '<code>' + esc(me.id) + '</code>') +
    row('Регистрация', esc(me.created_text)) +
    row('Статус', me.status === 'active' ? '🟢 активен' : '🔴 не активен') +
    '</div>';
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

function row(k, v) {
  return '<div class="row"><span class="k">' + k + '</span><span class="v">' + v + '</span></div>';
}

boot();
</script>
</body>
</html>`;
