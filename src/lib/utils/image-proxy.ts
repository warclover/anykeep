/**
 * 图片代理工具函数
 * 解决微信等平台的图片防盗链问题
 */

/**
 * 判断图片 URL 是否需要代理
 */
export function needsImageProxy(url: string | null | undefined): boolean {
  if (!url) return false

  // 微信图片域名
  const wechatImageDomains = [
    'mmbiz.qpic.cn',
    'mmbiz.qlogo.cn',
    'mp.weixin.qq.com'
  ]

  return wechatImageDomains.some(domain => url.includes(domain))
}

/**
 * 获取代理后的图片 URL
 * 使用免费的 images.weserv.nl 服务
 */
export function getProxiedImageUrl(url: string | null | undefined): string | null {
  if (!url) return null

  // 如果不需要代理，直接返回原 URL
  if (!needsImageProxy(url)) {
    return url
  }

  // 使用 images.weserv.nl 代理服务
  // 文档：https://images.weserv.nl/docs/
  try {
    const encodedUrl = encodeURIComponent(url)
    return `https://images.weserv.nl/?url=${encodedUrl}`
  } catch (error) {
    console.error('Failed to proxy image URL:', error)
    return url // 失败时返回原 URL
  }
}

/**
 * 获取最终显示的图片 URL（包含占位符逻辑）
 */
export function getDisplayImageUrl(
  imageUrl: string | null | undefined,
  fallbackGenerator?: () => string
): string {
  // 如果有真实图片，使用代理后的 URL
  if (imageUrl) {
    return getProxiedImageUrl(imageUrl) || (fallbackGenerator ? fallbackGenerator() : '')
  }

  // 否则使用占位符
  return fallbackGenerator ? fallbackGenerator() : ''
}
