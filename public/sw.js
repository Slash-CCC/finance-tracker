// Service Worker for 经济监管工具 PWA
// 缓存策略: 静态资源 Cache First, API 请求 Network First

const CACHE_VERSION = 'v1';
const STATIC_CACHE = `finance-static-${CACHE_VERSION}`;
const OFFLINE_URL = '/offline.html';

// 需要预缓存的静态资源（构建后自动匹配）
const PRECACHE_URLS = [
  '/',
  OFFLINE_URL,
];

// ====== 安装: 预缓存关键资源 ======
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(PRECACHE_URLS).catch((err) => {
        console.warn('[SW] 预缓存部分资源失败:', err);
      });
    }).then(() => {
      return self.skipWaiting();
    })
  );
});

// ====== 激活: 清理旧缓存 ======
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((k) => k.startsWith('finance-static-') && k !== STATIC_CACHE)
          .map((k) => caches.delete(k))
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// ====== 请求拦截 ======
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 跳过非 GET 请求
  if (request.method !== 'GET') return;

  // 跳过 chrome-extension 等非 http 请求
  if (!url.protocol.startsWith('http')) return;

  // Supabase API 请求: Network First（必须实时数据）
  if (url.hostname.includes('supabase.co')) {
    event.respondWith(networkFirstWithOffline(request));
    return;
  }

  // 静态资源（JS/CSS/字体/图片）: Cache First
  if (
    url.pathname.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/) ||
    url.pathname.startsWith('/assets/')
  ) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // HTML 导航请求: Network First
  if (request.mode === 'navigate') {
    event.respondWith(networkFirstWithOffline(request));
    return;
  }

  // 其他请求: Network First
  event.respondWith(networkFirstWithOffline(request));
});

// ====== 缓存策略 ======

// Cache First: 优先缓存，缓存未命中时走网络并缓存
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    // 如果请求的是页面，返回离线页面
    if (request.mode === 'navigate') {
      const offlinePage = await caches.match(OFFLINE_URL);
      if (offlinePage) return offlinePage;
    }
    throw err;
  }
}

// Network First: 优先网络，失败时用缓存，无缓存时返回离线页面
async function networkFirstWithOffline(request) {
  try {
    const response = await fetch(request);
    // 缓存成功的响应
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    const cached = await caches.match(request);
    if (cached) return cached;

    // 导航请求返回离线页面
    if (request.mode === 'navigate') {
      const offlinePage = await caches.match(OFFLINE_URL);
      if (offlinePage) return offlinePage;
    }

    // API 请求返回离线 JSON 提示
    if (request.headers.get('Accept')?.includes('application/json') ||
        request.url.includes('supabase.co')) {
      return new Response(
        JSON.stringify({ error: 'offline', message: '当前处于离线状态，数据未同步' }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      );
    }

    throw err;
  }
}

// ====== 消息处理: 客户端可发送 skipWaiting 命令 ======
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data?.type === 'CHECK_NETWORK') {
    // 通知所有客户端网络状态
    self.clients.matchAll().then((clients) => {
      clients.forEach((client) => {
        client.postMessage({ type: 'NETWORK_STATUS', online: self.navigator?.onLine ?? true });
      });
    });
  }
});
