/**
 * 图片代理 API
 *
 * GET /api/image-proxy?url=<encoded-url>
 *
 * 解决微信图片防盗链问题：
 * - 服务端代理请求微信图片
 * - 设置正确的 Referer 和 User-Agent
 * - 支持缓存和重试机制
 */

import { type NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { appEnv } from "@/lib/env";
import { forbiddenError } from "@/lib/utils/api-response";

export const dynamic = "force-dynamic";

// =============================================================================
// 配置常量
// =============================================================================

/** 允许代理的图片域名（安全白名单） */
const ALLOWED_IMAGE_HOSTS = [
  "mmbiz.qpic.cn", // 微信公众号图片
  "mmbiz.qlogo.cn", // 微信头像
  "wx.qlogo.cn", // 微信头像
];

/** CORS 允许的来源域名 */
const ALLOWED_ORIGINS = (() => {
  const origins = new Set<string>();
  // 开发环境
  origins.add("http://localhost:3000");
  origins.add("http://localhost:3001");
  // 生产环境：从 NEXT_PUBLIC_APP_URL 获取
  const appUrl = appEnv.appUrl;
  if (appUrl && appUrl !== "http://localhost:3000") {
    origins.add(appUrl);
  }
  return origins;
})();

/**
 * 校验请求来源是否在 CORS 白名单内
 * 返回匹配的 origin 或 null
 */
function getAllowedOrigin(request: NextRequest): string | null {
  const origin = request.headers.get("origin");
  if (!origin) return null;
  return ALLOWED_ORIGINS.has(origin) ? origin : null;
}

/** 图片请求超时时间 (ms) */
const IMAGE_FETCH_TIMEOUT = 15000;

/** 最大重试次数 */
const MAX_RETRIES = 3;

/** 缓存时间 (秒) */
const CACHE_MAX_AGE = 86400; // 24 小时

/** Referer 列表（轮换使用） */
const REFERER_LIST = [
  "https://mp.weixin.qq.com/",
  "https://weixin.qq.com/",
  "https://wx.qq.com/",
];

/** User-Agent 列表（模拟浏览器） */
const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0",
];

// =============================================================================
// 辅助函数
// =============================================================================

/**
 * 验证图片 URL 是否在白名单内
 */
function isAllowedHost(url: string): boolean {
  try {
    const urlObj = new URL(url);
    return ALLOWED_IMAGE_HOSTS.some(
      (host) =>
        urlObj.hostname === host || urlObj.hostname.endsWith(`.${host}`),
    );
  } catch {
    return false;
  }
}

/**
 * 优化微信图片 URL，获取高清原图
 */
function optimizeWechatImageUrl(url: string): string {
  if (!url.includes("mmbiz.qpic.cn")) return url;

  try {
    const urlObj = new URL(url);

    // 移除压缩参数
    urlObj.searchParams.delete("tp");
    urlObj.searchParams.delete("wx_lazy");
    urlObj.searchParams.delete("wxfrom");

    // 添加原图参数
    urlObj.searchParams.set("wx_co", "1");

    // 保留格式参数
    if (!urlObj.searchParams.has("wx_fmt")) {
      urlObj.searchParams.set("wx_fmt", "jpeg");
    }

    return urlObj.toString();
  } catch {
    return url;
  }
}

/**
 * 验证图片数据有效性（检查 magic bytes）
 */
function isValidImageBuffer(buffer: ArrayBuffer): boolean {
  if (buffer.byteLength < 4) return false;

  const arr = new Uint8Array(buffer);

  // JPEG: FF D8 FF
  if (arr[0] === 0xff && arr[1] === 0xd8 && arr[2] === 0xff) return true;

  // PNG: 89 50 4E 47
  if (arr[0] === 0x89 && arr[1] === 0x50 && arr[2] === 0x4e && arr[3] === 0x47)
    return true;

  // GIF: 47 49 46 38
  if (arr[0] === 0x47 && arr[1] === 0x49 && arr[2] === 0x46 && arr[3] === 0x38)
    return true;

  // WebP: 52 49 46 46 ... 57 45 42 50
  if (arr[0] === 0x52 && arr[1] === 0x49 && arr[2] === 0x46 && arr[3] === 0x46)
    return true;

  return false;
}

/**
 * 获取 MIME 类型
 */
function getMimeType(buffer: ArrayBuffer): string {
  const arr = new Uint8Array(buffer);

  if (arr[0] === 0xff && arr[1] === 0xd8) return "image/jpeg";
  if (arr[0] === 0x89 && arr[1] === 0x50) return "image/png";
  if (arr[0] === 0x47 && arr[1] === 0x49) return "image/gif";
  if (arr[0] === 0x52 && arr[1] === 0x49) return "image/webp";

  return "image/jpeg";
}

// =============================================================================
// 主处理逻辑
// =============================================================================

/**
 * OPTIONS /api/image-proxy - CORS preflight
 */
export async function OPTIONS(request: NextRequest) {
  const allowedOrigin = getAllowedOrigin(request);
  if (!allowedOrigin) {
    return new NextResponse(null, { status: 403 });
  }
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": allowedOrigin,
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Max-Age": "86400",
      Vary: "Origin",
    },
  });
}

/**
 * GET /api/image-proxy
 *
 * Query params:
 * - url: 图片 URL（必须是白名单域名）
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const encodedUrl = searchParams.get("url");

  // 1. 参数验证
  if (!encodedUrl) {
    return NextResponse.json(
      { error: "Missing url parameter" },
      { status: 400 },
    );
  }

  let imageUrl: string;
  try {
    imageUrl = decodeURIComponent(encodedUrl);
  } catch {
    return NextResponse.json(
      { error: "Invalid url encoding" },
      { status: 400 },
    );
  }

  // 2. 域名白名单验证
  if (!isAllowedHost(imageUrl)) {
    return forbiddenError("Domain not allowed");
  }

  // 3. 优化 URL
  const optimizedUrl = optimizeWechatImageUrl(imageUrl);

  // 4. 尝试下载图片（带重试）
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const referer = REFERER_LIST[attempt % REFERER_LIST.length];
    const userAgent = USER_AGENTS[attempt % USER_AGENTS.length];

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        IMAGE_FETCH_TIMEOUT,
      );

      const response = await fetch(optimizedUrl, {
        signal: controller.signal,
        headers: {
          Referer: referer,
          "User-Agent": userAgent,
          Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
          "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
          "Cache-Control": "no-cache",
          // 微信可能检查的其他头
          Origin: "https://mp.weixin.qq.com",
          "Sec-Fetch-Dest": "image",
          "Sec-Fetch-Mode": "no-cors",
          "Sec-Fetch-Site": "cross-site",
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const buffer = await response.arrayBuffer();

      // 5. 验证图片数据
      if (!isValidImageBuffer(buffer)) {
        throw new Error("Invalid image data");
      }

      // 6. 返回图片
      const contentType = getMimeType(buffer);

      const responseHeaders: Record<string, string> = {
        "Content-Type": contentType,
        "Content-Length": buffer.byteLength.toString(),
        "Cache-Control": `public, max-age=${CACHE_MAX_AGE}, immutable`,
        "X-Content-Type-Options": "nosniff",
      };

      // CORS：仅允许白名单域名跨域访问
      const allowedOrigin = getAllowedOrigin(request);
      if (allowedOrigin) {
        responseHeaders["Access-Control-Allow-Origin"] = allowedOrigin;
        responseHeaders["Vary"] = "Origin";
      }

      return new NextResponse(buffer, {
        status: 200,
        headers: responseHeaders,
      });
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      logger.error(
        { error: lastError, attempt: attempt + 1, maxRetries: MAX_RETRIES },
        "[ImageProxy] Attempt failed",
      );

      // 等待后重试（指数退避）
      if (attempt < MAX_RETRIES - 1) {
        await new Promise((resolve) =>
          setTimeout(resolve, 300 * Math.pow(2, attempt)),
        );
      }
    }
  }

  // 7. 所有重试失败，返回错误
  logger.error(
    { imageUrl, error: lastError },
    "[ImageProxy] All attempts failed",
  );

  return NextResponse.json(
    {
      error: "Failed to fetch image",
      message: lastError?.message,
    },
    { status: 502 },
  );
}
