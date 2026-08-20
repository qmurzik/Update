const CACHE = 'qmods-aurora-1';

self.addEventListener('install', (e) => {
    self.skipWaiting();
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
        )
    );
    self.clients.claim();
});

self.addEventListener('fetch', (e) => {
    if (e.request.method !== 'GET') return;

    const url = new URL(e.request.url);
    if (url.origin !== location.origin) return;

    // Страницы админки — всегда из сети (чтобы данные были свежие)
    if (url.pathname.includes('.php')) {
        e.respondWith(
            fetch(e.request).catch(() => caches.match(e.request))
        );
        return;
    }

    // Статика (css, js, картинки) — из кеша, иначе из сети
    e.respondWith(
        caches.match(e.request).then((cached) => {
            if (cached) return cached;
            return fetch(e.request).then((resp) => {
                const copy = resp.clone();
                caches.open(CACHE).then((c) => c.put(e.request, copy));
                return resp;
            });
        })
    );
});