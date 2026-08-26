# QMods Android client — авторизация через бота

Готовый smali-модуль (`smali/com/qmods/app/auth/`), который добавляет в
Android-приложение вход через Telegram-бота и проверку подписки — без
пароля/сессии на сайте внутри APK, только короткоживущий код привязки и
затем свой собственный `device_token`. Приложение **не пускает пользователя
дальше**, пока привязка не подтверждена в Telegram и подписка не активна —
проверка идёт заново при каждом холодном старте.

Написан на **smali** (а не Kotlin/Java), потому что предполагается вклейка
в уже собранный APK, для которого нет исходников — обычный сценарий,
когда патчишь готовое приложение через `apktool`. Если у вас есть
исходники/Gradle-проект, гораздо разумнее переписать это на Kotlin — smali
здесь не даёт никаких преимуществ, кроме совместимости с decompiled-проектом.

## Как это проверялось

Смали писался вручную, поэтому каждый файл прогонялся через настоящий
ассемблер (не просто "выглядит похоже на смали"):

```bash
java -cp 'smali-2.5.2.jar:dexlib2-2.5.2.jar:util-2.5.2.jar:antlr-3.5.2.jar:antlr-runtime-3.5.2.jar:jcommander-1.64.jar:stringtemplate-3.2.1.jar:guava-27.1-android.jar' \
  org.jf.smali.Main assemble -o /tmp/check.dex -a 30 smali
```

Все файлы модуля собираются в валидный DEX без ошибок. Дополнительно
результат разобран обратно через `baksmali` и построчно сверен с
оригиналом — инструкции и операнды совпадают полностью (отличия только
косметические: порядок методов/полей и автоматически сгенерированные имена
меток). Это не гарантирует, что рантайм-логика на 100% ведёт себя как
задумано (это можно подтвердить только реальным запуском на
устройстве/эмуляторе), но снимает основной риск ручного smali —
синтаксические ошибки и рассинхрон регистров. Так были реально пойманы и
исправлены две ошибки до отправки:
- `SubscriptionDispatcher`'s constructor берёт 6 параметров (7 регистров
  вместе с самим инстансом) — превышает лимит в 5 для обычного
  `invoke-direct`, понадобился `invoke-direct/range` с непрерывным блоком
  регистров;
- в `GateActivity.onCreate` случайно передавался инстанс `TextView` вместо
  int-константы гравитации в `setGravity(I)V` (опечатка при переносе
  черновика — `invoke-virtual {v1, v1}` вместо `{v1, v3}` с отдельной
  `const/16 v3, 0x11`).

## Классы

| Класс | Роль |
|---|---|
| `DevicePairing` | Точка входа для привязки: `startPairing(Context, PairingCallback)` |
| `DevicePairingRunnable` | Фоновый поток: запрашивает код, открывает Telegram, поллит статус |
| `PairingCallback` | Интерфейс обратного вызова для привязки (`onCodeReady`/`onPaired`/`onFailed`) |
| `CallbackDispatcher` | Доставляет вызовы `PairingCallback` в UI-поток через `Handler` |
| `SubscriptionChecker` | Точка входа для проверки: `isPaired`/`check`/`clearPairing` |
| `SubscriptionCheckRunnable` | Фоновый поток: читает `device_token`, спрашивает Worker о подписке |
| `SubscriptionCallback` | Интерфейс обратного вызова для проверки подписки |
| `SubscriptionDispatcher` | Доставляет вызовы `SubscriptionCallback` в UI-поток |
| `Http` | Общий блокирующий GET/POST на `HttpURLConnection`, без внешних зависимостей |
| `GateActivity` | **Блокирующий экран** — показывается вместо контента приложения, пока не пройдена привязка и подписка не активна (см. ниже) |

Ни один класс не тянет OkHttp/Retrofit/AndroidX — только `android.*`,
`java.*` и `org.json.*` (входит в саму платформу Android), чтобы модуль
без проблем вклеивался в любой APK независимо от того, чем пользуется
остальное приложение.

## Протокол (то же самое видно в комментариях воркера/PHP)

1. **Приложение**: `DevicePairing.startPairing(context, callback)` →
   `POST /device/pair/start` на Cloudflare Worker → получает
   `{code, deep_link}`.
2. **Приложение**: открывает `deep_link`
   (`https://t.me/<bot>?start=devicelink_<CODE>`) через `Intent.ACTION_VIEW` —
   Telegram открывает чат с ботом.
3. **Пользователь**: в чате с ботом (аккаунт уже привязан к qmods.ru через
   обычный `/link`) — бот видит `devicelink_<CODE>`, проверяет привязку,
   создаёт `device_token` (`worker/src/handlers/devicePair.ts`) и
   зеркалит его в качестве `device_id` на qmods.ru (`device_register` в
   `mod/api/bot.php`) — поэтому приложение появляется в разделе
   «📱 Устройства» бота/кабинета как обычное устройство, доступное для
   отвязки.
4. **Приложение**: поллит `GET /device/pair/status?code=<CODE>` каждые
   ~2.5 сек до `{status: "claimed", device_token: "..."}` — сохраняет токен
   в `SharedPreferences` и вызывает `callback.onPaired(token)`.
5. **Дальше при каждом холодном старте**: `SubscriptionChecker.check(...)`
   → `GET /device/subscription?token=<TOKEN>` → воркер резолвит токен в
   username (D1) и спрашивает `mod/api/bot.php` (`device_subscription`) →
   `{active, days_left, plan}`.
6. **Отвязка**: если пользователь нажимает «🗑 Отвязать устройство» в боте
   (или в Mini App) — `device_id` на qmods.ru очищается, и **тот же вызов**
   удаляет соответствующую строку из D1 `device_tokens`
   (`revokeDeviceToken()` в `worker/src/db.ts`). После этого
   `device_token` в приложении становится недействителен — следующий
   `check()` вернёт `onError("not_paired")`, и приложение снова уйдёт на
   экран привязки.

Приложение **никогда** не видит пароль/сессию qmods.ru, ни бот-токен
Cloudflare Worker — только свой собственный `device_token`, который ничего
не даёт без уже подтверждённой в Telegram привязки к конкретному аккаунту,
и который можно отозвать в любой момент со стороны бота/кабинета.

## Как работает гейт (не пускать без привязки и подписки)

`GateActivity` — самодостаточная Activity (интерфейс собирается программно,
без XML-layout и ресурсов — минимальный `LinearLayout` + `TextView` +
`Button`, чтобы вклеивалась в любой проект без завязки на чужие resource
ID). Три режима, переданные через `Intent`-экстру `"mode"`:

| mode | Когда | Что показывает |
|---|---|---|
| `"pair"` | `device_token` отсутствует/отозван | «Войти через Telegram» → `DevicePairing.startPairing()` |
| `"paywall"` | Привязан, но подписка неактивна | «Проверить снова» → повторный `SubscriptionChecker.check()` |
| `"error"` | Сама проверка не удалась (сеть/сервер) | То же, что paywall, но с другой подписью — **fail-closed**: не пускаем, если не смогли подтвердить подписку |

Реальная Activity вашего приложения (`MainActivity` в примере ниже) на
`onCreate` **сразу** вызывает `SubscriptionChecker.check()` — не
`isPaired()` отдельно: если токена нет, `check()` сам вернёт
`onError("not_paired")`, что эквивалентно «не привязан». Если подписка
активна — `onResult(true, ...)` ничего не делает, и обычный контент
приложения остаётся на экране. Если нет — `MainActivity` открывает
`GateActivity` в нужном режиме и вызывает `finish()` на себе, чтобы кнопка
«назад» не возвращала в заблокированный контент.

Пример полного `MainActivity.onCreate` + `onResult`/`onError` — в
`smali-example/com/example/app/MainActivity.smali` (адаптируйте под ваш
пакет/суперкласс, как описано ниже).

## Куда менять package name

Два **независимых** переименования — не перепутайте:

**1. Пакет самого модуля — `com.qmods.app.auth`.** Меняйте, только если
хотите переложить модуль в другой пакет. Встречается во **всех файлах**
модуля (`smali/com/qmods/app/auth/*.smali`) плюс в файле-примере
(`.implements`/`const-class`/вызовы `DevicePairing`/`SubscriptionChecker`).
Если оставляете как есть — этот пункт можно пропустить.
```bash
grep -rl 'qmods/app/auth' smali smali-example      # проверить, где встречается
sed -i 's#Lcom/qmods/app/auth#Lyour/real/pkg/auth#g' path/to/renamed/*.smali
```
Не забудьте физически переименовать и саму папку `com/qmods/app/auth` →
`your/real/pkg/auth` — `.smali`-путь должен совпадать с именем класса внутри.

**2. Пакет вашей Activity — `com.example.app` в файле-примере.** Это
просто заглушка. `smali-example/com/example/app/MainActivity.smali` целиком
не копируется в проект — у вас уже есть своя Activity в decompiled-дереве
под своим пакетом; берётся только логика `onCreate`/`onResult`/`onError`/
`openGate` и вставляется в ваш существующий класс. Строка `.implements
Lcom/qmods/app/auth/SubscriptionCallback;` добавляется в шапку вашего
класса рядом с уже существующими `.implements`/`.super`. Также в
`GateActivity.smali`'s `onResult` замените `Lcom/instashopper/MainActivity;`
на класс вашей реальной Activity (это то, куда гейт возвращает
пользователя после успешной проверки).

## Сборка в APK

1. Скачайте [apktool](https://apktool.org/) и декомпилируйте ваш APK:
   `apktool d app-release.apk -o app-decompiled`.
2. Скопируйте `smali/com/qmods/app/auth/` в
   `app-decompiled/smali/com/qmods/app/auth/` (при нескольких smali-папках —
   `smali_classes2` и т.д. — в любую, главное не продублировать пакет).
   Если переименовываете пакет модуля — см. «Куда менять package name» выше.
3. В `DevicePairingRunnable.smali` и `SubscriptionCheckRunnable.smali`
   замените `https://update.qmurzik7.workers.dev` на реальный домен вашего
   воркера (см. `worker/wrangler.toml` → `PUBLIC_URL`), если он отличается.
4. **Добавьте `GateActivity` в `AndroidManifest.xml`** (внутри `<application>`,
   рядом с объявлением вашей основной Activity):
   ```xml
   <activity android:name="com.qmods.app.auth.GateActivity" android:exported="false" />
   ```
   (поправьте пакет на свой, если переименовывали модуль).
5. В вашей реальной Activity: добавьте `.implements
   Lcom/qmods/app/auth/SubscriptionCallback;` и вставьте логику из
   `onCreate`/`onResult`/`onError`/`openGate` — см. «Как работает гейт»
   выше и файл-пример.
6. Соберите обратно: `apktool b app-decompiled -o app-patched.apk`, подпишите
   (`apksigner`/`jarsigner` + `zipalign`) своим ключом.

## Ограничения / что стоит знать

- **`android.permission.INTERNET`** должен быть в `AndroidManifest.xml` —
  без него `Http.get/post` упадут с `SecurityException` на уровне ОС.
- Опрос (`/device/pair/status`) ограничен ~120 попытками по 2.5 сек
  (~5 минут) — после этого `onFailed("timeout")`, нужно заново
  `startPairing()`. Само окно привязки на сервере — 10 минут
  (`PAIRING_TTL_MS` в `worker/src/db.ts`).
- Подписка проверяется на **каждом холодном старте** (`onCreate`), не на
  каждом `onResume` — переключение приложений туда-обратно не бьёт по
  бэкенду лишними запросами. Если нужна проверка и на возврат из фона,
  продублируйте вызов `SubscriptionChecker.check()` в `onResume()`.
- `device_token` не имеет TTL, но **отзывается** при отвязке устройства
  через раздел «Устройства» в боте или Mini App (см. «Протокол» выше) —
  после этого приложение уходит на экран привязки при следующей проверке.
