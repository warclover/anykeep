/**
 * V5.0 简化分类服务
 *
 * 核心设计：
 * 1. 统一向量搜索（profile + name embedding）
 * 2. 标签增强（+5%~+15%）
 * 3. 单阈值决策（70%）
 * 4. AI 选择题模式
 * 5. 统一命名规则（使用 naming-rules.ts）
 *
 * @version 5.0
 * @since 2026-02-25 统一命名规则优化
 * @description 务实优化版，解决冷启动问题，提升分类准确率
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import type {
  CandidateFolder,
  SimpleBookmarkInput,
  SimpleClassificationResult,
  SimpleClassificationConfig,
} from "../types/simple-classification.types";
import {
  generateEmbedding,
  buildEmbeddingText,
} from "@/lib/utils/embedding-generator";
import { generateWithAI } from "@/lib/ai-generator";
import { logger } from "@/lib/logger";
import { eventBus, ClassificationEvents } from "@/lib/shared/event-bus";
import { RECENT_FOLDER_DEDUP } from "@/lib/classification/constants/limits";
import { FOLDER_NAMING_RULES } from "@/lib/classification/constants/naming-rules";
import {
  sanitizeFolderName,
  generateFallbackName,
} from "@/lib/classification/utils/folder-name-sanitizer";

// ═══════════════════════════════════════════════════════════════
// 常量定义
// ═══════════════════════════════════════════════════════════════

/** Embedding 向量维度（与数据库 vector(1024) 一致） */
const EMBEDDING_DIMENSIONS = 1024;

/** AI 确认选择后的加分 */
const AI_SELECTION_BOOST = 10;

/** 置信度上限 */
const MAX_CONFIDENCE = 95;

/** 最大得分 */
const MAX_SCORE = 100;

/** AI 创建文件夹的默认置信度 */
const AI_CREATE_CONFIDENCE = 85;

/** AI 创建失败时的回退置信度 */
const AI_CREATE_FALLBACK_CONFIDENCE = 70;

/** 日志中标题最大显示长度（隐私保护） */
const LOG_TITLE_MAX_LENGTH = 30;

/** 待整理文件夹名称 */
const INBOX_FOLDER_NAME = "待整理";

/** Prompt 输入最大长度（防止注入） */
const PROMPT_INPUT_MAX_LENGTH = 200;

/** 标签最大数量（防止注入） */
const PROMPT_TAGS_MAX_COUNT = 10;

/**
 * V4.2.5: 增强 Prompt 注入防护
 * 消毒用户输入（防止 Prompt 注入）
 * - 替换控制字符为空格
 * - 移除 Unicode 控制字符（零宽字符等）
 * - 合并空白符
 * - 转义引号（单引号和双引号）
 * - 移除模板注入模式（Handlebars、Jinja、EJS）
 * - 移除 SQL 关键词
 * - 移除角色前缀
 * - 检测并移除 Base64 编码模式
 * - 移除 XML/HTML 标签
 * - 防止多行注入
 * - 截断长度
 */
function sanitizePromptInput(
  input: string | undefined,
  maxLength = PROMPT_INPUT_MAX_LENGTH,
): string {
  if (!input) return "";

  return (
    input
      // 替换控制字符为空格（保持文本可读性）
      .replace(/[\x00-\x1F\x7F]/g, " ")
      // 移除 Unicode 控制字符（零宽字符、方向控制等）
      .replace(/[\u200B-\u200F\uFEFF]/g, "")
      // 移除其他不可见字符
      .replace(/[\u2028\u2029]/g, " ")
      // 合并连续的空白符
      .replace(/[\n\r\t]+/g, " ")
      .replace(/\s{2,}/g, " ")
      // 转义双引号和单引号
      .replace(/"/g, '\\"')
      .replace(/'/g, "\\'")
      // 移除模板注入模式（Handlebars、Jinja、EJS）
      .replace(/{{\s*[\w.]+\s*}}/g, "")
      .replace(/{%\s*[\w\s]+\s*%}/g, "")
      .replace(/<%[=\-]?\s*[\w\s]+\s*%>/g, "")
      // 移除可能的 SQL 注入关键词
      .replace(
        /\b(select|insert|update|delete|drop|truncate|union|exec)\b/gi,
        "",
      )
      // 移除角色前缀（防止角色混淆攻击）
      .replace(
        /^(system|user|assistant|human|ai|command|instruct|role|prompt):/gim,
        "",
      )
      // 移除 XML/HTML 标签（防止标签注入）
      .replace(/<\/?[a-z][^>]*>/gi, "")
      // 检测并移除 Base64 编码的 data URI（防止编码绕过）
      .replace(/(?:data:text\/[a-z]+;base64,)[A-Za-z0-9+/=]+/g, "")
      // 移除可疑的多行注入模式（连续换行 + 特殊字符）
      .replace(/(\r?\n){2,}[^\w\s]/g, " ")
      // 截断长度
      .slice(0, maxLength)
      .trim()
  );
}

/**
 * 消毒标签数组
 */
function sanitizeTags(
  tags: string[] | undefined,
  maxCount = PROMPT_TAGS_MAX_COUNT,
): string[] {
  if (!tags || tags.length === 0) return [];

  return tags
    .slice(0, maxCount)
    .map((tag) => sanitizePromptInput(tag, 50))
    .filter((tag) => tag.length > 0);
}

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

      // 向量验证：必须存在且维度正确
      if (!embedding || embedding.length === 0) {
        logger.warn(
          { userId, title: this.truncateTitle(bookmark.title) },
          "[SimpleClassification] Failed to generate embedding",
        );
        return this.createInboxResult("无法生成书签向量", startTime);
      }

      if (embedding.length !== EMBEDDING_DIMENSIONS) {
        logger.error(
          {
            userId,
            title: this.truncateTitle(bookmark.title),
            actual: embedding.length,
            expected: EMBEDDING_DIMENSIONS,
          },
          "[SimpleClassification] Embedding dimension mismatch",
        );
        return this.createInboxResult(
          `向量维度错误: ${embedding.length} (期望 ${EMBEDDING_DIMENSIONS})`,
          startTime,
        );
      }

      // 2. 统一向量搜索（单次 SQL）
      const candidates = await this.searchFoldersUnified(userId, embedding);

      logger.debug(
        {
          userId,
          title: this.truncateTitle(bookmark.title),
          candidateCount: candidates.length,
          topCandidate: candidates[0]?.folderName,
          topScore: candidates[0]?.score,
        },
        "[SimpleClassification] Unified search completed",
      );

      if (candidates.length === 0) {
        // 无候选 → AI 创建新文件夹
        if (this.config.enableAICreate) {
          return this.aiCreateFolder(userId, bookmark, startTime);
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
            title: this.truncateTitle(bookmark.title),
            folderId: best.folderId,
            folderName: best.folderName,
            score: best.score,
            matchType: best.matchType,
            tagBoost: best.tagBoost,
            executionTime,
          },
          "[SimpleClassification] Auto classify (high confidence)",
        );

        const result: SimpleClassificationResult = {
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

        // 发布分类事件
        this.emitClassificationEvent(userId, bookmark.id, result);

        return result;
      }

      // 中低置信度 → AI 选择题
      if (this.config.enableAISelection) {
        return this.aiSelectFromCandidates(
          userId,
          bookmark,
          boostedCandidates.slice(0, 3),
          startTime,
        );
      }

      // AI 选择题禁用时，使用最佳匹配
      const fallbackResult: SimpleClassificationResult = {
        folderId: best.folderId,
        folderName: best.folderName,
        confidence: best.score,
        action: "classify",
        reason: `向量匹配 ${best.score}% (低于阈值，建议确认)`,
        executionTime,
        candidates: boostedCandidates.slice(0, 3),
        matchType: best.matchType,
      };

      // 发布分类事件
      this.emitClassificationEvent(userId, bookmark.id, fallbackResult);

      return fallbackResult;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error(
        {
          userId,
          title: this.truncateTitle(bookmark.title),
          error: errorMessage,
        },
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
    // V4.2.5: 修复向量格式，pgvector 需要 [1,2,3,...] 格式
    const { data, error } = await this.supabase.rpc("search_folders_unified", {
      p_user_id: userId,
      p_embedding: `[${embedding.join(",")}]`,
      p_limit: this.config.maxCandidates,
    });

    if (error) {
      logger.error(
        { error: error.message, userId },
        "[SimpleClassification] search_folders_unified failed",
      );
      return [];
    }

    return (data || []).map((row) => ({
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

      // V4.2.5: 改进标签匹配 - 使用精确匹配替代模糊匹配，避免假正例
      const overlap = normalizedBookmarkTags.filter((tag) =>
        normalizedFolderTags.includes(tag),
      ).length;

      if (overlap === 0) {
        return c;
      }

      // V4.2.5: 使用 Jaccard 相似度替代 max 分母，避免过度惩罚
      // Jaccard = |A ∩ B| / |A ∪ B|
      const union = new Set([
        ...normalizedBookmarkTags,
        ...normalizedFolderTags,
      ]).size;
      const overlapRate = overlap / union;
      const boost = Math.min(
        Math.round(overlapRate * this.config.maxTagBoost),
        this.config.maxTagBoost,
      );

      return {
        ...c,
        score: Math.min(c.score + boost, MAX_SCORE),
        tagBoost: boost,
      };
    });
  }

  /**
   * AI 选择题模式
   */
  private async aiSelectFromCandidates(
    userId: string,
    bookmark: SimpleBookmarkInput,
    candidates: CandidateFolder[],
    startTime: number,
  ): Promise<SimpleClassificationResult> {
    // 消毒用户输入（防止 Prompt 注入）
    const safeTitle = sanitizePromptInput(bookmark.title);
    const safeTags = sanitizeTags(bookmark.tags);
    const safeSummary = sanitizePromptInput(bookmark.summary, 300);

    const prompt = `你是一个智能书签分类助手。请根据书签内容选择最合适的文件夹。

书签标题: "${safeTitle}"
书签标签: ${safeTags.length > 0 ? safeTags.join(", ") : "无"}
${safeSummary ? `书签摘要: ${safeSummary}` : ""}

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
          title: this.truncateTitle(bookmark.title),
          aiResponse: response,
          choice,
          candidates: candidates.map((c) => c.folderName),
        },
        "[SimpleClassification] AI selection completed",
      );

      if (choice === 0 || isNaN(choice) || choice > candidates.length) {
        // AI 认为都不合适 → 创建新文件夹
        if (this.config.enableAICreate) {
          return this.aiCreateFolder(userId, bookmark, startTime);
        }
        return this.createInboxResult("AI 无法选择合适的文件夹", startTime);
      }

      const selected = candidates[choice - 1];
      const boostedConfidence = Math.min(
        selected.score + AI_SELECTION_BOOST,
        MAX_CONFIDENCE,
      );

      logger.info(
        {
          title: this.truncateTitle(bookmark.title),
          selectedFolder: selected.folderName,
          originalScore: selected.score,
          finalConfidence: boostedConfidence,
        },
        "[SimpleClassification] AI selected folder",
      );

      const result: SimpleClassificationResult = {
        folderId: selected.folderId,
        folderName: selected.folderName,
        confidence: boostedConfidence,
        action: "classify",
        reason: `AI 选择: ${selected.folderName}`,
        executionTime,
        candidates,
        matchType: "ai_select",
      };

      // 发布分类事件
      this.emitClassificationEvent(userId, bookmark.id, result);

      return result;
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        "[SimpleClassification] AI selection failed",
      );

      // AI 失败时使用最佳候选（防御性检查）
      if (candidates.length === 0) {
        return this.createInboxResult("AI 选择失败且无候选文件夹", startTime);
      }

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
   * V5.0: 使用统一的命名规则和清洗管道
   */
  private async aiCreateFolder(
    userId: string,
    bookmark: SimpleBookmarkInput,
    startTime: number,
  ): Promise<SimpleClassificationResult> {
    // 消毒用户输入（防止 Prompt 注入）
    const safeTitle = sanitizePromptInput(bookmark.title);
    const safeTags = sanitizeTags(bookmark.tags);
    const safeSummary = sanitizePromptInput(bookmark.summary, 300);

    // 获取近期文件夹名，用于引导 AI 复用已有名称
    const recentFolderNames = await this.getRecentFolderNames(userId);

    const recentFoldersSection =
      recentFolderNames.length > 0
        ? `

【近期已有文件夹】（${RECENT_FOLDER_DEDUP.WINDOW_HOURS}小时内创建）：${recentFolderNames.join("、")}
重要：若当前书签内容与上述某个文件夹主题一致，请直接返回该文件夹名称，不要创造新名称。`
        : "";

    // 使用统一的 Prompt 模板
    const prompt = `根据以下书签内容，生成一个简洁的文件夹名称。

${FOLDER_NAMING_RULES}

标题：${safeTitle}
${safeSummary ? `摘要：${safeSummary}` : ""}
标签：${safeTags.length > 0 ? safeTags.join("、") : "无"}
${recentFoldersSection}

只返回文件夹名称，不要其他说明。`;

    try {
      const folderName = await generateWithAI(prompt, {
        maxTokens: 20,
        temperature: 0.3,
      });

      const rawName = folderName.trim().replace(/["""'']/g, "");

      // 使用统一的清洗管道
      const sanitization = sanitizeFolderName(rawName, {
        tags: bookmark.tags || [],
        title: bookmark.title,
        strictMode: true,
      });

      const finalName = sanitization.name;
      const executionTime = Math.round(performance.now() - startTime);

      // 记录清洗结果
      if (sanitization.usedFallback || sanitization.wasSanitized) {
        logger.info(
          {
            title: this.truncateTitle(bookmark.title),
            originalName: rawName,
            sanitizedName: finalName,
            appliedRules: sanitization.appliedRules,
            usedFallback: sanitization.usedFallback,
          },
          "[SimpleClassification] Folder name sanitized",
        );
      }

      // 检查 AI 返回的名称是否与近期文件夹完全一致
      const matchedRecentFolder =
        recentFolderNames.length > 0
          ? await this.findExistingFolderByName(userId, finalName)
          : null;

      if (matchedRecentFolder) {
        logger.info(
          {
            title: this.truncateTitle(bookmark.title),
            suggestedFolder: finalName,
            matchedFolderId: matchedRecentFolder.id,
          },
          "[SimpleClassification] AI reused existing recent folder name",
        );

        const result: SimpleClassificationResult = {
          folderId: matchedRecentFolder.id,
          folderName: finalName,
          confidence: AI_CREATE_CONFIDENCE,
          action: "classify",
          reason: `AI 复用近期文件夹: ${finalName}`,
          executionTime,
          matchType: "ai_select",
        };

        this.emitClassificationEvent(userId, bookmark.id, result);
        return result;
      }

      logger.info(
        {
          title: this.truncateTitle(bookmark.title),
          suggestedFolder: finalName,
          originalSuggestion: rawName,
          wasSanitized: sanitization.wasSanitized,
        },
        "[SimpleClassification] AI created folder suggestion",
      );

      const result: SimpleClassificationResult = {
        folderId: null,
        folderName: finalName,
        confidence: AI_CREATE_CONFIDENCE,
        action: "suggest_create",
        reason: `AI 建议创建: ${finalName}`,
        executionTime,
        matchType: "ai_create",
      };

      // 发布分类事件（action: create_folder）
      this.emitClassificationEvent(userId, bookmark.id, result);

      return result;
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        "[SimpleClassification] AI folder creation failed",
      );

      // 使用统一的回退策略
      const fallbackName = generateFallbackName(
        bookmark.tags || [],
        bookmark.title || "",
      );
      return {
        folderId: null,
        folderName: fallbackName,
        confidence: AI_CREATE_FALLBACK_CONFIDENCE,
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
   * 发布分类完成事件（V4.2 事件总线）
   */
  private emitClassificationEvent(
    userId: string,
    bookmarkId: number | undefined,
    result: SimpleClassificationResult,
  ): void {
    // 只在有 bookmarkId 时发布事件
    if (!bookmarkId) return;

    // 映射 ClassificationAction 到事件 action
    const mapAction = (
      action: string,
    ): "classify" | "inbox" | "create_folder" => {
      if (action === "inbox") return "inbox";
      if (
        action === "suggest_create" ||
        action === "suggest_new" ||
        action === "auto_create"
      ) {
        return "create_folder";
      }
      return "classify";
    };

    eventBus.emit(ClassificationEvents.BOOKMARK_CLASSIFIED, {
      userId,
      bookmarkId,
      folderId: result.folderId,
      folderName: result.folderName,
      confidence: result.confidence,
      action: mapAction(result.action),
      timestamp: new Date().toISOString(),
    });
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
      folderName: INBOX_FOLDER_NAME,
      confidence: 0,
      action: "inbox",
      reason,
      executionTime: Math.round(performance.now() - startTime),
    };
  }

  /**
   * 截断标题用于日志（隐私保护）
   */
  private truncateTitle(title: string | undefined): string {
    if (!title) return "";
    return title.length > LOG_TITLE_MAX_LENGTH
      ? `${title.slice(0, LOG_TITLE_MAX_LENGTH)}...`
      : title;
  }

  /**
   * 根据精确名称查找现有文件夹，用于判断 AI 是否复用了已有名称
   * 返回 null 表示未找到（需要新建）
   */
  private async findExistingFolderByName(
    userId: string,
    name: string,
  ): Promise<{ id: number; name: string } | null> {
    try {
      const { data, error } = await this.supabase
        .from("folders")
        .select("id, name")
        .eq("user_id", userId)
        .eq("name", name)
        .is("deleted_at", null)
        .eq("is_system", false)
        .limit(1)
        .single();

      if (error || !data) return null;
      return data as { id: number; name: string };
    } catch {
      return null;
    }
  }

  /**
   * Phase 2: 获取近期（WINDOW_HOURS 内）创建的文件夹名列表
   * 用于注入 AI 命名 Prompt，引导 AI 在同主题时复用已有名称
   */
  private async getRecentFolderNames(userId: string): Promise<string[]> {
    try {
      const windowMs = RECENT_FOLDER_DEDUP.WINDOW_HOURS * 60 * 60 * 1000;
      const since = new Date(Date.now() - windowMs).toISOString();

      const { data, error } = await this.supabase
        .from("folders")
        .select("name")
        .eq("user_id", userId)
        .is("deleted_at", null)
        .eq("is_system", false)
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(RECENT_FOLDER_DEDUP.MAX_PROMPT_FOLDERS);

      if (error) {
        logger.warn(
          { error: error.message, userId },
          "[SimpleClassification] Failed to fetch recent folders for prompt",
        );
        return [];
      }

      return (data || []).map((f) => f.name).filter(Boolean);
    } catch {
      return [];
    }
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
