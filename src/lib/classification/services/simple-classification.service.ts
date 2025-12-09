/**
 * V4.1 简化分类服务
 *
 * 核心设计：
 * 1. 统一向量搜索（profile + name embedding）
 * 2. 标签增强（+5%~+15%）
 * 3. 单阈值决策（70%）
 * 4. AI 选择题模式
 *
 * @version 4.1
 * @description 务实优化版，解决冷启动问题，提升分类准确率
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import type {
  CandidateFolder,
  SimpleBookmarkInput,
  SimpleClassificationResult,
  SimpleClassificationConfig,
  UnifiedSearchResult,
} from "../types/simple-classification.types";
import {
  generateEmbedding,
  buildEmbeddingText,
} from "@/lib/utils/embedding-generator";
import { generateWithAI } from "@/lib/utils/ai-generator";
import { logger } from "@/lib/logger";

/**
 * V4.1 简化分类服务
 */
export class SimpleClassificationService {
  private config: SimpleClassificationConfig;

  constructor(
    private supabase: SupabaseClient<Database>,
    config?: Partial<SimpleClassificationConfig>,
  ) {
    this.config = {
      autoClassifyThreshold: 70,
      minMatchThreshold: 40,
      maxCandidates: 5,
      maxTagBoost: 15,
      enableAISelection: true,
      enableAICreate: true,
      ...config,
    };
  }

  /**
   * 执行分类
   */
  async classify(
    userId: string,
    bookmark: SimpleBookmarkInput,
  ): Promise<SimpleClassificationResult> {
    const startTime = performance.now();

    try {
      // 1. 生成书签 embedding
      const embeddingText = buildEmbeddingText(
        bookmark.title,
        bookmark.summary,
        bookmark.tags,
      );
      const embedding = await generateEmbedding(embeddingText);

      if (!embedding || embedding.length === 0) {
        logger.warn(
          { userId, title: bookmark.title },
          "[SimpleClassification] Failed to generate embedding",
        );
        return this.createInboxResult("无法生成书签向量", startTime);
      }

      // 2. 统一向量搜索（单次 SQL）
      const candidates = await this.searchFoldersUnified(userId, embedding);

      logger.debug(
        {
          userId,
          title: bookmark.title,
          candidateCount: candidates.length,
          topCandidate: candidates[0]?.folderName,
          topScore: candidates[0]?.score,
        },
        "[SimpleClassification] Unified search completed",
      );

      if (candidates.length === 0) {
        // 无候选 → AI 创建新文件夹
        if (this.config.enableAICreate) {
          return this.aiCreateFolder(bookmark, startTime);
        }
        return this.createInboxResult("没有匹配的文件夹", startTime);
      }

      // 3. 标签增强（内存计算，无额外 IO）
      const boostedCandidates = this.applyTagBoost(
        candidates,
        bookmark.tags || [],
      );

      // 排序取最佳
      boostedCandidates.sort((a, b) => b.score - a.score);
      const best = boostedCandidates[0];

      const executionTime = Math.round(performance.now() - startTime);

      // 4. 简化决策
      if (best.score >= this.config.autoClassifyThreshold) {
        // 高置信度 → 自动归类（不调 AI）
        logger.info(
          {
            userId,
            title: bookmark.title,
            folderId: best.folderId,
            folderName: best.folderName,
            score: best.score,
            matchType: best.matchType,
            tagBoost: best.tagBoost,
            executionTime,
          },
          "[SimpleClassification] Auto classify (high confidence)",
        );

        return {
          folderId: best.folderId,
          folderName: best.folderName,
          confidence: best.score,
          action: "classify",
          reason: this.buildReason(best),
          executionTime,
          candidates: boostedCandidates.slice(0, 3),
          matchType: best.matchType,
          tagBoost: best.tagBoost,
        };
      }

      // 中低置信度 → AI 选择题
      if (this.config.enableAISelection) {
        return this.aiSelectFromCandidates(
          bookmark,
          boostedCandidates.slice(0, 3),
          startTime,
        );
      }

      // AI 选择题禁用时，使用最佳匹配
      return {
        folderId: best.folderId,
        folderName: best.folderName,
        confidence: best.score,
        action: "classify",
        reason: `向量匹配 ${best.score}% (低于阈值，建议确认)`,
        executionTime,
        candidates: boostedCandidates.slice(0, 3),
        matchType: best.matchType,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error(
        { userId, title: bookmark.title, error: errorMessage },
        "[SimpleClassification] Classification failed",
      );

      return this.createInboxResult(`分类失败: ${errorMessage}`, startTime);
    }
  }

  /**
   * 统一向量搜索
   * 注意：需要先执行 SQL 迁移 20251209000001_add_search_folders_unified.sql
   */
  private async searchFoldersUnified(
    userId: string,
    embedding: number[],
  ): Promise<CandidateFolder[]> {
    // 使用类型断言绕过类型检查（函数通过 SQL 迁移添加，类型需重新生成）
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (this.supabase.rpc as any)(
      "search_folders_unified",
      {
        p_user_id: userId,
        p_embedding: embedding,
        p_limit: this.config.maxCandidates,
      },
    );

    if (error) {
      logger.error(
        { error: error.message, userId },
        "[SimpleClassification] search_folders_unified failed",
      );
      return [];
    }

    return ((data as UnifiedSearchResult[]) || []).map((row) => ({
      folderId: row.folder_id,
      folderName: row.folder_name,
      score: Math.round(row.similarity * 100),
      matchType: row.match_type as "profile" | "name",
      bookmarkCount: row.bookmark_count,
      topTags: row.top_tags || [],
    }));
  }

  /**
   * 标签增强计算
   */
  private applyTagBoost(
    candidates: CandidateFolder[],
    bookmarkTags: string[],
  ): CandidateFolder[] {
    if (bookmarkTags.length === 0) {
      return candidates;
    }

    const normalizedBookmarkTags = bookmarkTags.map((t) =>
      t.toLowerCase().trim(),
    );

    return candidates.map((c) => {
      const normalizedFolderTags = (c.topTags || []).map((t) =>
        t.toLowerCase().trim(),
      );

      // 计算重叠（模糊匹配）
      const overlap = normalizedBookmarkTags.filter((tag) =>
        normalizedFolderTags.some((ft) => ft.includes(tag) || tag.includes(ft)),
      ).length;

      if (overlap === 0) {
        return c;
      }

      // 重叠率 → 加分（最多 +maxTagBoost%）
      const overlapRate =
        overlap / Math.max(bookmarkTags.length, c.topTags.length);
      const boost = Math.min(
        Math.round(overlapRate * this.config.maxTagBoost),
        this.config.maxTagBoost,
      );

      return {
        ...c,
        score: Math.min(c.score + boost, 100),
        tagBoost: boost,
      };
    });
  }

  /**
   * AI 选择题模式
   */
  private async aiSelectFromCandidates(
    bookmark: SimpleBookmarkInput,
    candidates: CandidateFolder[],
    startTime: number,
  ): Promise<SimpleClassificationResult> {
    const prompt = `你是一个智能书签分类助手。请根据书签内容选择最合适的文件夹。

书签标题: "${bookmark.title}"
书签标签: ${bookmark.tags?.join(", ") || "无"}
${bookmark.summary ? `书签摘要: ${bookmark.summary}` : ""}

请从以下文件夹中选择最合适的，只回复数字：
${candidates.map((c, i) => `${i + 1}. ${c.folderName} (当前匹配度: ${c.score}%)`).join("\n")}
0. 都不合适，需要创建新文件夹

只回复一个数字，不要其他内容。`;

    try {
      const response = await generateWithAI(prompt, {
        maxTokens: 10,
        temperature: 0.1,
      });

      const choice = parseInt(response.trim(), 10);
      const executionTime = Math.round(performance.now() - startTime);

      logger.debug(
        {
          title: bookmark.title,
          aiResponse: response,
          choice,
          candidates: candidates.map((c) => c.folderName),
        },
        "[SimpleClassification] AI selection completed",
      );

      if (choice === 0 || isNaN(choice) || choice > candidates.length) {
        // AI 认为都不合适 → 创建新文件夹
        if (this.config.enableAICreate) {
          return this.aiCreateFolder(bookmark, startTime);
        }
        return this.createInboxResult("AI 无法选择合适的文件夹", startTime);
      }

      const selected = candidates[choice - 1];

      logger.info(
        {
          title: bookmark.title,
          selectedFolder: selected.folderName,
          originalScore: selected.score,
          finalConfidence: Math.min(selected.score + 10, 95),
        },
        "[SimpleClassification] AI selected folder",
      );

      return {
        folderId: selected.folderId,
        folderName: selected.folderName,
        confidence: Math.min(selected.score + 10, 95), // AI 确认加分
        action: "classify",
        reason: `AI 选择: ${selected.folderName}`,
        executionTime,
        candidates,
        matchType: "ai_select",
      };
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        "[SimpleClassification] AI selection failed",
      );

      // AI 失败时使用最佳候选
      const best = candidates[0];
      return {
        folderId: best.folderId,
        folderName: best.folderName,
        confidence: best.score,
        action: "classify",
        reason: `向量匹配 ${best.score}% (AI 选择失败)`,
        executionTime: Math.round(performance.now() - startTime),
        candidates,
        matchType: best.matchType,
      };
    }
  }

  /**
   * AI 创建新文件夹
   */
  private async aiCreateFolder(
    bookmark: SimpleBookmarkInput,
    startTime: number,
  ): Promise<SimpleClassificationResult> {
    const prompt = `根据以下书签内容，生成一个简洁的文件夹名称（2-6个中文字或英文单词）：

标题：${bookmark.title}
${bookmark.summary ? `摘要：${bookmark.summary}` : ""}
标签：${bookmark.tags?.join("、") || "无"}

要求：
1. 名称简洁明了，能概括内容主题
2. 2-6 个字
3. 不要使用"内容分类"、"待整理"、"收藏夹"等无意义名称
4. 优先使用具体的领域词汇（如"前端开发"、"投资理财"、"健康养生"）

只返回文件夹名称，不要其他说明。`;

    try {
      const folderName = await generateWithAI(prompt, {
        maxTokens: 20,
        temperature: 0.3,
      });

      const cleanedName = folderName.trim().replace(/["""'']/g, "");
      const executionTime = Math.round(performance.now() - startTime);

      // 黑名单检查
      const blacklist = [
        "内容分类",
        "待整理",
        "收藏夹",
        "默认",
        "其他",
        "未分类",
        "杂项",
      ];
      const isBlacklisted = blacklist.some(
        (word) =>
          cleanedName.includes(word) || cleanedName.toLowerCase() === word,
      );

      const finalName = isBlacklisted
        ? bookmark.tags?.[0] || bookmark.title.slice(0, 6)
        : cleanedName;

      logger.info(
        {
          title: bookmark.title,
          suggestedFolder: finalName,
          originalSuggestion: cleanedName,
          wasBlacklisted: isBlacklisted,
        },
        "[SimpleClassification] AI created folder suggestion",
      );

      return {
        folderId: null,
        folderName: finalName,
        confidence: 85,
        action: "suggest_create",
        reason: `AI 建议创建: ${finalName}`,
        executionTime,
        matchType: "ai_create",
      };
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        "[SimpleClassification] AI folder creation failed",
      );

      // AI 失败时使用标签或标题
      const fallbackName = bookmark.tags?.[0] || bookmark.title.slice(0, 6);
      return {
        folderId: null,
        folderName: fallbackName,
        confidence: 70,
        action: "suggest_create",
        reason: `建议创建: ${fallbackName} (AI 生成失败)`,
        executionTime: Math.round(performance.now() - startTime),
        matchType: "ai_create",
      };
    }
  }

  /**
   * 构建推理说明
   */
  private buildReason(candidate: CandidateFolder): string {
    const parts: string[] = [];

    if (candidate.matchType === "profile") {
      parts.push(`向量匹配 ${candidate.score - (candidate.tagBoost || 0)}%`);
    } else {
      parts.push(
        `名称匹配 ${candidate.score - (candidate.tagBoost || 0)}% (冷启动)`,
      );
    }

    if (candidate.tagBoost && candidate.tagBoost > 0) {
      parts.push(`标签增强 +${candidate.tagBoost}%`);
    }

    return parts.join(" ");
  }

  /**
   * 创建待整理结果
   */
  private createInboxResult(
    reason: string,
    startTime: number,
  ): SimpleClassificationResult {
    return {
      folderId: null,
      folderName: "待整理",
      confidence: 0,
      action: "inbox",
      reason,
      executionTime: Math.round(performance.now() - startTime),
    };
  }
}

/**
 * 创建简化分类服务实例
 */
export function createSimpleClassificationService(
  supabase: SupabaseClient<Database>,
  config?: Partial<SimpleClassificationConfig>,
): SimpleClassificationService {
  return new SimpleClassificationService(supabase, config);
}
