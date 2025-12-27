/**
 * 页面内容抓取服务
 *
 * 负责抓取网页内容并提取可读文本
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

import { createHash } from "crypto";
import type { PageFetchResult } from "./types";
import { MONITOR_PROTECTION } from "./constants";

/**
 * 计算内容的 SHA-256 哈希值
 *
 * 使用 Node.js crypto 模块，兼容 Jest 测试环境
 */
export function hashContent(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

/**
 * 统计文本字数（中英文混合）
 */
export function countWords(text: string): number {
  // 移除多余空白
  const cleaned = text.trim();
  if (!cleaned) return 0;

  // 中文字符计数
  const chineseChars = cleaned.match(/[\u4e00-\u9fff]/g) || [];

  // 英文单词计数
  const englishWords =
    cleaned
      .replace(/[\u4e00-\u9fff]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length > 0) || [];

  return chineseChars.length + englishWords.length;
}

/**
 * 从 HTML 中提取可读文本
 */
export function extractReadableText(html: string): string {
  // 移除 script 和 style 标签
  let text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");

  // 移除 HTML 标签
  text = text.replace(/<[^>]+>/g, " ");

  // 解码 HTML 实体
  text = text
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  // 清理空白字符
  text = text.replace(/\s+/g, " ").trim();

  return text;
}

/**
 * 抓取页面内容
 *
 * @param url - 页面 URL
 * @param timeoutMs - 超时时间（毫秒）
 * @returns 抓取结果
 */
export async function fetchPageContent(
  url: string,
  timeoutMs: number = MONITOR_PROTECTION.CHECK_TIMEOUT_MS,
): Promise<PageFetchResult> {
  const startTime = performance.now();

  try {
    // 创建 AbortController 用于超时控制
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; AnyKeep/1.0; +https://anykeep.app)",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
      },
    });

    clearTimeout(timeoutId);

    const responseTimeMs = Math.round(performance.now() - startTime);

    // 检查响应状态
    if (!response.ok) {
      return {
        success: false,
        content: null,
        contentHash: null,
        wordCount: null,
        errorMessage: `HTTP ${response.status}: ${response.statusText}`,
        responseTimeMs,
      };
    }

    // 获取响应内容
    const html = await response.text();

    // 提取可读文本
    const readableText = extractReadableText(html);

    // 计算哈希和字数
    const contentHash = await hashContent(readableText);
    const wordCount = countWords(readableText);

    return {
      success: true,
      content: readableText,
      contentHash,
      wordCount,
      errorMessage: null,
      responseTimeMs,
    };
  } catch (error) {
    const responseTimeMs = Math.round(performance.now() - startTime);

    if (error instanceof Error && error.name === "AbortError") {
      return {
        success: false,
        content: null,
        contentHash: null,
        wordCount: null,
        errorMessage: "请求超时",
        responseTimeMs,
      };
    }

    return {
      success: false,
      content: null,
      contentHash: null,
      wordCount: null,
      errorMessage: error instanceof Error ? error.message : "网络错误",
      responseTimeMs,
    };
  }
}

/**
 * 检查 URL 是否可以被监控
 *
 * @param url - 要检查的 URL
 * @returns 是否可监控
 */
export function isUrlMonitorable(url: string): {
  canMonitor: boolean;
  reason?: string;
} {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;

    // 1. 非 HTTP(S) 协议
    if (urlObj.protocol !== "http:" && urlObj.protocol !== "https:") {
      return {
        canMonitor: false,
        reason: `不支持的协议: ${urlObj.protocol}`,
      };
    }

    // 2. 本地/内网 IP
    if (
      hostname === "localhost" ||
      hostname.startsWith("192.168.") ||
      hostname.startsWith("10.") ||
      hostname.startsWith("172.16.") ||
      hostname.startsWith("172.17.") ||
      hostname.startsWith("172.18.") ||
      hostname.startsWith("172.19.") ||
      hostname.startsWith("172.2") ||
      hostname.startsWith("172.30.") ||
      hostname.startsWith("172.31.") ||
      hostname.startsWith("127.")
    ) {
      return {
        canMonitor: false,
        reason: "本地或内网地址无法监控",
      };
    }

    // 3. 需要登录的平台
    const loginRequiredDomains = [
      { domain: "weixin.qq.com", name: "微信公众号" },
      { domain: "mp.weixin.qq.com", name: "微信公众号" },
      { domain: "xiaohongshu.com", name: "小红书" },
      { domain: "xhs.com", name: "小红书" },
      { domain: "twitter.com", name: "Twitter/X" },
      { domain: "x.com", name: "Twitter/X" },
      { domain: "facebook.com", name: "Facebook" },
      { domain: "instagram.com", name: "Instagram" },
      { domain: "linkedin.com", name: "LinkedIn" },
    ];

    for (const { domain, name } of loginRequiredDomains) {
      if (hostname.includes(domain)) {
        return {
          canMonitor: false,
          reason: `${name} 链接需要登录，暂不支持监控`,
        };
      }
    }

    return { canMonitor: true };
  } catch {
    return {
      canMonitor: false,
      reason: "URL 格式错误",
    };
  }
}
