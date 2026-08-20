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
Профиль/подписка/платежи привязанного аккаунта.
```json
{
  "success": true, "linked": true,
  "user": {
    "id": "…", "username": "ivan", "created_text": "01.01.2026",
    "status": "active",
    "subscription": {"plan": "premium", "active": true, "days_left": 12, "expires_at": 173..., "expires_text": "…"},
    "device": {"linked": true, "id": "…"},
    "payments": [{"plan": "m1", "amount": 499, "date": 173..., "date_text": "…"}]
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

### `stats`
Публичная агрегированная статистика (без персональных данных) — для
приветствия/раздела статистики бота.

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
