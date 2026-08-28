import { esc } from '../util';

export interface DownloadPageData {
  version: string;
  changelog: string;
  downloadUrl: string | null;
  apkSize: number;
  kiraImage: string | null;
  cabinetUrl: string;
}

function fmtBytes(n: number): string {
  if (n <= 0) return '';
  if (n < 1048576) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1048576).toFixed(1)} MB`;
}

/**
 * The "pretty" public APK download page — a stable URL (`${PUBLIC_URL}/app/download`,
 * see index.ts) that admins generate from the bot's "📦 Приложение" screen
 * (handlers/admin.ts showAppManager) instead of sharing the raw
 * qmods.ru/mod/download.php?share=... link directly. The URL itself never
 * changes between releases — only the share token it links to does — so
 * it's safe to pin once (channel description, pinned message, etc.).
 */
export function renderDownloadPage(data: DownloadPageData): string {
  const changelogHtml = data.changelog
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `<li>${esc(line)}</li>`)
    .join('');

  const body = data.downloadUrl
    ? `
      <a class="dl-btn" href="${esc(data.downloadUrl)}">⬇️ Скачать APK${data.apkSize ? ` <span>· ${fmtBytes(data.apkSize)}</span>` : ''}</a>
      <p class="hint">Файл скачивается напрямую с сервера, без установки стороннего лаунчера. Android может предупредить об «неизвестном источнике» — это нормально для APK не из Google Play, разрешите установку в настройках.</p>`
    : `
      <p class="hint">Файл сейчас недоступен — загляните позже или откройте личный кабинет.</p>
      <a class="dl-btn dl-btn-secondary" href="${esc(data.cabinetUrl)}">🌐 Личный кабинет</a>`;

  return `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>QMods — скачать приложение${data.version ? ` v${esc(data.version)}` : ''}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Unbounded:wght@600;700;800&display=swap" rel="stylesheet">
<style>
  :root {
    --bg: #0a0e1a; --bg2: #10162a; --text: #f1f5f9; --hint: #7c8aa5;
    --accent: #3157ff; --accent2: #7c3aed; --success: #22c55e;
    --card: rgba(255,255,255,.05); --card-border: rgba(255,255,255,.09);
  }
  * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
  html, body { margin: 0; padding: 0; }
  body {
    min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px;
    background: var(--bg); color: var(--text);
    font-family: 'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background-image: radial-gradient(circle at 20% -10%, rgba(124,58,237,.20), transparent 55%), radial-gradient(circle at 100% 10%, rgba(49,87,255,.14), transparent 45%);
    background-attachment: fixed;
  }
  .card {
    width: 100%; max-width: 400px; text-align: center;
    background: linear-gradient(180deg, rgba(255,255,255,.055), rgba(255,255,255,.018));
    border: 1px solid var(--card-border); border-radius: 24px; padding: 32px 24px;
    box-shadow: 0 20px 50px rgba(0,0,0,.35);
  }
  .avatar { width: 84px; height: 84px; border-radius: 22px; margin: 0 auto 18px; object-fit: cover; display: block; background: var(--bg2); }
  h1 { font-family: 'Unbounded', sans-serif; font-size: 21px; font-weight: 800; margin: 0 0 4px; }
  .ver { display: inline-block; margin: 0 0 18px; padding: 4px 12px; border-radius: 100px; background: rgba(255,255,255,.08); color: var(--hint); font-size: 12.5px; font-weight: 700; }
  ul.changelog { text-align: left; list-style: none; margin: 0 0 22px; padding: 0; display: flex; flex-direction: column; gap: 8px; }
  ul.changelog li { position: relative; padding-left: 18px; font-size: 14px; line-height: 1.5; color: var(--text); }
  ul.changelog li::before { content: '✦'; position: absolute; left: 0; color: var(--accent2); font-size: 11px; top: 3px; }
  .dl-btn {
    display: block; width: 100%; padding: 15px 18px; border-radius: 16px; margin-bottom: 10px;
    background: linear-gradient(135deg, var(--accent2), var(--accent)); color: #fff; text-decoration: none;
    font-weight: 800; font-size: 15.5px; box-shadow: 0 10px 24px rgba(49,87,255,.35);
  }
  .dl-btn span { font-weight: 600; opacity: .85; font-size: 13px; }
  .dl-btn-secondary { background: rgba(255,255,255,.08); box-shadow: none; }
  .hint { font-size: 12.5px; color: var(--hint); line-height: 1.5; margin: 0 0 6px; }
  .footer { margin-top: 18px; font-size: 11.5px; color: var(--hint); }
  .footer a { color: var(--hint); }
</style>
</head>
<body>
  <div class="card">
    ${data.kiraImage ? `<img class="avatar" src="${esc(data.kiraImage)}" alt="">` : ''}
    <h1>QMods</h1>
    ${data.version ? `<div class="ver">версия ${esc(data.version)}</div>` : ''}
    ${changelogHtml ? `<ul class="changelog">${changelogHtml}</ul>` : ''}
    ${body}
    <div class="footer">Собрала для тебя Кира 💜 · <a href="${esc(data.cabinetUrl)}">кабинет на сайте</a></div>
  </div>
</body>
</html>`;
}
