/**
 * 日期时间相关工具函数
 */

// 时间常量
export const MILLISECONDS_PER_SECOND = 1000
export const SECONDS_PER_MINUTE = 60
export const MINUTES_PER_HOUR = 60
export const HOURS_PER_DAY = 24
export const DAYS_PER_WEEK = 7

export const MILLISECONDS_PER_MINUTE = MILLISECONDS_PER_SECOND * SECONDS_PER_MINUTE
export const MILLISECONDS_PER_HOUR = MILLISECONDS_PER_MINUTE * MINUTES_PER_HOUR
export const MILLISECONDS_PER_DAY = MILLISECONDS_PER_HOUR * HOURS_PER_DAY

/**
 * 格式化相对时间（多久以前）
 * @param dateString ISO 8601 日期字符串
 * @returns 格式化后的相对时间字符串
 *
 * @example
 * formatRelativeTime('2024-01-01T00:00:00Z') // "5分钟前"
 * formatRelativeTime('2024-01-01T00:00:00Z') // "2小时前"
 * formatRelativeTime('2024-01-01T00:00:00Z') // "3天前"
 * formatRelativeTime('2023-12-01T00:00:00Z') // "1月1日"
 */
export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()

  // 计算时间差
  const minutes = Math.floor(diffMs / MILLISECONDS_PER_MINUTE)
  const hours = Math.floor(diffMs / MILLISECONDS_PER_HOUR)
  const days = Math.floor(diffMs / MILLISECONDS_PER_DAY)

  // 1小时内显示分钟
  if (minutes < MINUTES_PER_HOUR) {
    return `${minutes}分钟前`
  }

  // 24小时内显示小时
  if (hours < HOURS_PER_DAY) {
    return `${hours}小时前`
  }

  // 7天内显示天数
  if (days < DAYS_PER_WEEK) {
    return `${days}天前`
  }

  // 超过7天显示日期
  return date.toLocaleDateString('zh-CN', {
    month: 'short',
    day: 'numeric',
  })
}

/**
 * 格式化完整日期时间
 * @param dateString ISO 8601 日期字符串
 * @returns 格式化后的日期时间字符串
 *
 * @example
 * formatDateTime('2024-01-01T12:30:00Z') // "2024年1月1日 12:30"
 */
export function formatDateTime(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * 格式化日期（不含时间）
 * @param dateString ISO 8601 日期字符串
 * @returns 格式化后的日期字符串
 *
 * @example
 * formatDate('2024-01-01T12:30:00Z') // "2024年1月1日"
 */
export function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

/**
 * 检查日期是否为今天
 * @param dateString ISO 8601 日期字符串
 * @returns 是否为今天
 */
export function isToday(dateString: string): boolean {
  const date = new Date(dateString)
  const today = new Date()
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  )
}

/**
 * 检查日期是否在指定天数内
 * @param dateString ISO 8601 日期字符串
 * @param days 天数
 * @returns 是否在指定天数内
 */
export function isWithinDays(dateString: string, days: number): boolean {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / MILLISECONDS_PER_DAY)
  return diffDays <= days
}
