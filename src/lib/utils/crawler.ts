/**
 * 内容爬虫工具函数
 * 从微信公众号、B站、小红书等平台爬取元数据
 */

import { logger } from '@/lib/logger'

export interface CrawlResult {
  title: string
  author?: string
  coverUrl?: string
  description?: string
  platform: 'WECHAT_OFFICIAL_ACCOUNT' | 'BILIBILI' | 'XIAOHONGSHU' | 'UNKNOWN'
  wordCount?: number
  imageCount?: number
}

/**
 * 识别 URL 所属平台
 */
function detectPlatform(url: string): CrawlResult['platform'] {
  try {
    const hostname = new URL(url).hostname.toLowerCase()

    if (hostname.includes('weixin.qq.com') || hostname.includes('mp.weixin.qq.com')) {
      return 'WECHAT_OFFICIAL_ACCOUNT'
    }
    if (hostname.includes('bilibili.com') || hostname.includes('b23.tv')) {
      return 'BILIBILI'
    }
    if (hostname.includes('xiaohongshu.com') || hostname.includes('xhslink.com')) {
      return 'XIAOHONGSHU'
    }

    return 'UNKNOWN'
  } catch {
    return 'UNKNOWN'
  }
}

/**
 * HTML 实体解码
 * 将 &#x2F; -> / 等 HTML 实体转换为实际字符
 */
function decodeHtmlEntities(text: string): string {
  if (!text) return text

  return text
    // 十六进制数字实体 &#x2F; -> /
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    // 十进制数字实体 &#47; -> /
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
    // 命名实体
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&hellip;/g, '…')
}

/**
 * 从 HTML 中提取 meta 标签内容
 */
function extractMetaTag(html: string, name: string): string | undefined {
  // 匹配 <meta property="og:title" content="..." /> 或 <meta name="title" content="..." />
  const propertyRegex = new RegExp(
    `<meta\\s+property=["']${name}["']\\s+content=["']([^"']+)["']`,
    'i'
  )
  const nameRegex = new RegExp(
    `<meta\\s+name=["']${name}["']\\s+content=["']([^"']+)["']`,
    'i'
  )

  const match = html.match(propertyRegex) || html.match(nameRegex)
  // 解码 HTML 实体
  return match ? decodeHtmlEntities(match[1]) : undefined
}

/**
 * 从 HTML 中提取 <title> 标签
 */
function extractTitle(html: string): string | undefined {
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i)
  // 解码 HTML 实体
  return match ? decodeHtmlEntities(match[1].trim()) : undefined
}

/**
 * 提取正文字数
 */
function extractWordCount(html: string): number {
  // 移除 script 和 style 标签
  let text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '')

  // 尝试提取正文区域
  const wechatContent = text.match(/<div[^>]*id="js_content"[^>]*>([\s\S]*?)<\/div>/i)
  if (wechatContent) {
    text = wechatContent[1]
  } else {
    const articleContent = text.match(/<article[^>]*>([\s\S]*?)<\/article>/i)
    const mainContent = text.match(/<main[^>]*>([\s\S]*?)<\/main>/i)
    if (articleContent) {
      text = articleContent[1]
    } else if (mainContent) {
      text = mainContent[1]
    }
  }

  // 移除 HTML 标签并解码实体
  text = text.replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, '')

  return text.length
}

/**
 * 提取图片数量
 */
function extractImageCount(html: string): number {
  // 尝试提取正文区域
  let contentHtml = html
  const wechatContent = html.match(/<div[^>]*id="js_content"[^>]*>([\s\S]*?)<\/div>/i)
  if (wechatContent) {
    contentHtml = wechatContent[1]
  } else {
    const articleContent = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i)
    const mainContent = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i)
    if (articleContent) {
      contentHtml = articleContent[1]
    } else if (mainContent) {
      contentHtml = mainContent[1]
    }
  }

  // 统计有效 img 标签
  const imgMatches = contentHtml.match(/<img[^>]+>/gi) || []
  const validImages = imgMatches.filter((img) => {
    if (/class=["'][^"']*(?:emoji|icon|avatar|logo|qr)[^"']*["']/i.test(img)) {
      return false
    }
    const widthMatch = img.match(/width=["']?(\d+)/i)
    const heightMatch = img.match(/height=["']?(\d+)/i)
    if (widthMatch && parseInt(widthMatch[1]) < 50) return false
    if (heightMatch && parseInt(heightMatch[1]) < 50) return false
    return true
  })

  return validImages.length
}

/**
 * 爬取网页内容
 */
async function fetchPage(url: string): Promise<string> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      },
      // 设置超时
      signal: AbortSignal.timeout(10000), // 10秒超时
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    return await response.text()
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`网页访问失败: ${error.message}`)
    }
    throw new Error('网页访问失败')
  }
}

/**
 * 爬取微信公众号文章
 */
async function crawlWechat(url: string): Promise<Partial<CrawlResult>> {
  const html = await fetchPage(url)

  // 提取标题
  const title =
    extractMetaTag(html, 'og:title') ||
    extractMetaTag(html, 'twitter:title') ||
    extractTitle(html) ||
    '未知标题'

  // 提取作者
  const author =
    extractMetaTag(html, 'author') || extractMetaTag(html, 'og:article:author')

  // 提取封面
  const coverUrl =
    extractMetaTag(html, 'og:image') || extractMetaTag(html, 'twitter:image')

  // 提取描述
  const description =
    extractMetaTag(html, 'og:description') || extractMetaTag(html, 'description')

  // 提取字数和图片数
  const wordCount = extractWordCount(html)
  const imageCount = extractImageCount(html)

  return {
    title,
    author,
    coverUrl,
    description,
    wordCount,
    imageCount,
  }
}

/**
 * 爬取 B 站视频
 */
async function crawlBilibili(url: string): Promise<Partial<CrawlResult>> {
  const html = await fetchPage(url)

  // 提取标题
  const title =
    extractMetaTag(html, 'og:title') ||
    extractMetaTag(html, 'title') ||
    extractTitle(html) ||
    '未知视频'

  // 提取作者（UP主）
  const author = extractMetaTag(html, 'author')

  // 提取封面
  const coverUrl = extractMetaTag(html, 'og:image')

  // 提取描述
  const description =
    extractMetaTag(html, 'og:description') || extractMetaTag(html, 'description')

  // 提取字数和图片数
  const wordCount = extractWordCount(html)
  const imageCount = extractImageCount(html)

  return {
    title,
    author,
    coverUrl,
    description,
    wordCount,
    imageCount,
  }
}

/**
 * 爬取小红书笔记
 */
async function crawlXiaohongshu(url: string): Promise<Partial<CrawlResult>> {
  const html = await fetchPage(url)

  // 提取标题
  const title =
    extractMetaTag(html, 'og:title') || extractTitle(html) || '未知笔记'

  // 提取作者
  const author = extractMetaTag(html, 'og:article:author')

  // 提取封面
  const coverUrl = extractMetaTag(html, 'og:image')

  // 提取描述
  const description =
    extractMetaTag(html, 'og:description') || extractMetaTag(html, 'description')

  // 提取字数和图片数
  const wordCount = extractWordCount(html)
  const imageCount = extractImageCount(html)

  return {
    title,
    author,
    coverUrl,
    description,
    wordCount,
    imageCount,
  }
}

/**
 * 通用爬取函数（兜底方案）
 */
async function crawlGeneric(url: string): Promise<Partial<CrawlResult>> {
  const html = await fetchPage(url)

  const title =
    extractMetaTag(html, 'og:title') ||
    extractMetaTag(html, 'twitter:title') ||
    extractTitle(html) ||
    '未知标题'

  const author = extractMetaTag(html, 'author')
  const coverUrl =
    extractMetaTag(html, 'og:image') || extractMetaTag(html, 'twitter:image')
  const description =
    extractMetaTag(html, 'og:description') || extractMetaTag(html, 'description')

  // 提取字数和图片数
  const wordCount = extractWordCount(html)
  const imageCount = extractImageCount(html)

  return {
    title,
    author,
    coverUrl,
    description,
    wordCount,
    imageCount,
  }
}

/**
 * 主爬取函数
 * @param url 要爬取的 URL
 * @returns 爬取结果
 */
export async function crawlContent(url: string): Promise<CrawlResult> {
  // 验证 URL 格式
  try {
    new URL(url)
  } catch {
    throw new Error('无效的 URL 格式')
  }

  // 识别平台
  const platform = detectPlatform(url)

  // 根据平台选择爬取策略
  let result: Partial<CrawlResult>

  try {
    switch (platform) {
      case 'WECHAT_OFFICIAL_ACCOUNT':
        result = await crawlWechat(url)
        break
      case 'BILIBILI':
        result = await crawlBilibili(url)
        break
      case 'XIAOHONGSHU':
        result = await crawlXiaohongshu(url)
        break
      default:
        result = await crawlGeneric(url)
    }
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        platform,
        url,
        action: 'crawl_failed',
      },
      `Crawl ${platform} error`
    )
    // 如果特定平台爬取失败，尝试通用爬取
    if (platform !== 'UNKNOWN') {
      try {
        result = await crawlGeneric(url)
      } catch {
        // 通用爬取也失败，使用默认值
        result = { title: '无法获取标题' }
      }
    } else {
      result = { title: '无法获取标题' }
    }
  }

  return {
    platform,
    title: result.title || '未知标题',
    author: result.author,
    coverUrl: result.coverUrl,
    description: result.description,
    wordCount: result.wordCount,
    imageCount: result.imageCount,
  }
}
