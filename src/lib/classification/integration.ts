/**
 * Classification V2 Integration Layer
 * Integrates the V2 classification service with the existing bookmark creation flow
 *
 * @version 1.1.0
 * @updated 2025-12-25 模块拆分重构
 */

import { z } from "zod";
import { ClassificationContainer } from "./container";
import { createSimpleClassificationService } from "./services/simple-classification.service";
import { FOLDER_LIMITS } from "./constants";
import { CONFIDENCE_THRESHOLDS } from "./types/classification-status";
import { logger } from "@/lib/logger";
import { MessageService } from "@/lib/messages/server";
import { confirmationService } from "@/lib/confirmation";
import { trustModeService } from "@/lib/trust-mode/trust-mode.service";
import {
  learningEventHandler,
  initializeLearningEventHandler,
} from "./learning/learning-event-handler";
import type { ClassificationResult, BookmarkInput } from "./types";
import type { ClassificationSuggestion } from "@/types/confirmation";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

// 导入提取的模块
import { updateFolderProfileAfterClassification as updateFolderProfile } from "./folder-profile-manager";
import { updateBookmarkClassificationStatus } from "./classification-status";

// 重新导出提取的函数（保持 API 兼容性）
export {
  updateFolderProfileAfterClassification,
  updateFolderProfilesOnBookmarkChange,
  initializeFolderNameProfile,
} from "./folder-profile-manager";

// ============================================================================
// 学习事件处理器懒初始化
// ============================================================================

/**
 * 确保学习事件处理器已初始化（懒加载模式）
 * 在 serverless 环境中，每个实例需要独立初始化
 */
function ensureLearningHandlerInitialized(): void {
  if (!learningEventHandler.isActive()) {
    initializeLearningEventHandler({
      enableNegativeSampling: true,
      enablePreferenceLearning: true,
      learnInManualMode: false,
      bulkOperationThreshold: 3,
    });
    logger.info("Classification: Learning event handler lazily initialized");
  }
}

// V4.2.7: 使用统一的置信度阈值配置
const AUTO_CLASSIFY_THRESHOLD = CONFIDENCE_THRESHOLDS.AUTO_CLASSIFY;
const SUGGEST_THRESHOLD = CONFIDENCE_THRESHOLDS.SUGGEST;

/**
 * V5 透传模式开关
 * 启用后，V5 的置信度不再进行非线性重映射，直接使用原始值
 * 减少 V2 集成层对 V5 结果的干扰
 *
 * @default true (默认启用透传模式)
 */
function isV5PassthroughEnabled(): boolean {
  return process.env.V5_PASSTHROUGH_MODE !== "false";
}

/**
 * 获取当前分类系统版本
 * 通过环境变量 CLASSIFICATION_VERSION 控制
 * - "v3": 使用 V3 ClassificationService（5层匹配器）
 * - "v4.1": 使用 V4.1 SimpleClassificationService
 * - "v5.0": 使用 V5.0 ClassificationPipeline（L0+T0+T1 三层架构）【默认】
 *
 * v5.1 修复: 默认使用 V5.0，除非显式设置其他版本
 */
export function getClassificationVersion(): "v3" | "v4.1" | "v5.0" {
  const version = process.env.CLASSIFICATION_VERSION;
  if (version === "v3") {
    return "v3";
  }
  if (version === "v4.1") {
    return "v4.1";
  }
  // v5.1 修复: 默认使用 V5.0
  return "v5.0";
}

/**
 * Input validation schema for classifyBookmarkV2
 */
const classifyBookmarkInputSchema = z.object({
  bookmarkId: z
    .number()
    .int()
    .positive("Bookmark ID must be a positive integer"),
  title: z.string().min(1, "Title is required").max(500, "Title too long"),
  summary: z.string().max(2000, "Summary too long").nullable(),
  tags: z.array(z.string().max(100)).max(50, "Too many tags"),
  userId: z.string().uuid("Invalid user ID format"),
});

/**
 * Process bookmark classification using V2 system
 * Replaces the legacy processAIFolderRecommendation function
 */
export async function classifyBookmarkV2(
  bookmarkId: number,
  title: string,
  summary: string | null,
  tags: string[],
  userId: string,
): Promise<{
  classified: boolean;
  folderId: number | null;
  folderName: string | null;
  confidence: number;
  action: ClassificationResult["action"];
  suggestionId?: number;
}> {
  // Input validation
  const validationResult = classifyBookmarkInputSchema.safeParse({
    bookmarkId,
    title,
    summary,
    tags,
    userId,
  });

  if (!validationResult.success) {
    const errorMessage = validationResult.error.issues
      .map((e) => `${e.path.join(".")}: ${e.message}`)
      .join("; ");

    logger.error(
      { bookmarkId, userId, validationErrors: validationResult.error.issues },
      `Classification V2: Input validation failed - ${errorMessage}`,
    );

    return {
      classified: false,
      folderId: null,
      folderName: null,
      confidence: 0,
      action: "inbox",
    };
  }

  try {
    // P0 Fix: 确保学习事件处理器已初始化
    ensureLearningHandlerInitialized();

    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();

    // 获取分类版本
    const classificationVersion = getClassificationVersion();

    // Prepare bookmark input
    const bookmarkInput: BookmarkInput = {
      id: bookmarkId, // 传入 ID 用于排除自匹配
      title,
      summary: summary || undefined,
      tags,
    };

    // Run classification based on version
    let result: ClassificationResult;

    if (classificationVersion === "v4.1") {
      // V4.1: 使用 SimpleClassificationService（统一向量搜索，支持冷启动）
      const simpleService = createSimpleClassificationService(
        supabase as SupabaseClient<Database>,
      );
      const simpleResult = await simpleService.classify(userId, {
        title,
        summary: summary || undefined,
        tags,
        url: undefined, // URL 在此上下文不可用
      });

      // 转换 SimpleClassificationResult 到 ClassificationResult
      result = {
        folderId: simpleResult.folderId,
        folderName: simpleResult.folderName,
        confidence: simpleResult.confidence,
        reason: simpleResult.reason,
        action: simpleResult.action as ClassificationResult["action"],
        scores: {
          vectorScore: simpleResult.confidence,
          historyScore: 0,
          aiScore:
            simpleResult.matchType === "ai_select"
              ? simpleResult.confidence
              : 0,
        },
      };

      logger.info(
        {
          version: "v4.1",
          bookmarkId,
          title: title.substring(0, 30),
          action: result.action,
          confidence: result.confidence,
          matchType: simpleResult.matchType,
          executionTime: simpleResult.executionTime,
        },
        "Classification V4.1: Result received",
      );
    } else if (classificationVersion === "v5.0") {
      // V5.0: 使用 ClassificationPipeline（L0+T0+T1 三层架构）
      const { FeatureFlagService } = await import(
        "@/lib/classification/v5/rollout/feature-flag"
      );

      // 检查 Feature Flag
      const { RolloutStage } = await import(
        "@/lib/classification/v5/rollout/feature-flag"
      );

      // v5.2 修复: 将环境变量字符串映射到 RolloutStage 枚举
      // 默认值改为 "full"，确保 V5.0 分类系统默认全量启用
      const stageStr = (process.env.CLASSIFICATION_V5_STAGE ||
        "full") as string;
      let stage: (typeof RolloutStage)[keyof typeof RolloutStage];
      switch (stageStr.toLowerCase()) {
        case "canary":
          stage = RolloutStage.CANARY;
          break;
        case "early":
          stage = RolloutStage.EARLY;
          break;
        case "majority":
          stage = RolloutStage.MAJORITY;
          break;
        case "full":
          stage = RolloutStage.FULL;
          break;
        case "disabled":
          stage = RolloutStage.DISABLED;
          break;
        default:
          // v5.2: 未知值默认使用 FULL，而非 DISABLED
          stage = RolloutStage.FULL;
      }

      // v5.1 修复: 简化 Feature Flag 配置，默认启用 V5.0
      // 只有显式设置 CLASSIFICATION_V5_ENABLED=false 才会禁用
      const isExplicitlyDisabled =
        process.env.CLASSIFICATION_V5_ENABLED === "false";

      const featureFlagConfig = {
        enabled: !isExplicitlyDisabled, // v5.1: 默认启用
        stage,
        percentage: 100, // v5.1: 默认全量发布
        whitelist: [],
        blacklist: [],
      };

      // 只有在非全量模式下才根据 stage 设置 percentage
      if (stage !== RolloutStage.FULL && stage !== RolloutStage.DISABLED) {
        const stagePercentages: Record<string, number> = {
          disabled: 0,
          canary: 5,
          early: 20,
          majority: 50,
          full: 100,
        };
        featureFlagConfig.percentage =
          stagePercentages[featureFlagConfig.stage] || 100;
      }

      const featureFlagService = new FeatureFlagService(featureFlagConfig);
      const isV5Enabled = featureFlagService.isEnabledForUser(userId);

      if (!isV5Enabled) {
        // 降级到 V4.1
        logger.info(
          {
            userId,
            bookmarkId,
            stage: featureFlagConfig.stage,
            reason: "feature_flag_disabled",
          },
          "Classification V5.0: Feature flag disabled, fallback to V4.1",
        );

        // 使用 V4.1 逻辑（复用上面的代码）
        const simpleService = createSimpleClassificationService(
          supabase as SupabaseClient<Database>,
        );
        const simpleResult = await simpleService.classify(userId, {
          title,
          summary: summary || undefined,
          tags,
          url: undefined,
        });

        result = {
          folderId: simpleResult.folderId,
          folderName: simpleResult.folderName,
          confidence: simpleResult.confidence,
          reason: simpleResult.reason,
          action: simpleResult.action as ClassificationResult["action"],
          scores: {
            vectorScore: simpleResult.confidence,
            historyScore: 0,
            aiScore:
              simpleResult.matchType === "ai_select"
                ? simpleResult.confidence
                : 0,
          },
        };
      } else {
        // 使用 V5.0 ClassificationPipeline（通过工厂复用服务实例）
        const { getClassificationPipeline } = await import(
          "@/lib/classification/v5/classification-pipeline/pipeline-factory"
        );

        const pipeline = getClassificationPipeline(
          supabase as SupabaseClient<Database>,
        );

        const v5Request = {
          userId,
          bookmarkId: bookmarkId.toString(),
          title,
          description: summary || undefined,
          summary: summary || undefined,
          tags: tags || [],
          url: "", // URL 在此上下文不可用
        };

        const v5Result = await pipeline.classify(v5Request);

        // v5.2 修复: 转换 V5.0 结果到统一的 ClassificationResult 格式
        // 处理 "inbox" 字符串返回值，避免 parseInt 返回 NaN
        const folderId =
          v5Result.folderId === "inbox"
            ? null
            : parseInt(v5Result.folderId, 10);

        // 如果 folderId 解析失败（NaN），也视为 inbox
        let validFolderId: number | null =
          folderId !== null && !isNaN(folderId) ? folderId : null;

        // 查询并验证文件夹存在性（只有 validFolderId 有效时才查询）
        let folderName: string | null = null;
        if (validFolderId !== null) {
          try {
            const { data: folderData, error: folderError } = await supabase
              .from("folders")
              .select("name")
              .eq("id", validFolderId)
              .eq("user_id", userId) // 确保是用户自己的文件夹
              .single();

            if (folderError || !folderData) {
              logger.warn(
                { folderId: validFolderId, error: folderError },
                "Classification V5.0: Folder not found or deleted, falling back to inbox",
              );
              // 文件夹不存在，重置为 inbox
              validFolderId = null;
            } else {
              folderName = folderData.name;
            }
          } catch (error) {
            logger.warn(
              { folderId: validFolderId, error },
              "Classification V5.0: Failed to verify folder existence",
            );
            validFolderId = null;
          }
        }

        // V5.2: 透传模式 - 基于 V5 的 needsT1/usedT1 决策，而非向量相似度
        // V5 的 confidence 是向量相似度（范围 0.25-0.45），不是置信度
        // V5 的决策逻辑：needsT1=false 表示 T0 结果可信，应直接分类
        let confidencePercent: number;
        let action: "classify" | "suggest" | "inbox";

        if (isV5PassthroughEnabled()) {
          // 透传模式：直接使用 V5 的决策逻辑
          if (validFolderId === null) {
            // 无有效文件夹 → inbox
            action = "inbox";
            confidencePercent = Math.round(v5Result.confidence * 100);
          } else if (v5Result.usedT1) {
            // T1 纠正后的结果 → 高置信度分类
            action = "classify";
            confidencePercent = 90;
          } else {
            // T0 直接通过（needsT1=false），V5 认为结果可信 → 分类
            action = "classify";
            confidencePercent = 85;
          }

          logger.debug(
            {
              mode: "passthrough",
              originalSimilarity: v5Result.confidence,
              confidencePercent,
              usedT1: v5Result.usedT1,
              v5Decision: action,
              folderId: validFolderId,
            },
            "V5 Passthrough: Using V5 decision (needsT1/usedT1)",
          );
        } else {
          // 兼容模式：保留旧的非线性映射（逐步废弃）
          const remapV5Confidence = (similarity: number): number => {
            const MIN_SIM = 0.25;
            const MAX_SIM = 0.45;
            const MIN_CONF = 65;
            const MAX_CONF = 100;

            if (similarity < MIN_SIM) return similarity * 100;
            if (similarity > MAX_SIM) return MAX_CONF;

            return (
              ((similarity - MIN_SIM) / (MAX_SIM - MIN_SIM)) *
                (MAX_CONF - MIN_CONF) +
              MIN_CONF
            );
          };
          confidencePercent = remapV5Confidence(v5Result.confidence);

          // 旧逻辑：基于映射后的置信度计算 action
          action =
            validFolderId === null
              ? "inbox"
              : confidencePercent >= AUTO_CLASSIFY_THRESHOLD
                ? "classify"
                : confidencePercent >= SUGGEST_THRESHOLD
                  ? "suggest"
                  : "inbox";

          logger.debug(
            {
              mode: "legacy-remap",
              originalConfidence: v5Result.confidence,
              confidencePercent,
            },
            "V5 Legacy: Using non-linear remapping (deprecated)",
          );
        }

        result = {
          folderId: validFolderId,
          folderName: folderName ?? "",
          confidence: confidencePercent, // 存储为百分比格式，与系统其他部分保持一致
          reason:
            validFolderId === null
              ? "无匹配文件夹，保留在待整理"
              : v5Result.usedT1
                ? `T1 纠正: ${v5Result.reasoning || "LLM 推理"}`
                : "T0 快速生成",
          action,
          scores: {
            vectorScore: confidencePercent,
            historyScore: 0,
            aiScore: v5Result.usedT1 ? confidencePercent : 0,
          },
        };

        logger.info(
          {
            version: "v5.0",
            bookmarkId,
            title: title.substring(0, 30),
            action: result.action,
            confidence: result.confidence,
            usedT1: v5Result.usedT1,
            totalLatencyMs: v5Result.totalLatencyMs,
            t0LatencyMs: v5Result.t0LatencyMs,
            t1LatencyMs: v5Result.t1LatencyMs,
          },
          "Classification V5.0: Result received",
        );
      }
    } else {
      // V3: 使用 ClassificationContainer（5层匹配器）
      const container = ClassificationContainer.initialize(supabase);
      const classificationService = container.getClassificationService();
      result = await classificationService.classify(userId, bookmarkInput);

      logger.info(
        {
          version: "v3",
          bookmarkId,
          title: title.substring(0, 30),
          action: result.action,
          confidence: result.confidence,
          scores: result.scores,
        },
        "Classification V3: Result received",
      );
    }

    // Handle result based on action and confidence
    if (result.action === "classify" && result.folderId) {
      // V4.2.21: 首先检查托管模式，manual 模式下不自动分类
      const trustMode = await trustModeService.getUserTrustMode(userId);

      // Manual 模式：所有置信度都创建确认消息，不自动分类
      if (trustMode === "manual") {
        logger.info(
          {
            bookmarkId,
            confidence: result.confidence,
            trustMode: "manual",
          },
          "Classification V2: Manual mode - skipping auto-classify, creating confirmation",
        );
        // 跳过自动分类，进入中等置信度的确认消息创建流程
        // 注意：这里不 return，让代码继续执行到下面的确认消息创建逻辑
      }

      // High confidence - auto-classify (仅 full_auto 和 semi_auto 模式)
      if (
        result.confidence >= AUTO_CLASSIFY_THRESHOLD &&
        trustMode !== "manual"
      ) {
        // Move bookmark to classified folder and clear pending cluster status
        // Note: pending_cluster, pending_since, cluster_id, cluster_confidence 是 V4.2 新增字段
        const { error: moveError } = await supabase
          .from("bookmarks")
          .update({
            folder_id: result.folderId,
            // V4.2: 清除待聚类状态
            pending_cluster: false,
            pending_since: null,
            cluster_id: null,
            cluster_confidence: null,
          })
          .eq("id", bookmarkId)
          .eq("user_id", userId);

        if (moveError) {
          logger.error(
            { error: moveError, bookmarkId, folderId: result.folderId },
            "Classification V2: Failed to move bookmark",
          );
          return {
            classified: false,
            folderId: null,
            folderName: null,
            confidence: result.confidence,
            action: "inbox",
          };
        }

        logger.info(
          {
            bookmarkId,
            folderId: result.folderId,
            folderName: result.folderName,
            confidence: result.confidence,
          },
          "Classification V2: Auto-classified (high confidence)",
        );

        // 发送自动分类完成消息（静默级别）
        await MessageService.notifyClassificationComplete(
          userId,
          bookmarkId,
          result.folderName || "未知文件夹",
          result.confidence,
          true, // isAuto = true
        ).catch((err) => {
          logger.warn(
            { error: err },
            "Failed to create classification message",
          );
        });

        // V3.1: Write classification status for frontend polling
        await updateBookmarkClassificationStatus(
          supabase,
          bookmarkId,
          userId,
          "classified",
          {
            folderId: result.folderId,
            folderName: result.folderName,
            confidence: result.confidence,
            action: "classify",
            timestamp: new Date().toISOString(),
            reason: result.reason,
          },
        );

        // V4.2.7: 同步更新文件夹 Profile（确保后续分类使用最新数据）
        // 对于高置信度分类，同步等待 Profile 更新完成
        try {
          await updateFolderProfile(result.folderId, userId);
          logger.debug(
            { folderId: result.folderId, bookmarkId },
            "Classification V2: Folder profile updated synchronously",
          );
        } catch (profileErr) {
          // Profile 更新失败不应阻止分类返回，只记录警告
          logger.warn(
            {
              error:
                profileErr instanceof Error
                  ? profileErr.message
                  : String(profileErr),
              folderId: result.folderId,
            },
            "Classification V2: Folder profile update failed (non-blocking)",
          );
        }

        return {
          classified: true,
          folderId: result.folderId,
          folderName: result.folderName,
          confidence: result.confidence,
          action: "classify",
        };
      }

      // Medium confidence - check trust mode before deciding action
      // 注意：高置信度 >= 80% 在 manual 模式下也会进入这里，因为跳过了自动分类
      if (result.confidence >= SUGGEST_THRESHOLD) {
        // V4.2.21: trustMode 已在上面获取，无需重复调用
        // const trustMode = await trustModeService.getUserTrustMode(userId);

        if (trustMode === "full_auto" && result.folderId) {
          // Full Auto 模式：中等置信度也直接自动分类，不创建确认消息
          const { error: moveError } = await supabase
            .from("bookmarks")
            .update({
              folder_id: result.folderId,
              // V4.2.28: 清除待聚类状态（修复"AI整理中"始终显示的问题）
              pending_cluster: false,
              pending_since: null,
              cluster_id: null,
              cluster_confidence: null,
            })
            .eq("id", bookmarkId)
            .eq("user_id", userId); // V4.2.20: 添加 user_id 条件，确保 RLS 正确工作

          if (moveError) {
            logger.error(
              { error: moveError, bookmarkId, folderId: result.folderId },
              "Classification V2: Failed to auto-classify (full_auto, medium confidence)",
            );
            // V4.2.20: 移动失败时返回，不继续创建确认消息
            return {
              classified: false,
              folderId: null,
              folderName: null,
              confidence: result.confidence,
              action: "inbox",
            };
          }

          // 移动成功，记录日志并返回
          logger.info(
            {
              bookmarkId,
              folderId: result.folderId,
              folderName: result.folderName,
              confidence: result.confidence,
              trustMode: "full_auto",
            },
            "Classification V2: Auto-classified (full_auto mode, medium confidence)",
          );

          // 发送自动分类完成消息（静默级别）
          await MessageService.notifyClassificationComplete(
            userId,
            bookmarkId,
            result.folderName || "未知文件夹",
            result.confidence,
            true, // isAuto = true
          ).catch((err) => {
            logger.warn(
              { error: err },
              "Failed to create classification message",
            );
          });

          // 更新分类状态
          await updateBookmarkClassificationStatus(
            supabase,
            bookmarkId,
            userId,
            "classified",
            {
              folderId: result.folderId,
              folderName: result.folderName,
              confidence: result.confidence,
              action: "classify",
              timestamp: new Date().toISOString(),
              reason: `${result.reason || ""} (full_auto mode)`,
            },
          );

          return {
            classified: true,
            folderId: result.folderId,
            folderName: result.folderName,
            confidence: result.confidence,
            action: "classify",
          };
        }

        // Semi-auto 或 Manual 模式：创建确认消息
        const { data: suggestion, error: suggestionError } = await supabase
          .from("classification_suggestions")
          .insert({
            user_id: userId,
            bookmark_id: bookmarkId,
            suggested_folder_id: result.folderId,
            suggested_folder_name: result.folderName,
            suggest_new_folder: false,
            confidence: result.confidence,
            reason: result.reason,
            status: "pending",
            batch_id: crypto.randomUUID(),
          })
          .select("id")
          .single();

        if (!suggestionError && suggestion) {
          logger.info(
            {
              bookmarkId,
              suggestionId: suggestion.id,
              folderId: result.folderId,
              folderName: result.folderName,
              confidence: result.confidence,
              trustMode,
            },
            "Classification V2: Saved suggestion (medium confidence)",
          );

          // V4.2: 仅在非 full_auto 模式下创建待确认记录
          if (trustMode !== "full_auto") {
            // 获取书签 URL 用于确认消息展示
            const { data: bookmarkData } = await supabase
              .from("bookmarks")
              .select("url")
              .eq("id", bookmarkId)
              .single();

            const confirmationSuggestion: ClassificationSuggestion = {
              folderId: result.folderId,
              folderName: result.folderName,
              confidence: Math.round(result.confidence),
              reason: result.reason || "基于内容相似度匹配",
              alternatives: [],
            };

            await confirmationService
              .createClassificationConfirmation({
                userId,
                bookmarkId,
                bookmarkTitle: title,
                bookmarkUrl: bookmarkData?.url || "",
                suggestion: confirmationSuggestion,
              })
              .catch((err) => {
                logger.warn(
                  { error: err },
                  "Failed to create classification confirmation",
                );
              });
          }

          // V3.1: Write classification status for frontend polling
          await updateBookmarkClassificationStatus(
            supabase,
            bookmarkId,
            userId,
            "suggested",
            {
              folderId: result.folderId,
              folderName: result.folderName,
              confidence: result.confidence,
              action: "classify",
              suggestionId: suggestion.id,
              timestamp: new Date().toISOString(),
              reason: result.reason,
            },
          );

          // V4.2.28: 创建建议后清除 pending_cluster（有建议就不需要继续"整理中"）
          await supabase
            .from("bookmarks")
            .update({
              pending_cluster: false,
              pending_since: null,
            })
            .eq("id", bookmarkId)
            .eq("user_id", userId);

          return {
            classified: false,
            folderId: result.folderId,
            folderName: result.folderName,
            confidence: result.confidence,
            action: "classify",
            suggestionId: suggestion.id,
          };
        }
      }
    }

    // Handle suggest_new action
    if (result.action === "suggest_new" && result.folderName) {
      // Check daily folder creation limit
      const today = new Date().toISOString().split("T")[0];
      const { count: todayCount } = await supabase
        .from("folders")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .gte("created_at", `${today}T00:00:00Z`)
        .lt("created_at", `${today}T23:59:59Z`);

      if ((todayCount || 0) >= FOLDER_LIMITS.MAX_AUTO_CREATE_PER_DAY) {
        logger.warn(
          { userId, todayCount },
          "Classification V2: Daily folder creation limit reached",
        );
        // Save as suggestion instead
        const { data: suggestion, error: suggestionError } = await supabase
          .from("classification_suggestions")
          .insert({
            user_id: userId,
            bookmark_id: bookmarkId,
            suggested_folder_id: null,
            suggested_folder_name: result.folderName,
            suggest_new_folder: true,
            confidence: result.confidence,
            reason: result.reason || "Suggest creating new folder",
            status: "pending",
            batch_id: crypto.randomUUID(),
          })
          .select("id")
          .single();

        if (!suggestionError && suggestion) {
          // V3.1: Write classification status for frontend polling
          await updateBookmarkClassificationStatus(
            supabase,
            bookmarkId,
            userId,
            "suggested",
            {
              folderId: null,
              folderName: result.folderName,
              confidence: result.confidence,
              action: "suggest_new",
              suggestionId: suggestion.id,
              timestamp: new Date().toISOString(),
              reason: "每日文件夹创建数量已达上限",
            },
          );

          // V4.2.28: 清除 pending_cluster 状态
          await supabase
            .from("bookmarks")
            .update({
              pending_cluster: false,
              pending_since: null,
            })
            .eq("id", bookmarkId)
            .eq("user_id", userId);

          return {
            classified: false,
            folderId: null,
            folderName: result.folderName,
            confidence: result.confidence,
            action: "suggest_new",
            suggestionId: suggestion.id,
          };
        }
      }

      // High confidence - auto-create folder
      if (result.confidence >= AUTO_CLASSIFY_THRESHOLD) {
        // Create new folder
        const { data: newFolder, error: createError } = await supabase
          .from("folders")
          .insert({
            user_id: userId,
            name: result.folderName,
            sort_order: 0,
          })
          .select("id")
          .single();

        if (!createError && newFolder) {
          // Move bookmark to new folder and clear pending cluster status
          // Note: pending_cluster, pending_since, cluster_id, cluster_confidence 是 V4.2 新增字段
          const { error: moveError } = await supabase
            .from("bookmarks")
            .update({
              folder_id: newFolder.id,
              // V4.2: 清除待聚类状态
              pending_cluster: false,
              pending_since: null,
              cluster_id: null,
              cluster_confidence: null,
            })
            .eq("id", bookmarkId)
            .eq("user_id", userId);

          if (!moveError) {
            logger.info(
              {
                bookmarkId,
                folderId: newFolder.id,
                folderName: result.folderName,
                confidence: result.confidence,
              },
              "Classification V2: Created new folder and classified",
            );

            // V3.1: Write classification status for frontend polling
            await updateBookmarkClassificationStatus(
              supabase,
              bookmarkId,
              userId,
              "classified",
              {
                folderId: newFolder.id,
                folderName: result.folderName,
                confidence: result.confidence,
                action: "suggest_new",
                timestamp: new Date().toISOString(),
                reason: "创建新文件夹并归类",
              },
            );

            return {
              classified: true,
              folderId: newFolder.id,
              folderName: result.folderName,
              confidence: result.confidence,
              action: "suggest_new",
            };
          }
        }
      }

      // Medium confidence - save suggestion for new folder
      if (result.confidence >= SUGGEST_THRESHOLD) {
        const { data: suggestion, error: suggestionError } = await supabase
          .from("classification_suggestions")
          .insert({
            user_id: userId,
            bookmark_id: bookmarkId,
            suggested_folder_id: null,
            suggested_folder_name: result.folderName,
            suggest_new_folder: true,
            confidence: result.confidence,
            reason: result.reason || "Suggest creating new folder",
            status: "pending",
            batch_id: crypto.randomUUID(),
          })
          .select("id")
          .single();

        if (!suggestionError && suggestion) {
          logger.info(
            {
              bookmarkId,
              suggestionId: suggestion.id,
              folderName: result.folderName,
              confidence: result.confidence,
            },
            "Classification V2: Saved new folder suggestion",
          );

          // V3.1: Write classification status for frontend polling
          await updateBookmarkClassificationStatus(
            supabase,
            bookmarkId,
            userId,
            "suggested",
            {
              folderId: null,
              folderName: result.folderName,
              confidence: result.confidence,
              action: "suggest_new",
              suggestionId: suggestion.id,
              timestamp: new Date().toISOString(),
              reason: result.reason || "建议创建新文件夹",
            },
          );

          // V4.2.28: 清除 pending_cluster 状态
          await supabase
            .from("bookmarks")
            .update({
              pending_cluster: false,
              pending_since: null,
            })
            .eq("id", bookmarkId)
            .eq("user_id", userId);

          return {
            classified: false,
            folderId: null,
            folderName: result.folderName,
            confidence: result.confidence,
            action: "suggest_new",
            suggestionId: suggestion.id,
          };
        }
      }
    }

    // Low confidence or inbox action - stay in inbox
    logger.info(
      {
        bookmarkId,
        confidence: result.confidence,
        action: result.action,
      },
      "Classification V2: Staying in inbox (low confidence)",
    );

    // V4.2: 标记为待聚类状态，等待智能分拣处理
    // Note: pending_cluster, pending_since 是 V4.2 新增字段
    await supabase
      .from("bookmarks")
      .update({
        pending_cluster: true,
        pending_since: new Date().toISOString(),
      })
      .eq("id", bookmarkId)
      .eq("user_id", userId);

    logger.info(
      { bookmarkId, userId },
      "Classification V4.2: Marked as pending cluster for smart sorting",
    );

    // V3.1: Write classification status for frontend polling
    await updateBookmarkClassificationStatus(
      supabase,
      bookmarkId,
      userId,
      "inbox",
      {
        folderId: null,
        folderName: "待整理",
        confidence: result.confidence,
        action: "inbox",
        timestamp: new Date().toISOString(),
        reason: `置信度 ${result.confidence}% 低于阈值`,
      },
    );

    return {
      classified: false,
      folderId: null,
      folderName: null,
      confidence: result.confidence,
      action: "inbox",
    };
  } catch (error) {
    logger.error(
      {
        bookmarkId,
        error: error instanceof Error ? error.message : String(error),
      },
      "Classification V2: Failed",
    );

    return {
      classified: false,
      folderId: null,
      folderName: null,
      confidence: 0,
      action: "inbox",
    };
  }
}

/**
 * Check if V2 classification system should be used
 * Can be controlled via feature flag or environment variable
 */
export function shouldUseV2Classification(): boolean {
  // Default to V2 enabled
  // Can be overridden via environment variable
  const v2Enabled = process.env.CLASSIFICATION_V2_ENABLED;
  return v2Enabled !== "false";
}
