/**
 * AnyKeep Service Worker
 * 提供离线支持和缓存功能
 *
 * @version 2.0.0 - 添加 API 缓存支持 (Phase 4 North Star)
 */

const CACHE_NAME = 'anykeep-v5'
const STATIC_CACHE = 'anykeep-static-v5'
const DYNAMIC_CACHE = 'anykeep-dynamic-v5'
const API_CACHE = 'anykeep-api-v1'

// 预缓存的静态资源
const PRECACHE_ASSETS = [
  '/',
  '/home',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
]

// 可缓存的 API 路径（只缓存读取操作）
const CACHEABLE_API_PATTERNS = [
  // Legacy API
  /^\/api\/bookmarks(\?|$)/,           // 书签列表
  /^\/api\/bookmarks\/\d+$/,           // 书签详情
  /^\/api\/bookmarks\/stats$/,         // 书签统计
  /^\/api\/bookmarks\/tags$/,          // 用户标签
  /^\/api\/folders(\?|$)/,             // 文件夹列表
  /^\/api\/folders\/\d+$/,             // 文件夹详情
  // v1 API
  /^\/api\/v1\/bookmarks(\?|$)/,       // v1 书签列表
  /^\/api\/v1\/bookmarks\/\d+$/,       // v1 书签详情
  /^\/api\/v1\/bookmarks\/stats$/,     // v1 书签统计
  /^\/api\/v1\/bookmarks\/tags$/,      // v1 用户标签
  /^\/api\/v1\/folders(\?|$)/,         // v1 文件夹列表
  /^\/api\/v1\/folders\/\d+$/,         // v1 文件夹详情
  /^\/api\/v1\/folders\/\d+\/path$/,   // v1 文件夹路径
  /^\/api\/v1\/search(\?|$)/,          // v1 搜索
]

// API 缓存过期时间（5 分钟）
const API_CACHE_MAX_AGE = 5 * 60 * 1000

// 安装事件 - 预缓存静态资源
self.addEventListener('install', (event) => {
  console.log('[SW] Installing Service Worker')
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      console.log('[SW] Precaching static assets')
      return cache.addAll(PRECACHE_ASSETS)
    })
  )
  // 立即激活新的 Service Worker
  self.skipWaiting()
})

// 激活事件 - 清理旧缓存
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating Service Worker')
  const currentCaches = [STATIC_CACHE, DYNAMIC_CACHE, API_CACHE]
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => !currentCaches.includes(name))
          .map((name) => {
            console.log('[SW] Deleting old cache:', name)
            return caches.delete(name)
          })
      )
    })
  )
  // 立即控制所有页面
  self.clients.claim()
})

// 请求拦截 - 缓存策略
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // 跳过非 GET 请求
  if (request.method !== 'GET') return

  // 跳过 Chrome 扩展请求
  if (url.protocol === 'chrome-extension:') return

  // API 请求：网络优先，离线回退缓存
  if (url.pathname.startsWith('/api/')) {
    // 检查是否是可缓存的 API
    const isCacheable = CACHEABLE_API_PATTERNS.some(pattern => pattern.test(url.pathname))
    if (isCacheable) {
      event.respondWith(apiNetworkFirst(request))
      return
    }
    // 不可缓存的 API 直接跳过
    return
  }

  // 跳过 Supabase 请求
  if (url.hostname.includes('supabase')) return

  // 跳过 Next.js RSC 请求（React Server Components 数据请求）
  // RSC 请求包含动态数据，不应被缓存
  if (url.searchParams.has('_rsc')) return

  // 跳过 analytics 页面（需要实时数据）
  if (url.pathname === '/analytics') {
    event.respondWith(networkOnly(request))
    return
  }

  // 静态资源：Cache First
  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirst(request))
    return
  }

  // 页面请求：Network First with Cache Fallback
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request))
    return
  }

  // 其他请求：Stale While Revalidate
  event.respondWith(staleWhileRevalidate(request))
})

// 判断是否为静态资源
function isStaticAsset(pathname) {
  return (
    pathname.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2)$/) ||
    pathname.startsWith('/icons/') ||
    pathname.startsWith('/_next/static/')
  )
}

// Network Only 策略（不使用缓存）
async function networkOnly(request) {
  try {
    return await fetch(request)
  } catch (error) {
    console.log('[SW] Network only fetch failed:', error)
    return new Response('Offline', { status: 503 })
  }
}

// Cache First 策略
async function cacheFirst(request) {
  const cached = await caches.match(request)
  if (cached) {
    return cached
  }

  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE)
      cache.put(request, response.clone())
    }
    return response
  } catch (error) {
    console.log('[SW] Cache first fetch failed:', error)
    return new Response('Offline', { status: 503 })
  }
}

// Network First 策略
async function networkFirst(request) {
  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(DYNAMIC_CACHE)
      cache.put(request, response.clone())
    }
    return response
  } catch (error) {
    console.log('[SW] Network first failed, trying cache')
    const cached = await caches.match(request)
    if (cached) {
      return cached
    }
    // 返回离线页面
    return caches.match('/') || new Response('Offline', { status: 503 })
  }
}

// API Network First 策略（带缓存时间戳）
async function apiNetworkFirst(request) {
  try {
    const response = await fetch(request)
    if (response.ok) {
      // 克隆响应以添加缓存时间戳
      const responseToCache = response.clone()
      const cache = await caches.open(API_CACHE)

      // 创建带时间戳的响应头
      const headers = new Headers(responseToCache.headers)
      headers.set('sw-cached-at', Date.now().toString())

      const cachedResponse = new Response(await responseToCache.blob(), {
        status: responseToCache.status,
        statusText: responseToCache.statusText,
        headers: headers,
      })

      cache.put(request, cachedResponse)
      console.log('[SW] API cached:', request.url)
    }
    return response
  } catch (error) {
    console.log('[SW] API network failed, trying cache:', request.url)

    const cached = await caches.match(request)
    if (cached) {
      // 检查缓存是否过期
      const cachedAt = cached.headers.get('sw-cached-at')
      if (cachedAt) {
        const age = Date.now() - parseInt(cachedAt, 10)
        if (age > API_CACHE_MAX_AGE) {
          console.log('[SW] API cache expired:', request.url)
          // 缓存过期，但仍然返回（离线场景）
        }
      }
      console.log('[SW] Returning cached API response:', request.url)
      return cached
    }

    // 返回离线错误响应
    return new Response(
      JSON.stringify({
        error: 'offline',
        message: '网络不可用，请检查连接',
      }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
}

// Stale While Revalidate 策略
async function staleWhileRevalidate(request) {
  const cached = await caches.match(request)

  const fetchPromise = fetch(request)
    .then(async (response) => {
      if (response.ok) {
        // 先克隆再缓存，避免 body 被消费后无法 clone
        const responseToCache = response.clone()
        const cache = await caches.open(DYNAMIC_CACHE)
        cache.put(request, responseToCache)
      }
      return response
    })
    .catch(() => cached)

  return cached || fetchPromise
}

// 消息处理
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting()
  }
})

// 推送通知处理 (未来功能)
self.addEventListener('push', (event) => {
  if (!event.data) return

  const data = event.data.json()
  const options = {
    body: data.body,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-96x96.png',
    data: data.url,
    actions: [
      { action: 'open', title: '查看' },
      { action: 'close', title: '关闭' },
    ],
  }

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  )
})

// 通知点击处理
self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  if (event.action === 'open' || !event.action) {
    const url = event.notification.data || '/home'
    event.waitUntil(
      clients.matchAll({ type: 'window' }).then((clientList) => {
        // 如果已有窗口，聚焦它
        for (const client of clientList) {
          if (client.url === url && 'focus' in client) {
            return client.focus()
          }
        }
        // 否则打开新窗口
        if (clients.openWindow) {
          return clients.openWindow(url)
        }
      })
    )
  }
})

console.log('[SW] Service Worker loaded')
