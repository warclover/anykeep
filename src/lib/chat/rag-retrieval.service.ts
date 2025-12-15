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
 * V4.2.5: RAG 上下文格式配置
 *
 * 配置化设计原因：
 * - 不同的 LLM 模型对上下文格式有不同的偏好
 * - 方便 A/B 测试不同格式对回答质量的影响
 * - 支持多语言场景（中文/英文）
 */
export interface RAGContextFormatConfig {
  /** 上下文开头提示语 */
  header: string;
  /** 单条书签格式模板（支持变量: {index}, {title}, {folder}, {platform}, {summary}, {description}, {tags}, {url}） */
  itemTemplate: string;
  /** 书签之间的分隔符 */
  itemSeparator: string;
  /** 最大上下文长度（字符数），超过则截断 */
  maxLength?: number;
  /** 是否显示相似度分数（用于调试） */
  showSimilarity?: boolean;
}

/** 默认中文上下文格式 */
export const DEFAULT_CONTEXT_FORMAT: RAGContextFormatConfig = {
  header: "以下是用户收藏中与问题相关的内容：\n",
  itemTemplate: [
    "【{index}】{title}",
    "{folder?   文件夹：{folder}}",
    "{platform?   来源：{platform}}",
    "{summary?   摘要：{summary}}",
    "{description?   描述：{description}}",
    "{tags?   标签：{tags}}",
    "   链接：{url}",
  ].join("\n"),
  itemSeparator: "\n\n",
  maxLength: 8000,
  showSimilarity: false,
};

/** 简洁格式（用于 token 受限场景） */
export const COMPACT_CONTEXT_FORMAT: RAGContextFormatConfig = {
  header: "相关收藏内容：\n",
  itemTemplate: "{index}. {title}\n   {summary}\n   {url}",
  itemSeparator: "\n",
  maxLength: 4000,
  showSimilarity: false,
};

/** 英文格式（用于英文 LLM） */
export const ENGLISH_CONTEXT_FORMAT: RAGContextFormatConfig = {
  header: "Here are relevant bookmarks from the user's collection:\n",
  itemTemplate: [
    "[{index}] {title}",
    "{folder?   Folder: {folder}}",
    "{platform?   Source: {platform}}",
    "{summary?   Summary: {summary}}",
    "{tags?   Tags: {tags}}",
    "   URL: {url}",
  ].join("\n"),
  itemSeparator: "\n\n",
  maxLength: 8000,
  showSimilarity: false,
};

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
  /** V4.2.5: 上下文格式配置 */
  contextFormat?: RAGContextFormatConfig;
}

const DEFAULT_OPTIONS: Required<
  Omit<RAGRetrievalOptions, "folderId" | "bookmarkIds" | "contextFormat">
> & { contextFormat: RAGContextFormatConfig } = {
  limit: 5,
  minSimilarity: 0.5,
  includeDescription: true,
  contextFormat: DEFAULT_CONTEXT_FORMAT,
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

      // V4.2.5: 修复向量格式，pgvector 需要 [1,2,3,...] 格式
      const rpcParams = {
        query_embedding: `[${queryEmbedding.join(",")}]`,
        match_threshold: opts.minSimilarity,
        match_count: opts.limit,
        p_user_id: userId,
        p_folder_id: opts.folderId,
      };

      // 调用 RPC 函数进行向量搜索 (V4.2 RPC)
      const { data: searchResults, error: searchError } = await supabase.rpc(
        "search_bookmarks_by_embedding",
        rpcParams,
      );

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

      // 5. 生成上下文文本（使用配置化格式）
      const contextFormat = options.contextFormat || DEFAULT_CONTEXT_FORMAT;
      const context = this.buildContext(
        bookmarks,
        opts.includeDescription,
        contextFormat,
      );

      // 6. 计算元数据
      const avgSimilarity =
        bookmarks.length > 0
          ? bookmarks.reduce((sum, b) => sum + b.similarity, 0) /
            bookmarks.length
          : 0;

      const retrievalTimeMs = Date.now() - startTime;

      // V4.2.5: 增强检索质量指标日志
      const similarities = bookmarks.map((b) => b.similarity);
      const sortedSimilarities = [...similarities].sort((a, b) => b - a);
      const qualityMetrics = {
        // 基础指标
        found: bookmarks.length,
        requested: opts.limit,
        fillRate:
          opts.limit > 0 ? (bookmarks.length / opts.limit).toFixed(2) : "0",
        // 相似度分布
        avgSimilarity: avgSimilarity.toFixed(3),
        maxSimilarity: sortedSimilarities[0]?.toFixed(3) ?? "N/A",
        minSimilarity:
          sortedSimilarities[sortedSimilarities.length - 1]?.toFixed(3) ??
          "N/A",
        medianSimilarity:
          sortedSimilarities.length > 0
            ? sortedSimilarities[
                Math.floor(sortedSimilarities.length / 2)
              ].toFixed(3)
            : "N/A",
        // 质量分布（高于阈值的比例）
        highQualityRatio:
          bookmarks.length > 0
            ? (
                bookmarks.filter((b) => b.similarity >= 0.7).length /
                bookmarks.length
              ).toFixed(2)
            : "0",
        // 文件夹分布（检索结果是否集中在少数文件夹）
        uniqueFolders: new Set(
          bookmarks.map((b) => b.folderName).filter(Boolean),
        ).size,
      };

      logger.info(
        {
          userId: userId.slice(0, 8) + "...",
          query: query.slice(0, 50) + (query.length > 50 ? "..." : ""),
          ...qualityMetrics,
          timeMs: retrievalTimeMs,
          threshold: opts.minSimilarity,
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
   * V4.2.5: 支持配置化格式
   *
   * @param bookmarks - 检索到的书签列表
   * @param includeDescription - 是否包含描述
   * @param format - 上下文格式配置
   * @returns 格式化的上下文文本
   */
  private buildContext(
    bookmarks: RetrievedBookmark[],
    includeDescription: boolean,
    format: RAGContextFormatConfig = DEFAULT_CONTEXT_FORMAT,
  ): string {
    if (bookmarks.length === 0) {
      return "";
    }

    const contextParts: string[] = [format.header];

    bookmarks.forEach((bookmark, index) => {
      // 构建变量映射
      const vars: Record<string, string | undefined> = {
        index: String(index + 1),
        title: bookmark.title,
        folder: bookmark.folderName || undefined,
        platform: bookmark.platform || undefined,
        summary: bookmark.summary || undefined,
        description: includeDescription
          ? bookmark.description || undefined
          : undefined,
        tags: bookmark.tags?.join("、") || undefined,
        url: bookmark.url,
        similarity: format.showSimilarity
          ? bookmark.similarity.toFixed(3)
          : undefined,
      };

      // 应用模板
      const itemText = this.applyTemplate(format.itemTemplate, vars);
      contextParts.push(itemText);
    });

    let result = contextParts.join(format.itemSeparator).trim();

    // 截断到最大长度
    if (format.maxLength && result.length > format.maxLength) {
      result = result.slice(0, format.maxLength) + "\n...(内容已截断)";
    }

    return result;
  }

  /**
   * V4.2.5: 应用模板变量
   * 支持条件语法: {var?text with {var}}
   *
   * @param template - 模板字符串
   * @param vars - 变量映射
   * @returns 替换后的字符串
   */
  private applyTemplate(
    template: string,
    vars: Record<string, string | undefined>,
  ): string {
    // 处理条件语法: {var?text}
    // 如果 var 存在，则显示 text（text 中的 {var} 会被替换）
    // 如果 var 不存在，则整行被移除
    let result = template;

    // 1. 处理条件语法 {varName?conditional text with {varName}}
    result = result.replace(
      /\{(\w+)\?([^}]+(?:\{[^}]+\}[^}]*)*)\}/g,
      (_, varName: string, conditionalText: string) => {
        const value = vars[varName];
        if (value === undefined || value === "") {
          return ""; // 条件不满足，移除整个块
        }
        // 替换条件文本中的变量
        return conditionalText.replace(
          /\{(\w+)\}/g,
          (__, v: string) => vars[v] || "",
        );
      },
    );

    // 2. 处理普通变量 {varName}
    result = result.replace(
      /\{(\w+)\}/g,
      (_, varName: string) => vars[varName] || "",
    );

    // 3. 清理空行（由条件语法移除产生）
    result = result
      .split("\n")
      .filter((line) => line.trim() !== "")
      .join("\n");

    return result;
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
