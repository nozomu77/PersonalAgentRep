// ============================================
// Service Worker - オフラインキャッシュ
// ============================================

const CACHE_NAME = 'ai-agent-v1';
const CACHE_FILES = [
  './',
  './index.html',
  './css/style.css',
  './js/app.js',
  './js/speech.js',
  './js/agent.js',
  './js/auth.js',
  './js/google-services.js',
  './manifest.json',
];

// インストール時にコアファイルをキャッシュ
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(CACHE_FILES))
      .then(() => self.skipWaiting())
  );
});

// 古いキャッシュを削除
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

// ネットワークファースト、失敗時にキャッシュ
self.addEventListener('fetch', (event) => {
  // API呼び出しはキャッシュしない
  if (event.request.url.includes('googleapis.com') ||
      event.request.url.includes('openai.com') ||
      event.request.url.includes('accounts.google.com')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // レスポンスをキャッシュに保存
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
