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
 * 获取当前分类系统版本
 * 通过环境变量 CLASSIFICATION_VERSION 控制
 * - "v3": 使用 V3 ClassificationService（5层匹配器）
 * - "v4.1": 使用 V4.1 SimpleClassificationService（默认）
 * - "v5.0": 使用 V5.0 ClassificationPipeline（L0+T0+T1 三层架构）
 */
export function getClassificationVersion(): "v3" | "v4.1" | "v5.0" {
  const version = process.env.CLASSIFICATION_VERSION;
  if (version === "v3") {
    return "v3";
  }
  if (version === "v5.0") {
    return "v5.0";
  }
  return "v4.1"; // 默认使用 V4.1
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
      const { ClassificationPipelineService } = await import(
        "@/lib/classification/v5/classification-pipeline/classification-pipeline.service"
      );
      const { LoggerService } = await import(
        "@/lib/classification/v5/shared/logger"
      );
      const { DashScopeEmbeddingAdapter } = await import(
        "@/lib/classification/v5/shared/embedding/dashscope-embedding-adapter"
      );
      const { VectorSearchService } = await import(
        "@/lib/classification/v5/shared/vector-search"
      );
      const { LLMService } = await import("@/lib/classification/v5/shared/llm");

      // 检查 Feature Flag
      const { RolloutStage } = await import(
        "@/lib/classification/v5/rollout/feature-flag"
      );

      // 将环境变量字符串映射到 RolloutStage 枚举
      const stageStr = (process.env.CLASSIFICATION_V5_STAGE ||
        "disabled") as string;
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
        default:
          stage = RolloutStage.DISABLED;
      }

      const featureFlagConfig = {
        enabled: process.env.CLASSIFICATION_V5_ENABLED === "true",
        stage,
        percentage: 0,
        whitelist: [],
        blacklist: [],
      };

      // 根据 stage 设置 percentage
      const stagePercentages: Record<string, number> = {
        disabled: 0,
        canary: 5,
        early: 20,
        majority: 50,
        full: 100,
      };
      featureFlagConfig.percentage =
        stagePercentages[featureFlagConfig.stage] || 0;

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
        // 使用 V5.0 ClassificationPipeline
        const loggerService = new LoggerService();
        const embeddingService = new DashScopeEmbeddingAdapter(
          loggerService,
          60, // 阿里云 QPM 限制
        );
        const vectorSearchService = new VectorSearchService(loggerService, {
          supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
          supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
        });
        const llmService = new LLMService(loggerService);

        const pipeline = new ClassificationPipelineService(
          loggerService,
          embeddingService,
          vectorSearchService,
          llmService,
          {
            t0ConfidenceThreshold: 0.85,
            vectorConflictThreshold: 0.15,
            hybridWeights: {
              content: 0.7,
              behavior: 0.3,
            },
            rrfK: 60,
          },
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

        // 转换 V5.0 结果到统一的 ClassificationResult 格式
        const folderId = parseInt(v5Result.folderId, 10);

        // 查询文件夹名称
        let folderName: string | null = null;
        try {
          const { data: folderData } = await supabase
            .from("folders")
            .select("name")
            .eq("id", folderId)
            .single();
          folderName = folderData?.name || null;
        } catch (error) {
          logger.warn(
            { folderId, error },
            "Failed to fetch folder name for V5.0 result",
          );
        }

        // V5.0 返回的置信度是 0-1 范围，需要转换为 0-100 百分比与阈值比较
        const confidencePercent = v5Result.confidence * 100;

        result = {
          folderId,
          folderName: folderName ?? "",
          confidence: confidencePercent, // 存储为百分比格式，与系统其他部分保持一致
          reason: v5Result.usedT1
            ? `T1 纠正: ${v5Result.reasoning || "LLM 推理"}`
            : "T0 快速生成",
          action:
            confidencePercent >= AUTO_CLASSIFY_THRESHOLD
              ? "classify"
              : confidencePercent >= SUGGEST_THRESHOLD
                ? "suggest"
                : "inbox",
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
            .update({ folder_id: result.folderId })
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
