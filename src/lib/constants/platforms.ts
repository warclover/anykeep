/**
 * 平台配置常量
 * 统一管理所有平台相关的配置信息
 */

import type { Platform } from "@/types/supabase";

/**
 * 平台配置接口
 */
export interface PlatformConfig {
  /** 平台显示名称 */
  name: string;
  /** 平台唯一标识（用于设置等场景） */
  key: string;
  /** 十六进制颜色代码（用于图表） */
  hexColor: string;
  /** Tailwind CSS 背景色类名（用于 UI 组件） */
  bgColor: string;
  /** Emoji 图标 */
  icon: string;
}

/**
 * 平台配置映射表
 */
export const PLATFORM_CONFIGS: Record<Platform, PlatformConfig> = {
  WECHAT_OFFICIAL_ACCOUNT: {
    name: "微信公众号",
    key: "wechat",
    hexColor: "#07c160",
    bgColor: "bg-green-600",
    icon: "💬",
  },
  BILIBILI: {
    name: "B站",
    key: "bilibili",
    hexColor: "#00a1d6",
    bgColor: "bg-blue-500",
    icon: "📺",
  },
  XIAOHONGSHU: {
    name: "小红书",
    key: "xiaohongshu",
    hexColor: "#ff2442",
    bgColor: "bg-red-500",
    icon: "📕",
  },
  // ========== V1.2 新增：浏览器平台 ==========
  BROWSER_CHROME: {
    name: "Chrome",
    key: "chrome",
    hexColor: "#4285f4",
    bgColor: "bg-blue-500",
    icon: "🌐",
  },
  BROWSER_EDGE: {
    name: "Edge",
    key: "edge",
    hexColor: "#0078d4",
    bgColor: "bg-cyan-600",
    icon: "🔷",
  },
  BROWSER_FIREFOX: {
    name: "Firefox",
    key: "firefox",
    hexColor: "#ff7139",
    bgColor: "bg-orange-500",
    icon: "🦊",
  },
  BROWSER_SAFARI: {
    name: "Safari",
    key: "safari",
    hexColor: "#006cff",
    bgColor: "bg-sky-500",
    icon: "🧭",
  },
  UNKNOWN: {
    name: "其他",
    key: "unknown",
    hexColor: "#9ca3af",
    bgColor: "bg-gray-500",
    icon: "📌",
  },
};

/**
 * 所有支持的平台列表（用于设置页面等需要遍历的场景）
 */
export const ALL_PLATFORMS: PlatformConfig[] = [
  PLATFORM_CONFIGS.WECHAT_OFFICIAL_ACCOUNT,
  PLATFORM_CONFIGS.BILIBILI,
  PLATFORM_CONFIGS.XIAOHONGSHU,
  PLATFORM_CONFIGS.BROWSER_CHROME,
  PLATFORM_CONFIGS.BROWSER_EDGE,
];

/**
 * 内容平台列表（微信、B站、小红书等）
 */
export const CONTENT_PLATFORMS: Platform[] = [
  "WECHAT_OFFICIAL_ACCOUNT",
  "BILIBILI",
  "XIAOHONGSHU",
];

/**
 * 浏览器平台列表
 */
export const BROWSER_PLATFORMS: Platform[] = [
  "BROWSER_CHROME",
  "BROWSER_EDGE",
  "BROWSER_FIREFOX",
  "BROWSER_SAFARI",
];

/**
 * 判断是否为浏览器平台
 * @param platform 平台类型
 * @returns 是否为浏览器平台
 */
export function isBrowserPlatform(platform: Platform): boolean {
  return BROWSER_PLATFORMS.includes(platform);
}

/**
 * 判断是否为内容平台
 * @param platform 平台类型
 * @returns 是否为内容平台
 */
export function isContentPlatform(platform: Platform): boolean {
  return CONTENT_PLATFORMS.includes(platform);
}

/**
 * 获取平台配置
 * @param platform 平台类型
 * @returns 平台配置对象
 */
export function getPlatformConfig(platform: Platform | string): PlatformConfig {
  return PLATFORM_CONFIGS[platform as Platform] || PLATFORM_CONFIGS.UNKNOWN;
}

/**
 * 获取平台中文名称
 * @param platform 平台类型
 * @returns 平台中文名称
 */
export function getPlatformName(platform: Platform | string): string {
  return getPlatformConfig(platform).name;
}

/**
 * 获取平台十六进制颜色
 * @param platform 平台类型
 * @returns 十六进制颜色代码
 */
export function getPlatformHexColor(platform: Platform | string): string {
  return getPlatformConfig(platform).hexColor;
}

/**
 * 获取平台 Tailwind 背景色类名
 * @param platform 平台类型
 * @returns Tailwind CSS 类名
 */
export function getPlatformBgColor(platform: Platform | string): string {
  return getPlatformConfig(platform).bgColor;
}

/**
 * 获取平台图标
 * @param platform 平台类型
 * @returns Emoji 图标
 */
export function getPlatformIcon(platform: Platform | string): string {
  return getPlatformConfig(platform).icon;
}

/**
 * 检测 URL 所属平台
 * @param url 内容 URL
 * @returns 平台类型
 */
export function detectPlatformFromUrl(url: string): Platform {
  if (url.includes("mp.weixin.qq.com")) return "WECHAT_OFFICIAL_ACCOUNT";
  if (url.includes("bilibili.com")) return "BILIBILI";
  if (url.includes("xiaohongshu.com") || url.includes("xhslink.com"))
    return "XIAOHONGSHU";
  return "UNKNOWN";
}
