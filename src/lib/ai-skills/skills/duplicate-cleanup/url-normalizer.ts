/**
 * URL 规范化工具
 *
 * 用于将 URL 规范化以便进行重复检测
 *
 * @version 1.0.0
 * @since 2025-12-24
 */

import { URL_NORMALIZE_CONFIG } from "./types";
import { logger } from "@/lib/logger";

/**
 * URL 规范化结果
 */
export interface NormalizedUrlResult {
  /** 原始 URL */
  original: string;
  /** 规范化后的 URL */
  normalized: string;
  /** 是否成功 */
  success: boolean;
  /** 移除的参数 */
  removedParams: string[];
  /** 错误信息 */
  error?: string;
}

/**
 * URL 规范化选项
 */
export interface NormalizeOptions {
  /** 是否移除 www */
  removeWww?: boolean;
  /** 是否移除尾部斜杠 */
  removeTrailingSlash?: boolean;
  /** 是否移除 hash */
  removeHash?: boolean;
  /** 是否移除追踪参数 */
  removeTrackingParams?: boolean;
  /** 是否转小写 */
  toLowerCase?: boolean;
  /** 自定义移除的参数 */
  customParamsToRemove?: string[];
}

const DEFAULT_OPTIONS: NormalizeOptions = {
  removeWww: true,
  removeTrailingSlash: true,
  removeHash: true,
  removeTrackingParams: true,
  toLowerCase: true,
};

/**
 * URL 规范化器类
 */
export class UrlNormalizer {
  private options: NormalizeOptions;

  constructor(options: NormalizeOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * 规范化单个 URL
   */
  normalize(url: string): NormalizedUrlResult {
    const removedParams: string[] = [];

    try {
      // 尝试解析 URL
      let parsed: URL;
      try {
        parsed = new URL(url);
      } catch {
        // 尝试添加协议
        if (!url.startsWith("http://") && !url.startsWith("https://")) {
          parsed = new URL("https://" + url);
        } else {
          throw new Error("Invalid URL format");
        }
      }

      // 验证协议
      if (!["http:", "https:"].includes(parsed.protocol)) {
        return {
          original: url,
          normalized: url.toLowerCase(),
          success: false,
          removedParams: [],
          error: `Unsupported protocol: ${parsed.protocol}`,
        };
      }

      // 移除追踪参数
      if (this.options.removeTrackingParams) {
        const paramsToRemove = [
          ...URL_NORMALIZE_CONFIG.TRACKING_PARAMS,
          ...(this.options.customParamsToRemove || []),
        ];

        for (const param of paramsToRemove) {
          if (parsed.searchParams.has(param)) {
            removedParams.push(param);
            parsed.searchParams.delete(param);
          }
        }
      }

      // 构建规范化 URL
      let host = parsed.host;
      let pathname = parsed.pathname;
      const search = parsed.searchParams.toString();
      let hash = parsed.hash;

      // 移除 www
      if (this.options.removeWww) {
        host = host.replace(/^www\./, "");
      }

      // 移除尾部斜杠
      if (this.options.removeTrailingSlash) {
        pathname = pathname.replace(/\/$/, "");
        // 根路径处理 - 移除单独的 "/"
        if (pathname === "") {
          pathname = "";
        }
      }

      // 移除 hash
      if (this.options.removeHash) {
        // 检查是否匹配移除模式
        const shouldRemoveHash =
          !hash ||
          URL_NORMALIZE_CONFIG.REMOVE_HASH_PATTERNS.some((pattern) =>
            pattern.test(hash),
          );
        if (shouldRemoveHash) {
          hash = "";
        }
      }

      // 转小写
      if (this.options.toLowerCase) {
        host = host.toLowerCase();
        // pathname 保持原样（可能是大小写敏感的）
      }

      // 构建最终 URL
      let normalized = host + pathname;
      if (search) {
        // 对参数排序以确保一致性
        const sortedParams = new URLSearchParams(
          [...parsed.searchParams.entries()].sort((a, b) =>
            a[0].localeCompare(b[0]),
          ),
        );
        normalized += "?" + sortedParams.toString();
      }
      if (hash && !this.options.removeHash) {
        normalized += hash;
      }

      return {
        original: url,
        normalized,
        success: true,
        removedParams,
      };
    } catch (error) {
      logger.debug(
        {
          url,
          error: error instanceof Error ? error.message : String(error),
        },
        "UrlNormalizer: Failed to normalize URL",
      );

      return {
        original: url,
        normalized: url.toLowerCase(),
        success: false,
        removedParams: [],
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * 批量规范化 URL
   */
  normalizeMany(urls: string[]): NormalizedUrlResult[] {
    return urls.map((url) => this.normalize(url));
  }

  /**
   * 比较两个 URL 是否相同（规范化后）
   */
  areEqual(url1: string, url2: string): boolean {
    const norm1 = this.normalize(url1);
    const norm2 = this.normalize(url2);
    return norm1.normalized === norm2.normalized;
  }

  /**
   * 提取 URL 的核心部分（用于快速比较）
   */
  extractCore(url: string): string {
    const result = this.normalize(url);
    return result.normalized;
  }
}

/**
 * 默认 URL 规范化器实例
 */
export const urlNormalizer = new UrlNormalizer();

/**
 * 快捷函数：规范化 URL
 */
export function normalizeUrl(url: string): string {
  return urlNormalizer.normalize(url).normalized;
}

/**
 * 快捷函数：比较两个 URL
 */
export function compareUrls(url1: string, url2: string): boolean {
  return urlNormalizer.areEqual(url1, url2);
}
