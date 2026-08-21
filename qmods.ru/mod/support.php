<?php
declare(strict_types=1);

require __DIR__ . '/includes/bootstrap.php';
require_once __DIR__ . '/includes/reminders.php';

if (!defined('SUPPORT_GROUP_URL')) {
    define('SUPPORT_GROUP_URL', 'https://t.me/qmurzik');
}

$user = current_user();
if ($user === null) {
    redirect('login.php');
}

$releaseFile = DATA_DIR . '/app_release.json';
$release = is_file($releaseFile) ? json_decode((string)file_get_contents($releaseFile), true) : null;
$releaseVersion = is_array($release) ? (string)($release['version'] ?? '') : '';
$sub = subscription_info($user);
$payments = is_array($user['payments'] ?? null) ? $user['payments'] : [];
$lastPayment = $payments ? end($payments) : null;

function support_platform(): string {
    $ua = (string)($_SERVER['HTTP_USER_AGENT'] ?? '');
    if (stripos($ua, 'Android') !== false) return 'Android';
    if (stripos($ua, 'iPhone') !== false || stripos($ua, 'iPad') !== false) return 'iOS';
    if (stripos($ua, 'Windows') !== false) return 'Windows';
    if (stripos($ua, 'Mac OS') !== false) return 'macOS';
    return 'Другое';
}

function support_message(array $user, array $sub, string $category, string $issue, string $version, string $comment, string $platform, string $device): string {
    $lines = [];
    $lines[] = '🆘 Обращение в поддержку QMods';
    $lines[] = '';
    $lines[] = '📌 Категория: ' . $category;
    $lines[] = '🔧 Проблема: ' . $issue;
    $lines[] = '📱 Версия ShopperMod: ' . ($version !== '' ? $version : 'не указана');
    $lines[] = '📲 Платформа: ' . $platform;
    $lines[] = '🆔 Устройство: ' . ($device !== '' ? $device : 'не привязано');
    $lines[] = '👤 Пользователь: ' . (string)($user['username'] ?? '—');
    $lines[] = '🔑 ID: ' . (string)($user['id'] ?? '—');
    $lines[] = '💳 Тариф: ' . (string)($sub['plan'] ?? '—');
    $lines[] = '📅 Подписка: ' . ($sub['active'] ? ('активна, до ' . (string)$sub['expires_text']) : 'неактивна');
    if ($comment !== '') {
        $lines[] = '';
        $lines[] = '💬 Описание:';
        $lines[] = $comment;
    }
    $lines[] = '';
    $lines[] = '🌐 QMods: https://qmods.ru/mod';
    return implode("\n", $lines);
}

$defaultCategory = 'Не могу войти';
$defaultIssue = 'Другое';
$categories = [
    'APK' => ['Не скачивается APK', 'Не устанавливается APK', 'Ошибка при запуске', 'Приложение работает некорректно', 'Другое'],
    'Подписка' => ['Подписка не активировалась', 'Неверно отображается срок', 'Не могу продлить подписку', 'Закончился доступ', 'Другое'],
    'Оплата' => ['Платёж не зачислился', 'Деньги списались, но доступа нет', 'Ошибка при оплате', 'Хочу уточнить платёж', 'Другое'],
    'Авторизация' => ['Не могу войти', 'Не приходит/не принимается пароль', 'Проблема с регистрацией', 'Проблема с устройством', 'Другое'],
    'Другое' => ['Вопрос', 'Предложение', 'Ошибка сайта', 'Другое'],
];

$platform = support_platform();
$deviceId = trim((string)($user['device_id'] ?? ''));
$deviceShort = $deviceId !== '' ? substr($deviceId, 0, 6) . '…' . substr($deviceId, -4) : '';

$category = $defaultCategory;
$issue = $defaultIssue;
$version = $releaseVersion;
$comment = '';
$message = support_message($user, $sub, $category, $issue, $version, $comment, $platform, $deviceShort);
$shareUrl = 'https://t.me/share/url?url=' . rawurlencode(SUPPORT_GROUP_URL) . '&text=' . rawurlencode($message);

render_header('Поддержка', ['user' => $user]);
?>

<div class="support-wrap">

  <div style="margin-bottom:14px"><a href="cabinet.php" class="soft-cta btn-sm">← Вернуться в кабинет</a></div>

  <section class="support-hero">
    <div class="support-icon">🆘</div>
    <div>
      <h1>Связаться с поддержкой</h1>
      <p>Выберите пункты ниже — мы соберём обращение со всеми нужными данными. Вам останется открыть Telegram и нажать «Отправить».</p>
    </div>
  </section>

  <section class="support-card">
    <div class="support-grid">
      <div class="support-field">
        <label class="support-label" for="supportCategory">Что случилось?</label>
        <select id="supportCategory" class="support-select">
          <?php foreach ($categories as $name => $issues): ?>
            <option value="<?= e($name) ?>" <?= $name === $category ? 'selected' : '' ?>><?= e($name) ?></option>
          <?php endforeach; ?>
        </select>
      </div>
      <div class="support-field">
        <label class="support-label" for="supportIssue">Тип проблемы</label>
        <select id="supportIssue" class="support-select"></select>
      </div>
    </div>

    <div class="support-grid">
      <div class="support-field">
        <label class="support-label" for="supportVersion">Версия ShopperMod</label>
        <select id="supportVersion" class="support-select">
          <option value="">Не знаю / не указана</option>
          <?php if ($releaseVersion !== ''): ?>
            <option value="<?= e($releaseVersion) ?>" selected><?= e($releaseVersion) ?> (актуальная)</option>
          <?php endif; ?>
          <option value="Другая">Другая версия</option>
        </select>
      </div>
      <div class="support-field">
        <label class="support-label">Данные аккаунта</label>
        <div class="support-meta">
          <span class="support-chip">👤 <?= e((string)$user['username']) ?></span>
          <span class="support-chip">💳 <?= e((string)$sub['plan']) ?></span>
        </div>
      </div>
    </div>

    <div class="support-field">
      <label class="support-label" for="supportComment">Что произошло?</label>
      <textarea id="supportComment" class="support-textarea form-input" maxlength="1200"
                placeholder="Например: оплатил тариф, деньги списались, но подписка не появилась."></textarea>
    </div>

    <div class="support-meta">
      <span class="support-chip">📲 <?= e($platform) ?></span>
      <span class="support-chip">🆔 <?= e($deviceShort !== '' ? $deviceShort : 'устройство не привязано') ?></span>
      <span class="support-chip">📅 <?= e($sub['active'] ? $sub['expires_text'] : 'подписка неактивна') ?></span>
    </div>
  </section>

  <section class="support-card">
    <h3 class="card-title" style="margin-top:0">Предпросмотр сообщения</h3>
    <div id="supportPreview" class="support-preview"></div>
    <div class="support-actions">
      <button type="button" class="soft-cta" id="copySupport">📋 Скопировать</button>
      <a class="primary-cta" id="openTelegram" href="#" target="_blank" rel="noopener">💬 Открыть Telegram</a>
    </div>
    <p class="support-note">Telegram откроет экран отправки с уже подготовленным текстом — вы сможете проверить его перед отправкой. Получатель: <b>@qmurzik</b>.</p>
  </section>

</div>

<script>
const supportData = <?= json_encode($categories, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?>;
const userData = <?= json_encode([
    'username' => (string)($user['username'] ?? '—'),
    'id' => (string)($user['id'] ?? '—'),
    'plan' => (string)($sub['plan'] ?? '—'),
    'active' => (bool)$sub['active'],
    'expires' => (string)($sub['expires_text'] ?? '—'),
    'platform' => $platform,
    'device' => $deviceShort,
    'groupUrl' => SUPPORT_GROUP_URL,
], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?>;
const releaseVersion = <?= json_encode($releaseVersion, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?>;
const category = document.getElementById('supportCategory');
const issue = document.getElementById('supportIssue');
const version = document.getElementById('supportVersion');
const comment = document.getElementById('supportComment');
const preview = document.getElementById('supportPreview');
const openTelegram = document.getElementById('openTelegram');
const copySupport = document.getElementById('copySupport');

function populateIssues(){
    issue.innerHTML = '';
    (supportData[category.value] || ['Другое']).forEach(function(item){
        const opt=document.createElement('option'); opt.value=item; opt.textContent=item; issue.appendChild(opt);
    });
    updateSupport();
}
function buildMessage(){
    const lines=[];
    lines.push('🆘 Обращение в поддержку QMods','');
    lines.push('📌 Категория: ' + category.value);
    lines.push('🔧 Проблема: ' + issue.value);
    lines.push('📱 Версия ShopperMod: ' + (version.value || 'не указана'));
    lines.push('📲 Платформа: ' + userData.platform);
    lines.push('🆔 Устройство: ' + (userData.device || 'не привязано'));
    lines.push('👤 Пользователь: ' + userData.username);
    lines.push('🔑 ID: ' + userData.id);
    lines.push('💳 Тариф: ' + userData.plan);
    lines.push('📅 Подписка: ' + (userData.active ? ('активна, до ' + userData.expires) : 'неактивна'));
    if(comment.value.trim()) lines.push('','💬 Описание:',comment.value.trim());
    lines.push('','🌐 QMods: https://qmods.ru/mod');
    return lines.join('\n');
}
function updateSupport(){
    const msg=buildMessage();
    preview.textContent=msg;
    openTelegram.href='https://t.me/share/url?url='+encodeURIComponent(userData.groupUrl)+'&text='+encodeURIComponent(msg);
}
category.addEventListener('change',populateIssues);
issue.addEventListener('change',updateSupport);
version.addEventListener('change',updateSupport);
comment.addEventListener('input',updateSupport);
copySupport.addEventListener('click',async function(){
    const msg=buildMessage();
    try { await navigator.clipboard.writeText(msg); copySupport.textContent='✓ Скопировано'; setTimeout(()=>copySupport.textContent='📋 Скопировать',1500); }
    catch(e){ window.prompt('Скопируйте сообщение:',msg); }
});
populateIssues();
</script>

<?php render_footer(); ?>
