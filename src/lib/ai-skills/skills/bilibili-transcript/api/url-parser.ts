/**
 * B站 URL 解析器
 *
 * 支持格式：
 * - https://www.bilibili.com/video/BV1xx411c7XW
 * - https://www.bilibili.com/video/BV1xx411c7XW?p=1
 * - https://b23.tv/xxxxx (短链)
 * - bilibili://video/BV1xx411c7XW (App 分享)
 *
 * @version 1.0.0
 */

export interface ParsedBilibiliUrl {
  bvid: string;
  page: number;
  isShortLink: boolean;
}

/**
 * 从 URL 中提取 BV 号
 */
export function parseBilibiliUrl(url: string): ParsedBilibiliUrl | null {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();

    // 检查是否为 B站域名
    if (!hostname.includes("bilibili.com") && !hostname.includes("b23.tv")) {
      return null;
    }

    // 短链需要先解析
    if (hostname.includes("b23.tv")) {
      return {
        bvid: "",
        page: 1,
        isShortLink: true,
      };
    }

    // 提取 BV 号
    const pathMatch = urlObj.pathname.match(/\/video\/(BV[a-zA-Z0-9]+)/);
    if (pathMatch) {
      const page = parseInt(urlObj.searchParams.get("p") || "1", 10);
      return {
        bvid: pathMatch[1],
        page: isNaN(page) ? 1 : page,
        isShortLink: false,
      };
    }

    // 兼容 av 号格式（返回 null，需要额外处理）
    const avMatch = urlObj.pathname.match(/\/video\/av(\d+)/);
    if (avMatch) {
      // av 号需要调用 API 转换，这里先返回 null
      return null;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * 解析短链获取真实 URL
 */
export async function resolveShortLink(
  shortUrl: string,
): Promise<string | null> {
  try {
    // 使用 fetch 获取重定向地址
    const response = await fetch(shortUrl, {
      method: "GET",
      redirect: "manual",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    // 检查重定向
    const location = response.headers.get("location");
    if (location) {
      return location;
    }

    // 某些情况下可能是 302 重定向
    if (response.status >= 300 && response.status < 400) {
      return response.headers.get("location");
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * 验证 BV 号格式
 * BV 号格式：BV + 10位 Base58 字符
 */
export function isValidBvid(bvid: string): boolean {
  return /^BV[a-zA-Z0-9]{10}$/.test(bvid);
}

/**
 * 格式化时间戳为 SRT 时间格式
 * @param seconds 秒数
 * @returns 格式化的时间字符串 (HH:MM:SS,mmm)
 */
export function formatSrtTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 1000);

  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")},${ms.toString().padStart(3, "0")}`;
}

/**
 * 格式化时间为 MM:SS 格式
 * @param seconds 秒数
 * @returns 格式化的时间字符串
 */
export function formatMinuteTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  if (mins >= 60) {
    const hours = Math.floor(mins / 60);
    const remainMins = mins % 60;
    return `${hours}:${remainMins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

/**
 * 从分享文本中提取 B站 URL
 * @param text 分享文本
 * @returns 提取的 URL 或 null
 */
export function extractBilibiliUrl(text: string): string | null {
  // 匹配 bilibili.com 链接
  const biliMatch = text.match(
    /https?:\/\/(?:www\.)?bilibili\.com\/video\/[^\s\u4e00-\u9fa5]+/,
  );
  if (biliMatch) {
    return biliMatch[0].replace(/[)}\]>"']+$/, "");
  }

  // 匹配 b23.tv 短链
  const shortMatch = text.match(/https?:\/\/b23\.tv\/[a-zA-Z0-9]+/);
  if (shortMatch) {
    return shortMatch[0];
  }

  return null;
}
