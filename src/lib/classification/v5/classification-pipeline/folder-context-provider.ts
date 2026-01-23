/**
 * 智能分类 v6.0 - 文件夹上下文提供器
 *
 * 为 T1 LLM 调用提供文件夹的示例书签和关键词
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { LoggerService } from "../shared/logger";

export interface FolderContext {
  folderId: string;
  folderName: string;
  description?: string;
  sampleBookmarks: string[];
  keywordTags: string[];
}

export class FolderContextProvider {
  private logger: LoggerService;
  private supabase: SupabaseClient;
  private cache: Map<string, FolderContext> = new Map();

  constructor(logger: LoggerService, supabase: SupabaseClient) {
    this.logger = logger.child({ service: "FolderContextProvider" });
    this.supabase = supabase;
  }

  /**
   * 获取文件夹上下文（包含示例书签）
   */
  async getFolderContext(
    userId: string,
    folderId: string,
    folderName: string,
  ): Promise<FolderContext> {
    // 检查缓存
    const cacheKey = `${userId}:${folderId}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    try {
      // 查询该文件夹最近的 5 条书签标题
      const { data: bookmarks, error } = await this.supabase
        .from("bookmarks")
        .select("title")
        .eq("user_id", userId)
        .eq("folder_id", folderId)
        .order("created_at", { ascending: false })
        .limit(5);

      if (error) {
        this.logger.warn("查询文件夹书签失败", {
          error: error.message,
          folderId,
        });
      }

      const sampleBookmarks = (bookmarks || [])
        .map((b: { title: string }) => b.title)
        .filter((title: string) => title && title.length > 0);

      // 提取关键词（从文件夹名称分词）
      const keywordTags = this.extractKeywords(folderName);

      const context: FolderContext = {
        folderId,
        folderName,
        sampleBookmarks,
        keywordTags,
      };

      // 缓存结果
      this.cache.set(cacheKey, context);

      return context;
    } catch (error) {
      this.logger.error(
        "获取文件夹上下文失败",
        error instanceof Error ? error : undefined,
        { folderId },
      );

      return {
        folderId,
        folderName,
        sampleBookmarks: [],
        keywordTags: this.extractKeywords(folderName),
      };
    }
  }

  /**
   * 批量获取多个文件夹的上下文
   */
  async getFolderContextBatch(
    userId: string,
    folders: Array<{ folderId: string; folderName: string }>,
  ): Promise<FolderContext[]> {
    return Promise.all(
      folders.map((f) =>
        this.getFolderContext(userId, f.folderId, f.folderName),
      ),
    );
  }

  /**
   * 从文件夹名称提取关键词
   */
  private extractKeywords(folderName: string): string[] {
    // 按常见分隔符分词
    const words = folderName
      .toLowerCase()
      .split(/[+\s_\-/&]+/)
      .filter((w) => w.length > 1);

    // 去重
    return [...new Set(words)];
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.cache.clear();
  }
}
