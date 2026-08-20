<?php
declare(strict_types=1);

require __DIR__ . '/includes/bootstrap.php';

$shareFile = DATA_DIR . '/download_link.json';
$releaseFile = DATA_DIR . '/app_release.json';
$share = trim((string)($_GET['share'] ?? ''));
$linkData = is_file($shareFile) ? json_decode((string)file_get_contents($shareFile), true) : null;

if ($share === '' || !is_array($linkData) || empty($linkData['enabled']) || empty($linkData['token']) || !hash_equals((string)$linkData['token'], $share)) {
    http_response_code(404);
    ?><!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Ссылка недействительна — QMods</title><style>body{margin:0;font-family:Inter,Arial,sans-serif;background:#f7f7fb;color:#171725;display:grid;place-items:center;min-height:100vh}.box{max-width:460px;margin:24px;padding:32px;background:#fff;border:1px solid #e9e9f2;border-radius:24px;text-align:center;box-shadow:0 18px 60px #20204012}h1{margin:0 0 10px}p{color:#68687a;line-height:1.6}a{display:inline-block;margin-top:12px;padding:13px 20px;border-radius:12px;background:#6366f1;color:#fff;text-decoration:none;font-weight:700}</style></head><body><div class="box"><div style="font-size:44px">🔗</div><h1>Ссылка недействительна</h1><p>Публичная ссылка на приложение была отключена или заменена новой.</p><a href="index.php">Перейти на QMods</a></div></body></html><?php
    exit;
}

$release = is_file($releaseFile) ? json_decode((string)file_get_contents($releaseFile), true) : [];
$apk = APP_ROOT . '/downloads/app.apk';
if (!is_file($apk) || filesize($apk) <= 0) {
    http_response_code(404);
    exit('Приложение временно недоступно');
}

$version = trim((string)($release['version'] ?? '')) ?: 'Последняя версия';
$changelog = trim((string)($release['changelog'] ?? ''));
$changes = preg_split('/\R/u', $changelog, -1, PREG_SPLIT_NO_EMPTY) ?: [];
$updated = !empty($release['updated_at']) ? date('d.m.Y', (int)$release['updated_at']) : '';
$downloadUrl = 'download.php?share=' . rawurlencode($share);
$currentUrl = (function (): string {
    $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (($_SERVER['SERVER_PORT'] ?? '') === '443');
    return ($https ? 'https' : 'http') . '://' . ($_SERVER['HTTP_HOST'] ?? 'localhost') . ($_SERVER['REQUEST_URI'] ?? '/app.php');
})();
?>
<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#05060f">
<meta name="color-scheme" content="dark">
<meta name="description" content="Официальная страница загрузки приложения QMods. Версия <?= e($version) ?>.">
<meta property="og:type" content="website">
<meta property="og:title" content="QMods — скачать приложение">
<meta property="og:description" content="Скачайте официальное приложение QMods. Версия <?= e($version) ?>.">
<meta property="og:url" content="<?= e($currentUrl) ?>">
<meta property="og:image" content="<?= e((preg_replace('/\?.*$/', '', $currentUrl) ?: '') . 'assets/icon-512.png') ?>">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="QMods — скачать приложение">
<meta name="twitter:description" content="Официальная страница загрузки приложения QMods.">
<link rel="icon" href="assets/icon-192.png">
<title>QMods — скачать приложение</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="assets/style.css?v=aurora-1">
<style>
.apk-wrap{width:min(1080px,calc(100% - 32px));margin:0 auto;padding:26px 0 60px;position:relative;z-index:1}
.apk-nav{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:54px}
.apk-brand{display:flex;align-items:center;gap:12px;font:800 21px var(--display);letter-spacing:-.04em}
.apk-brand img{width:42px;height:42px;border-radius:14px;box-shadow:0 10px 26px rgba(124,92,255,.4)}
.apk-hero{display:grid;grid-template-columns:1.1fr .9fr;gap:48px;align-items:center}
.apk-hero h1{font-size:clamp(42px,7.6vw,78px);line-height:.96;letter-spacing:-.055em;margin:20px 0 18px}
.apk-hero h1 em{font-style:normal;background:var(--grad-main);background-size:220% auto;-webkit-background-clip:text;background-clip:text;color:transparent;animation:gradientShift 7s ease infinite}
.apk-lead{color:var(--muted);font-size:17px;line-height:1.65;max-width:520px}
.apk-actions{display:flex;gap:12px;flex-wrap:wrap;margin-top:28px}
.apk-meta{display:flex;gap:9px;flex-wrap:wrap;margin-top:24px}
.apk-phone{position:relative;justify-self:center;width:min(100%,300px);aspect-ratio:.5;border-radius:44px;padding:11px;
  background:linear-gradient(160deg,#1a1c34,#0b0c18);border:1px solid var(--line-2);
  box-shadow:0 44px 90px rgba(0,0,0,.65),inset 0 1px 0 rgba(255,255,255,.14);
  transform:rotate(2.5deg);animation:floatSoft 8s ease-in-out infinite}
.apk-phone::before{content:"";position:absolute;left:50%;top:18px;translate:-50% 0;width:82px;height:6px;border-radius:99px;background:rgba(255,255,255,.14);z-index:2}
.apk-screen{height:100%;border-radius:34px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:9px;text-align:center;padding:28px 22px;
  background:radial-gradient(420px circle at 50% 22%,rgba(124,92,255,.4),transparent 66%),linear-gradient(170deg,#0e1024,#141031)}
.apk-screen img{width:96px;height:96px;border-radius:28px;box-shadow:0 18px 44px rgba(124,92,255,.5);margin-bottom:14px}
.apk-screen strong{font:800 24px var(--display);letter-spacing:-.04em}
.apk-screen small{color:var(--muted);font-size:13px}
.apk-screen .pill{margin-top:18px;padding:12px 20px;border-radius:14px;background:var(--grad-main);font-weight:800;font-size:14px;box-shadow:0 14px 32px rgba(124,92,255,.4)}
.apk-section{margin-top:64px}
.apk-changes{list-style:none;display:grid;gap:11px}
.apk-changes li{display:flex;gap:11px;color:var(--muted);font-size:14.5px;line-height:1.55}
.apk-changes li::before{content:"✓";color:var(--mint);font-weight:800;flex:none}
.apk-footer{text-align:center;color:var(--faint);font-size:12.5px;margin-top:34px}
@media(max-width:860px){.apk-nav{margin-bottom:32px}.apk-hero{grid-template-columns:1fr;gap:36px}.apk-phone{width:250px;transform:none}.apk-section{margin-top:44px}}
</style>
</head>
<body>
<div class="bg-gradient"></div>

<div class="apk-wrap">
  <header class="apk-nav">
    <a class="apk-brand" href="index.php"><img src="assets/icon-192.png" alt="QMods"><span>QMods</span></a>
    <a class="soft-cta btn-sm" href="index.php">На сайт →</a>
  </header>

  <section class="apk-hero">
    <div>
      <div class="lnd-pill"><i></i> Официальная загрузка</div>
      <h1>QMods<br><em>для Android</em></h1>
      <p class="apk-lead">Скачайте актуальную версию приложения. APK-файл отдаётся напрямую с нашего сервера — без регистрации и лишних шагов.</p>
      <div class="apk-actions">
        <a class="primary-cta" href="<?= e($downloadUrl) ?>">⬇ Скачать APK</a>
        <a class="soft-cta" href="#changes">Что нового</a>
      </div>
      <div class="apk-meta">
        <span class="support-chip">📱 Android</span>
        <span class="support-chip">▣ Версия <?= e($version) ?></span>
        <?php if ($updated): ?><span class="support-chip">🕘 Обновлено <?= e($updated) ?></span><?php endif; ?>
      </div>
    </div>

    <div class="apk-phone" aria-hidden="true">
      <div class="apk-screen">
        <img src="assets/icon-512.png" alt="QMods">
        <strong>QMods</strong>
        <small>Версия <?= e($version) ?></small>
        <div class="pill">Скачать приложение</div>
      </div>
    </div>
  </section>

  <section class="apk-section" id="changes">
    <div class="card">
      <h2 class="card-title" style="font-size:23px">Что нового в <?= e($version) ?></h2>
      <?php if ($changes): ?>
        <ul class="apk-changes">
          <?php foreach ($changes as $change): ?><li><?= e(trim($change)) ?></li><?php endforeach; ?>
        </ul>
      <?php else: ?>
        <div class="empty-state">Описание обновления пока не добавлено</div>
      <?php endif; ?>
    </div>
  </section>

  <div class="apk-footer">QMods · Официальная страница загрузки приложения</div>
</div>

<script src="assets/script.js?v=aurora-1"></script>
</body>
</html>
