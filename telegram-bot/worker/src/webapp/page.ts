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
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Unbounded:wght@600;700;800&display=swap" rel="stylesheet">
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
    --accent2: #7c3aed;
    --success: #22c55e;
    --danger: #ef4444;
    --card: rgba(255,255,255,.05);
    --card-border: rgba(255,255,255,.09);
  }
  * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
  html, body { margin: 0; padding: 0; }
  body {
    background: var(--bg);
    color: var(--text);
    font-family: 'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    padding-bottom: 96px;
    min-height: 100vh;
  }
  body.light-theme { --card: rgba(0,0,0,.03); --card-border: rgba(0,0,0,.08); }
  .bg-glow {
    position: fixed; inset: 0; z-index: -1; pointer-events: none;
    background:
      radial-gradient(480px circle at 10% -8%, rgba(124,58,237,.32), transparent 60%),
      radial-gradient(420px circle at 108% 12%, rgba(49,87,255,.26), transparent 55%),
      radial-gradient(560px circle at 45% 115%, rgba(124,58,237,.20), transparent 60%);
  }
  body.light-theme .bg-glow { opacity: .1; }
  a { color: var(--link); }
  .hero-card {
    display: flex; align-items: center; gap: 12px;
    margin: 14px 16px 6px; padding: 12px 14px;
    background: linear-gradient(135deg, rgba(124,58,237,.16), rgba(49,87,255,.10));
    border: 1px solid rgba(255,255,255,.14);
    border-radius: 20px;
    backdrop-filter: blur(16px);
    box-shadow: 0 10px 26px rgba(0,0,0,.22);
  }
  body.light-theme .hero-card { background: linear-gradient(135deg, rgba(124,58,237,.09), rgba(49,87,255,.06)); border-color: rgba(0,0,0,.08); box-shadow: 0 8px 20px rgba(0,0,0,.08); }
  .hero-avatar { width: 46px; height: 46px; border-radius: 14px; object-fit: cover; flex: none; border: 2px solid rgba(255,255,255,.25); box-shadow: 0 4px 16px rgba(124,58,237,.45); }
  .hero-info { flex: 1; min-width: 0; }
  .hero-brand { font-family: 'Unbounded', sans-serif; font-size: 15px; font-weight: 700; letter-spacing: -.01em; margin-bottom: 4px; }
  .hero-brand em { font-style: normal; background: linear-gradient(135deg, #c4b5fd, #93c5fd); -webkit-background-clip: text; background-clip: text; color: transparent; }
  .pill {
    display: inline-flex; align-items: center; gap: 5px;
    padding: 4px 10px; border-radius: 999px; font-size: 12px; font-weight: 700;
    background: rgba(255,255,255,.08); border: 1px solid var(--card-border);
  }
  body.light-theme .pill { background: rgba(0,0,0,.04); }
  .pill.ok { color: var(--success); }
  .pill.bad { color: var(--danger); }
  .content { padding: 10px 16px 16px; }
  .card {
    background: linear-gradient(180deg, rgba(255,255,255,.055), rgba(255,255,255,.018));
    border: 1px solid var(--card-border);
    border-radius: 20px; padding: 16px; margin-bottom: 12px;
    backdrop-filter: blur(14px);
    box-shadow: 0 10px 28px rgba(0,0,0,.16);
    animation: cardIn .35s cubic-bezier(.2,.8,.2,1) both;
  }
  body.light-theme .card { background: linear-gradient(180deg, rgba(0,0,0,.025), rgba(0,0,0,.008)); box-shadow: 0 6px 18px rgba(0,0,0,.06); }
  @keyframes cardIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
  .card h3 { margin: 0 0 12px; font-size: 12px; color: var(--hint); font-weight: 700; text-transform: uppercase; letter-spacing: .07em; }
  .row { display: flex; justify-content: space-between; align-items: center; padding: 9px 0; border-bottom: 1px solid var(--card-border); font-size: 14px; }
  .row:last-child { border-bottom: none; }
  .row .k { color: var(--hint); }
  .row .v { font-weight: 700; text-align: right; }
  .big-stat { font-family: 'Unbounded', sans-serif; font-size: 24px; font-weight: 700; margin: 2px 0 6px; }
  .muted { color: var(--hint); font-size: 13px; line-height: 1.5; }
  .btn {
    display: block; width: 100%; text-align: center; padding: 13px; border-radius: 14px;
    border: 1px solid var(--card-border); font-weight: 700; font-size: 14px; cursor: pointer; margin-top: 10px;
    background: rgba(255,255,255,.05); color: var(--text);
    transition: transform .12s ease;
  }
  body.light-theme .btn { background: rgba(0,0,0,.03); }
  .btn:active { transform: scale(.97); }
  .btn.primary { background: linear-gradient(135deg, var(--accent), var(--accent2)); color: #fff; border: none; box-shadow: 0 8px 22px rgba(49,87,255,.35); }
  .btn.danger { background: rgba(239,68,68,.12); color: var(--danger); border-color: rgba(239,68,68,.3); }
  input[type=text] {
    width: 100%; padding: 12px 14px; border-radius: 14px; border: 1px solid var(--card-border);
    background: var(--bg2); color: var(--text); font-size: 16px; letter-spacing: .08em; text-align: center;
    text-transform: uppercase;
  }
  input:focus, textarea:focus, input[type=search]:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px rgba(49,87,255,.18); }
  .skeleton { background: linear-gradient(90deg, var(--card) 25%, rgba(255,255,255,.12) 37%, var(--card) 63%); background-size: 400% 100%; animation: sk 1.4s ease infinite; border-radius: 8px; height: 14px; margin: 6px 0; }
  @keyframes sk { 0% { background-position: 100% 50%; } 100% { background-position: 0 50%; } }
  .tabs {
    position: fixed; left: 10px; right: 10px; bottom: 10px;
    display: flex; gap: 2px;
    background: rgba(16,22,42,.82);
    border: 1px solid rgba(255,255,255,.1);
    border-radius: 22px; padding: 6px;
    backdrop-filter: blur(20px);
    box-shadow: 0 14px 36px rgba(0,0,0,.4);
    padding-bottom: calc(6px + env(safe-area-inset-bottom));
  }
  body.light-theme .tabs { background: rgba(255,255,255,.88); border-color: rgba(0,0,0,.08); box-shadow: 0 10px 26px rgba(0,0,0,.14); }
  .tab {
    flex: 1; display: flex; flex-direction: column; align-items: center; gap: 3px;
    padding: 8px 2px; border-radius: 15px; color: var(--hint); font-size: 9.5px; font-weight: 700;
    background: none; border: none; cursor: pointer; transition: background .15s, color .15s, transform .1s;
  }
  .tab:active { transform: scale(.93); }
  .tab svg { width: 19px; height: 19px; display: block; }
  .tab.active { color: #fff; background: linear-gradient(135deg, var(--accent), var(--accent2)); box-shadow: 0 6px 16px rgba(124,58,237,.45); }
  .notif { padding: 10px 0; border-bottom: 1px solid var(--card-border); }
  .notif:last-child { border-bottom: none; }
  .notif .t { font-weight: 700; font-size: 14px; display: flex; align-items: center; gap: 6px; }
  .notif .m { font-size: 13px; color: var(--hint); margin-top: 2px; }
  .notif .d { font-size: 11px; color: var(--hint); margin-top: 4px; }
  .dot { width: 7px; height: 7px; border-radius: 50%; background: linear-gradient(135deg, var(--accent), var(--accent2)); flex: none; box-shadow: 0 0 6px rgba(124,58,237,.7); }
  .center-screen { min-height: 70vh; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 24px; }
  .hidden { display: none !important; }
  .bar { height: 10px; border-radius: 999px; background: rgba(255,255,255,.08); overflow: hidden; margin: 12px 0 6px; }
  body.light-theme .bar { background: rgba(0,0,0,.06); }
  .bar > span { display: block; height: 100%; background: linear-gradient(90deg, var(--accent), var(--accent2)); box-shadow: 0 0 12px rgba(124,58,237,.55); transition: width .6s cubic-bezier(.2,.8,.2,1); }
  .ach-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 4px; }
  .ach-item { text-align: center; padding: 12px 4px; border-radius: 16px; background: rgba(255,255,255,.035); border: 1px solid var(--card-border); }
  .ach-item.earned { background: linear-gradient(160deg, rgba(124,58,237,.22), rgba(49,87,255,.1)); border-color: rgba(124,58,237,.4); box-shadow: 0 6px 18px rgba(124,58,237,.18); }
  .ach-item.locked { opacity: .3; filter: grayscale(1); }
  .ach-item .ic { font-size: 22px; }
  .ach-item .t { font-size: 10px; margin-top: 4px; font-weight: 700; line-height: 1.25; }
  .stars { display: flex; gap: 6px; justify-content: center; margin: 8px 0; }
  .stars button { font-size: 28px; background: none; border: none; cursor: pointer; opacity: .28; padding: 2px; transition: opacity .15s, transform .15s; }
  .stars button.on { opacity: 1; transform: scale(1.08); filter: drop-shadow(0 2px 8px rgba(124,58,237,.6)); }
  textarea { width: 100%; padding: 10px 12px; border-radius: 14px; border: 1px solid var(--card-border); background: var(--bg2); color: var(--text); font-size: 14px; font-family: inherit; resize: vertical; }
  .copy-row { display: flex; gap: 8px; align-items: center; background: var(--bg2); border-radius: 12px; padding: 9px 10px; margin-top: 6px; border: 1px solid var(--card-border); }
  .copy-row code { flex: 1; font-size: 12px; word-break: break-all; }
  .copy-row button { flex: none; background: linear-gradient(135deg, var(--accent), var(--accent2)); border: none; color: #fff; border-radius: 9px; padding: 7px 11px; font-size: 12px; font-weight: 700; cursor: pointer; }
  .stat-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 4px; }
  .stat-tile { background: var(--bg2); border-radius: 14px; padding: 10px 8px; text-align: center; border: 1px solid var(--card-border); }
  .stat-tile b { display: block; font-size: 17px; font-weight: 800; }
  .stat-tile small { color: var(--hint); font-size: 10px; }
  .chart { display: flex; align-items: flex-end; gap: 3px; height: 60px; margin-top: 10px; }
  .chart-bar { flex: 1; background: linear-gradient(180deg, var(--accent), var(--accent2)); border-radius: 4px 4px 0 0; min-height: 2px; box-shadow: 0 0 10px rgba(124,58,237,.35); }
  input[type=search] {
    width: 100%; padding: 10px 12px; border-radius: 12px; border: 1px solid var(--card-border);
    background: var(--bg2); color: var(--text); font-size: 14px; margin-bottom: 8px;
  }
  .user-row {
    display: flex; justify-content: space-between; align-items: center; width: 100%;
    padding: 11px 6px; border-bottom: 1px solid var(--card-border); background: none; border-left: none; border-right: none; border-top: none;
    color: var(--text); font-size: 13px; text-align: left; cursor: pointer; border-radius: 10px; transition: background .12s;
  }
  .user-row:active { background: rgba(255,255,255,.05); }
  .user-row:last-child { border-bottom: none; }
  .user-list { max-height: 320px; overflow-y: auto; }
  .admin-form { margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--card-border); }
  .admin-form input[type=text], .admin-form input[type=number] {
    width: 100%; padding: 10px 12px; border-radius: 12px; border: 1px solid var(--card-border);
    background: var(--bg2); color: var(--text); font-size: 14px; margin-bottom: 8px;
  }
  .mascot { width: 190px; max-width: 62vw; margin-bottom: 14px; filter: drop-shadow(0 14px 32px rgba(124,58,237,.45)); }
  .mascot-sm { width: 120px; max-width: 44vw; margin: 4px auto 10px; display: block; opacity: .92; filter: drop-shadow(0 8px 20px rgba(124,58,237,.3)); }
</style>
</head>
<body>
<div class="bg-glow"></div>

<div id="loading" class="center-screen">
  <img class="mascot" src="__KIRA_LOADING__" alt="Кира" onerror="this.style.display='none'">
  <div class="skeleton" style="width:120px;height:20px"></div>
</div>

<div id="linkScreen" class="center-screen hidden">
  <img class="mascot" src="__KIRA_HERO__" alt="Кира" onerror="this.style.display='none'">
  <div class="logo" style="font-size:20px;margin-bottom:6px">Привет, я Кира 🖤</div>
  <p class="muted" style="max-width:280px">Аккаунт ещё не привязан. Введите одноразовый код из личного кабинета qmods.ru/mod.</p>
  <input type="text" id="codeInput" maxlength="10" placeholder="ХХХХХХХХХХ" style="max-width:220px;margin-top:14px">
  <button class="btn primary" style="max-width:220px" onclick="doLink()">Привязать</button>
  <p id="linkError" class="muted" style="color:var(--danger)"></p>
</div>

<div id="app" class="hidden">
  <div class="hero-card">
    <img class="hero-avatar" src="__KIRA_HERO__" alt="Кира" onerror="this.style.display='none'">
    <div class="hero-info">
      <div class="hero-brand"><em>Кира</em> · QMods</div>
      <span id="statusPill" class="pill">…</span>
    </div>
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
    <button class="tab active" data-tab="profile" onclick="switchTab('profile')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"></circle><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"></path></svg>Профиль</button>
    <button class="tab" data-tab="sub" onclick="switchTab('sub')"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7-6.2-3.8L5.8 21l1.6-7-5.4-4.7 7.1-.6z"></path></svg>Подписка</button>
    <button class="tab" data-tab="devices" onclick="switchTab('devices')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="2" width="12" height="20" rx="2.5"></rect><path d="M11 18h2"></path></svg>Устройства</button>
    <button class="tab" data-tab="ach" onclick="switchTab('ach')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 21h8M12 17v4M7 4h10v4a5 5 0 0 1-10 0V4z"></path><path d="M7 5H4a1 1 0 0 0-1 1c0 2.5 1.6 4.5 4 4.9M17 5h3a1 1 0 0 1 1 1c0 2.5-1.6 4.5-4 4.9"></path></svg>Награды</button>
    <button class="tab" data-tab="pay" onclick="switchTab('pay')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="5" width="19" height="14" rx="2.5"></rect><path d="M2.5 9.5h19"></path></svg>Оплата</button>
    <button class="tab" data-tab="notif" onclick="switchTab('notif')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.7 21a2 2 0 0 1-3.4 0"></path></svg>Увед.</button>
    <button class="tab hidden" data-tab="admin" id="adminTabBtn" onclick="switchTab('admin')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l8 3.5v6c0 5-3.4 8.6-8 10.5-4.6-1.9-8-5.5-8-10.5v-6z"></path></svg>Админ</button>
  </div>
</div>

<script>
var tg = window.Telegram && window.Telegram.WebApp;
if (tg) { tg.ready(); tg.expand(); }
if (tg && tg.colorScheme === 'light') document.body.classList.add('light-theme');
if (tg && tg.onEvent) tg.onEvent('themeChanged', function () {
  document.body.classList.toggle('light-theme', tg.colorScheme === 'light');
});
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
      el.innerHTML = '<div class="card" style="text-align:center">' +
        '<img class="mascot-sm" src="__KIRA_EMPTY__" alt="" onerror="this.style.display=\\'none\\'">' +
        '<h3>Устройства</h3><p class="muted">Устройство ещё не привязано.</p></div>';
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
