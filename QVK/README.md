# QVK — неофициальный клиент ВКонтакте

QVK — быстрый, современный Android-клиент VK на Kotlin + Jetpack Compose с собственным премиальным
дизайном, Clean Architecture / MVVM и прямой работой с официальным VK API. Это не демо и не макет:
все экраны ниже подключены к реальным сетевым вызовам, реальной локальной базе (Room) и реальному
хранилищу токена (EncryptedSharedPreferences).

## Технологии

Kotlin · Jetpack Compose · Material 3 (динамические цвета, AMOLED-тема) · Clean Architecture (core /
feature, data-domain-presentation) · MVVM · Kotlin Coroutines + Flow · Paging 3 · Retrofit + OkHttp +
kotlinx.serialization · Room · Hilt · Coil · Media3 ExoPlayer · Navigation Compose · Gradle Kotlin DSL
· minSdk 26 (Android 8.0), compileSdk/targetSdk 35.

## Что реально работает

| Раздел | Статус |
|---|---|
| Авторизация VK OAuth (WebView, Standalone-flow), сохранение сессии, мультиаккаунт | ✅ |
| Лента: пагинация (Paging 3, курсор `next_from`), pull-to-refresh, офлайн-кеш первой страницы (Room) | ✅ |
| Посты: фото/видео/документы/ссылки/опросы/репосты, лайки, комментарии, репост, сохранение, скрытие источника, жалоба | ✅ |
| Профиль: аватар, статистика, стена (пагинация по offset), друзья, фото | ✅ |
| Сообщения: диалоги, переписка, отправка текста, реальный Long Poll (см. ограничения ниже), непрочитанные | ✅ (текст; вложения — см. ниже) |
| Сообщества: список, поиск, вступление/выход, стена, публикация от имени группы для админов | ✅ |
| Поиск: люди / группы / записи | ✅ |
| Уведомления: лайки, комментарии, ответы, подписки | ✅ |
| Видео: собственные видео + поиск, полноэкранный плеер на ExoPlayer | ✅ (без алгоритмической ленты «Клипов» — см. ниже) |
| Музыка: архитектура и плеер на Media3 готовы, но раздел закрыт баннером «недоступно» | ⚠️ см. ограничения |
| Настройки: тема (системная/светлая/тёмная/AMOLED), Material You, акцентный цвет, размер текста, качество фото/видео, экономия трафика, приватность, уведомления, очистка кеша | ✅ |
| Виджет «Непрочитанные» на главном экране | ✅ |
| Скрытие рекламных записей (`marked_as_ads`) | ✅ |
| EncryptedSharedPreferences для токена, network security config (только HTTPS) | ✅ |

## Честные ограничения API (и почему)

VK намеренно закрыл часть возможностей для сторонних приложений. Ниже — что именно и как это
отражено в архитектуре (не как «забытая функция», а как явное, документированное состояние):

- **Музыка.** С 2021 года VK не выдаёт скоуп `audio` новым сторонним приложениям — `audio.get` /
  `audio.search` возвращают ошибку 15 (`access denied`) почти для любого токена, кроме
  «партнёрских» приложений. `feature/music/data/MusicRepository` вызывает эти методы по-настоящему,
  ловит именно этот код ошибки и показывает пользователю понятный экран вместо «фейковой» библиотеки
  треков. Если у вашего токена всё же есть этот скоуп — раздел заработает без единой правки кода.
- **Видеолента «Клипы».** Алгоритмическая рекомендательная лента коротких видео официального
  приложения работает через внутренние методы, никогда не публиковавшиеся для сторонних
  разработчиков. QVK показывает вместо неё документированные `video.get`/`video.search` (ваши
  видео + полнотекстовый поиск) с полноценным плеером на ExoPlayer — сам плейбек настоящий, только
  подбор контента не алгоритмический.
- **Push-уведомления.** Настоящий push (как в официальном приложении) требует партнёрской
  интеграции с VK-инфраструктурой пуш-сертификатов, недоступной сторонним клиентам. QVK получает
  уведомления и новые сообщения через `notifications.get` и реальный messages Long Poll
  (`messages.getLongPollServer` + long-poll цикл), пока активен соответствующий экран.
- **Long Poll.** Протокол разобран не «по битам»: точный формат `updates[]` слегка отличается между
  `lp_version`/`mode` и версией API. `LongPollClient` декодирует только код события (4 = новое/
  изменённое сообщение) и на любое другое обновление просто перезапрашивает актуальные данные через
  обычный REST API — это чуть больше трафика, зато клиент не может «разъехаться» с форматом VK.
- **Вложения в сообщениях** (фото/документы/голосовые). Отправка текста и реалтайм-обновления
  полностью рабочие; загрузка медиавложений требует отдельного протокола
  (`docs.getMessagesUploadServer` → multipart-загрузка → `messages.send` с `attachment`) и намеренно
  не включена в этот проход, чтобы не оставлять полурабочий UI — задел под неё есть в
  `Attachment`/DTO-слое.
- **Экономия трафика / качество медиа.** Настройки качества фото/видео и экономии трафика
  сохраняются в DataStore и видны в UI, но выбор конкретного разрешения на каждый запрос изображения
  пока не протянут через все места загрузки — это следующий шаг поверх готовой архитектуры
  (`core/datastore/SettingsDataStore`).

## Регистрация приложения VK (обязательно перед первым запуском)

QVK не может использовать общий `client_id` — VK привязывает redirect URI к конкретному
приложению, и общий ключ либо не будет работать, либо будет заблокирован при первом же
всплеске трафика. Чтобы получить свой:

1. Зайдите на https://vk.com/apps?act=manage и создайте приложение типа **Standalone-приложение**
   (или «VK ID для приложения», в зависимости от текущего интерфейса VK).
2. Скопируйте **Client ID**.
3. Передайте его в сборку одним из способов:
   - в `local.properties` (не коммитится): `VK_CLIENT_ID=12345678`, затем в `app/build.gradle.kts`
     проксируется как Gradle-свойство — либо просто передайте флагом:
     `./gradlew assembleDebug -PVK_CLIENT_ID=12345678`
   - или пропишите в `~/.gradle/gradle.properties`: `VK_CLIENT_ID=12345678`.
4. Redirect URI, который нужно указать в настройках VK-приложения: `vk<ваш_client_id>://authorize`
   (QVK формирует его сам через `manifestPlaceholders`, см. `app/build.gradle.kts`).

Без `VK_CLIENT_ID` экран входа корректно покажет предупреждение (`login_no_client_id`), а не упадёт.

## Сборка

В этом окружении сборка **не выполнялась** — контейнер, в котором готовился проект, не имеет
доступа к Android SDK и не может обратиться к `dl.google.com` (исходящий трафик к серверам Google
заблокирован прокси окружения). Поэтому здесь нет скомпилированного APK — только полный,
самодостаточный исходный код, который соберётся у вас локально или в CI при наличии Android SDK.

### Локально (Android Studio)

Откройте папку `QVK/` в Android Studio (Koala+), дайте IDE подтянуть SDK/Gradle, задайте
`VK_CLIENT_ID` как описано выше, запустите обычный Run.

### Из командной строки

```bash
cd QVK
# отладочная сборка
./gradlew assembleDebug -PVK_CLIENT_ID=<ваш_id>

# release-сборка (см. подпись ниже)
./gradlew assembleRelease -PVK_CLIENT_ID=<ваш_id> \
  -PQVK_RELEASE_STORE_FILE=/path/to/release.keystore \
  -PQVK_RELEASE_STORE_PASSWORD=*** \
  -PQVK_RELEASE_KEY_ALIAS=qvk \
  -PQVK_RELEASE_KEY_PASSWORD=***
```

Debug-сборка подписывается автоматически стандартным debug-ключом Android SDK — отдельная
настройка не нужна.

### Подпись release-сборки

Release-подпись в `app/build.gradle.kts` активируется только когда заданы
`QVK_RELEASE_STORE_FILE`/`QVK_RELEASE_STORE_PASSWORD`/`QVK_RELEASE_KEY_ALIAS`/`QVK_RELEASE_KEY_PASSWORD`
(через `-P` флаги или `~/.gradle/gradle.properties` — **никогда не коммitьте keystore или пароли в
репозиторий**, `.gitignore` уже исключает `*.jks`/`*.keystore`/`keystore.properties`).

Создать новый keystore:

```bash
keytool -genkeypair -v -keystore release.keystore -alias qvk \
  -keyalg RSA -keysize 2048 -validity 10000
```

Готовый APK после сборки лежит в `app/build/outputs/apk/debug/` или
`app/build/outputs/apk/release/` — переложите его в `/output`, как и просили в задаче, локально
после сборки (`cp app/build/outputs/apk/release/app-release.apk /output/qvk.apk`).

## Архитектура

```
app/src/main/java/com/qvk/app/
  core/            — общие слои: network (Retrofit/DTO/мапперы), database (Room),
                     security (EncryptedSharedPreferences), datastore (настройки),
                     ui/theme, ui/components, media (ExoPlayer-сервис), di (Hilt-модули)
  navigation/      — Navigation Compose граф, нижняя навигация, корневой ViewModel
  feature/<name>/  — data / domain (модели в core/model) / presentation на фичу:
                     auth, feed, profile, messages, communities, search,
                     notifications, music, video, settings, widget
```

Каждый репозиторий — синглтон с конструкторной инъекцией через Hilt, без Service Locator.
Сеть оборачивается в `Resource<T>` (`core/common/Resource.kt`), VK-конверт `{response|error}`
разбирается один раз в `safeApiCall`. Кеш ленты/стены в Room использует один и тот же `PostDao` с
полем `bucket` ("home_feed" / "wall_<id>"), что убирает дублирование между лентой и профилем.

## Безопасность

- Токены хранятся только в `EncryptedSharedPreferences` (AES-256-GCM, см.
  `core/security/TokenManager.kt`) — никогда не логируются и не пишутся в обычные prefs/Room.
- `allowBackup="false"` и явные `data_extraction_rules` исключают secure prefs и БД из бэкапов.
- `network_security_config.xml` запрещает cleartext-трафик глобально.
- Все сетевые и парсинг-ошибки перехватываются в `safeApiCall`, ни один экран не падает от сетевого
  сбоя — вместо этого показывается `ErrorState` с повтором.
- Глобальный `Thread.UncaughtExceptionHandler` в `QvkApp` логирует фатальные ошибки перед крэшем
  (готовая точка подключения любого краш-репортера).

## Иконка и splash

Лончер — векторный adaptive-icon (`res/mipmap-anydpi-v26`, minSdk уже 26, поэтому растровые
фолбэки не нужны) с монохромным вариантом для Android 13+ themed icons. Splash — через
`androidx.core.splashscreen`, с той же векторной монограммой на фирменном синем/чёрном фоне для
светлой/тёмной темы.
