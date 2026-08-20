<?php
require __DIR__ . '/includes/bootstrap.php';
$user = current_user();

/* Данные только для отображения — логика не меняется. */
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

render_header('QMods', ['user' => $user]);
?>
<div class="lnd">

  <!-- ══ HERO ══ -->
  <section class="lnd-hero">
    <div class="lnd-hero-grid">
      <div class="lnd-hero-copy">
        <div class="lnd-pill"><i></i> QMods · Private Access</div>

        <h1 class="lnd-title" data-words>
          <span class="line">Твой мод.</span>
          <span class="line"><em>Твой контроль.</em></span>
        </h1>

        <p class="lnd-lead">
          Единый центр аккаунта, подписки и доступа к приложению.
          Всё синхронизировано с устройством, всё под рукой — и ничего лишнего.
        </p>

        <div class="lnd-actions">
          <?php if ($user): ?>
            <a href="cabinet.php" class="primary-cta">Открыть кабинет <b>→</b></a>
            <a href="../subscribe/" class="soft-cta">Продлить доступ</a>
          <?php else: ?>
            <a href="register.php" class="primary-cta">Получить доступ <b>→</b></a>
            <a href="login.php" class="soft-cta">У меня есть аккаунт</a>
          <?php endif; ?>
        </div>

        <div class="lnd-trust">
          <div class="lnd-trust-dots"><span>Q</span><span>M</span><span>O</span><span>D</span></div>
          <div class="lnd-trust-copy">
            <b><?= $landingUsers > 0 ? $landingUsers . '+ участников' : 'Закрытое сообщество' ?></b>
            <small>
              <?php if ($landingRating > 0): ?>
                <span class="lnd-stars"><?= str_repeat('★', (int)round($landingRating)) ?></span>
                <?= number_format($landingRating, 1, ',', '') ?> из 5 по отзывам
              <?php else: ?>
                Доступ по подписке · одно устройство
              <?php endif; ?>
            </small>
          </div>
        </div>
      </div>

      <div class="lnd-visual" aria-hidden="true">
        <div class="orb-stage">
          <i class="orb-ring r2"></i>
          <i class="orb-ring r1"></i>
          <i class="orb-ring r3"></i>
          <div class="orb-core">Q</div>
          <div class="orb-sat s1">◈</div>
          <div class="orb-sat s2">⚡</div>
          <div class="orb-sat s3">✦</div>
        </div>
        <div class="float-card fc1" data-parallax="0.05">
          <em>✓</em><div><b>Доступ активен</b><small>проверено сервером</small></div>
        </div>
        <div class="float-card fc2" data-parallax="0.09">
          <em>↗</em><div><b>+3 дня</b><small>за приглашённого друга</small></div>
        </div>
      </div>
    </div>
  </section>

  <!-- ══ БЕГУЩАЯ СТРОКА ══ -->
  <div class="lnd-marquee" aria-hidden="true">
    <div class="lnd-marquee-track">
      <?php for ($i = 0; $i < 2; $i++): ?>
        <span>Единый аккаунт</span><span>Проверка подписки</span><span>Одно устройство</span>
        <span>Достижения и уровни</span><span>Бонусные дни</span><span>Telegram-бот</span>
        <span>Безопасная оплата</span><span>Мгновенная активация</span>
      <?php endfor; ?>
    </div>
  </div>

  <!-- ══ МЕТРИКИ ══ -->
  <section class="lnd-stats">
    <article class="lnd-stat" data-reveal><b data-count="24" data-suffix="/7">0</b><small>Доступ без перерывов</small></article>
    <article class="lnd-stat" data-reveal><b data-count="<?= (int)$landingActive ?>">0</b><small>Активных подписок</small></article>
    <article class="lnd-stat" data-reveal><b data-count="1">0</b><small>Устройство на аккаунт</small></article>
    <article class="lnd-stat" data-reveal><b>∞</b><small>Достижений впереди</small></article>
  </section>

  <!-- ══ ВОЗМОЖНОСТИ ══ -->
  <section class="lnd-section" id="features">
    <div class="lnd-head" data-reveal>
      <span class="eyebrow">Возможности</span>
      <h2>Всё, что нужно — <span class="grad-text">в одном месте</span></h2>
      <p>Аккаунт, подписка, устройство и прогресс живут в единой системе. Без чатов, таблиц и ручных проверок.</p>
    </div>
    <div class="lnd-features">
      <article class="lnd-feature f1" data-reveal>
        <span class="feat-num">01</span>
        <div class="feat-ico">◈</div>
        <h3>Единый аккаунт</h3>
        <p>Авторизация, устройство и подписка связаны в одной системе. Вошёл — и всё уже на месте.</p>
      </article>
      <article class="lnd-feature f2" data-reveal>
        <span class="feat-num">02</span>
        <div class="feat-ico">⚡</div>
        <h3>Безопасный доступ</h3>
        <p>Сервер проверяет активность подписки перед каждым входом в приложение. Ничего не проскочит.</p>
      </article>
      <article class="lnd-feature f3" data-reveal>
        <span class="feat-num">03</span>
        <div class="feat-ico">✦</div>
        <h3>Живой прогресс</h3>
        <p>Уровни, достижения и бонусные дни превращают обычный аккаунт в систему прогресса.</p>
      </article>
    </div>
  </section>

  <!-- ══ БЕНТО ══ -->
  <section class="lnd-section">
    <div class="lnd-head" data-reveal>
      <span class="eyebrow">Внутри кабинета</span>
      <h2>Панель, в которую <span class="grad-text">приятно заходить</span></h2>
    </div>
    <div class="lnd-bento">
      <article class="bento bento-lg" data-reveal>
        <div>
          <div class="bento-ico">◷</div>
          <h3>Наглядный статус подписки</h3>
          <p>Кольцевой индикатор, точная дата окончания и напоминания заранее — вы всегда знаете, сколько дней осталось.</p>
        </div>
        <div class="bento-visual">
          <?php foreach ([38, 55, 42, 78, 64, 92, 71, 100] as $k => $h): ?>
            <i style="height:<?= $h ?>%;animation-delay:<?= 90 * $k ?>ms"></i>
          <?php endforeach; ?>
        </div>
      </article>
      <article class="bento" data-reveal>
        <div class="bento-ico">↗</div>
        <h3>Рефералы</h3>
        <p>Личный код, ссылка в один клик и +3 дня за каждого приглашённого друга после его первой оплаты.</p>
        <div style="margin-top:16px"><span class="bento-chip">+3 дня за друга</span></div>
      </article>
      <article class="bento" data-reveal>
        <div class="bento-ico">🤖</div>
        <h3>Telegram-бот</h3>
        <p>Подписка, платежи и данные аккаунта — прямо в мессенджере. Привязка одним кодом из кабинета.</p>
        <div style="margin-top:16px"><span class="bento-chip">Код действует 10 минут</span></div>
      </article>
    </div>
  </section>

  <!-- ══ ШАГИ ══ -->
  <section class="lnd-section">
    <div class="lnd-head" data-reveal>
      <span class="eyebrow">Как начать</span>
      <h2>Три шага до доступа</h2>
    </div>
    <div class="lnd-steps">
      <article class="lnd-step" data-reveal>
        <div class="step-dot">1</div>
        <h3>Создайте аккаунт</h3>
        <p>Ник и пароль — это всё. Регистрация с устройства сразу открывает пробный доступ.</p>
      </article>
      <article class="lnd-step" data-reveal>
        <div class="step-dot">2</div>
        <h3>Выберите тариф</h3>
        <p>Оплата через ЮMoney. Срок складывается с текущим — ничего не сгорает.</p>
      </article>
      <article class="lnd-step" data-reveal>
        <div class="step-dot">3</div>
        <h3>Пользуйтесь</h3>
        <p>Приложение проверяет подписку автоматически. Кабинет держит вас в курсе.</p>
      </article>
    </div>
  </section>

  <?php if ($landingPlans): ?>
  <!-- ══ ТАРИФЫ ══ -->
  <section class="lnd-section" id="plans">
    <div class="lnd-head" data-reveal>
      <span class="eyebrow">Тарифы</span>
      <h2>Чем дольше — <span class="grad-text">тем выгоднее</span></h2>
      <p>Любой срок добавляется к уже активной подписке.</p>
    </div>
    <div class="lnd-plans">
      <?php $pi = 0; foreach ($landingPlans as $code => $plan): $pi++;
        $days = max(1, (int)$plan['days']);
        $perDay = (float)$plan['price'] / $days;
        $hot = $code === 'm3';
      ?>
      <article class="lnd-plan <?= $hot ? 'hot' : '' ?>" data-reveal>
        <?php if ($hot): ?><span class="plan-tag">ПОПУЛЯРНЫЙ</span><?php endif; ?>
        <h3><?= e((string)$plan['title']) ?></h3>
        <div class="plan-price"><?= number_format((float)$plan['price'], 0, ',', ' ') ?><span> ₽</span></div>
        <div class="plan-day">≈ <?= number_format($perDay, 2, ',', ' ') ?> ₽ в день</div>
        <ul class="plan-feats">
          <li><?= $days ?> дней доступа</li>
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

  <?php if ($landingReviews): ?>
  <!-- ══ ОТЗЫВЫ ══ -->
  <section class="lnd-section">
    <div class="lnd-head" data-reveal>
      <span class="eyebrow">Отзывы</span>
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
          <div><b><?= e($name) ?></b><small><?= !empty($r['verified']) ? '✓ Подтверждённый доступ' : 'Участник QMods' ?></small></div>
        </div>
      </article>
      <?php endforeach; ?>
    </div>
  </section>
  <?php endif; ?>

  <!-- ══ FAQ ══ -->
  <section class="lnd-section">
    <div class="lnd-head" data-reveal>
      <span class="eyebrow">Вопросы</span>
      <h2>Коротко о главном</h2>
    </div>
    <div class="lnd-faq">
      <details class="faq-item" data-reveal>
        <summary>Сколько устройств можно привязать?</summary>
        <div class="faq-body">Одно устройство на аккаунт. При входе с нового устройства старая сессия завершается — это защищает доступ от передачи третьим лицам. Отвязать устройство можно в кабинете.</div>
      </details>
      <details class="faq-item" data-reveal>
        <summary>Что будет с оставшимися днями при продлении?</summary>
        <div class="faq-body">Новый срок складывается с текущим. Продлевать заранее выгодно — ни один день не сгорает.</div>
      </details>
      <details class="faq-item" data-reveal>
        <summary>Как быстро активируется подписка после оплаты?</summary>
        <div class="faq-body">Сразу после подтверждения платежа от ЮMoney — обычно это занимает несколько секунд. Кабинет обновит статус автоматически.</div>
      </details>
      <details class="faq-item" data-reveal>
        <summary>Что делать, если что-то пошло не так?</summary>
        <div class="faq-body">Откройте раздел поддержки в кабинете — форма соберёт обращение со всеми нужными данными, останется отправить его в Telegram.</div>
      </details>
    </div>
  </section>

  <!-- ══ ФИНАЛЬНЫЙ CTA ══ -->
  <section>
    <div class="lnd-cta" data-reveal>
      <h2><?= $user ? 'С возвращением' : 'Готовы начать?' ?></h2>
      <p><?= $user
        ? 'Ваш кабинет ждёт: статус доступа, достижения и история — всё на месте.'
        : 'Создайте аккаунт за минуту и получите доступ к QMods прямо с вашего устройства.' ?></p>
      <div class="lnd-actions">
        <?php if ($user): ?>
          <a href="cabinet.php" class="primary-cta">В кабинет <b>→</b></a>
        <?php else: ?>
          <a href="register.php" class="primary-cta">Создать аккаунт <b>→</b></a>
          <a href="login.php" class="soft-cta">Войти</a>
        <?php endif; ?>
      </div>
    </div>

    <footer class="lnd-footer">
      <span><b>QMods</b> · Private Access</span>
      <span><?php if ($user): ?><a href="support.php">Поддержка</a> · <?php endif; ?>Безопасная оплата через ЮMoney</span>
    </footer>
  </section>

</div>
<?php render_footer(); ?>
