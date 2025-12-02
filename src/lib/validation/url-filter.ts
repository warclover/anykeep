/**
 * URL 失效检测过滤工具
 * 判断 URL 是否可以进行失效检测（智能过滤）
 */

import type { Platform } from "@/types/supabase";

/**
 * 判断 URL 是否可以进行失效检测
 * @param url - 要检测的 URL
 * @param platform - 平台类型（可选）
 * @returns true 可以检测，false 不可检测
 */
export function isUrlValidatable(
  url: string,
  platform?: Platform | null,
): boolean {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;

    // 1. 微信公众号文章（需要登录）
    if (
      hostname.includes("weixin.qq.com") ||
      hostname.includes("mp.weixin.qq.com")
    ) {
      return false;
    }

    // 2. 需要登录的平台
    const loginRequiredDomains = [
      "xiaohongshu.com", // 小红书详情页
      "twitter.com", // Twitter 需要登录
      "x.com", // X (Twitter)
      "facebook.com", // Facebook
      "instagram.com", // Instagram
      "linkedin.com", // LinkedIn
    ];

    if (loginRequiredDomains.some((domain) => hostname.includes(domain))) {
      return false;
    }

    // 3. 本地文件或特殊协议
    if (urlObj.protocol !== "http:" && urlObj.protocol !== "https:") {
      return false;
    }

    // 4. 内网地址
    if (
      hostname === "localhost" ||
      hostname.startsWith("192.168.") ||
      hostname.startsWith("10.") ||
      hostname.startsWith("172.")
    ) {
      return false;
    }

    // 5. 平台特定判断
    if (platform === "WECHAT_OFFICIAL_ACCOUNT") {
      return false; // 所有微信公众号内容都跳过
    }

    return true;
  } catch {
    // URL 解析失败，无法检测
    return false;
  }
}

/**
 * 批量过滤可检测的收藏
 * @param bookmarks - 收藏列表
 * @returns 可检测的收藏列表
 */
export function filterValidatableBookmarks<
  T extends { url: string; platform?: Platform | null },
>(bookmarks: T[]): T[] {
  return bookmarks.filter((b) => isUrlValidatable(b.url, b.platform));
}

/**
 * 获取跳过检测的原因
 * @param url - URL
 * @param platform - 平台类型
 * @returns 跳过原因
 */
export function getSkipReason(url: string, platform?: Platform | null): string {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;

    if (
      hostname.includes("weixin.qq.com") ||
      hostname.includes("mp.weixin.qq.com")
    ) {
      return "微信公众号";
    }

    if (hostname.includes("xiaohongshu.com")) return "小红书";
    if (hostname.includes("twitter.com") || hostname.includes("x.com"))
      return "Twitter/X";
    if (hostname.includes("facebook.com")) return "Facebook";
    if (hostname.includes("instagram.com")) return "Instagram";
    if (hostname.includes("linkedin.com")) return "LinkedIn";

    if (urlObj.protocol !== "http:" && urlObj.protocol !== "https:") {
      return "非HTTP协议";
    }

    if (
      hostname === "localhost" ||
      hostname.startsWith("192.168.") ||
      hostname.startsWith("10.") ||
      hostname.startsWith("172.")
    ) {
      return "内网地址";
    }

    if (platform === "WECHAT_OFFICIAL_ACCOUNT") {
      return "微信公众号平台";
    }

    return "未知原因";
  } catch {
    return "URL解析失败";
  }
}
