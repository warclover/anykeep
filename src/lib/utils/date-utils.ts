/**
 * 日期时间工具函数
 */

/**
 * 格式化相对时间（如"3 分钟前"、"2 小时前"）
 */
export function formatRelativeTime(date: string | Date): string {
  const now = new Date()
  const target = new Date(date)
  const diffInMs = now.getTime() - target.getTime()
  const diffInSeconds = Math.floor(diffInMs / 1000)
  const diffInMinutes = Math.floor(diffInSeconds / 60)
  const diffInHours = Math.floor(diffInMinutes / 60)
  const diffInDays = Math.floor(diffInHours / 24)

  if (diffInSeconds < 60) {
    return '刚刚'
  }

  if (diffInMinutes < 60) {
    return `${diffInMinutes} 分钟前`
  }

  if (diffInHours < 24) {
    return `${diffInHours} 小时前`
  }

  if (diffInDays < 7) {
    return `${diffInDays} 天前`
  }

  if (diffInDays < 30) {
    const weeks = Math.floor(diffInDays / 7)
    return `${weeks} 周前`
  }

  if (diffInDays < 365) {
    const months = Math.floor(diffInDays / 30)
    return `${months} 个月前`
  }

  const years = Math.floor(diffInDays / 365)
  return `${years} 年前`
}

/**
 * 格式化为友好的日期字符串
 * @example formatFriendlyDate('2025-01-24T10:30:00Z') // "2025年1月24日 10:30"
 */
export function formatFriendlyDate(date: string | Date): string {
  const target = new Date(date)
  const year = target.getFullYear()
  const month = target.getMonth() + 1
  const day = target.getDate()
  const hours = target.getHours().toString().padStart(2, '0')
  const minutes = target.getMinutes().toString().padStart(2, '0')

  return `${year}年${month}月${day}日 ${hours}:${minutes}`
}

/**
 * 格式化为短日期（如"01-24"）
 */
export function formatShortDate(date: string | Date): string {
  const target = new Date(date)
  const month = (target.getMonth() + 1).toString().padStart(2, '0')
  const day = target.getDate().toString().padStart(2, '0')
  return `${month}-${day}`
}
