/**
 * Service Worker 注册组件
 * 在客户端注册 PWA Service Worker
 */

'use client'

import { useEffect } from 'react'

export function ServiceWorkerRegister() {
  useEffect(() => {
    // 仅在生产环境和支持 Service Worker 的浏览器中注册
    if (
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      process.env.NODE_ENV === 'production'
    ) {
      registerServiceWorker()
    }
  }, [])

  return null
}

async function registerServiceWorker() {
  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
      updateViaCache: 'none',
    })

    // eslint-disable-next-line no-console
    console.log('[PWA] Service Worker registered:', registration.scope)

    // 检查更新
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing
      if (!newWorker) return

      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          // 新版本可用，可以提示用户刷新
          // eslint-disable-next-line no-console
          console.log('[PWA] New version available')

          // 可以在这里显示更新提示
          // 例如：showUpdateToast()
        }
      })
    })

    // 定期检查更新（每小时）
    setInterval(() => {
      registration.update()
    }, 60 * 60 * 1000)

  } catch (error) {
    console.error('[PWA] Service Worker registration failed:', error)
  }
}

/**
 * 手动触发 Service Worker 更新
 */
export async function checkForUpdates() {
  if ('serviceWorker' in navigator) {
    const registration = await navigator.serviceWorker.ready
    await registration.update()
  }
}

/**
 * 跳过等待，立即激活新的 Service Worker
 */
export async function skipWaiting() {
  if ('serviceWorker' in navigator) {
    const registration = await navigator.serviceWorker.ready
    if (registration.waiting) {
      registration.waiting.postMessage('skipWaiting')
      window.location.reload()
    }
  }
}
