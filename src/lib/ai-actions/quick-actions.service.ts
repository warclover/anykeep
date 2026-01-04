/**
 * Quick Actions Service
 *
 * 快捷操作服务：直接调用 AI Skills 执行快捷操作
 *
 * 支持的操作：
 * - auto-tag: 智能标签推荐
 * - auto-classify: 智能分类（文件夹推荐）
 * - extract-key: 提取关键要点
 * - rate-quality: 内容质量评估
 *
 * @version 1.0.0
 * @since 2025-12-22
 */

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { classifySkill } from "@/lib/ai-skills/skills/classify";
import { summarySkill } from "@/lib/ai-skills/skills/summary";
import { logger } from "@/lib/logger";
import type { SkillContext } from "@/lib/ai-skills/core/types";
import type { ClassificationCandidate } from "@/types/supabase";

// ============================================
// 类型定义
// ============================================

/**
 * 快捷操作类型
 */
export type QuickActionType =
  | "auto-tag"
  | "auto-classify"
  | "extract-key"
  | "rate-quality";

/**
 * 快捷操作请求
 */
export interface QuickActionRequest {
  /** 操作类型 */
  action: QuickActionType;
  /** 书签 ID */
  bookmarkId: number;
  /** 是否自动应用结果 */
  autoApply?: boolean;
}

/**
 * 快捷操作成功结果
 */
export interface QuickActionSuccessResult<T = unknown> {
  success: true;
  action: QuickActionType;
  bookmarkId: number;
  /** 操作结果数据 */
  data: T;
  /** 是否已应用 */
  applied: boolean;
  /** 执行时间（毫秒） */
  durationMs: number;
}

/**
 * 快捷操作失败结果
 */
export interface QuickActionErrorResult {
  success: false;
  action: QuickActionType;
  bookmarkId: number;
  error: string;
  errorCode?: string;
}

/**
 * 快捷操作结果
 */
export type QuickActionResult<T = unknown> =
  | QuickActionSuccessResult<T>
  | QuickActionErrorResult;

// ============================================
// 操作结果数据类型
// ============================================

/**
 * 智能标签结果
 */
export interface AutoTagResult {
  /** 推荐的标签 */
  suggestedTags: string[];
  /** 现有标签 */
  existingTags: string[];
  /** 新增的标签 */
  newTags: string[];
  /** 内容类型 */
  contentType?: string;
}

/**
 * 智能分类结果
 */
export interface AutoClassifyResult {
  /** 推荐的文件夹 ID */
  folderId: number | null;
  /** 推荐的文件夹名称 */
  folderName: string;
  /** 置信度 (0-100) */
  confidence: number;
  /** 推荐操作 */
  action: string;
  /** 推荐原因 */
  reason: string;
  /** 候选文件夹列表 */
  candidates: ClassificationCandidate[];
}

/**
 * 提取要点结果
 */
export interface ExtractKeyResult {
  /** 一句话总结 */
  tldr: string;
  /** 关键要点 */
  keyPoints: string[];
  /** 关键词 */
  keywords: string[];
  /** 内容情感 */
  sentiment?: "positive" | "neutral" | "negative";
  /** 阅读时间（分钟） */
  readingTime?: number;
}

/**
 * 质量评估结果
 */
export interface RateQualityResult {
  /** 评分 (1-5) */
  rating: number;
  /** 评分理由 */
  reason: string;
  /** 详细维度评分 */
  dimensions?: {
    /** 内容深度 */
    depth: number;
    /** 实用性 */
    usefulness: number;
    /** 原创性 */
    originality: number;
    /** 可读性 */
    readability: number;
  };
}

// ============================================
// 验证 Schema
// ============================================

export const QuickActionRequestSchema = z.object({
  action: z.enum(["auto-tag", "auto-classify", "extract-key", "rate-quality"]),
  bookmarkId: z.number().int().positive(),
  autoApply: z.boolean().optional().default(false),
});

// ============================================
// 服务实现
// ============================================

/**
 * Quick Actions 服务类
 */
export class QuickActionsService {
  private supabase: Awaited<ReturnType<typeof createClient>>;
  private userId: string;

  private constructor(
    supabase: Awaited<ReturnType<typeof createClient>>,
    userId: string,
  ) {
    this.supabase = supabase;
    this.userId = userId;
  }

  /**
   * 创建服务实例
   */
  static async create(userId: string): Promise<QuickActionsService> {
    const supabase = await createClient();
    return new QuickActionsService(supabase, userId);
  }

  /**
   * 执行快捷操作
   */
  async execute(request: QuickActionRequest): Promise<QuickActionResult> {
    const startTime = performance.now();
    const { action, bookmarkId, autoApply = false } = request;

    logger.info(
      {
        userId: this.userId,
        action,
        bookmarkId,
        autoApply,
      },
      "QuickActionsService: Executing action",
    );

    try {
      // 1. 获取书签数据
      const bookmark = await this.getBookmark(bookmarkId);
      if (!bookmark) {
        return {
          success: false,
          action,
          bookmarkId,
          error: "书签不存在或无权访问",
          errorCode: "BOOKMARK_NOT_FOUND",
        };
      }

      // 2. 执行对应操作
      let result: QuickActionResult;
      switch (action) {
        case "auto-tag":
          result = await this.executeAutoTag(bookmark, autoApply);
          break;
        case "auto-classify":
          result = await this.executeAutoClassify(bookmark, autoApply);
          break;
        case "extract-key":
          result = await this.executeExtractKey(bookmark);
          break;
        case "rate-quality":
          result = await this.executeRateQuality(bookmark, autoApply);
          break;
        default:
          return {
            success: false,
            action,
            bookmarkId,
            error: `未知操作类型: ${action}`,
            errorCode: "UNKNOWN_ACTION",
          };
      }

      const durationMs = Math.round(performance.now() - startTime);

      if (result.success) {
        result.durationMs = durationMs;
      }

      logger.info(
        {
          userId: this.userId,
          action,
          bookmarkId,
          success: result.success,
          durationMs,
        },
        "QuickActionsService: Action completed",
      );

      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "执行操作失败";

      logger.error(
        {
          userId: this.userId,
          action,
          bookmarkId,
          error: errorMessage,
        },
        "QuickActionsService: Action failed",
      );

      return {
        success: false,
        action,
        bookmarkId,
        error: errorMessage,
        errorCode: "EXECUTION_ERROR",
      };
    }
  }

  /**
   * 获取书签数据
   */
  private async getBookmark(bookmarkId: number): Promise<BookmarkData | null> {
    const { data, error } = await this.supabase
      .from("bookmarks")
      .select(
        "id, title, url, description, user_tags, folder_id, platform, rating, folders(name)",
      )
      .eq("id", bookmarkId)
      .eq("user_id", this.userId)
      .is("deleted_at", null)
      .single();

    if (error || !data) {
      return null;
    }

    return {
      id: data.id,
      title: data.title || "",
      url: data.url,
      description: data.description ?? undefined,
      content: undefined, // bookmarks 表无 content 字段，后续可从其他来源获取
      tags: data.user_tags || [],
      folderId: data.folder_id ?? undefined,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      folderName: (data.folders as any)?.name ?? undefined,
      platform: data.platform || "OTHER",
      rating: data.rating ?? undefined,
    };
  }

  /**
   * 创建 Skill 上下文
   */
  private createSkillContext(): SkillContext {
    return {
      userId: this.userId,
      traceId: `quick-action-${Date.now()}`,
    };
  }

  // ============================================
  // 操作实现
  // ============================================

  /**
   * 执行智能标签推荐
   */
  private async executeAutoTag(
    bookmark: BookmarkData,
    autoApply: boolean,
  ): Promise<QuickActionResult<AutoTagResult>> {
    const context = this.createSkillContext();

    // 使用 SummarySkill 提取标签
    const summaryResult = await summarySkill.execute(
      {
        title: bookmark.title,
        url: bookmark.url,
        description: bookmark.description,
        content: bookmark.content,
        mode: "standard",
        needsClassification: false,
      },
      context,
    );

    if (!summaryResult.success) {
      return {
        success: false,
        action: "auto-tag",
        bookmarkId: bookmark.id,
        error: summaryResult.error || "标签提取失败",
        errorCode: "SKILL_ERROR",
      };
    }

    const suggestedTags = summaryResult.data.tags || [];
    const existingTags = bookmark.tags || [];

    // 计算新增标签（排除已有的）
    const newTags = suggestedTags.filter((tag) => !existingTags.includes(tag));

    // 自动应用标签
    let applied = false;
    if (autoApply && newTags.length > 0) {
      const mergedTags = [...new Set([...existingTags, ...newTags])];
      const { error } = await this.supabase
        .from("bookmarks")
        .update({ user_tags: mergedTags })
        .eq("id", bookmark.id)
        .eq("user_id", this.userId);

      if (!error) {
        applied = true;
      }
    }

    return {
      success: true,
      action: "auto-tag",
      bookmarkId: bookmark.id,
      data: {
        suggestedTags,
        existingTags,
        newTags,
        contentType: summaryResult.data.contentType,
      },
      applied,
      durationMs: 0,
    };
  }

  /**
   * 执行智能分类
   */
  private async executeAutoClassify(
    bookmark: BookmarkData,
    autoApply: boolean,
  ): Promise<QuickActionResult<AutoClassifyResult>> {
    const context = this.createSkillContext();

    // 使用 ClassifySkill 推荐文件夹
    const classifyResult = await classifySkill.execute(
      {
        bookmarkId: bookmark.id,
        title: bookmark.title,
        summary: bookmark.description,
        tags: bookmark.tags,
        url: bookmark.url,
        enableAI: true,
      },
      context,
    );

    if (!classifyResult.success) {
      return {
        success: false,
        action: "auto-classify",
        bookmarkId: bookmark.id,
        error: classifyResult.error || "分类推荐失败",
        errorCode: "SKILL_ERROR",
      };
    }

    const data = classifyResult.data;

    // 自动应用分类（仅当推荐了具体文件夹且置信度较高时）
    let applied = false;
    if (
      autoApply &&
      data.folderId !== null &&
      data.confidence >= 70 &&
      data.folderId !== bookmark.folderId
    ) {
      const { error } = await this.supabase
        .from("bookmarks")
        .update({ folder_id: data.folderId })
        .eq("id", bookmark.id)
        .eq("user_id", this.userId);

      if (!error) {
        applied = true;
      }
    }

    return {
      success: true,
      action: "auto-classify",
      bookmarkId: bookmark.id,
      data: {
        folderId: data.folderId,
        folderName: data.folderName,
        confidence: data.confidence,
        action: data.action,
        reason: data.reason,
        candidates: data.candidates.slice(0, 5).map((c) => ({
          folderId: c.folderId,
          folderName: c.folderName,
          score: c.score,
          matchType: c.matchType,
        })),
      },
      applied,
      durationMs: 0,
    };
  }

  /**
   * 执行提取要点
   */
  private async executeExtractKey(
    bookmark: BookmarkData,
  ): Promise<QuickActionResult<ExtractKeyResult>> {
    const context = this.createSkillContext();

    // 使用 SummarySkill 的 enhanced 模式提取要点
    const summaryResult = await summarySkill.execute(
      {
        title: bookmark.title,
        url: bookmark.url,
        description: bookmark.description,
        content: bookmark.content,
        mode: "enhanced",
        needsClassification: false,
      },
      context,
    );

    if (!summaryResult.success) {
      return {
        success: false,
        action: "extract-key",
        bookmarkId: bookmark.id,
        error: summaryResult.error || "要点提取失败",
        errorCode: "SKILL_ERROR",
      };
    }

    const data = summaryResult.data;
    const structured = data.structured;

    return {
      success: true,
      action: "extract-key",
      bookmarkId: bookmark.id,
      data: {
        tldr: structured?.tldr || data.summary,
        keyPoints: structured?.keyPoints || [],
        keywords: structured?.keywords || data.tags,
        sentiment: structured?.sentiment,
        readingTime: structured?.readingTime,
      },
      applied: false,
      durationMs: 0,
    };
  }

  /**
   * 执行质量评估
   */
  private async executeRateQuality(
    bookmark: BookmarkData,
    autoApply: boolean,
  ): Promise<QuickActionResult<RateQualityResult>> {
    const context = this.createSkillContext();

    // 使用 SummarySkill 的 enhanced 模式获取内容分析
    const summaryResult = await summarySkill.execute(
      {
        title: bookmark.title,
        url: bookmark.url,
        description: bookmark.description,
        content: bookmark.content,
        mode: "enhanced",
        needsClassification: false,
      },
      context,
    );

    if (!summaryResult.success) {
      return {
        success: false,
        action: "rate-quality",
        bookmarkId: bookmark.id,
        error: summaryResult.error || "质量评估失败",
        errorCode: "SKILL_ERROR",
      };
    }

    const data = summaryResult.data;
    const structured = data.structured;
    const enhanced = data.enhanced;

    // 计算综合评分（基于内容丰富度）
    let rating = 3; // 默认评分
    let reason = "内容基本满足需求";

    // 根据内容特征调整评分
    const hasKeyPoints = (structured?.keyPoints?.length || 0) >= 3;
    const hasKeywords = (structured?.keywords?.length || 0) >= 3;
    const hasEntities = (enhanced?.entities?.length || 0) >= 2;
    const hasDifficulty = !!enhanced?.difficulty;

    if (hasKeyPoints && hasKeywords && hasEntities) {
      rating = 5;
      reason = "内容丰富、结构清晰、信息量大";
    } else if (hasKeyPoints && hasKeywords) {
      rating = 4;
      reason = "内容较为丰富，有明确的要点和关键词";
    } else if (hasKeyPoints || hasKeywords) {
      rating = 3;
      reason = "内容基本完整，但信息量一般";
    } else {
      rating = 2;
      reason = "内容较为简单，信息量有限";
    }

    // 如果有难度标记，也可以作为参考
    if (hasDifficulty && enhanced?.difficulty === "advanced") {
      rating = Math.min(rating + 1, 5);
      reason += "，涉及高级主题";
    }

    // 自动应用评分
    let applied = false;
    if (autoApply && bookmark.rating !== rating) {
      const { error } = await this.supabase
        .from("bookmarks")
        .update({ rating })
        .eq("id", bookmark.id)
        .eq("user_id", this.userId);

      if (!error) {
        applied = true;
      }
    }

    return {
      success: true,
      action: "rate-quality",
      bookmarkId: bookmark.id,
      data: {
        rating,
        reason,
        dimensions: {
          depth: hasKeyPoints ? 4 : 2,
          usefulness: hasKeywords ? 4 : 2,
          originality: hasEntities ? 4 : 3,
          readability: 4, // 默认可读性较好
        },
      },
      applied,
      durationMs: 0,
    };
  }
}

// ============================================
// 辅助类型
// ============================================

interface BookmarkData {
  id: number;
  title: string;
  url: string;
  description?: string;
  content?: string;
  tags: string[];
  folderId?: number;
  folderName?: string;
  platform: string;
  rating?: number;
}

// ============================================
// 便捷函数
// ============================================

/**
 * 执行快捷操作（便捷函数）
 */
export async function executeQuickAction(
  userId: string,
  request: QuickActionRequest,
): Promise<QuickActionResult> {
  const service = await QuickActionsService.create(userId);
  return service.execute(request);
}
