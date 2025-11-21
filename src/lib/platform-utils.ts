/**
 * 平台相关工具函数
 */

import type { Platform } from '@/types/supabase'

/**
 * 平台配置类型
 */
export interface PlatformConfig {
  name: string
  bgColor: string
  icon?: string
}

/**
 * 平台配置映射表
 */
const PLATFORM_CONFIGS: Record<Platform, PlatformConfig> = {
  WECHAT_OFFICIAL_ACCOUNT: {
    name: '微信',
    bgColor: 'bg-green-500',
  },
  BILIBILI: {
    name: 'B站',
    bgColor: 'bg-pink-500',
  },
  XIAOHONGSHU: {
    name: '小红书',
    bgColor: 'bg-red-500',
  },
  UNKNOWN: {
    name: '其他',
    bgColor: 'bg-gray-500',
  },
}

/**
 * 平台中文名称映射表
 */
const PLATFORM_NAMES: Record<Platform, string> = {
  WECHAT_OFFICIAL_ACCOUNT: '微信公众号',
  BILIBILI: 'B站',
  XIAOHONGSHU: '小红书',
  UNKNOWN: '其他',
}

/**
 * 获取平台配置
 * @param platform 平台类型
 * @returns 平台配置对象
 */
export function getPlatformConfig(platform: Platform | string): PlatformConfig {
  return PLATFORM_CONFIGS[platform as Platform] || PLATFORM_CONFIGS.UNKNOWN
}

/**
 * 获取平台中文名称
 * @param platform 平台类型
 * @returns 平台中文名称
 */
export function getPlatformName(platform: Platform | string): string {
  return PLATFORM_NAMES[platform as Platform] || '收藏'
}

/**
 * 检测 URL 所属平台
 * @param url 内容 URL
 * @returns 平台类型
 */
export function detectPlatformFromUrl(url: string): Platform {
  if (url.includes('mp.weixin.qq.com')) return 'WECHAT_OFFICIAL_ACCOUNT'
  if (url.includes('bilibili.com')) return 'BILIBILI'
  if (url.includes('xiaohongshu.com') || url.includes('xhslink.com')) return 'XIAOHONGSHU'
  return 'UNKNOWN'
}
