const CACHE_NAME = 'omegapos-pwa-v2.2';
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/dashboard.html',
    '/style.css',
    '/manifest.json',
    '/app.js',
    '/utils.js',
    '/generatepdf.js',
    '/source/generatepdf.js',
    '/source/factura.css',
    '/source/factura.html',
    '/source/factura_usd.html',
    '/source/inventario_pdf.css',
    '/source/inventario_pdf.html',
    '/imagen/logo.png',
    '/vistas/inicio.html',
    '/vistas/inventario.html',
    '/vistas/caja.html',
    '/vistas/ventas.html',
    '/vistas/devoluciones.html',
    '/vistas/reportes.html',
    '/vistas/ajustes.html'
];

// Instalación: Precarga de recursos esenciales y activación inmediata
self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(STATIC_ASSETS).catch((err) => {
                console.warn('Algunos recursos estáticos no pudieron ser precacheados:', err);
            });
        })
    );
});

// Activación: Limpieza total de versiones previas de caché y toma de control inmediata
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) {
                        console.log('Eliminando caché antigua:', cache);
                        return caches.delete(cache);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Escuchar mensajes desde la aplicación (dashboard/index)
self.addEventListener('message', (event) => {
    if (event.data && (event.data.action === 'skipWaiting' || event.data === 'skipWaiting')) {
        self.skipWaiting();
    }
    if (event.data && event.data.action === 'clearCache') {
        caches.keys().then((keys) => {
            return Promise.all(keys.map(k => caches.delete(k)));
        });
    }
});

// Estrategia Fetch: Red primero con respaldo en caché (Network-First falling back to cache)
// Omitir peticiones a APIs externas, WebSockets, Supabase y CDN
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Omitir peticiones no GET y servicios externos / APIs en vivo
    if (
        event.request.method !== 'GET' ||
        url.pathname.startsWith('/api/') ||
        url.pathname.startsWith('/socket.io/') ||
        url.hostname.includes('supabase.co') ||
        url.hostname.includes('workers.dev') ||
        url.hostname.includes('jsdelivr.net') ||
        url.hostname.includes('cdnjs.cloudflare.com')
    ) {
        return;
    }

    // Para páginas y recursos de la app: Network-First con fallback a Cache
    event.respondWith(
        fetch(event.request)
            .then((networkResponse) => {
                if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
                    const responseClone = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseClone);
                    });
                }
                return networkResponse;
            })
            .catch(() => {
                return caches.match(event.request).then((cachedResponse) => {
                    if (cachedResponse) {
                        return cachedResponse;
                    }
                    if (event.request.mode === 'navigate') {
                        return caches.match('/dashboard.html') || caches.match('/index.html');
                    }
                });
            })
    );
});
