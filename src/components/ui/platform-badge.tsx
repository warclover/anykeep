/**
 * 平台徽章组件
 * PRD v4.1: Source Memory - 强化平台视觉识别
 *
 * 设计原则：
 * - 图标 24x24px（移动端 20x20px）
 * - 平台品牌色背景 + 白色图标
 * - 支持深色模式
 */

'use client'

import { cn } from '@/lib/utils'
import { getPlatformConfig } from '@/lib/platform-utils'
import type { Platform } from '@/types/supabase'

interface PlatformBadgeProps {
  /** 平台类型 */
  platform: Platform | string
  /** 尺寸：sm (紧凑) | md (默认) | lg (大) */
  size?: 'sm' | 'md' | 'lg'
  /** 是否显示平台名称 */
  showName?: boolean
  /** 自定义类名 */
  className?: string
}

/**
 * 平台徽章组件
 *
 * @example
 * // 仅图标（默认）
 * <PlatformBadge platform="WECHAT_OFFICIAL_ACCOUNT" />
 *
 * // 带名称
 * <PlatformBadge platform="BILIBILI" showName />
 *
 * // 大尺寸
 * <PlatformBadge platform="XIAOHONGSHU" size="lg" showName />
 */
export function PlatformBadge({
  platform,
  size = 'md',
  showName = false,
  className,
}: PlatformBadgeProps) {
  const config = getPlatformConfig(platform)
  const Icon = config.icon

  // 尺寸配置
  const sizeConfig = {
    sm: {
      container: 'px-1.5 py-0.5 gap-1',
      icon: 'w-4 h-4',
      text: 'text-xs',
    },
    md: {
      container: 'px-2 py-1 gap-1.5',
      icon: 'w-5 h-5',
      text: 'text-xs font-medium',
    },
    lg: {
      container: 'px-2.5 py-1.5 gap-2',
      icon: 'w-6 h-6',
      text: 'text-sm font-medium',
    },
  }

  const sizes = sizeConfig[size]

  return (
    <div
      className={cn(
        'inline-flex items-center rounded-md text-white transition-opacity',
        sizes.container,
        className
      )}
      style={{
        backgroundColor: config.brandColor,
      }}
    >
      <Icon className={cn(sizes.icon, 'shrink-0')} />
      {showName && (
        <span className={cn(sizes.text, 'whitespace-nowrap')}>
          {config.name}
        </span>
      )}
    </div>
  )
}

/**
 * 平台徽章（浅色背景版本）
 * 适用于白色/浅色卡片内部
 */
export function PlatformBadgeLight({
  platform,
  size = 'md',
  showName = false,
  className,
}: PlatformBadgeProps) {
  const config = getPlatformConfig(platform)
  const Icon = config.icon

  const sizeConfig = {
    sm: {
      container: 'px-1.5 py-0.5 gap-1',
      icon: 'w-4 h-4',
      text: 'text-xs',
    },
    md: {
      container: 'px-2 py-1 gap-1.5',
      icon: 'w-5 h-5',
      text: 'text-xs font-medium',
    },
    lg: {
      container: 'px-2.5 py-1.5 gap-2',
      icon: 'w-6 h-6',
      text: 'text-sm font-medium',
    },
  }

  const sizes = sizeConfig[size]

  return (
    <div
      className={cn(
        'inline-flex items-center rounded-md transition-opacity',
        sizes.container,
        className
      )}
      style={{
        backgroundColor: config.brandBgColor,
        color: config.brandColor,
      }}
    >
      <Icon className={cn(sizes.icon, 'shrink-0')} />
      {showName && (
        <span className={cn(sizes.text, 'whitespace-nowrap')}>
          {config.name}
        </span>
      )}
    </div>
  )
}
