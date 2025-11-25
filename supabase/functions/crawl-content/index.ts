/**
 * Supabase Edge Function: crawl-content
 * 爬取微信公众号、B站、小红书等平台的内容元数据
 *
 * 请求格式: POST
 * Body: { "url": "https://..." }
 *
 * 响应格式:
 * {
 *   "success": true,
 *   "data": {
 *     "title": "文章标题",
 *     "author": "作者名",
 *     "coverUrl": "封面图URL",
 *     "description": "描述",
 *     "platform": "WECHAT_OFFICIAL_ACCOUNT" | "BILIBILI" | "XIAOHONGSHU"
 *   }
 * }
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

interface CrawlRequest {
  url: string
}

interface CrawlResult {
  title: string
  author?: string
  coverUrl?: string
  description?: string
  platform: 'WECHAT_OFFICIAL_ACCOUNT' | 'BILIBILI' | 'XIAOHONGSHU' | 'UNKNOWN'
}

/**
 * 识别 URL 所属平台
 */
function detectPlatform(url: string): CrawlResult['platform'] {
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
}

/**
 * 从 HTML 中提取 meta 标签内容
 */
function extractMetaTag(html: string, name: string): string | undefined {
  // 匹配 <meta property="og:title" content="..." /> 或 <meta name="title" content="..." />
  const propertyRegex = new RegExp(`<meta\\s+property=["']${name}["']\\s+content=["']([^"']+)["']`, 'i')
  const nameRegex = new RegExp(`<meta\\s+name=["']${name}["']\\s+content=["']([^"']+)["']`, 'i')

  let match = html.match(propertyRegex) || html.match(nameRegex)
  return match ? match[1] : undefined
}

/**
 * 从 HTML 中提取 <title> 标签
 */
function extractTitle(html: string): string | undefined {
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i)
  return match ? match[1].trim() : undefined
}

/**
 * 爬取微信公众号文章
 */
async function crawlWechat(url: string): Promise<Partial<CrawlResult>> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    })

    const html = await response.text()

    // 提取标题
    const title = extractMetaTag(html, 'og:title') ||
                  extractMetaTag(html, 'twitter:title') ||
                  extractTitle(html) ||
                  '未知标题'

    // 提取作者
    const author = extractMetaTag(html, 'author') ||
                   extractMetaTag(html, 'og:article:author')

    // 提取封面
    const coverUrl = extractMetaTag(html, 'og:image') ||
                     extractMetaTag(html, 'twitter:image')

    // 提取描述
    const description = extractMetaTag(html, 'og:description') ||
                        extractMetaTag(html, 'description')

    return {
      title,
      author,
      coverUrl,
      description,
    }
  } catch (error) {
    console.error('Crawl wechat error:', error)
    throw new Error('爬取微信文章失败')
  }
}

/**
 * 爬取 B 站视频
 */
async function crawlBilibili(url: string): Promise<Partial<CrawlResult>> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    })

    const html = await response.text()

    // 提取标题
    const title = extractMetaTag(html, 'og:title') ||
                  extractMetaTag(html, 'title') ||
                  extractTitle(html) ||
                  '未知视频'

    // 提取作者（UP主）
    const author = extractMetaTag(html, 'author')

    // 提取封面
    const coverUrl = extractMetaTag(html, 'og:image')

    // 提取描述
    const description = extractMetaTag(html, 'og:description') ||
                        extractMetaTag(html, 'description')

    return {
      title,
      author,
      coverUrl,
      description,
    }
  } catch (error) {
    console.error('Crawl bilibili error:', error)
    throw new Error('爬取 B 站视频失败')
  }
}

/**
 * 爬取小红书笔记
 */
async function crawlXiaohongshu(url: string): Promise<Partial<CrawlResult>> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15',
      },
    })

    const html = await response.text()

    // 提取标题
    const title = extractMetaTag(html, 'og:title') ||
                  extractTitle(html) ||
                  '未知笔记'

    // 提取作者
    const author = extractMetaTag(html, 'og:article:author')

    // 提取封面
    const coverUrl = extractMetaTag(html, 'og:image')

    // 提取描述
    const description = extractMetaTag(html, 'og:description') ||
                        extractMetaTag(html, 'description')

    return {
      title,
      author,
      coverUrl,
      description,
    }
  } catch (error) {
    console.error('Crawl xiaohongshu error:', error)
    throw new Error('爬取小红书笔记失败')
  }
}

/**
 * 通用爬取函数（兜底方案）
 */
async function crawlGeneric(url: string): Promise<Partial<CrawlResult>> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    })

    const html = await response.text()

    const title = extractMetaTag(html, 'og:title') ||
                  extractMetaTag(html, 'twitter:title') ||
                  extractTitle(html) ||
                  '未知标题'

    const author = extractMetaTag(html, 'author')
    const coverUrl = extractMetaTag(html, 'og:image') || extractMetaTag(html, 'twitter:image')
    const description = extractMetaTag(html, 'og:description') || extractMetaTag(html, 'description')

    return {
      title,
      author,
      coverUrl,
      description,
    }
  } catch (error) {
    console.error('Crawl generic error:', error)
    throw new Error('爬取内容失败')
  }
}

/**
 * 主爬取函数
 */
async function crawlContent(url: string): Promise<CrawlResult> {
  // 识别平台
  const platform = detectPlatform(url)

  // 根据平台选择爬取策略
  let result: Partial<CrawlResult>

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

  return {
    platform,
    title: result.title || '未知标题',
    author: result.author,
    coverUrl: result.coverUrl,
    description: result.description,
  }
}

/**
 * Edge Function 入口
 */
serve(async (req) => {
  // CORS 预检请求
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    })
  }

  // 只接受 POST 请求
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ success: false, error: 'Method not allowed' }),
      {
        status: 405,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }

  try {
    // 解析请求体
    const { url }: CrawlRequest = await req.json()

    if (!url) {
      return new Response(
        JSON.stringify({ success: false, error: 'URL is required' }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      )
    }

    // 验证 URL 格式
    try {
      new URL(url)
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid URL format' }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      )
    }

    // 执行爬取
    const data = await crawlContent(url)

    return new Response(
      JSON.stringify({ success: true, data }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    )
  } catch (error) {
    console.error('Edge function error:', error)

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : '爬取失败',
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    )
  }
})
