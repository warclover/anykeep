/**
 * 平台相关工具函数
 * PRD v4.1: Visual First 设计 - 平台图标强化和颜色编码
 */

import type { Platform } from "@/types/supabase";
import type { LucideIcon } from "lucide-react";
import {
  MessageSquare,
  Play,
  BookOpen,
  Globe,
  Chrome,
  Compass,
} from "lucide-react";

/**
 * 平台配置类型 - 增强版
 * 支持品牌颜色、图标、深色模式
 */
export interface PlatformConfig {
  /** 平台简称 */
  name: string;
  /** 平台全称 */
  fullName: string;
  /** Tailwind 背景色类（用于小徽章） */
  bgColor: string;
  /** 品牌主色（HEX） */
  brandColor: string;
  /** 品牌浅色背景（HEX） */
  brandBgColor: string;
  /** 深色模式品牌色（HEX） */
  brandColorDark: string;
  /** 深色模式品牌背景（HEX） */
  brandBgColorDark: string;
  /** Lucide 图标组件 */
  icon: LucideIcon;
}

/**
 * 平台配置映射表 - 增强版
 * PRD v4.1: Source Memory - 平台视觉识别
 */
const PLATFORM_CONFIGS: Record<Platform, PlatformConfig> = {
  WECHAT_OFFICIAL_ACCOUNT: {
    name: "微信",
    fullName: "微信公众号",
    bgColor: "bg-green-500",
    brandColor: "#07C160", // 微信绿
    brandBgColor: "#E7F8EF", // 浅绿背景
    brandColorDark: "#10B981", // 深色模式绿
    brandBgColorDark: "#064E3B", // 深色模式背景
    icon: MessageSquare,
  },
  BILIBILI: {
    name: "B站",
    fullName: "B站视频",
    bgColor: "bg-pink-500",
    brandColor: "#FB7299", // B站粉
    brandBgColor: "#FFF0F6", // 浅粉背景
    brandColorDark: "#F472B6", // 深色模式粉
    brandBgColorDark: "#831843", // 深色模式背景
    icon: Play,
  },
  XIAOHONGSHU: {
    name: "小红书",
    fullName: "小红书笔记",
    bgColor: "bg-red-500",
    brandColor: "#FF2442", // 小红书红
    brandBgColor: "#FFE8EC", // 浅红背景
    brandColorDark: "#EF4444", // 深色模式红
    brandBgColorDark: "#7F1D1D", // 深色模式背景
    icon: BookOpen,
  },
  // ========== V1.2 新增：浏览器平台 ==========
  BROWSER_CHROME: {
    name: "Chrome",
    fullName: "Chrome 书签",
    bgColor: "bg-blue-500",
    brandColor: "#4285F4", // Google 蓝
    brandBgColor: "#E8F0FE", // 浅蓝背景
    brandColorDark: "#60A5FA", // 深色模式蓝
    brandBgColorDark: "#1E3A5F", // 深色模式背景
    icon: Chrome,
  },
  BROWSER_EDGE: {
    name: "Edge",
    fullName: "Edge 书签",
    bgColor: "bg-cyan-600",
    brandColor: "#0078D4", // Microsoft 蓝
    brandBgColor: "#E6F2FF", // 浅蓝背景
    brandColorDark: "#38BDF8", // 深色模式青
    brandBgColorDark: "#164E63", // 深色模式背景
    icon: Compass,
  },
  BROWSER_FIREFOX: {
    name: "Firefox",
    fullName: "Firefox 书签",
    bgColor: "bg-orange-500",
    brandColor: "#FF7139", // Firefox 橙
    brandBgColor: "#FFF4E6", // 浅橙背景
    brandColorDark: "#FB923C", // 深色模式橙
    brandBgColorDark: "#7C2D12", // 深色模式背景
    icon: Globe,
  },
  BROWSER_SAFARI: {
    name: "Safari",
    fullName: "Safari 书签",
    bgColor: "bg-sky-500",
    brandColor: "#006CFF", // Safari 蓝
    brandBgColor: "#E0F2FE", // 浅蓝背景
    brandColorDark: "#0EA5E9", // 深色模式蓝
    brandBgColorDark: "#0C4A6E", // 深色模式背景
    icon: Compass,
  },
  UNKNOWN: {
    name: "其他",
    fullName: "其他来源",
    bgColor: "bg-gray-500",
    brandColor: "#6B7280", // 灰色
    brandBgColor: "#F3F4F6", // 浅灰背景
    brandColorDark: "#9CA3AF", // 深色模式灰
    brandBgColorDark: "#374151", // 深色模式背景
    icon: Globe,
  },
};

/**
 * 平台中文名称映射表
 */
const PLATFORM_NAMES: Record<Platform, string> = {
  WECHAT_OFFICIAL_ACCOUNT: "微信公众号",
  BILIBILI: "B站",
  XIAOHONGSHU: "小红书",
  BROWSER_CHROME: "Chrome",
  BROWSER_EDGE: "Edge",
  BROWSER_FIREFOX: "Firefox",
  BROWSER_SAFARI: "Safari",
  UNKNOWN: "其他",
};

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
  return PLATFORM_NAMES[platform as Platform] || "收藏";
}

/**
 * 检测 URL 所属平台（增强版）
 * 使用精确的域名匹配，支持所有微信域名变种
 * @param url 内容 URL
 * @returns 平台类型
 */
export function detectPlatformFromUrl(url: string): Platform {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();

    // 微信：支持所有子域名
    if (
      hostname === "mp.weixin.qq.com" ||
      hostname === "weixin.qq.com" ||
      hostname.endsWith(".weixin.qq.com")
    ) {
      return "WECHAT_OFFICIAL_ACCOUNT";
    }

    // B站：支持所有子域名和短链
    if (
      hostname === "bilibili.com" ||
      hostname.endsWith(".bilibili.com") ||
      hostname === "b23.tv"
    ) {
      return "BILIBILI";
    }

    // 小红书：支持所有子域名和短链
    if (
      hostname === "xiaohongshu.com" ||
      hostname.endsWith(".xiaohongshu.com") ||
      hostname === "xhslink.com"
    ) {
      return "XIAOHONGSHU";
    }

    return "UNKNOWN";
  } catch {
    // URL 解析失败，回退到字符串匹配
    const urlLower = url.toLowerCase();
    if (urlLower.includes("weixin.qq.com")) return "WECHAT_OFFICIAL_ACCOUNT";
    if (urlLower.includes("bilibili.com") || urlLower.includes("b23.tv"))
      return "BILIBILI";
    if (
      urlLower.includes("xiaohongshu.com") ||
      urlLower.includes("xhslink.com")
    )
      return "XIAOHONGSHU";
    return "UNKNOWN";
  }
}

/**
 * 获取所有平台配置（用于筛选器）
 */
export function getAllPlatformConfigs(): Array<{
  id: Platform;
  config: PlatformConfig;
}> {
  return Object.entries(PLATFORM_CONFIGS).map(([id, config]) => ({
    id: id as Platform,
    config,
  }));
}
