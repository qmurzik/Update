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
    "extra_device_slot": false, "max_devices": 1,
    "is_curator": false, "curator_username": null,
    "payments": [{"plan": "m1", "amount": 499, "date": 173..., "date_text": "…"}],
    "level": {"code": "vip", "title": "VIP", "icon": "💎", "perks": "…"},
    "achievements_unlocked": 5, "achievements_total": 13,
    "ref_count": 3
  }
}
```
`extra_device_slot`/`max_devices` *(новое)* — куплен ли «клон» (второе
устройство, см. `grant_device_slot` ниже) и итоговый лимит устройств
аккаунта (1 или 2). Сам лимит проверяет и считает воркер по количеству
живых `device_token` в D1, не эта пара полей — `max_devices` только
источник правды для него.

`is_curator`/`curator_username` *(новое, см. README «Кураторы»)* — выдан ли
этому аккаунту статус куратора (только админом, см. `set_curator`) и ник
ЕГО СОБСТВЕННОГО куратора, если он сам чей-то подопечный (`null`, если нет).

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

### `link_by_password` (POST) *(новое)*
**Параметры:** `telegram_id`, `username`, `password`. Альтернатива
`link` — привязывает существующий сайтовый аккаунт БЕЗ одноразового
кода, сверяя пароль напрямую (`password_verify()` против `pass_hash`,
тем же способом, что и `login.php`). Общий лимит попыток с `link`
(`link_attempts_*`, 8 попыток / 15 минут на `telegram_id`) — код и
пароль это один и тот же сценарий подбора доступа.
- `401` — неверный логин ИЛИ пароль (намеренно один и тот же текст для
  обоих случаев — не даёт подбирающему отличить существующий логин от
  несуществующего).
- `409` — этот Telegram уже привязан к другому аккаунту, либо найденный
  по логину/паролю аккаунт уже привязан к ДРУГОМУ Telegram.
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

### `register` (POST)
**Параметры:** `telegram_id`, `username` (3–20 симв.: латиница, цифры, `_`,
`-`), `ref` *(опционально)*. Создаёт новый аккаунт без сайта — прямо из
бота (см. handlers/register.ts). `ref` — код из `t.me/qmods_bot?start=ref_
<CODE>` (см. `referrals` ниже); если код найден — новый аккаунт сразу
получает `referred_by`. Неизвестный/пустой код НЕ блокирует регистрацию
(в отличие от `register.php` на сайте) — просто не будет бонуса
приглашавшему. Даёт пробный доступ на 24 часа, один раз на `telegram_id`
(см. `bot_trial_already_claimed()`).
```json
{"success": true, "username": "vasya", "trial": true}
```

### `referrals`
**Параметры:** `telegram_id`. Лениво генерирует `ref_code` при первом
обращении (как `cabinet.php`), возвращает код, ссылку и счётчик приглашённых.
`ref_link` — ссылка НА БОТА (`t.me/qmods_bot?start=ref_<CODE>`), не на
сайт *(изменено — раньше вела на `mod/register.php?ref=...`, что уводило
приглашённых мимо бота)*. Бонус приглашавшему (+3 дня) начисляется при
ПЕРВОЙ оплате приглашённого через `record_payment` — см.
`bot_award_referral_bonus()` в `includes/bot_notify.php`.
```json
{"success": true, "ref_code": "AB12CD", "ref_link": "https://t.me/qmods_bot?start=ref_AB12CD", "ref_count": 3}
```

### `app_release`
Без параметров. Версия/чейнджлог мобильного приложения из
`data/app_release.json`. `download_url` присутствует только если публичная
ссылка (`data/download_link.json`) включена — иначе бот отправляет на
`cabinet_url` (требует обычного логина на сайте, бот не может передать
Telegram-сессию как cookie-сессию сайта). `apk_size` *(новое)* — размер
файла в байтах, 0 если файла нет; используется «красивой» страницей
скачивания (`${PUBLIC_URL}/app/download`, см. README «Публикация APK из
бота»).
```json
{"success": true, "version": "2.3", "changelog": "…", "has_file": true, "apk_size": 41943040, "download_url": null, "cabinet_url": "https://qmods.ru/mod/download.php"}
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
**Параметры:** `username`, `version_code` (int, версия приложения —
0, если клиент не прислал). Только для server-to-server вызова с
Cloudflare Worker (device-auth хендшейк для нативного Android-приложения —
см. `android-client/README.md` и README «Авторизация приложения через
бота»). Вызывается воркером на каждой проверке подписки — и при холодном
старте, и на периодическом re-check во время использования (см.
android-client/README.md «Проверка во время использования»). Отдаёт:
```json
{
  "success": true,
  "found": true,
  "subscription": { "plan": "...", "active": true, "days_left": 12, "expires_at": 0, "expires_text": "..." },
  "notifications": [ { "id": "...", "title": "...", "message": "...", "created_at": 0 } ],
  "force_update": { "required": false, "message": "" }
}
```
`notifications` — необработанные админ-уведомления для этого `username`
(тот же `data/notifications.json`, что и доставка в Telegram — см.
`get_and_mark_app_notifications()`), помечаются доставленными сразу же в
этом вызове. `force_update.required` — `true`, если `version_code` ниже
администраторского минимума (см. `set_app_version` ниже); приложение
использует это независимо от `subscription`, а не вместо него. Приложение
никогда не вызывает это действие напрямую и не видит бот-токен, которым
оно авторизовано — оно знает только `device_token`, который резолвится в
`username` на самом воркере (`GET /device/subscription`).

### `device_remove_by_username` (POST)
**Параметры:** `username`. То же самое, что `device_remove`, но по
`username` вместо `telegram_id` — server-to-server вызов с воркера, для
самостоятельной отвязки устройства прямо из приложения (`POST
/device/unlink?token=...` на воркере — резолвит `device_token` в
`username` через D1, отзывает там же и зеркалит очистку `device_id` сюда
best-effort). См. `android-client/README.md` «Отвязка устройства из
приложения».

### `device_register` (POST)
**Параметры:** `telegram_id`, `device_id`. Тоже только server-to-server —
вызывается воркером сразу после успешной привязки приложения через бота
(`handlers/devicePair.ts`), с `device_id` = только что выданным
`device_token`. Существующее действие `devices` затем видит это
устройство как обычное — приложение появляется в разделе «Устройства»
бота/кабинета, и штатное `device_remove` (по `device_id`) отвязывает его.

### `set_curator_for_ward` (POST) *(новое)*
**Параметры:** `telegram_id` (подопечного), `curator_username`. Согласие
подопечного стать чьим-то подопечным — см. README «Кураторы». `telegram_id`
здесь ВСЕГДА подопечного (вызывается воркером только после его собственного
нажатия «✅ Подтвердить» на приглашение), поэтому куратор физически не может
выставить это поле сам себе или кому-то ещё. Отклоняет, если `curator_username`
не существует, не является куратором (`is_curator`), или совпадает с самим
подопечным.

### `unlink_curator` (POST) *(новое)*
**Параметры:** `telegram_id` (подопечного). Подопечный сам отвязывает своего
куратора — без согласия куратора, в любой момент. Идемпотентно.

### `curator_wards` *(новое)*
**Параметры:** `telegram_id` (куратора). `403`, если `is_curator` не
установлен. Отдаёт подписку и устройство каждого подопечного, чей
`curator_username` указывает на этого куратора — `device.id_short`, а не
полный `device_id` (это по сути bearer-токен устройства, куратору его знать
незачем).
```json
{"success": true, "wards": [
  {"username": "ivan", "subscription": {...}, "device": {"linked": true, "id_short": "a1b2c3d4…", "android_version": "13", "last_seen": 173...}}
]}
```

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
**Параметры:** `username` **или** `telegram_id` *(новое)* — если `username`
пуст, а `telegram_id` указан, ищет по нему вместо ника (см. README
«Быстрый переход из Telegram-клиента»). Карточка одного пользователя
(профиль, подписка, платежи, telegram_id, device_id). *(новое)* Плюс
`is_curator`; если это куратор — сразу `wards: [{username, active,
expires_text}]`, без отдельного запроса; если у него самого есть куратор —
`curator_username`.

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

### `record_payment` (POST) *(новое)*
**Параметры:** `username`, `plan` (title), `days`, `amount`. Продлевает
подписку (тот же принцип, что и `issue` — от текущего окончания, не от
"сейчас") **и** дописывает запись в историю платежей (`user.payments[]`) —
в отличие от `issue`, который её не трогает (ручной грант — не покупка).
Вызывается ТОЛЬКО воркером (`worker/src/index.ts`, `finalizePayment()`)
сразу после проверки sha1-подписи HTTP-уведомления ЮMoney — см. README
«Оплата через ЮMoney». Создаёт и персональное уведомление покупателю
(«💰 Оплата прошла успешно»), и админский алерт (`notify_admin_payment_event`,
см. `pending_payment_alerts`). Отдаёт `{success, message, expires_at,
user_id, notification_id}` — `user_id`/`notification_id` нужны только
вызывающей стороне, чтобы сразу подтвердить доставку через
`ack_telegram_push` и не получить то же сообщение повторно от 5-минутного
крона. Заодно — атомарно, внутри той же блокировки `update_users()` — вызывает
`bot_award_referral_bonus()`: если это ПЕРВАЯ оплата покупателя и у него
есть `referred_by`, приглашавшему начисляется +3 дня, и он получает
персональное уведомление «🎁 Бонус за приглашение».

### `issue_device_slot` (POST) *(новое)*
**Параметры:** `username`. Ручная выдача «клона» из админки — без покупки,
тот же принцип, что у `issue` относительно `record_payment`: не пишет в
`user.payments[]` и не начисляет реферальный бонус. Идемпотентна —
повторный вызов на уже выданном клоне отвечает `{success: false, error:
'Уже выдано.'}` (`409`). Шлёт персональное уведомление («🧬 Клон выдан»).
См. кнопку «🧬 Выдать клона» на карточке пользователя (в боте и в Mini App).

### `grant_device_slot` (POST) *(новое)*
**Параметры:** `username`, `amount`. Покупка «клона» — навсегда выставляет
флаг `extra_device_slot` (см. поле `max_devices` в `me`), поднимая лимит
устройств аккаунта с 1 до 2. В отличие от `record_payment` **не трогает**
`subscription.expires_at` — только дописывает запись в `user.payments[]`
(для истории/выручки) и, как и `record_payment`, атомарно проверяет
`bot_award_referral_bonus()`. Вызывается ТОЛЬКО воркером
(`finalizePayment()` в `worker/src/index.ts`), веткой по
`order.plan_id === 'device_slot'` — см. README «Лимит устройств и „клон“».
Повторный вызов для уже купившего аккаунта отвечает `{success: false,
error: 'Уже куплено.'}` (`409`). Отдаёт `{success, message, user_id,
notification_id}` — те же поля, что и `record_payment`, для того же
`ack_telegram_push`.

### `set_curator` (POST) *(новое)*
**Параметры:** `username`, `enabled` (`1`/`0`). Выдаёт или снимает статус
куратора — единственный способ стать куратором, см. README «Кураторы».
Само по себе никого ни к кому не привязывает — это делает только сам
подопечный через `set_curator_for_ward`. Снятие (`enabled=0`) каскадно
чистит `curator_username` у всех текущих подопечных — иначе бывший куратор
пропал бы из `curators_list`, но продолжал бы значиться у людей в профиле.
Отдаёт `{success, message, cleared_wards}`.

### `curators_list` *(новое)*
Все текущие кураторы + число подопечных у каждого — для раздела «👔
Кураторы» в админке.
```json
{"success": true, "curators": [{"username": "ivan", "telegram_id": "123", "ward_count": 3}]}
```

### `admin_unlink_curator` (POST) *(новое)*
**Параметры:** `username` (подопечного). Принудительная отвязка от админа —
спор/жалоба; тот же эффект, что у собственного `unlink_curator` подопечного
в `mod/api/bot.php`, только по нику, а не по `telegram_id`.

### `remove` (POST)
**Параметры:** `username`. Снимает подписку и отвязывает устройство.

### `delete_user` (POST)
**Параметры:** `username`. Полностью удаляет аккаунт. Необратимо.

### `notifications`
Лента всех уведомлений (для отладки/просмотра админом).

### `send_notification` (POST)
**Параметры:** `title`, `message`, `target` (опционально — username).
Без `target` — рассылка всем привязанным к Telegram пользователям, с
`target` — личное уведомление одному пользователю. Тот же вызов доставляет
и в native-приложение (см. `android-client/README.md` «Отправка
уведомлений в приложение через бота») — отдельного действия для этого не
существует, `device_subscription` вычитывает те же записи.

### `get_app_version` *(новое)*
Текущий гейт принудительного обновления: `{success, min_version_code,
message}`. `min_version_code: 0` = гейт выключен.

### `set_app_version` (POST) *(новое)*
**Параметры:** `min_version_code` (int, ≥0), `message` (обязателен, если
`min_version_code > 0`). Устанавливает минимальный `versionCode`
нативного приложения — устройства со старой версией получают
`force_update.required: true` в ответе `device_subscription` (см.
`mod/api/bot.php`) и блокируются экраном `GateActivity` в режиме
`"update"`, независимо от статуса подписки. Управляется командой бота
«🚧 Мин. версия приложения» в `/admin`.

### `get_app_release` *(новое)*
Карточка версии/APK/публичной ссылки для экрана «📦 Приложение» в `/admin`
(отдельно от пользовательского `app_release` — здесь ещё `apk_size` и
`share_enabled`, чтобы бот мог показать кнопку «Создать»/«Отключить
ссылку» без второго запроса).
```json
{"success": true, "version": "2.3", "changelog": "…", "has_file": true, "apk_size": 41943040, "share_enabled": true, "download_url": "https://qmods.ru/mod/download.php?share=…"}
```

### `set_app_release` (POST) *(новое)*
**Параметры:** `version`, `changelog`. Пишет `data/app_release.json` —
то же самое, что форма «Что нового» в веб-панели `admin/app.php`, только
из чата бота (`✏️ Версия и описание` на экране «📦 Приложение»).

### `generate_apk_share_link` (POST) *(новое)*
Без параметров. (Пере)генерирует токен `data/download_link.json` —
любая ранее выданная публичная ссылка сразу перестаёт работать (как
кнопка «Сгенерировать» в `admin/app.php`). 400, если `downloads/app.apk`
ещё не загружен.

### `revoke_apk_share_link` (POST) *(новое)*
Без параметров. Удаляет `data/download_link.json` — публичная ссылка
перестаёт открываться, скачивание снова требует логина на сайте.

### `apk_upload` (POST) *(новое)*
Тело запроса — **сырые байты APK**, не JSON (поэтому `action` передаётся
через query-string: `?action=apk_upload`, а не в теле). Заголовок
`X-Apk-Filename` (опционален) — исходное имя файла, только для лога.
Проверяет ZIP-заголовок (`PK\x03\x04`/…) и лимит 20 МБ (тот же потолок,
что у Telegram Bot API на скачивание файлов ботом — сюда попадают только
файлы, которые Worker уже смог скачать), атомарно заменяет
`downloads/app.apk`. Используется исключительно
`worker/src/handlers/admin.ts handleApkDocument` — не вызывается напрямую
с сайта, для этого есть отдельная веб-форма в `admin/app.php`.
```json
{"success": true, "size": 8912345, "sha256": "…"}
```

### `pending_payment_alerts` *(новое)*
**Параметры:** `limit` (1–500, по умолчанию 100).
Отдаёт и сразу очищает необработанные алерты «кто/когда/что купил» (см.
`notify_admin_payment_event()` в `bot_notify.php` и `INTEGRATION.md`
«Алерт админу об оплате»):
```json
{"success": true, "items": [
  {"id": "…", "username": "ivan123", "telegram_id": "5110155633", "plan": "Про", "amount": 299, "days": 30, "created_at": 173..}
]}
```
Вызывается только cron-джобой воркера (`scheduled()` → `deliverPendingPaymentAlerts`
в `src/index.ts`), доставляется на все `ADMIN_TELEGRAM_IDS`, не покупателю.

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
