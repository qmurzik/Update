<?php
require __DIR__ . '/includes/bootstrap.php';
$user = current_user();

/* ── Данные только для отображения. Логика и бэкенд не менялись. ── */
$landingReviews = [];
$landingRating = 0.0;
if (is_file(__DIR__ . '/includes/reviews.php')) {
    require_once __DIR__ . '/includes/reviews.php';
    if (function_exists('approved_reviews')) {
        $landingReviews = array_slice(approved_reviews(), 0, 3);
        $landingRating = function_exists('reviews_average') ? reviews_average($landingReviews) : 0.0;
    }
}

$landingPlans = [];
if (!defined('PLANS') && is_file(__DIR__ . '/../subscribe/config.php')) {
    @require_once __DIR__ . '/../subscribe/config.php';
}
if (defined('PLANS') && is_array(PLANS)) $landingPlans = PLANS;

$landingAllUsers = load_users();
$landingUsers = count($landingAllUsers);
$landingActive = 0;
foreach ($landingAllUsers as $u) {
    $s = subscription_info($u);
    if ($s['active']) $landingActive++;
}

/* Новости — общие уведомления (без адресата) */
$landingNews = [];
foreach (load_notifications() as $n) {
    if ((string)($n['target'] ?? '') === '') $landingNews[] = $n;
}
usort($landingNews, fn($a, $b) => ((int)($b['created_at'] ?? 0)) <=> ((int)($a['created_at'] ?? 0)));
$landingNews = array_slice($landingNews, 0, 3);

/* Версия приложения для блока загрузчика */
$releaseFile = DATA_DIR . '/app_release.json';
$release = is_file($releaseFile) ? json_decode((string)file_get_contents($releaseFile), true) : null;
$releaseVersion = is_array($release) ? trim((string)($release['version'] ?? '')) : '';
$releaseDate = (is_array($release) && !empty($release['updated_at'])) ? date('d.m.Y', (int)$release['updated_at']) : '';
$releaseHasFile = is_array($release) && !empty($release['has_file']);

$kiraLines = [
    'Система QMODS онлайн. Чем помочь?',
    'Проверяю статус подписки… доступ подтверждён.',
    'Новая сборка мода уже в каталоге.',
    'Один аккаунт — одно устройство. Я слежу за этим.',
];

render_header('QMods', ['user' => $user]);
?>
<div class="lnd cyber">

  <!-- ══════════ HERO ══════════ -->
  <section class="cy-hero">
    <div class="cy-hero-head">
      <a class="cy-logo" href="index.php" aria-label="QMODS">
        <span class="cy-logo-mark">Q</span>
        <span class="cy-logo-text" data-glitch="QMODS">QMODS</span>
      </a>
      <div class="cy-tag"><i></i> 最高のチーム · PRIVATE PLATFORM</div>
    </div>

    <div class="cy-hero-grid">

      <div class="cy-hero-copy">
        <h1 class="cy-title" data-words>
          <span class="line">Твой мир</span>
          <span class="line"><em>модификаций</em></span>
        </h1>

        <p class="cy-lead">
          Каталог модов, подписка, безопасность и загрузчик приложения — в одной
          платформе. А рядом Kira: следит за доступом, подсказывает и держит систему под контролем.
        </p>

        <div class="cy-actions">
          <?php if ($user): ?>
            <a href="cabinet.php" class="primary-cta">Открыть кабинет <b>→</b></a>
            <a href="../subscribe/" class="soft-cta">QMODS Premium</a>
          <?php else: ?>
            <a href="register.php" class="primary-cta">Получить доступ <b>→</b></a>
            <a href="login.php" class="soft-cta">Войти в систему</a>
          <?php endif; ?>
        </div>

        <div class="cy-hero-stats">
          <div><b data-count="<?= (int)$landingUsers ?>">0</b><small>УЧАСТНИКОВ</small></div>
          <div><b data-count="<?= (int)$landingActive ?>">0</b><small>АКТИВНЫХ ДОСТУПОВ</small></div>
          <div><b>24/7</b><small>БЕЗ ПЕРЕРЫВОВ</small></div>
          <?php if ($landingRating > 0): ?>
            <div><b><?= number_format($landingRating, 1, ',', '') ?>★</b><small>РЕЙТИНГ</small></div>
          <?php endif; ?>
        </div>
      </div>

      <div class="cy-hero-kira">
        <div class="kira-frame">
          <img src="assets/kira-hero.webp" alt="Kira — цифровой ассистент QMODS" width="880" height="1100" fetchpriority="high">
          <span class="bracket tl"></span><span class="bracket tr"></span>
          <span class="bracket bl"></span><span class="bracket br"></span>
          <div class="kira-plate">
            <img src="assets/kira-avatar.webp" alt="" width="40" height="40">
            <div><b>KIRA</b><small>AI ASSISTANT</small></div>
            <span class="kira-online">ONLINE</span>
          </div>
        </div>

        <div class="kira-chip kc1" data-parallax="0.04">
          <em>✓</em><div><b>Доступ защищён</b><small>проверка на сервере</small></div>
        </div>
        <div class="kira-chip kc2" data-parallax="0.07">
          <em>◈</em><div><b>1 устройство</b><small>привязка аккаунта</small></div>
        </div>

        <div class="kira-say">
          <span data-type='<?= e(implode('|', $kiraLines)) ?>'></span><i></i>
        </div>
      </div>

    </div>
  </section>

  <!-- ══════════ БЕГУЩАЯ СТРОКА ══════════ -->
  <div class="lnd-marquee" aria-hidden="true">
    <div class="lnd-marquee-track">
      <?php for ($i = 0; $i < 2; $i++): ?>
        <span>Каталог модов</span><span>QMODS Premium</span><span>Безопасный доступ</span>
        <span>Личный кабинет</span><span>Загрузчик приложения</span><span>Telegram-бот</span>
        <span>Достижения и уровни</span><span>Kira AI</span>
      <?php endfor; ?>
    </div>
  </div>

  <!-- ══════════ РАЗДЕЛЫ ПЛАТФОРМЫ ══════════ -->
  <section class="lnd-section" id="platform">
    <div class="lnd-head" data-reveal>
      <span class="eyebrow">// Платформа</span>
      <h2>Шесть модулей <span class="grad-text">одной системы</span></h2>
      <p>Каждый раздел QMODS работает с единым аккаунтом: то, что вы делаете в одном месте, сразу видно в остальных.</p>
    </div>

    <div class="cy-grid">
      <a class="cy-card" href="<?= $releaseHasFile ? 'download.php' : '#launcher' ?>" data-reveal>
        <span class="cy-num">01</span>
        <div class="cy-ico">◈</div>
        <h3>Каталог модов</h3>
        <p>Актуальные сборки с описанием изменений<?= $releaseVersion !== '' ? '. Сейчас в каталоге версия ' . e($releaseVersion) : '' ?>. Всё скачивается напрямую с нашего сервера.</p>
        <span class="cy-more">Открыть каталог <b>→</b></span>
      </a>

      <a class="cy-card" href="<?= $user ? 'cabinet.php' : 'login.php' ?>" data-reveal>
        <span class="cy-num">02</span>
        <div class="cy-ico">▣</div>
        <h3>Личный кабинет</h3>
        <p>Статус подписки, устройство, достижения, рефералы и история платежей — на одном экране.</p>
        <span class="cy-more">В кабинет <b>→</b></span>
      </a>

      <a class="cy-card accent" href="../subscribe/" data-reveal>
        <span class="cy-num">03</span>
        <span class="cy-badge">PREMIUM</span>
        <div class="cy-ico">♛</div>
        <h3>QMODS Premium</h3>
        <p>Полный доступ к модам без ограничений. Срок складывается с текущим — ни один день не сгорает.</p>
        <span class="cy-more">Выбрать тариф <b>→</b></span>
      </a>

      <a class="cy-card" href="#security" data-reveal>
        <span class="cy-num">04</span>
        <div class="cy-ico">⛨</div>
        <h3>Безопасность</h3>
        <p>Привязка к устройству, проверка подписки на сервере, защита пробного периода и контроль сессий.</p>
        <span class="cy-more">Как это работает <b>→</b></span>
      </a>

      <a class="cy-card" href="#news" data-reveal>
        <span class="cy-num">05</span>
        <div class="cy-ico">⌁</div>
        <h3>Новости</h3>
        <p>Обновления мода, статус серверов и важные объявления команды — прямо на главной и в кабинете.</p>
        <span class="cy-more">Читать <b>→</b></span>
      </a>

      <a class="cy-card" href="#launcher" data-reveal>
        <span class="cy-num">06</span>
        <div class="cy-ico">⇩</div>
        <h3>Загрузчик приложения</h3>
        <p>Мобильный клиент QMODS<?= $releaseVersion !== '' ? ' v' . e($releaseVersion) : '' ?>: вход по аккаунту, автопроверка доступа и обновления.</p>
        <span class="cy-more">Скачать APK <b>→</b></span>
      </a>
    </div>
  </section>

  <!-- ══════════ KIRA ══════════ -->
  <section class="lnd-section" id="kira">
    <div class="cy-band" data-reveal>
      <div class="cy-band-art">
        <img src="assets/kira-card.webp" alt="Kira — цифровой ассистент QMODS" width="560" height="700" loading="lazy">
      </div>
      <div class="cy-band-copy">
        <span class="eyebrow">// Цифровой ассистент</span>
        <h2>Kira — лицо <span class="grad-text">системы QMODS</span></h2>
        <p>Она встречает вас на главной, сопровождает в кабинете и первой сообщает, что доступ скоро закончится. Kira — не украшение: за её репликами стоят реальные проверки, которые выполняет сервер.</p>
        <div class="cy-band-list">
          <div><span>◷</span><div><b>Следит за подпиской</b><small>напоминает заранее, пока доступ ещё активен</small></div></div>
          <div><span>⛨</span><div><b>Контролирует устройство</b><small>один аккаунт — одно устройство, без исключений</small></div></div>
          <div><span>✦</span><div><b>Ведёт прогресс</b><small>уровни, достижения и бонусные дни за активность</small></div></div>
        </div>
      </div>
    </div>
  </section>

  <!-- ══════════ БЕЗОПАСНОСТЬ ══════════ -->
  <section class="lnd-section" id="security">
    <div class="lnd-head" data-reveal>
      <span class="eyebrow">// Безопасность</span>
      <h2>Доступ, который <span class="grad-text">нельзя подделать</span></h2>
      <p>Проверка происходит на сервере при каждом входе — приложение не решает это самостоятельно.</p>
    </div>
    <div class="lnd-steps">
      <article class="lnd-step" data-reveal>
        <div class="step-dot">1</div>
        <h3>Вход по аккаунту</h3>
        <p>Пароль хранится только в виде хеша. Сессия защищена CSRF-токеном и ограничением попыток входа.</p>
      </article>
      <article class="lnd-step" data-reveal>
        <div class="step-dot">2</div>
        <h3>Привязка устройства</h3>
        <p>Аккаунт закрепляется за устройством. Вход с нового завершает старую сессию — вы всегда об этом узнаете.</p>
      </article>
      <article class="lnd-step" data-reveal>
        <div class="step-dot">3</div>
        <h3>Проверка подписки</h3>
        <p>Сервер сверяет срок доступа до того, как приложение откроется. Просроченный аккаунт не пройдёт.</p>
      </article>
    </div>
  </section>

  <?php if ($landingPlans): ?>
  <!-- ══════════ PREMIUM ══════════ -->
  <section class="lnd-section" id="premium">
    <div class="lnd-head" data-reveal>
      <span class="eyebrow">// QMODS Premium</span>
      <h2>Чем дольше — <span class="grad-text">тем выгоднее</span></h2>
      <p>Любой срок добавляется к уже активной подписке. Активация — сразу после подтверждения платежа.</p>
    </div>
    <div class="lnd-plans">
      <?php foreach ($landingPlans as $code => $plan):
        $days = max(1, (int)$plan['days']);
        $perDay = (float)$plan['price'] / $days;
        $hot = $code === 'm3';
      ?>
      <article class="lnd-plan <?= $hot ? 'hot' : '' ?>" data-reveal>
        <?php if ($hot): ?><span class="plan-tag">ВЫБОР ИГРОКОВ</span><?php endif; ?>
        <h3><?= e((string)$plan['title']) ?></h3>
        <div class="plan-price"><?= number_format((float)$plan['price'], 0, ',', ' ') ?><span> ₽</span></div>
        <div class="plan-day">≈ <?= number_format($perDay, 2, ',', ' ') ?> ₽ в день</div>
        <ul class="plan-feats">
          <li><?= $days ?> дней полного доступа</li>
          <li>Мгновенная активация</li>
          <li>Срок складывается</li>
        </ul>
        <a class="<?= $hot ? 'primary-cta' : 'soft-cta' ?> full" href="<?= $user ? '../subscribe/' : 'register.php' ?>">
          <?= $user ? 'Выбрать' : 'Начать' ?> <b>→</b>
        </a>
      </article>
      <?php endforeach; ?>
    </div>
  </section>
  <?php endif; ?>

  <!-- ══════════ ЗАГРУЗЧИК ══════════ -->
  <section class="lnd-section" id="launcher">
    <div class="cy-launcher" data-reveal>
      <div>
        <span class="eyebrow">// Загрузчик</span>
        <h2>Приложение QMODS<?= $releaseVersion !== '' ? ' <span class="grad-text">v' . e($releaseVersion) . '</span>' : '' ?></h2>
        <p>Мобильный клиент входит в систему под вашим аккаунтом, сам проверяет доступ и подсказывает, когда вышло обновление.</p>
        <div class="cy-lchips">
          <span class="support-chip">📱 Android</span>
          <?php if ($releaseDate): ?><span class="support-chip">🕘 Обновлено <?= e($releaseDate) ?></span><?php endif; ?>
          <span class="support-chip">⛨ Прямая загрузка</span>
        </div>
        <div class="cy-actions" style="margin-top:22px">
          <?php if ($releaseHasFile && $user): ?>
            <a class="primary-cta" href="download.php">⇩ Скачать APK</a>
          <?php elseif (!$user): ?>
            <a class="primary-cta" href="register.php">Получить доступ <b>→</b></a>
          <?php else: ?>
            <a class="primary-cta" href="cabinet.php">Открыть кабинет <b>→</b></a>
          <?php endif; ?>
        </div>
      </div>

      <div class="cy-progress" aria-hidden="true">
        <div class="cy-progress-top">
          <b>qmods-app.apk</b>
          <span><?= $releaseVersion !== '' ? 'v' . e($releaseVersion) : 'latest' ?></span>
        </div>
        <div class="cy-progress-rail"><i></i></div>
        <div class="cy-progress-meta">
          <span>ПРОВЕРКА ПОДПИСИ</span>
          <span>SECURE CHANNEL</span>
        </div>
      </div>
    </div>
  </section>

  <?php if ($landingNews): ?>
  <!-- ══════════ НОВОСТИ ══════════ -->
  <section class="lnd-section" id="news">
    <div class="lnd-head" data-reveal>
      <span class="eyebrow">// Новости</span>
      <h2>Что происходит <span class="grad-text">в системе</span></h2>
    </div>
    <div class="cy-news">
      <?php foreach ($landingNews as $n): ?>
      <article data-reveal>
        <span class="dot"></span>
        <time><?= date('d.m.Y', (int)($n['created_at'] ?? 0)) ?></time>
        <h3><?= e((string)($n['title'] ?? 'Обновление')) ?></h3>
        <p><?= e(mb_substr((string)($n['message'] ?? ''), 0, 190)) ?></p>
      </article>
      <?php endforeach; ?>
    </div>
  </section>
  <?php endif; ?>

  <?php if ($landingReviews): ?>
  <!-- ══════════ ОТЗЫВЫ ══════════ -->
  <section class="lnd-section">
    <div class="lnd-head" data-reveal>
      <span class="eyebrow">// Отзывы</span>
      <h2>Что говорят участники</h2>
    </div>
    <div class="lnd-reviews">
      <?php foreach ($landingReviews as $r):
        $name = (string)($r['username'] ?? '—');
        $rate = max(1, min(5, (int)($r['rating'] ?? 5)));
      ?>
      <article class="rev-card" data-reveal>
        <div class="rev-stars"><?= str_repeat('★', $rate) . str_repeat('☆', 5 - $rate) ?></div>
        <p><?= e(mb_substr((string)($r['text'] ?? ''), 0, 240)) ?></p>
        <div class="rev-who">
          <span><?= e(mb_strtoupper(mb_substr($name, 0, 1))) ?></span>
          <div><b><?= e($name) ?></b><small><?= !empty($r['verified']) ? '✓ Подтверждённый доступ' : 'Участник QMODS' ?></small></div>
        </div>
      </article>
      <?php endforeach; ?>
    </div>
  </section>
  <?php endif; ?>

  <!-- ══════════ FAQ ══════════ -->
  <section class="lnd-section">
    <div class="lnd-head" data-reveal>
      <span class="eyebrow">// Вопросы</span>
      <h2>Коротко о главном</h2>
    </div>
    <div class="lnd-faq">
      <details class="faq-item" data-reveal>
        <summary>Сколько устройств можно привязать?</summary>
        <div class="faq-body">Одно устройство на аккаунт. При входе с нового старая сессия завершается — это защищает доступ от передачи третьим лицам. Отвязать устройство можно в кабинете.</div>
      </details>
      <details class="faq-item" data-reveal>
        <summary>Что будет с оставшимися днями при продлении?</summary>
        <div class="faq-body">Новый срок складывается с текущим. Продлевать заранее выгодно — ни один день не сгорает.</div>
      </details>
      <details class="faq-item" data-reveal>
        <summary>Как быстро активируется QMODS Premium?</summary>
        <div class="faq-body">Сразу после подтверждения платежа от ЮMoney — обычно это занимает несколько секунд. Кабинет обновит статус автоматически.</div>
      </details>
      <details class="faq-item" data-reveal>
        <summary>Kira — это живой человек?</summary>
        <div class="faq-body">Нет, Kira — цифровой ассистент и символ платформы. Её реплики отражают реальное состояние вашего аккаунта: срок подписки, статус устройства и прогресс.</div>
      </details>
      <details class="faq-item" data-reveal>
        <summary>Что делать, если что-то пошло не так?</summary>
        <div class="faq-body">Откройте раздел поддержки в кабинете — форма соберёт обращение со всеми нужными данными, останется отправить его в Telegram.</div>
      </details>
    </div>
  </section>

  <!-- ══════════ CTA ══════════ -->
  <section>
    <div class="lnd-cta" data-reveal>
      <h2><?= $user ? 'С возвращением в систему' : 'Готовы войти в QMODS?' ?></h2>
      <p><?= $user
        ? 'Ваш кабинет ждёт: статус доступа, достижения и история — всё на месте.'
        : 'Создайте аккаунт за минуту и получите доступ к платформе прямо с вашего устройства.' ?></p>
      <div class="cy-actions" style="justify-content:center">
        <?php if ($user): ?>
          <a href="cabinet.php" class="primary-cta">В кабинет <b>→</b></a>
        <?php else: ?>
          <a href="register.php" class="primary-cta">Создать аккаунт <b>→</b></a>
          <a href="login.php" class="soft-cta">Войти</a>
        <?php endif; ?>
      </div>
    </div>

    <footer class="lnd-footer">
      <span><b>QMODS</b> · Private Modding Platform</span>
      <span><?php if ($user): ?><a href="support.php">Поддержка</a> · <?php endif; ?>Безопасная оплата через ЮMoney</span>
    </footer>
  </section>

</div>
<?php render_footer(); ?>
