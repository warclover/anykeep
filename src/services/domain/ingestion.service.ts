/**
 * Ingestion Service
 *
 * 统一摄入服务，所有数据源（网页、API、浏览器导入、移动端）统一走此服务
 *
 * Pipeline 流程:
 * 1. Normalize   - URL 标准化
 * 2. Deduplicate - 重复检测
 * 3. Persist     - 写入数据库 (status=PENDING)
 * 4. Enqueue     - 推送异步任务队列 (Phase 2)
 *
 * @module services/domain
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { BaseService } from "../core/base.service";
import { BookmarkRepository } from "@/repositories";
import type {
  IngestionRequestInput,
  IngestionSource,
} from "@/contracts/schemas/ingestion.schema";

/**
 * 单条摄入结果
 */
export interface IngestionResult {
  bookmarkId: number;
  url: string;
  status: "created" | "duplicate" | "queued";
  message: string;
}

/**
 * 批量摄入结果
 */
export interface BatchIngestionResult {
  total: number;
  created: number;
  duplicates: number;
  queued: number;
  errors: Array<{ url: string; error: string }>;
  results: IngestionResult[];
}

/**
 * URL 标准化选项
 */
interface NormalizeOptions {
  removeTracking?: boolean;
  removeFragment?: boolean;
  lowercaseHostname?: boolean;
}

/**
 * 统一摄入服务
 */
export class IngestionService extends BaseService {
  private readonly bookmarkRepository: BookmarkRepository;

  // URL 追踪参数列表
  private static readonly TRACKING_PARAMS = new Set([
    // Google Analytics
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_term",
    "utm_content",
    // Facebook
    "fbclid",
    // Google Ads
    "gclid",
    "gclsrc",
    // Other
    "ref",
    "source",
    "ref_src",
    "ref_url",
    // WeChat
    "from",
    "isappinstalled",
    // Common
    "share_source",
    "share_medium",
  ]);

  // 平台检测映射
  private static readonly PLATFORM_MAP: Record<string, string> = {
    "mp.weixin.qq.com": "wechat",
    "weixin.qq.com": "wechat",
    "bilibili.com": "bilibili",
    "www.bilibili.com": "bilibili",
    "b23.tv": "bilibili",
    "xiaohongshu.com": "xiaohongshu",
    "www.xiaohongshu.com": "xiaohongshu",
    "xhslink.com": "xiaohongshu",
    "zhihu.com": "zhihu",
    "www.zhihu.com": "zhihu",
    "zhuanlan.zhihu.com": "zhihu",
    "juejin.cn": "juejin",
    "github.com": "github",
    "gist.github.com": "github",
    "twitter.com": "twitter",
    "x.com": "twitter",
    "youtube.com": "youtube",
    "www.youtube.com": "youtube",
    "youtu.be": "youtube",
    "medium.com": "medium",
    "dev.to": "devto",
    "linkedin.com": "linkedin",
    "www.linkedin.com": "linkedin",
  };

  constructor(supabase: SupabaseClient<Database>, userId: string) {
    super(supabase, userId, "IngestionService");
    this.bookmarkRepository = new BookmarkRepository(supabase, userId);
  }

  /**
   * 单条摄入
   */
  async ingest(request: IngestionRequestInput): Promise<IngestionResult> {
    return this.withLogging(
      "ingest",
      async () => {
        // Step 1: Normalize URL
        const normalizedUrl = this.normalizeUrl(request.url);

        // Step 2: Check duplicate
        const existing = await this.bookmarkRepository.findByUrl(normalizedUrl);
        if (existing) {
          return {
            bookmarkId: existing.id,
            url: normalizedUrl,
            status: "duplicate" as const,
            message: "Bookmark already exists",
          };
        }

        // Step 3: Detect platform
        const platform = this.detectPlatform(normalizedUrl);

        // Step 4: Create bookmark with PENDING status
        const bookmark = await this.bookmarkRepository.create({
          url: normalizedUrl,
          title: request.title || this.extractDomainTitle(normalizedUrl),
          description: request.description,
          folder_id: request.folderId,
          user_tags: request.tags,
          notes: request.notes,
          platform,
          user_id: this.userId,
          is_starred: false,
          // 标记来源（需要在 Phase 2 的数据库迁移中添加 source 字段）
          // source: request.source,
          // status: "PENDING", // 等待 AI 处理
        });

        // Step 5: TODO (Phase 2) - Enqueue async tasks
        // await this.enqueueProcessingTasks(bookmark.id, request.source);

        return {
          bookmarkId: bookmark.id,
          url: normalizedUrl,
          status: "created" as const,
          message: "Bookmark created successfully",
        };
      },
      { url: request.url, source: request.source },
    );
  }

  /**
   * 批量摄入
   */
  async batchIngest(
    requests: IngestionRequestInput[],
    options: {
      batchSize?: number;
      skipDuplicates?: boolean;
    } = {},
  ): Promise<BatchIngestionResult> {
    const { batchSize = 100, skipDuplicates = true } = options;

    return this.withLogging(
      "batchIngest",
      async () => {
        const result: BatchIngestionResult = {
          total: requests.length,
          created: 0,
          duplicates: 0,
          queued: 0,
          errors: [],
          results: [],
        };

        // 批量预检查 URL 重复
        const allUrls = requests.map((r) => this.normalizeUrl(r.url));
        const existingUrls =
          await this.bookmarkRepository.checkUrlsExist(allUrls);

        // 分批处理
        for (let i = 0; i < requests.length; i += batchSize) {
          const batch = requests.slice(i, i + batchSize);

          for (const request of batch) {
            try {
              const normalizedUrl = this.normalizeUrl(request.url);

              // 快速跳过已存在的
              if (existingUrls.has(normalizedUrl)) {
                if (skipDuplicates) {
                  result.duplicates++;
                  result.results.push({
                    bookmarkId: 0, // 未知 ID
                    url: normalizedUrl,
                    status: "duplicate",
                    message: "Skipped: already exists",
                  });
                  continue;
                }
              }

              // 正常摄入
              const ingested = await this.ingest(request);
              result.results.push(ingested);

              if (ingested.status === "created") {
                result.created++;
              } else if (ingested.status === "queued") {
                result.queued++;
              } else if (ingested.status === "duplicate") {
                result.duplicates++;
              }
            } catch (error) {
              const errorMessage =
                error instanceof Error ? error.message : "Unknown error";
              result.errors.push({
                url: request.url,
                error: errorMessage,
              });
            }
          }
        }

        return result;
      },
      { count: requests.length, batchSize },
    );
  }

  /**
   * 从浏览器书签导入
   *
   * 专门处理浏览器书签导入的场景
   */
  async importFromBrowser(
    bookmarks: Array<{
      url: string;
      title?: string;
      dateAdded?: number;
      folderId?: number;
    }>,
    options?: {
      batchSize?: number;
      skipDuplicates?: boolean;
    },
  ): Promise<BatchIngestionResult> {
    const requests: IngestionRequestInput[] = bookmarks.map((b) => ({
      url: b.url,
      title: b.title,
      folderId: b.folderId,
      source: "browser" as IngestionSource,
      metadata: b.dateAdded ? { originalDateAdded: b.dateAdded } : undefined,
    }));

    return this.batchIngest(requests, {
      ...options,
      batchSize: options?.batchSize ?? 50, // 浏览器导入默认较小批次
    });
  }

  /**
   * URL 标准化
   */
  normalizeUrl(url: string, options: NormalizeOptions = {}): string {
    const {
      removeTracking = true,
      removeFragment = true,
      lowercaseHostname = true,
    } = options;

    try {
      const parsed = new URL(url);

      // 移除追踪参数
      if (removeTracking) {
        for (const param of IngestionService.TRACKING_PARAMS) {
          parsed.searchParams.delete(param);
        }
      }

      // 移除 fragment
      if (removeFragment) {
        parsed.hash = "";
      }

      // 小写 hostname
      if (lowercaseHostname) {
        parsed.hostname = parsed.hostname.toLowerCase();
      }

      // 标准化协议
      parsed.protocol = parsed.protocol.toLowerCase();

      // 构建标准化 URL
      let normalized = parsed.toString();

      // 移除尾部斜杠（仅当路径为根路径时）
      if (parsed.pathname === "/" && !parsed.search) {
        normalized = normalized.replace(/\/$/, "");
      }

      return normalized;
    } catch {
      // 如果 URL 无效，返回原始值
      return url;
    }
  }

  /**
   * 检测平台
   */
  detectPlatform(url: string): string {
    try {
      const hostname = new URL(url).hostname.toLowerCase();

      // 精确匹配
      if (IngestionService.PLATFORM_MAP[hostname]) {
        return IngestionService.PLATFORM_MAP[hostname];
      }

      // 前缀匹配
      for (const [domain, platform] of Object.entries(
        IngestionService.PLATFORM_MAP,
      )) {
        if (hostname.endsWith(domain) || hostname.includes(domain)) {
          return platform;
        }
      }

      return "web";
    } catch {
      return "web";
    }
  }

  /**
   * 从 URL 提取域名作为标题
   */
  private extractDomainTitle(url: string): string {
    try {
      const { hostname, pathname } = new URL(url);

      // 清理主机名
      const cleanHostname = hostname.replace(/^www\./, "");

      // 如果有路径，尝试提取有意义的部分
      if (pathname && pathname !== "/") {
        const pathParts = pathname.split("/").filter(Boolean);
        if (pathParts.length > 0) {
          // 取最后一个有意义的路径段
          const lastPart = pathParts[pathParts.length - 1];
          // 清理文件扩展名
          const cleanPart = lastPart.replace(/\.[^.]+$/, "");
          // 如果不是纯数字或太短，使用它
          if (cleanPart && !/^\d+$/.test(cleanPart) && cleanPart.length > 2) {
            return `${cleanHostname} - ${decodeURIComponent(cleanPart)}`;
          }
        }
      }

      return cleanHostname;
    } catch {
      return url;
    }
  }

  /**
   * 验证 URL 是否有效
   */
  isValidUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      return ["http:", "https:"].includes(parsed.protocol);
    } catch {
      return false;
    }
  }

  /**
   * 预处理 URL 列表（去重、验证）
   */
  preprocessUrls(urls: string[]): {
    valid: string[];
    invalid: string[];
    duplicates: string[];
  } {
    const seen = new Set<string>();
    const valid: string[] = [];
    const invalid: string[] = [];
    const duplicates: string[] = [];

    for (const url of urls) {
      if (!this.isValidUrl(url)) {
        invalid.push(url);
        continue;
      }

      const normalized = this.normalizeUrl(url);

      if (seen.has(normalized)) {
        duplicates.push(url);
        continue;
      }

      seen.add(normalized);
      valid.push(normalized);
    }

    return { valid, invalid, duplicates };
  }
}
