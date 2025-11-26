/**
 * AnyKeep Service Worker
 * 提供离线支持和缓存功能
 */

const CACHE_NAME = 'anykeep-v1'
const STATIC_CACHE = 'anykeep-static-v1'
const DYNAMIC_CACHE = 'anykeep-dynamic-v1'

// 预缓存的静态资源
const PRECACHE_ASSETS = [
  '/',
  '/home',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
]

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
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== STATIC_CACHE && name !== DYNAMIC_CACHE)
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

  // 跳过 API 请求（需要实时数据）
  if (url.pathname.startsWith('/api/')) return

  // 跳过 Supabase 请求
  if (url.hostname.includes('supabase')) return

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

// Stale While Revalidate 策略
async function staleWhileRevalidate(request) {
  const cached = await caches.match(request)

  const fetchPromise = fetch(request)
    .then((response) => {
      if (response.ok) {
        const cache = caches.open(DYNAMIC_CACHE)
        cache.then((c) => c.put(request, response.clone()))
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
