/**
 * URL 提取工具
 * 从各平台分享文本中提取真实 URL
 *
 * 支持的平台分享格式：
 * - 小红书：【标题 - 作者 | 小红书】😆 短码 😆 https://www.xiaohongshu.com/...
 * - 抖音：标题 https://v.douyin.com/...
 * - 微博：标题 https://weibo.com/...
 * - 通用：任意包含 https:// 的文本
 */

/**
 * 检查是否为纯净的 URL（不包含其他文本）
 */
function isCleanUrl(text: string): boolean {
  const trimmed = text.trim()
  // 检查是否以 http:// 或 https:// 开头，且不包含空格
  return /^https?:\/\/\S+$/.test(trimmed)
}

/**
 * 从分享文本中提取 URL
 *
 * @param text - 用户粘贴的文本（可能包含标题、表情等）
 * @returns 提取的纯净 URL，如果无法提取则返回原文本
 *
 * @example
 * // 小红书分享
 * extractUrlFromShareText('22 【标题 - 作者 | 小红书】 😆 xxx 😆 https://www.xiaohongshu.com/discovery/item/123')
 * // => 'https://www.xiaohongshu.com/discovery/item/123'
 *
 * // 纯净 URL
 * extractUrlFromShareText('https://mp.weixin.qq.com/s/xxx')
 * // => 'https://mp.weixin.qq.com/s/xxx'
 */
export function extractUrlFromShareText(text: string): string {
  if (!text) {
    return ''
  }

  const trimmed = text.trim()

  // 如果已经是纯净 URL，直接返回
  if (isCleanUrl(trimmed)) {
    return trimmed
  }

  // 小红书分享格式
  // 格式：【标题】😆 短码 😆 https://www.xiaohongshu.com/...
  const xhsMatch = trimmed.match(
    /https?:\/\/(?:www\.)?xiaohongshu\.com\/[^\s\u4e00-\u9fa5]*/
  )
  if (xhsMatch) {
    // 清理 URL 末尾可能的非 URL 字符
    return cleanUrlEnd(xhsMatch[0])
  }

  // 抖音分享格式
  // 格式：标题 https://v.douyin.com/... 或 https://www.douyin.com/...
  const douyinMatch = trimmed.match(
    /https?:\/\/(?:www\.|v\.)?douyin\.com\/[^\s\u4e00-\u9fa5]*/
  )
  if (douyinMatch) {
    return cleanUrlEnd(douyinMatch[0])
  }

  // 微博分享格式
  const weiboMatch = trimmed.match(
    /https?:\/\/(?:www\.|m\.)?weibo\.(?:com|cn)\/[^\s\u4e00-\u9fa5]*/
  )
  if (weiboMatch) {
    return cleanUrlEnd(weiboMatch[0])
  }

  // B站分享格式
  const biliMatch = trimmed.match(
    /https?:\/\/(?:www\.)?bilibili\.com\/[^\s\u4e00-\u9fa5]*/
  )
  if (biliMatch) {
    return cleanUrlEnd(biliMatch[0])
  }

  // 知乎分享格式
  const zhihuMatch = trimmed.match(
    /https?:\/\/(?:www\.|zhuanlan\.)?zhihu\.com\/[^\s\u4e00-\u9fa5]*/
  )
  if (zhihuMatch) {
    return cleanUrlEnd(zhihuMatch[0])
  }

  // 通用：尝试提取任何 https/http URL
  const genericMatch = trimmed.match(/https?:\/\/[^\s\u4e00-\u9fa5]+/)
  if (genericMatch) {
    return cleanUrlEnd(genericMatch[0])
  }

  // 无法提取，返回原文本
  return trimmed
}

/**
 * 清理 URL 末尾可能的非法字符
 * 例如：末尾的引号、括号等
 */
function cleanUrlEnd(url: string): string {
  // 移除末尾的常见非 URL 字符
  return url.replace(/[)}\]>"']+$/, '')
}

/**
 * 检测文本是否包含可提取的分享链接
 *
 * @param text - 要检测的文本
 * @returns 是否包含可提取的 URL
 */
export function containsExtractableUrl(text: string): boolean {
  if (!text) return false
  const trimmed = text.trim()

  // 检查是否包含 http:// 或 https://
  return /https?:\/\//.test(trimmed)
}

/**
 * 获取 URL 对应的平台名称
 *
 * @param url - URL 字符串
 * @returns 平台名称，未知平台返回 null
 */
export function getPlatformFromUrl(url: string): string | null {
  if (!url) return null

  const lowerUrl = url.toLowerCase()

  if (lowerUrl.includes('xiaohongshu.com')) return '小红书'
  if (lowerUrl.includes('douyin.com')) return '抖音'
  if (lowerUrl.includes('weibo.com') || lowerUrl.includes('weibo.cn')) return '微博'
  if (lowerUrl.includes('bilibili.com')) return 'B站'
  if (lowerUrl.includes('zhihu.com')) return '知乎'
  if (lowerUrl.includes('mp.weixin.qq.com')) return '微信公众号'
  if (lowerUrl.includes('juejin.cn')) return '掘金'
  if (lowerUrl.includes('github.com')) return 'GitHub'
  if (lowerUrl.includes('youtube.com') || lowerUrl.includes('youtu.be')) return 'YouTube'

  return null
}
