// 오프라인에서 전 기능이 동작해야 합니다(PRD 3.6 · 10장).
// 학교 인터넷을 신뢰하지 않으므로, 첫 방문에서 필요한 것을 전부 캐시합니다.
// 그림 데이터는 통합본 하나라 파일 수가 늘지 않습니다(PRD 11장).
const VERSION = 'jjam-draw-v1';
const ASSETS = [
  './',
  'index.html',
  'css/app.css',
  'js/app.js',
  'data/drawings.json',
  'favicon.svg',
  'manifest.webmanifest',
];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    await cache.addAll(ASSETS);
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((k) => k !== VERSION).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

// 캐시 우선. 교실에서 인터넷이 끊겨도 같은 속도로 열립니다.
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith((async () => {
    const cached = await caches.match(req, { ignoreSearch: true });
    if (cached) return cached;
    try {
      const res = await fetch(req);
      if (res.ok) {
        const cache = await caches.open(VERSION);
        cache.put(req, res.clone());
      }
      return res;
    } catch {
      const shell = await caches.match('index.html');
      if (shell && req.mode === 'navigate') return shell;
      throw new Error('오프라인이고 캐시에도 없습니다: ' + req.url);
    }
  })());
});

// 캐시가 준비되었는지 홈에서 물어봅니다(PRD 3.6의 캐시 완료 표시).
self.addEventListener('message', async (e) => {
  if (e.data !== 'ready?') return;
  const cache = await caches.open(VERSION);
  const keys = await cache.keys();
  e.source?.postMessage({ ready: keys.length >= ASSETS.length });
});
