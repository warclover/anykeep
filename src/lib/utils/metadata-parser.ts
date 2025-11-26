/**
 * 网页元数据解析工具
 * 从 HTML 中提取 Open Graph、meta 标签等元数据
 */

import { logger } from '@/lib/logger'
import { detectPlatformFromUrl } from '@/lib/platform-utils'

export interface WebMetadata {
  title: string
  description: string
  coverUrl: string
  author: string
  platform: string
  siteName: string
  wordCount: number
  imageCount: number
}

/**
 * 从 HTML 字符串中提取元数据
 */
export function parseHTMLMetadata(html: string, url: string): WebMetadata {
  const platform = detectPlatformFromUrl(url)

  // 提取各种元数据
  const title = extractTitle(html)
  const description = extractDescription(html)
  const coverUrl = extractCoverImage(html, url)
  const author = extractAuthor(html, platform)
  const siteName = extractSiteName(html)
  const wordCount = extractWordCount(html)
  const imageCount = extractImageCount(html)

  return {
    title,
    description,
    coverUrl,
    author,
    platform,
    siteName,
    wordCount,
    imageCount,
  }
}

/**
 * 提取页面标题
 * 优先级：og:title > twitter:title > <title>
 */
function extractTitle(html: string): string {
  // 1. Open Graph title
  const ogTitle = extractMetaContent(html, 'og:title', 'property')
  if (ogTitle) return cleanText(ogTitle)

  // 2. Twitter title
  const twitterTitle = extractMetaContent(html, 'twitter:title', 'name')
  if (twitterTitle) return cleanText(twitterTitle)

  // 3. HTML <title>
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
  if (titleMatch) return cleanText(titleMatch[1])

  return ''
}

/**
 * 提取页面描述
 * 优先级：og:description > twitter:description > meta description
 */
function extractDescription(html: string): string {
  // 1. Open Graph description
  const ogDesc = extractMetaContent(html, 'og:description', 'property')
  if (ogDesc) return cleanText(ogDesc)

  // 2. Twitter description
  const twitterDesc = extractMetaContent(html, 'twitter:description', 'name')
  if (twitterDesc) return cleanText(twitterDesc)

  // 3. Meta description
  const metaDesc = extractMetaContent(html, 'description', 'name')
  if (metaDesc) return cleanText(metaDesc)

  return ''
}

/**
 * 提取封面图片
 * 优先级：og:image > twitter:image > 页面内第一张大图
 */
function extractCoverImage(html: string, baseUrl: string): string {
  // 1. Open Graph image
  const ogImage = extractMetaContent(html, 'og:image', 'property')
  if (ogImage) return resolveUrl(ogImage, baseUrl)

  // 2. Twitter image
  const twitterImage = extractMetaContent(html, 'twitter:image', 'name')
  if (twitterImage) return resolveUrl(twitterImage, baseUrl)

  // 3. Twitter image:src (备用)
  const twitterImageSrc = extractMetaContent(html, 'twitter:image:src', 'name')
  if (twitterImageSrc) return resolveUrl(twitterImageSrc, baseUrl)

  return ''
}

/**
 * 提取作者信息
 * 根据不同平台有不同的提取策略
 */
function extractAuthor(html: string, platform: string): string {
  // 1. Open Graph article:author
  const ogAuthor = extractMetaContent(html, 'article:author', 'property')
  if (ogAuthor) return cleanText(ogAuthor)

  // 2. Meta author
  const metaAuthor = extractMetaContent(html, 'author', 'name')
  if (metaAuthor) return cleanText(metaAuthor)

  // 3. 微信公众号特殊处理
  if (platform === 'wechat') {
    return extractWechatAuthor(html)
  }

  // 4. B站特殊处理
  if (platform === 'bilibili') {
    return extractBilibiliAuthor(html)
  }

  return ''
}

/**
 * 提取网站名称
 */
function extractSiteName(html: string): string {
  const ogSiteName = extractMetaContent(html, 'og:site_name', 'property')
  if (ogSiteName) return cleanText(ogSiteName)

  return ''
}

/**
 * 从 meta 标签中提取内容
 */
function extractMetaContent(
  html: string,
  name: string,
  attribute: 'property' | 'name'
): string {
  // 匹配两种顺序：attribute在前或content在前
  const patterns = [
    new RegExp(
      `<meta[^>]+${attribute}=["']${escapeRegex(name)}["'][^>]+content=["']([^"']+)["']`,
      'i'
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+${attribute}=["']${escapeRegex(name)}["']`,
      'i'
    ),
  ]

  for (const pattern of patterns) {
    const match = html.match(pattern)
    if (match) return match[1]
  }

  return ''
}

/**
 * 微信公众号作者提取
 */
function extractWechatAuthor(html: string): string {
  // 方法1：从 profile_nickname 变量提取
  const nicknameMatch = html.match(/var\s+profile_nickname\s*=\s*["']([^"']+)["']/)
  if (nicknameMatch) return cleanText(nicknameMatch[1])

  // 方法2：从 js_name 提取
  const jsNameMatch = html.match(/id="js_name"[^>]*>([^<]+)</)
  if (jsNameMatch) return cleanText(jsNameMatch[1])

  // 方法3：从 meta 标签提取
  const metaAuthor = html.match(/<meta\s+name="author"\s+content="([^"]+)"/)
  if (metaAuthor) return cleanText(metaAuthor[1])

  return ''
}

/**
 * B站作者提取
 */
function extractBilibiliAuthor(html: string): string {
  // 方法1：从 __INITIAL_STATE__ 提取
  const stateMatch = html.match(/__INITIAL_STATE__\s*=\s*(\{[\s\S]*?\});/)
  if (stateMatch) {
    try {
      const state = JSON.parse(stateMatch[1])
      // 视频页面
      if (state.videoData?.owner?.name) {
        return state.videoData.owner.name
      }
      // 文章页面
      if (state.readInfo?.author?.name) {
        return state.readInfo.author.name
      }
    } catch {
      // JSON 解析失败，继续尝试其他方法
    }
  }

  // 方法2：从 meta 标签提取
  const metaAuthor = extractMetaContent(html, 'author', 'name')
  if (metaAuthor) return cleanText(metaAuthor)

  return ''
}

/**
 * 解析相对 URL 为绝对 URL
 */
function resolveUrl(urlStr: string, baseUrl: string): string {
  if (!urlStr) return ''

  // 已经是绝对 URL
  if (urlStr.startsWith('http://') || urlStr.startsWith('https://')) {
    return urlStr
  }

  // 协议相对 URL
  if (urlStr.startsWith('//')) {
    try {
      const base = new URL(baseUrl)
      return `${base.protocol}${urlStr}`
    } catch {
      return `https:${urlStr}`
    }
  }

  // 相对 URL
  try {
    return new URL(urlStr, baseUrl).href
  } catch {
    return urlStr
  }
}

/**
 * 清理文本：去除多余空白、HTML 实体解码
 */
function cleanText(text: string): string {
  return text
    // 十六进制数字实体 &#x2F; -> /
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    // 十进制数字实体 &#47; -> /
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
    // 命名实体
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&hellip;/g, '…')
    .replace(/&copy;/g, '©')
    .replace(/&reg;/g, '®')
    .replace(/&trade;/g, '™')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * 提取正文字数
 * 从 HTML 中提取纯文本并计算字数
 */
function extractWordCount(html: string): number {
  // 移除 script 和 style 标签及其内容
  let text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '')

  // 尝试提取正文区域（微信公众号）
  const wechatContent = text.match(/<div[^>]*id="js_content"[^>]*>([\s\S]*?)<\/div>/i)
  if (wechatContent) {
    text = wechatContent[1]
  } else {
    // 尝试提取 article 或 main 标签内容
    const articleContent = text.match(/<article[^>]*>([\s\S]*?)<\/article>/i)
    const mainContent = text.match(/<main[^>]*>([\s\S]*?)<\/main>/i)
    if (articleContent) {
      text = articleContent[1]
    } else if (mainContent) {
      text = mainContent[1]
    }
  }

  // 移除所有 HTML 标签
  text = text.replace(/<[^>]+>/g, '')

  // 解码 HTML 实体
  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")

  // 移除多余空白
  text = text.replace(/\s+/g, '')

  // 返回字符数（中文按字符计算）
  return text.length
}

/**
 * 提取图片数量
 * 统计 HTML 中的 img 标签数量
 */
function extractImageCount(html: string): number {
  // 尝试提取正文区域（微信公众号）
  let contentHtml = html
  const wechatContent = html.match(/<div[^>]*id="js_content"[^>]*>([\s\S]*?)<\/div>/i)
  if (wechatContent) {
    contentHtml = wechatContent[1]
  } else {
    // 尝试提取 article 或 main 标签内容
    const articleContent = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i)
    const mainContent = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i)
    if (articleContent) {
      contentHtml = articleContent[1]
    } else if (mainContent) {
      contentHtml = mainContent[1]
    }
  }

  // 统计 img 标签数量（排除小图标和头像等）
  const imgMatches = contentHtml.match(/<img[^>]+>/gi) || []

  // 过滤掉小图片（如表情、图标等）
  const validImages = imgMatches.filter((img) => {
    // 排除带有 emoji、icon、avatar、logo 类名的图片
    if (/class=["'][^"']*(?:emoji|icon|avatar|logo|qr)[^"']*["']/i.test(img)) {
      return false
    }
    // 排除过小的图片
    const widthMatch = img.match(/width=["']?(\d+)/i)
    const heightMatch = img.match(/height=["']?(\d+)/i)
    if (widthMatch && parseInt(widthMatch[1]) < 50) return false
    if (heightMatch && parseInt(heightMatch[1]) < 50) return false
    return true
  })

  return validImages.length
}

/**
 * 转义正则表达式特殊字符
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * 抓取网页内容
 */
export async function fetchWebContent(url: string): Promise<string> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 10000) // 10秒超时

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      },
      signal: controller.signal,
      redirect: 'follow',
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const contentType = response.headers.get('content-type') || ''
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
      throw new Error('不是有效的 HTML 页面')
    }

    const html = await response.text()
    return html
  } catch (error) {
    clearTimeout(timeoutId)

    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new Error('请求超时，请检查链接是否可访问')
      }
      logger.error(
        { url, error: error.message, action: 'fetch_web_content' },
        'Metadata Parser: fetch failed'
      )
      throw error
    }
    throw new Error('网页抓取失败')
  }
}

/**
 * 完整的元数据获取流程
 */
export async function getWebMetadata(url: string): Promise<WebMetadata> {
  logger.info({ url, action: 'get_metadata_start' }, 'Metadata Parser: fetching')

  const html = await fetchWebContent(url)
  const metadata = parseHTMLMetadata(html, url)

  logger.info(
    {
      url,
      title: metadata.title.substring(0, 50),
      platform: metadata.platform,
      action: 'get_metadata_success'
    },
    'Metadata Parser: success'
  )

  return metadata
}
