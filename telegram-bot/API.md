# API-контракт Telegram-бота QMods

Два HTTP JSON API на стороне qmods.ru, каждый со своим bearer-подобным
токеном в заголовке `X-QMods-Bot-Token` (значение сверяется через
`password_verify()` с bcrypt-хешем в конфиге файла). Тела запросов — JSON,
form-data или query-string (объединяются, JSON-тело имеет приоритет).
Ответы — всегда `{"success": bool, ...}`.

- **Пользовательский API**: `POST/GET https://qmods.ru/mod/api/bot.php`
  Держит только Cloudflare Worker, обслуживает всех пользователей бота.
- **Админский API**: `POST/GET https://qmods.ru/mod/admin/bot.php`
  Отдельный токен, используется только разделом `/admin` бота и cron-джобой.

Оба работают поверх `data/users.json` / `data/notifications.json` —
отдельной базы для Telegram не создаётся.

---

## Пользовательский API (`mod/api/bot.php`)

### `ping`
Проверка доступности. Без параметров.
```json
{"success": true, "service": "QMods Bot API", "time": 1732000000}
```

### `plans`
Список тарифов (из `subscribe/config.php::PLANS`).
```json
{"success": true, "plans": [{"id": "m1", "title": "1 месяц", "price": 499, "days": 30}]}
```

### `me`
**Параметры:** `telegram_id` (строка цифр).
Профиль/подписка/платежи привязанного аккаунта. Заодно синхронизирует
достижения/уровень/бонусные дни — та же логика, что при загрузке
`cabinet.php` (см. `includes/achievements.php`), так что бонусы начисляются
и пользователям, которые вообще не заходят на сайт.
```json
{
  "success": true, "linked": true,
  "user": {
    "id": "…", "username": "ivan", "created_text": "01.01.2026",
    "status": "active",
    "subscription": {"plan": "premium", "active": true, "days_left": 12, "expires_at": 173..., "expires_text": "…"},
    "device": {"linked": true, "id": "…"},
    "payments": [{"plan": "m1", "amount": 499, "date": 173..., "date_text": "…"}],
    "level": {"code": "vip", "title": "VIP", "icon": "💎", "perks": "…"},
    "achievements_unlocked": 5, "achievements_total": 13,
    "ref_count": 3
  }
}
```
Если не привязан: `{"success": true, "linked": false, "user": null}`.

### `link` (POST)
**Параметры:** `telegram_id`, `code` (10 символов A-Z0-9, код выдаётся в
кабинете). Ограничение: 8 попыток / 15 минут на один `telegram_id`
(файл `data/bot_link_attempts.json`), дополнительно троттлится в самом
воркере.
- `409` — Telegram уже привязан к другому аккаунту.
- `404` — код не найден/просрочен.
- `429` — превышен лимит попыток.
- `200 {"success": true, "linked": true, "username": "ivan"}` — успех.

### `unlink` (POST)
**Параметры:** `telegram_id`. Отвязывает Telegram от аккаунта (подписка и
устройство не затрагиваются).

### `devices`
**Параметры:** `telegram_id`. Список устройств (сейчас 0–1 элемент — сайт
хранит одно устройство на аккаунт; формат уже рассчитан на несколько).
```json
{"success": true, "devices": [{"id": "…", "id_short": "a1b2c3d4…", "name": null, "android_version": null, "added_at": 173.., "last_seen": 173..}]}
```

### `device_remove` (POST)
**Параметры:** `telegram_id`, `device_id` (опционально — если не передан,
снимается текущее устройство). Отвязывает устройство, подписку не трогает.

### `notifications`
**Параметры:** `telegram_id`. До 10 последних личных/широковещательных
уведомлений с флагом `unread` (независим от статуса прочтения в кабинете).

### `notifications_ack` (POST)
**Параметры:** `telegram_id`, `ids` (массив id). Помечает уведомления
прочитанными в боте.

### `achievements`
**Параметры:** `telegram_id`. Синхронизирует и возвращает уровень, прогресс
до следующего и полный каталог достижений (мигрировано из
`includes/achievements.php`).
```json
{
  "success": true,
  "level": {"code": "vip", "title": "VIP", "icon": "💎", "perks": "…"},
  "progress": {"next_code": "legend", "next_title": "Легенда", "percent": 40, "closest": {"label": "оплат", "current": 4, "min": 10}},
  "stats": {"payments": 4, "spent": 3996, "days": 41, "refs": 1},
  "achievements": [{"code": "first_payment", "title": "Первая покупка", "desc": "…", "icon": "💎", "bonus": 1, "earned": true}],
  "newly_unlocked": [], "level_up": null, "bonus_days": 0
}
```
`newly_unlocked`/`level_up`/`bonus_days` ненулевые только в тот вызов,
когда достижение/уровень выданы — бот показывает поздравление один раз.

### `referrals`
**Параметры:** `telegram_id`. Лениво генерирует `ref_code` при первом
обращении (как `cabinet.php`), возвращает код, ссылку и счётчик приглашённых.
```json
{"success": true, "ref_code": "AB12CD", "ref_link": "https://qmods.ru/mod/register.php?ref=AB12CD", "ref_count": 3}
```

### `app_release`
Без параметров. Версия/чейнджлог мобильного приложения из
`data/app_release.json`. `download_url` присутствует только если публичная
ссылка (`data/download_link.json`) включена — иначе бот отправляет на
`cabinet_url` (требует обычного логина на сайте, бот не может передать
Telegram-сессию как cookie-сессию сайта).
```json
{"success": true, "version": "2.3", "changelog": "…", "has_file": true, "download_url": null, "cabinet_url": "https://qmods.ru/mod/download.php"}
```

### `review`
**Параметры:** `telegram_id`. Текущий отзыв пользователя, если есть.
```json
{"success": true, "review": {"rating": 5, "text": "…", "status": "pending"}}
```
Если отзыва нет: `{"success": true, "review": null}`.

### `review_add` (POST)
**Параметры:** `telegram_id`, `rating` (1–5), `text` (мин. 10 символов).
Перезаписывает предыдущий отзыв пользователя (как `cabinet.php`), ставит
статус `pending` на модерацию.

### `stats`
Публичная агрегированная статистика (без персональных данных) — для
приветствия/раздела статистики бота.

### `device_subscription`
**Параметры:** `username`. Только для server-to-server вызова с Cloudflare
Worker (device-auth хендшейк для нативного Android-приложения — см.
`android-client/README.md` и README «Авторизация приложения через бота»).
Отдаёт узкий срез `{found, subscription: {plan, active, days_left,
expires_at, expires_text}}` — без id/платежей/устройства. Приложение
никогда не вызывает это действие напрямую и не видит бот-токен, которым
оно авторизовано — оно знает только `device_token`, который резолвится в
`username` на самом воркере (`GET /device/subscription`).

---

## Админский API (`mod/admin/bot.php`)

Все действия ниже, кроме `pending_telegram_pushes`/`ack_telegram_push`,
существовали и раньше — поведение не менялось.

### `stats`
Как в `get_stats()` из `bootstrap.php` + новое поле `telegram_linked`
(число аккаунтов с привязанным Telegram).

### `users`
Полный список пользователей (кратко) — id, логин, тариф, telegram_id,
device_id, даты.

### `user`
**Параметры:** `username`. Карточка одного пользователя (профиль, подписка,
платежи, telegram_id, device_id).

### `payments`
Последние 100 платежей по всем пользователям.

### `issue` (POST)
**Параметры:** `username`, `days` **или** `expires_date` (YYYY-MM-DD),
`plan` (опц.), `create` (опц., создать пользователя, если не найден).
Выдаёт/продлевает подписку. Создаёт персональное уведомление автоматически.
`days` **прибавляется** к текущему окончанию подписки (или к сейчас, если
подписки нет / она уже истекла) — а не отсчитывается заново от текущего
момента, иначе продление съедало бы уже оплаченный остаток. `expires_date`
задаёт абсолютную дату окончания и остатка не учитывает.

### `remove` (POST)
**Параметры:** `username`. Снимает подписку и отвязывает устройство.

### `delete_user` (POST)
**Параметры:** `username`. Полностью удаляет аккаунт. Необратимо.

### `notifications`
Лента всех уведомлений (для отладки/просмотра админом).

### `send_notification` (POST)
**Параметры:** `title`, `message`, `target` (опционально — username).
Без `target` — рассылка всем привязанным к Telegram пользователям, с
`target` — личное уведомление одному пользователю.

### `pending_telegram_pushes` *(новое)*
**Параметры:** `limit` (1–500, по умолчанию 200).
Отдаёт уведомления, ещё не доставленные в Telegram, "расплющенные" по
получателям (одна запись = одно уведомление для одного telegram_id):
```json
{"success": true, "items": [
  {"notification_id": "…", "user_id": "…", "telegram_id": "5110155633", "title": "💰 Оплата прошла успешно", "message": "…", "created_at": 173..}
]}
```
Вызывается только cron-джобой воркера (`scheduled()` в `src/index.ts`).

### `ack_telegram_push` (POST) *(новое)*
**Параметры:** `items`: `[{"notification_id": "…", "user_id": "…"}, …]`.
Помечает пары (уведомление, получатель) доставленными — они больше не
вернутся из `pending_telegram_pushes`.

---

## Коды ответов

| Код | Значение |
|---|---|
| 200 | успех |
| 400 | некорректные параметры |
| 401 | неверный/отсутствующий токен |
| 404 | не найдено (пользователь, код привязки, устройство) |
| 405 | метод должен быть POST |
| 409 | конфликт (Telegram уже привязан к другому аккаунту) |
| 429 | превышен лимит попыток (`action=link`) |
| 500 | ошибка хранилища/конфигурации |
