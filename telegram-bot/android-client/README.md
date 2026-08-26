# QMods Android client — авторизация через бота

Готовый smali-модуль (`smali/com/qmods/app/auth/`), который добавляет в
Android-приложение вход через Telegram-бота и проверку подписки — без
пароля/сессии на сайте внутри APK, только короткоживущий код привязки и
затем свой собственный `device_token`.

Написан на **smali** (а не Kotlin/Java), потому что предполагается вклейка
в уже собранный APK, для которого нет исходников — обычный сценарий,
когда патчишь готовое приложение через `apktool`. Если у вас есть
исходники/Gradle-проект, гораздо разумнее переписать это на Kotlin (в
разделе «Логика» ниже — построчное описание, чтобы это было легко
сделать) — smali здесь не даёт никаких преимуществ, кроме как раз
совместимости с decompiled-проектом.

## Как это проверялось

Смали писался вручную, поэтому каждый файл прогонялся через настоящий
ассемблер (не просто "выглядит похоже на смали"):

```bash
# те же координаты, что ниже в "Сборка в APK"
java -cp 'smali-2.5.2.jar:dexlib2-2.5.2.jar:util-2.5.2.jar:antlr-3.5.2.jar:antlr-runtime-3.5.2.jar:jcommander-1.64.jar:stringtemplate-3.2.1.jar:guava-27.1-android.jar' \
  org.jf.smali.Main assemble -o /tmp/check.dex -a 30 smali
```

Все 9 файлов собираются в валидный DEX без ошибок. Дополнительно результат
разобран обратно через `baksmali` и построчно сверен с оригиналом — инструкции
и операнды совпадают полностью (отличия только косметические: порядок
методов/полей и автоматически сгенерированные имена меток). Это не
гарантирует, что рантайм-логика на 100% ведёт себя как задумано (это можно
подтвердить только реальным запуском на устройстве/эмуляторе), но снимает
основной риск ручного smali — синтаксические ошибки и рассинхрон регистров
(в частности, реальный баг был найден и исправлен именно так:
`SubscriptionDispatcher`'s constructor берёт 6 параметров — 7 регистров
вместе с самим инстансом, — что превышает лимит в 5 регистров для обычного
`invoke-direct`; понадобился `invoke-direct/range` с непрерывным блоком
регистров).

## Классы

| Класс | Роль |
|---|---|
| `DevicePairing` | Публичная точка входа: `startPairing(Context, PairingCallback)` |
| `DevicePairingRunnable` | Фоновый поток: запрашивает код, открывает Telegram, поллит статус |
| `PairingCallback` | Интерфейс обратного вызова для привязки (`onCodeReady`/`onPaired`/`onFailed`) |
| `CallbackDispatcher` | Доставляет вызовы `PairingCallback` в UI-поток через `Handler` |
| `SubscriptionChecker` | Публичная точка входа: `isPaired`/`check`/`clearPairing` |
| `SubscriptionCheckRunnable` | Фоновый поток: читает `device_token`, спрашивает Worker о подписке |
| `SubscriptionCallback` | Интерфейс обратного вызова для проверки подписки |
| `SubscriptionDispatcher` | Доставляет вызовы `SubscriptionCallback` в UI-поток |
| `Http` | Общий блокирующий GET/POST на `HttpURLConnection`, без внешних зависимостей |

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
   обычный `/link`) — бот видит `devicelink_<CODE>`, проверяет привязку и
   создаёт `device_token` (`worker/src/handlers/devicePair.ts`).
4. **Приложение**: поллит `GET /device/pair/status?code=<CODE>` каждые
   ~2.5 сек до `{status: "claimed", device_token: "..."}` — сохраняет токен
   в `SharedPreferences` и вызывает `callback.onPaired(token)`.
5. **Дальше при каждой проверке подписки**: `SubscriptionChecker.check(...)`
   → `GET /device/subscription?token=<TOKEN>` → воркер резолвит токен в
   username (D1) и спрашивает `mod/api/bot.php` (`device_subscription`) →
   `{active, days_left, plan}`.

Приложение **никогда** не видит пароль/сессию qmods.ru, ни бот-токен
Cloudflare Worker — только свой собственный `device_token`, который ничего
не даёт без уже подтверждённой в Telegram привязки к конкретному аккаунту.

## Вызов из `onCreate` (реальный smali, не псевдокод)

`smali-example/com/example/app/MainActivity.smali` — полный пример: класс
реализует `PairingCallback` и `SubscriptionCallback` прямо на себе (проще
всего вклеить в существующую Activity — не нужна отдельная анонимная
реализация, которой в smali-то и нет), `onCreate` решает между
`isPaired()`/`check()` и `startPairing()`, плюс все 5 callback-методов как
рабочие заглушки на `Toast`. Собран и сверен тем же способом, что и сам
модуль (см. «Как это проверялось»).

Суть `onCreate`:

```smali
invoke-super {p0, p1}, Landroid/app/Activity;->onCreate(Landroid/os/Bundle;)V

# ... ваш setContentView(...) остаётся как есть ...

invoke-static {p0}, Lcom/qmods/app/auth/SubscriptionChecker;->isPaired(Landroid/content/Context;)Z
move-result v0
if-eqz v0, :not_paired

invoke-static {p0, p0}, Lcom/qmods/app/auth/SubscriptionChecker;->check(Landroid/content/Context;Lcom/qmods/app/auth/SubscriptionCallback;)V
goto :done

:not_paired
invoke-static {p0, p0}, Lcom/qmods/app/auth/DevicePairing;->startPairing(Landroid/content/Context;Lcom/qmods/app/auth/PairingCallback;)V

:done
return-void
```

`p0` (сама Activity) передаётся как коллбэк в обоих вызовах — именно
поэтому класс должен объявлять `.implements` на оба интерфейса (см.
`.class`/`.super`/`.implements` в начале файла-примера). Если ваша Activity
уже реализует другие интерфейсы — просто добавьте ещё две строки
`.implements` рядом с уже существующими, конфликтов не будет.

## Куда менять package name

Два **независимых** переименования — не перепутайте:

**1. Пакет самого модуля — `com.qmods.app.auth`.** Меняйте, только если
хотите переложить модуль в другой пакет (например, чтобы не плодить лишний
`com.qmods.*` рядом с вашим). Встречается в **10 файлах** — 9 в
`smali/com/qmods/app/auth/` (сам модуль) плюс `smali-example/.../MainActivity.smali`
(пример, 8 упоминаний: 2 `.implements` + 6 вызовов). Если оставляете как
есть — этот пункт можно пропустить.
```bash
grep -rl 'qmods/app/auth' smali smali-example      # проверить, где встречается
# после переноса в новый путь:
sed -i 's#Lcom/qmods/app/auth#Lyour/real/pkg/auth#g' path/to/renamed/*.smali
```
Не забудьте физически переименовать и саму папку `com/qmods/app/auth` →
`your/real/pkg/auth`, `.smali`-путь должен совпадать с именем класса внутри.

**2. Пакет вашей Activity — `com.example.app` в файле-примере.** Это
просто заглушка. `smali-example/com/example/app/MainActivity.smali` целиком
не копируется в проект — у вас уже есть своя Activity в decompiled-дереве
под своим пакетом; берётся только **тело** `onCreate` (кусок между
`invoke-super` и `return-void`) и 5 callback-методов, и вставляется в ваш
существующий класс. Строки `.implements Lcom/qmods/app/auth/PairingCallback;`
и `.implements Lcom/qmods/app/auth/SubscriptionCallback;` добавляются в
шапку вашего класса рядом с уже существующими `.implements`/`.super`.

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
4. В вашей реальной Activity: добавьте два `.implements` и вставьте вызовы
   из `onCreate` + 5 callback-методов — см. «Вызов из onCreate» выше.
5. Соберите обратно: `apktool b app-decompiled -o app-patched.apk`, подпишите
   (`apksigner`/`jarsigner` + `zipalign`) своим ключом.

## Ограничения / что стоит знать

- **`android.permission.INTERNET`** должен быть в `AndroidManifest.xml` —
  без него `Http.get/post` упадут с `SecurityException` на уровне ОС.
- Опрос (`/device/pair/status`) ограничен ~120 попытками по 2.5 сек
  (~5 минут) — после этого `onFailed("timeout")`, нужно заново
  `startPairing()`. Само окно привязки на сервере — 10 минут
  (`PAIRING_TTL_MS` в `worker/src/db.ts`).
- `device_token` не имеет TTL и не отзывается автоматически — если нужен
  logout/сброс привязки на конкретном устройстве, добавьте на сайте/боте
  действие, которое удаляет строку из D1 `device_tokens` (сейчас это можно
  сделать только вручную через `wrangler d1 execute`).
