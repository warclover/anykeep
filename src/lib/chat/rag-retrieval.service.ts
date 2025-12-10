/**
 * RAG 检索服务
 * Phase 4.1: 基于向量相似度检索相关书签内容作为 AI 对话上下文
 *
 * @version 1.0.0
 * @since 2025-12-09
 */

import { createClient } from "@/lib/supabase/server";
import { generateEmbedding } from "@/lib/utils/embedding-generator";
import { logger } from "@/lib/logger";
import { v42Rpc } from "@/lib/supabase/v42-types";

/**
 * 检索到的书签上下文
 */
export interface RetrievedBookmark {
  id: number;
  title: string;
  url: string;
  summary: string | null;
  description: string | null;
  tags: string[] | null;
  folderName: string | null;
  platform: string | null;
  similarity: number;
  createdAt: string;
}

/**
 * RAG 检索结果
 */
export interface RAGRetrievalResult {
  /** 检索到的书签列表 */
  bookmarks: RetrievedBookmark[];
  /** 生成的上下文文本 */
  context: string;
  /** 检索元数据 */
  metadata: {
    query: string;
    totalFound: number;
    avgSimilarity: number;
    retrievalTimeMs: number;
  };
}

/**
 * RAG 检索选项
 */
export interface RAGRetrievalOptions {
  /** 检索数量限制 */
  limit?: number;
  /** 最小相似度阈值 */
  minSimilarity?: number;
  /** 限制到特定文件夹 */
  folderId?: number;
  /** 限制到特定书签 ID 列表 */
  bookmarkIds?: number[];
  /** 是否包含书签描述 */
  includeDescription?: boolean;
}

const DEFAULT_OPTIONS: Required<
  Omit<RAGRetrievalOptions, "folderId" | "bookmarkIds">
> = {
  limit: 5,
  minSimilarity: 0.5,
  includeDescription: true,
};

/**
 * RAG 检索服务类
 */
export class RAGRetrievalService {
  /**
   * 基于用户查询检索相关书签
   *
   * @param userId - 用户 ID
   * @param query - 用户查询文本
   * @param options - 检索选项
   * @returns 检索结果，包含相关书签和生成的上下文
   */
  async retrieve(
    userId: string,
    query: string,
    options: RAGRetrievalOptions = {},
  ): Promise<RAGRetrievalResult> {
    const startTime = Date.now();
    const opts = { ...DEFAULT_OPTIONS, ...options };

    try {
      // 1. 为用户查询生成向量
      logger.debug(
        { query, userId: userId.slice(0, 8) + "..." },
        "RAG: Generating query embedding",
      );

      const queryEmbedding = await generateEmbedding(query);

      // 2. 在数据库中搜索相似书签
      const supabase = await createClient();

      // 构建查询
      const rpcParams: Record<string, unknown> = {
        query_embedding: queryEmbedding,
        match_threshold: opts.minSimilarity,
        match_count: opts.limit,
        p_user_id: userId,
      };

      // 添加可选的文件夹过滤
      if (opts.folderId) {
        rpcParams.p_folder_id = opts.folderId;
      }

      // 调用 RPC 函数进行向量搜索 (V4.2 RPC)
      const { data: searchResults, error: searchError } = await v42Rpc(
        supabase,
      ).rpc("search_bookmarks_by_embedding", rpcParams);

      if (searchError) {
        logger.error({ error: searchError }, "RAG: Vector search failed");
        throw new Error("向量搜索失败");
      }

      // 3. 如果指定了书签 ID 列表，进行过滤
      let filteredResults = searchResults || [];
      if (opts.bookmarkIds && opts.bookmarkIds.length > 0) {
        filteredResults = filteredResults.filter((r: { id: number }) =>
          opts.bookmarkIds!.includes(r.id),
        );
      }

      // 4. 格式化检索结果
      const bookmarks: RetrievedBookmark[] = filteredResults.map(
        (item: {
          id: number;
          title: string;
          url: string;
          ai_summary: string | null;
          description: string | null;
          ai_tags: string[] | null;
          folder_name: string | null;
          platform: string | null;
          similarity: number;
          created_at: string;
        }) => ({
          id: item.id,
          title: item.title,
          url: item.url,
          summary: item.ai_summary,
          description: item.description,
          tags: item.ai_tags,
          folderName: item.folder_name,
          platform: item.platform,
          similarity: item.similarity,
          createdAt: item.created_at,
        }),
      );

      // 5. 生成上下文文本
      const context = this.buildContext(bookmarks, opts.includeDescription);

      // 6. 计算元数据
      const avgSimilarity =
        bookmarks.length > 0
          ? bookmarks.reduce((sum, b) => sum + b.similarity, 0) /
            bookmarks.length
          : 0;

      const retrievalTimeMs = Date.now() - startTime;

      logger.info(
        {
          userId: userId.slice(0, 8) + "...",
          query: query.slice(0, 50) + "...",
          found: bookmarks.length,
          avgSimilarity: avgSimilarity.toFixed(3),
          timeMs: retrievalTimeMs,
        },
        "RAG: Retrieval completed",
      );

      return {
        bookmarks,
        context,
        metadata: {
          query,
          totalFound: bookmarks.length,
          avgSimilarity,
          retrievalTimeMs,
        },
      };
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        "RAG: Retrieval failed",
      );
      throw error;
    }
  }

  /**
   * 从检索到的书签构建上下文文本
   *
   * @param bookmarks - 检索到的书签列表
   * @param includeDescription - 是否包含描述
   * @returns 格式化的上下文文本
   */
  private buildContext(
    bookmarks: RetrievedBookmark[],
    includeDescription: boolean,
  ): string {
    if (bookmarks.length === 0) {
      return "";
    }

    const contextParts: string[] = ["以下是用户收藏中与问题相关的内容：\n"];

    bookmarks.forEach((bookmark, index) => {
      const parts: string[] = [];

      // 标题和来源
      parts.push(`【${index + 1}】${bookmark.title}`);
      if (bookmark.folderName) {
        parts.push(`   文件夹：${bookmark.folderName}`);
      }
      if (bookmark.platform) {
        parts.push(`   来源：${bookmark.platform}`);
      }

      // 摘要（优先）或描述
      if (bookmark.summary) {
        parts.push(`   摘要：${bookmark.summary}`);
      } else if (includeDescription && bookmark.description) {
        parts.push(`   描述：${bookmark.description}`);
      }

      // 标签
      if (bookmark.tags && bookmark.tags.length > 0) {
        parts.push(`   标签：${bookmark.tags.join("、")}`);
      }

      // URL（作为引用来源）
      parts.push(`   链接：${bookmark.url}`);

      contextParts.push(parts.join("\n"));
      contextParts.push(""); // 空行分隔
    });

    return contextParts.join("\n").trim();
  }

  /**
   * 检索单个书签的详细信息作为上下文
   *
   * @param userId - 用户 ID
   * @param bookmarkId - 书签 ID
   * @returns 书签上下文
   */
  async retrieveBookmarkContext(
    userId: string,
    bookmarkId: number,
  ): Promise<RetrievedBookmark | null> {
    try {
      const supabase = await createClient();

      const { data, error } = await supabase
        .from("bookmarks")
        .select(
          `
          id,
          title,
          url,
          ai_summary,
          description,
          ai_tags,
          platform,
          created_at,
          folders!inner (
            name
          )
        `,
        )
        .eq("id", bookmarkId)
        .eq("user_id", userId)
        .single();

      if (error || !data) {
        return null;
      }

      return {
        id: data.id,
        title: data.title,
        url: data.url,
        summary: data.ai_summary,
        description: data.description,
        tags: data.ai_tags,
        folderName: (data.folders as { name: string } | null)?.name || null,
        platform: data.platform,
        similarity: 1.0, // 精确匹配
        createdAt: data.created_at ?? new Date().toISOString(),
      };
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          bookmarkId,
        },
        "RAG: Failed to retrieve bookmark context",
      );
      return null;
    }
  }
}

// 导出单例
export const ragRetrievalService = new RAGRetrievalService();
