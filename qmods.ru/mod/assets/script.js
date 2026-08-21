/* ══════════════════════════════════════════════════════════════════════
   QMODS · CYBER MOTION ENGINE
   Визуальный слой: анимации, микровзаимодействия, фон.
   Бизнес-логика не затрагивается — при любой ошибке контент остаётся видимым.
   ══════════════════════════════════════════════════════════════════════ */

/* ─────────── Функциональные обработчики (как и раньше) ─────────── */
document.addEventListener('DOMContentLoaded', function () {

    /* Автоисчезающие тосты */
    document.querySelectorAll('.toast').forEach(function (toast, i) {
        toast.style.animationDelay = (i * 90) + 'ms';
        setTimeout(function () {
            toast.style.transition = 'opacity .45s, transform .45s';
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(-14px) scale(.97)';
            setTimeout(function () { toast.remove(); }, 460);
        }, 4200 + i * 90);
    });

    /* Поиск по пользователям (админ) */
    var searchInput = document.getElementById('userSearch');
    if (searchInput) {
        searchInput.addEventListener('input', function (e) {
            var query = e.target.value.toLowerCase().trim();
            document.querySelectorAll('.user-card').forEach(function (card) {
                var name = card.dataset.username || '';
                card.style.display = name.includes(query) ? '' : 'none';
            });
        });
    }

    /* Refresh */
    var refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', function () {
            this.style.transition = 'transform .55s cubic-bezier(.22,.94,.28,1)';
            this.style.transform = 'rotate(360deg)';
            setTimeout(function () { location.reload(); }, 480);
        });
    }

    /* FAB / Stats модалки */
    var fabBtn = document.getElementById('fabBtn');
    if (fabBtn) {
        fabBtn.addEventListener('click', function () {
            var m = document.getElementById('issueModal');
            if (m) m.classList.add('active');
        });
    }
    var statsBtn = document.getElementById('statsBtn');
    if (statsBtn) {
        statsBtn.addEventListener('click', function () {
            var m = document.getElementById('statsModal');
            if (m) m.classList.add('active');
        });
    }
    document.querySelectorAll('.modal').forEach(function (modal) {
        modal.addEventListener('click', function (e) {
            if (e.target === modal) modal.classList.remove('active');
        });
    });
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal.active').forEach(function (m) { m.classList.remove('active'); });
        }
    });

    /* PWA. Регистрацию service worker выполняет render_footer() —
       здесь только приглашение установки, чтобы не ловить 404 на /sw.js. */
    var deferredPrompt;
    var installBtn = document.getElementById('installBtn');
    window.addEventListener('beforeinstallprompt', function (e) {
        e.preventDefault();
        deferredPrompt = e;
        if (installBtn) installBtn.style.display = 'flex';
    });
    if (installBtn) {
        installBtn.addEventListener('click', function () {
            if (deferredPrompt) {
                deferredPrompt.prompt();
                deferredPrompt.userChoice.then(function () {
                    deferredPrompt = null;
                    installBtn.style.display = 'none';
                });
            }
        });
    }

    /* Тактильный отклик */
    document.querySelectorAll('.quick-btn,.fab,.bottom-nav-item,.stat-tile,.quick-card,.mobile-bottom-nav a,.copy-button,.primary-cta,.au-submit').forEach(function (el) {
        el.addEventListener('click', function () {
            if (navigator.vibrate) navigator.vibrate(9);
        });
    });
});

/* ─────────── Глобальные функции (вызываются из onclick в PHP) ─────────── */
function toggleCard(el) {
    var card = el.closest('.user-card');
    if (!card) return;
    var wasOpen = card.classList.contains('open');
    document.querySelectorAll('.user-card.open').forEach(function (c) { c.classList.remove('open'); });
    if (!wasOpen) card.classList.add('open');
    if (navigator.vibrate) navigator.vibrate(5);
}
function closeModal(id) {
    var m = document.getElementById(id);
    if (m) m.classList.remove('active');
}

/* Копирование с красивым тостом вместо alert() */
function qmodsToast(message, tone) {
    try {
        var host = document.querySelector('.main-content') || document.body;
        var t = document.createElement('div');
        t.className = 'toast toast-' + (tone || 'success');
        t.style.position = 'fixed';
        t.style.left = '50%';
        t.style.bottom = '26px';
        t.style.transform = 'translateX(-50%)';
        t.style.zIndex = '500';
        t.style.margin = '0';
        t.innerHTML = '<span>' + message + '</span>';
        host.appendChild(t);
        setTimeout(function () {
            t.style.transition = 'opacity .4s,transform .4s';
            t.style.opacity = '0';
            t.style.transform = 'translateX(-50%) translateY(14px)';
            setTimeout(function () { t.remove(); }, 420);
        }, 2200);
    } catch (e) { }
}

function copyText(text, message) {
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(function () {
            qmodsToast(message || 'Скопировано');
            if (navigator.vibrate) navigator.vibrate([8, 30, 8]);
        }).catch(function () { window.prompt('Скопируйте:', text); });
    } else {
        window.prompt('Скопируйте:', text);
    }
}

/* ══════════════════════════════════════════════════════════════════════
   MOTION ENGINE
   ══════════════════════════════════════════════════════════════════════ */
(function () {
    'use strict';

    var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    var root = document.documentElement;
    root.classList.add('qmods-motion');

    function ready(fn) {
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
        else fn();
    }

    /* ── Фоновые слои: аврора, звёзды, зерно ─────────────────────── */
    function buildBackdrop() {
        if (document.querySelector('.aurora-field')) return;
        try {
            var field = document.createElement('div');
            field.className = 'aurora-field';
            field.setAttribute('aria-hidden', 'true');
            field.innerHTML = '<i class="aurora-blob b1"></i><i class="aurora-blob b2"></i><i class="aurora-blob b3"></i>';
            document.body.appendChild(field);

            if (!reduced) {
                var stars = document.createElement('div');
                stars.className = 'star-field';
                stars.setAttribute('aria-hidden', 'true');
                var n = coarse ? 26 : 54, html = '';
                for (var i = 0; i < n; i++) {
                    html += '<i style="left:' + (Math.random() * 100).toFixed(2) + '%;top:' +
                        (Math.random() * 100).toFixed(2) + '%;animation-delay:' +
                        (Math.random() * 5).toFixed(2) + 's;animation-duration:' +
                        (3 + Math.random() * 4).toFixed(2) + 's;opacity:0"></i>';
                }
                stars.innerHTML = html;
                document.body.appendChild(stars);

                var grain = document.createElement('div');
                grain.className = 'grain';
                grain.setAttribute('aria-hidden', 'true');
                document.body.appendChild(grain);

                var scan = document.createElement('div');
                scan.className = 'cy-scanlines';
                scan.setAttribute('aria-hidden', 'true');
                document.body.appendChild(scan);
            }
        } catch (e) { }
    }

    /* ── Полоса прогресса прокрутки ──────────────────────────────── */
    function buildScrollProgress() {
        try {
            var bar = document.createElement('div');
            bar.className = 'scroll-progress';
            document.body.appendChild(bar);
            var ticking = false;
            function update() {
                var h = document.documentElement.scrollHeight - window.innerHeight;
                var p = h > 0 ? Math.min(1, window.scrollY / h) : 0;
                bar.style.transform = 'scaleX(' + p.toFixed(4) + ')';
                ticking = false;
            }
            window.addEventListener('scroll', function () {
                if (!ticking) { ticking = true; requestAnimationFrame(update); }
            }, { passive: true });
            update();
        } catch (e) { }
    }

    /* ── Появление при прокрутке ─────────────────────────────────── */
    function buildReveal() {
        var auto = '.card,.stat-tile,.insight-card,.ach,.feature-panel,.list-panel,.profile-panel,' +
            '.settings-drawer,.lnd-feature,.lnd-stat,.bento,.lnd-step,.lnd-plan,.rev-card,.faq-item,' +
            '.support-card,.section-block,.access,.level-panel,.notification-stack,.review-form,.state-card,' +
            '.cy-card,.cy-news article,.cy-band,.cy-launcher,.hud';
        document.querySelectorAll(auto).forEach(function (el) {
            if (!el.hasAttribute('data-reveal')) el.setAttribute('data-reveal', '');
        });

        var targets = document.querySelectorAll('[data-reveal]');
        if (!targets.length) return;

        /* Стаггер для соседних элементов одной группы */
        var groups = {};
        targets.forEach(function (el) {
            var parent = el.parentNode;
            if (!parent) return;
            var key = parent.__qmKey || (parent.__qmKey = 'g' + (Math.random() * 1e9 | 0));
            groups[key] = (groups[key] || 0);
            if (!el.style.getPropertyValue('--d')) {
                el.style.setProperty('--d', Math.min(groups[key] * 75, 450) + 'ms');
            }
            groups[key]++;
        });

        function showAll() { targets.forEach(function (el) { el.classList.add('is-visible'); }); }

        if (reduced || !('IntersectionObserver' in window)) { showAll(); return; }

        var io = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-visible');
                    io.unobserve(entry.target);
                }
            });
        }, { threshold: 0.06, rootMargin: '0px 0px -30px 0px' });
        targets.forEach(function (el) { io.observe(el); });
        setTimeout(showAll, 3200); /* страховка */
    }

    /* ── Прожектор под курсором внутри карточек ──────────────────── */
    function buildSpotlight() {
        if (coarse || reduced) return;
        var sel = '.lnd-feature,.lnd-stat,.stat-tile,.bento,.lnd-plan,.rev-card,.insight-card,.card,.access,' +
            '.feature-panel,.cy-card,.cy-news article,.hud';
        document.addEventListener('pointermove', function (e) {
            var el = e.target.closest && e.target.closest(sel);
            if (!el) return;
            var r = el.getBoundingClientRect();
            el.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100).toFixed(1) + '%');
            el.style.setProperty('--my', ((e.clientY - r.top) / r.height * 100).toFixed(1) + '%');
        }, { passive: true });
    }

    /* ── Магнитные кнопки ────────────────────────────────────────── */
    function buildMagnetic() {
        if (coarse || reduced) return;
        document.querySelectorAll('.btn,.primary-cta,.soft-cta,.au-submit,.icon-action,.copy-button,.avatar-mini,.support-cta').forEach(function (el) {
            el.classList.add('magnetic');
            el.addEventListener('pointermove', function (e) {
                var r = el.getBoundingClientRect();
                var x = (e.clientX - r.left) / r.width - .5;
                var y = (e.clientY - r.top) / r.height - .5;
                el.style.transform = 'translate(' + (x * 7).toFixed(1) + 'px,' + (y * 7).toFixed(1) + 'px)';
            }, { passive: true });
            el.addEventListener('pointerleave', function () { el.style.transform = ''; }, { passive: true });
        });
    }

    /* ── 3D-наклон сцены с орбитой ───────────────────────────────── */
    function buildTilt() {
        if (coarse || reduced) return;
        document.querySelectorAll('.orb-stage,.au-orb,.dash-hero-avatar,.kira-frame').forEach(function (stage) {
            var host = stage.closest('.lnd-visual,.au-visual,.dash-hero,.cy-hero-kira') || stage.parentNode;
            if (!host) return;
            host.addEventListener('pointermove', function (e) {
                var r = host.getBoundingClientRect();
                var x = (e.clientX - r.left) / r.width - .5;
                var y = (e.clientY - r.top) / r.height - .5;
                stage.style.transform = 'perspective(900px) rotateY(' + (x * 16).toFixed(2) + 'deg) rotateX(' + (-y * 16).toFixed(2) + 'deg)';
            }, { passive: true });
            host.addEventListener('pointerleave', function () {
                stage.style.transform = '';
            }, { passive: true });
        });
    }

    /* ── Параллакс плавающих карточек ────────────────────────────── */
    function buildParallax() {
        if (coarse || reduced) return;
        var items = document.querySelectorAll('[data-parallax]');
        if (!items.length) return;
        var ticking = false;
        function update() {
            var y = window.scrollY;
            items.forEach(function (el) {
                var k = parseFloat(el.getAttribute('data-parallax')) || .1;
                el.style.setProperty('--py', (-y * k).toFixed(1) + 'px');
                el.style.translate = '0 ' + (-y * k).toFixed(1) + 'px';
            });
            ticking = false;
        }
        window.addEventListener('scroll', function () {
            if (!ticking) { ticking = true; requestAnimationFrame(update); }
        }, { passive: true });
    }

    /* ── Анимация полос и кольцевых индикаторов ──────────────────── */
    function buildBars() {
        document.querySelectorAll('.rail span,.level-bar span,.sub-progress span').forEach(function (el) {
            var w = el.style.width || '100%';
            if (reduced) return;
            el.style.width = '0';
            setTimeout(function () { el.style.width = w; }, 220);
        });

        document.querySelectorAll('.gauge[data-progress]').forEach(function (el) {
            var target = el.getAttribute('data-progress');
            if (reduced) { el.style.setProperty('--progress', target); return; }
            el.style.setProperty('--progress', '0deg');
            setTimeout(function () { el.style.setProperty('--progress', target); }, 260);
        });
    }

    /* ── Счётчики ────────────────────────────────────────────────── */
    function animateCount(el) {
        var target = parseFloat(el.getAttribute('data-count'));
        if (!isFinite(target)) return;
        var suffix = el.getAttribute('data-suffix') || '';
        if (reduced) { el.textContent = target.toLocaleString('ru-RU') + suffix; return; }
        var duration = 1250, start = null;
        function tick(t) {
            if (!start) start = t;
            var p = Math.min((t - start) / duration, 1);
            var eased = 1 - Math.pow(1 - p, 3);
            el.textContent = Math.round(target * eased).toLocaleString('ru-RU') + suffix;
            if (p < 1) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
    }
    function buildCounters() {
        var els = document.querySelectorAll('[data-count]');
        if (!els.length) return;
        if (!('IntersectionObserver' in window)) { els.forEach(animateCount); return; }
        var io = new IntersectionObserver(function (entries) {
            entries.forEach(function (e) {
                if (e.isIntersecting) { animateCount(e.target); io.unobserve(e.target); }
            });
        }, { threshold: .4 });
        els.forEach(function (el) { io.observe(el); });
    }

    /* ── Рябь от клика ───────────────────────────────────────────── */
    function buildRipple() {
        if (reduced) return;
        document.addEventListener('click', function (e) {
            if (!e.target.closest) return;
            var el = e.target.closest('.btn,.primary-cta,.soft-cta,.au-submit,.copy-button,.admin-primary,' +
                '.app-sidebar-nav a,.admin-nav a,.admin-nav button,.stat-tile,.mobile-bottom-nav a,.lnd-plan button,.cy-card');
            if (!el) return;
            var cs = getComputedStyle(el);
            if (cs.position === 'static') el.style.position = 'relative';
            if (cs.overflow !== 'hidden') el.style.overflow = 'hidden';
            var r = el.getBoundingClientRect();
            var size = Math.max(r.width, r.height) * 1.5;
            var ripple = document.createElement('span');
            ripple.className = 'qmods-ripple';
            ripple.style.width = ripple.style.height = size + 'px';
            ripple.style.left = (e.clientX - r.left - size / 2) + 'px';
            ripple.style.top = (e.clientY - r.top - size / 2) + 'px';
            el.appendChild(ripple);
            setTimeout(function () { ripple.remove(); }, 640);
        });
    }

    /* ── Подсветка курсора ───────────────────────────────────────── */
    function buildCursorGlow() {
        if (coarse || reduced) return;
        try {
            var glow = document.createElement('div');
            glow.className = 'cursor-glow';
            glow.setAttribute('aria-hidden', 'true');
            document.body.appendChild(glow);
            var gx = window.innerWidth / 2, gy = window.innerHeight / 2, tx = gx, ty = gy;
            (function loop() {
                tx += (gx - tx) * .1; ty += (gy - ty) * .1;
                glow.style.transform = 'translate3d(' + tx.toFixed(1) + 'px,' + ty.toFixed(1) + 'px,0)';
                requestAnimationFrame(loop);
            })();
            document.addEventListener('pointermove', function (e) {
                gx = e.clientX; gy = e.clientY;
                if (!document.body.classList.contains('pointer-awake')) {
                    document.body.classList.add('pointer-awake');
                }
            }, { passive: true });
            document.body.classList.add('js-motion-ready');
        } catch (e) { }
    }

    /* ── Шторка перехода между страницами ────────────────────────── */
    function buildCurtain() {
        if (reduced) return;
        try {
            var curtain = document.createElement('div');
            curtain.className = 'page-curtain';
            curtain.setAttribute('aria-hidden', 'true');
            curtain.innerHTML = '<span>QMODS</span>';
            document.body.appendChild(curtain);
            setTimeout(function () { curtain.remove(); }, 1200);
        } catch (e) { }
    }

    /* ── Конфетти ────────────────────────────────────────────────── */
    window.qmodsConfetti = function (count) {
        if (reduced) return;
        try {
            var layer = document.createElement('div');
            layer.className = 'confetti-layer';
            layer.setAttribute('aria-hidden', 'true');
            var colors = ['#7c5cff', '#ff4ecd', '#25d8f5', '#3ddc97', '#ffb454', '#ffffff'];
            var n = count || 70, html = '';
            for (var i = 0; i < n; i++) {
                html += '<i style="left:' + (Math.random() * 100).toFixed(1) + '%;' +
                    'background:' + colors[i % colors.length] + ';' +
                    '--cx:' + ((Math.random() - .5) * 260).toFixed(0) + 'px;' +
                    '--cr:' + (Math.random() * 1080 - 540).toFixed(0) + 'deg;' +
                    'animation-duration:' + (2.2 + Math.random() * 2).toFixed(2) + 's;' +
                    'animation-delay:' + (Math.random() * .5).toFixed(2) + 's"></i>';
            }
            layer.innerHTML = html;
            document.body.appendChild(layer);
            setTimeout(function () { layer.remove(); }, 5200);
        } catch (e) { }
    };

    /* ── Подсветка активного поля ────────────────────────────────── */
    function buildFieldFocus() {
        document.querySelectorAll('input,select,textarea').forEach(function (el) {
            el.addEventListener('focus', function () {
                var g = el.closest('.au-field,.form-group,.au-input,.support-field');
                if (g) g.classList.add('field-active');
            });
            el.addEventListener('blur', function () {
                var g = el.closest('.au-field,.form-group,.au-input,.support-field');
                if (g) g.classList.remove('field-active');
            });
        });
    }

    /* ── Scrollspy: боковое меню и мобильный док ─────────────────── */
    function buildScrollSpy() {
        var links = document.querySelectorAll('.app-sidebar-nav a[href*="#"],.mobile-bottom-nav a[href^="#"]');
        if (!links.length) return;
        var ids = ['home', 'subscription', 'achievements', 'referrals', 'payments', 'profile'];
        var byId = {};
        ids.forEach(function (id) {
            var el = document.getElementById(id);
            if (el) byId[id] = el;
        });
        if (!Object.keys(byId).length) return;

        var ticking = false;
        function update() {
            var best = null, bestScore = 0;
            Object.keys(byId).forEach(function (id) {
                var r = byId[id].getBoundingClientRect();
                var score = Math.max(0, 1 - Math.abs(r.top - 150) / 620);
                if (score > bestScore) { bestScore = score; best = id; }
            });
            if (best) {
                links.forEach(function (a) {
                    var hash = (a.getAttribute('href') || '').split('#')[1] || '';
                    a.classList.toggle('active', hash === best);
                });
            }
            ticking = false;
        }
        window.addEventListener('scroll', function () {
            if (!ticking) { ticking = true; requestAnimationFrame(update); }
        }, { passive: true });
        update();
    }

    /* ── Плавная прокрутка по якорям ─────────────────────────────── */
    function buildAnchors() {
        document.addEventListener('click', function (e) {
            var a = e.target.closest && e.target.closest('a[href^="#"]');
            if (!a) return;
            var id = a.getAttribute('href').slice(1);
            if (!id) return;
            var target = document.getElementById(id);
            if (!target) return;
            e.preventDefault();
            var top = target.getBoundingClientRect().top + window.scrollY - 18;
            window.scrollTo({ top: top, behavior: reduced ? 'auto' : 'smooth' });
            if (navigator.vibrate) navigator.vibrate(6);
        });
    }

    /* ── Заголовок посимвольно (лендинг) ─────────────────────────── */
    function buildHeadline() {
        var el = document.querySelector('[data-words]');
        if (!el) return;
        var delay = 0;
        el.querySelectorAll('.line').forEach(function (line) {
            var text = line.innerHTML;
            var parts = text.split(/(<em>.*?<\/em>|\s+)/g).filter(function (p) { return p && p.trim() !== ''; });
            line.innerHTML = parts.map(function (p) {
                delay += 90;
                return '<span class="word" style="--wd:' + delay + 'ms">' + p + '</span>';
            }).join(' ');
        });
    }

    /* ── Живые часы (кабинет) ────────────────────────────────────── */
    function buildClock() {
        var el = document.querySelector('[data-clock]');
        if (!el) return;
        function tick() {
            var d = new Date();
            var p = function (n) { return n < 10 ? '0' + n : '' + n; };
            el.textContent = p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
        }
        tick();
        setInterval(tick, 1000);
    }

    /* ── Поле частиц (canvas) ────────────────────────────────────── */
    function buildParticles() {
        if (reduced) return;
        var canvas;
        try {
            canvas = document.createElement('canvas');
            canvas.className = 'cy-particles';
            canvas.setAttribute('aria-hidden', 'true');
            document.body.appendChild(canvas);
        } catch (e) { return; }

        var ctx = canvas.getContext && canvas.getContext('2d');
        if (!ctx) { canvas.remove(); return; }

        var dpr = Math.min(window.devicePixelRatio || 1, 2);
        var w = 0, h = 0, parts = [], running = true;
        var colors = ['168,85,255', '255,62,200', '34,230,255'];

        function resize() {
            w = window.innerWidth; h = window.innerHeight;
            canvas.width = w * dpr; canvas.height = h * dpr;
            canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

            var count = Math.round(Math.min(90, Math.max(28, (w * h) / 26000)));
            if (coarse) count = Math.round(count * 0.5);
            parts = [];
            for (var i = 0; i < count; i++) {
                parts.push({
                    x: Math.random() * w,
                    y: Math.random() * h,
                    r: 0.7 + Math.random() * 1.9,
                    vx: (Math.random() - 0.5) * 0.22,
                    vy: -(0.08 + Math.random() * 0.32),
                    a: 0.18 + Math.random() * 0.5,
                    c: colors[(Math.random() * colors.length) | 0],
                    p: Math.random() * Math.PI * 2
                });
            }
        }

        function frame() {
            if (!running) return;
            ctx.clearRect(0, 0, w, h);
            for (var i = 0; i < parts.length; i++) {
                var p = parts[i];
                p.p += 0.012;
                p.x += p.vx + Math.sin(p.p) * 0.16;
                p.y += p.vy;
                if (p.y < -20) { p.y = h + 12; p.x = Math.random() * w; }
                if (p.x < -20) p.x = w + 12;
                if (p.x > w + 20) p.x = -12;

                var alpha = p.a * (0.6 + Math.sin(p.p) * 0.4);
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(' + p.c + ',' + alpha.toFixed(3) + ')';
                ctx.shadowBlur = 10;
                ctx.shadowColor = 'rgba(' + p.c + ',' + (alpha * 0.8).toFixed(3) + ')';
                ctx.fill();
            }
            ctx.shadowBlur = 0;
            requestAnimationFrame(frame);
        }

        resize();
        var rt;
        window.addEventListener('resize', function () {
            clearTimeout(rt);
            rt = setTimeout(resize, 220);
        }, { passive: true });
        document.addEventListener('visibilitychange', function () {
            if (document.hidden) { running = false; }
            else if (!running) { running = true; requestAnimationFrame(frame); }
        });
        requestAnimationFrame(frame);
    }

    /* ── Реплики Kira: эффект печати ─────────────────────────────── */
    function buildTyping() {
        document.querySelectorAll('[data-type]').forEach(function (el) {
            var lines = (el.getAttribute('data-type') || '').split('|')
                .map(function (t) { return t.trim(); })
                .filter(Boolean);
            if (!lines.length) return;

            if (reduced) { el.textContent = lines[0]; return; }

            var li = 0, ci = 0, deleting = false;
            function tick() {
                var full = lines[li];
                if (!deleting) {
                    ci++;
                    el.textContent = full.slice(0, ci);
                    if (ci >= full.length) {
                        deleting = true;
                        return setTimeout(tick, 2600);
                    }
                    return setTimeout(tick, 34 + Math.random() * 40);
                }
                ci -= 2;
                if (ci <= 0) {
                    ci = 0;
                    deleting = false;
                    li = (li + 1) % lines.length;
                    return setTimeout(tick, 420);
                }
                el.textContent = full.slice(0, ci);
                setTimeout(tick, 18);
            }
            setTimeout(tick, 900);
        });
    }

    /* ── Запуск ──────────────────────────────────────────────────── */
    ready(function () {
        buildBackdrop();
        buildParticles();
        buildCurtain();
        buildHeadline();
        buildReveal();
        buildScrollProgress();
        buildSpotlight();
        buildMagnetic();
        buildTilt();
        buildParallax();
        buildBars();
        buildCounters();
        buildRipple();
        buildCursorGlow();
        buildFieldFocus();
        buildScrollSpy();
        buildAnchors();
        buildClock();
        buildTyping();

        if (document.querySelector('[data-celebrate]')) {
            setTimeout(function () { window.qmodsConfetti(90); }, 700);
        }
    });
})();
