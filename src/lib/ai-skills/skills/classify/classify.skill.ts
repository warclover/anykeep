/**
 * ClassifySkill - 内容分类技能
 *
 * 功能：
 * - 根据书签内容智能推荐文件夹
 * - 支持向量匹配、标签增强、AI 选择
 * - 冷启动时使用名称匹配
 * - 支持 v5.0 三层分类架构（L0+T0+T1）
 *
 * @version 1.1.0 - 集成 v5.0 分类系统
 * @since 2025-12-22
 * @updated 2026-01-19
 */

import { z } from "zod";
import { BaseSkill } from "../../core/base-skill";
import type { SkillMetadata, SkillContext } from "../../core/types";
import type {
  ClassifySkillInput,
  ClassifySkillOutput,
  ClassifyCandidateFolder,
} from "./types";
import type { ClassificationAction } from "@/lib/classification/types/classification";
import { createClient } from "@/lib/supabase/server";
import { createSimpleClassificationService } from "@/lib/classification/services/simple-classification.service";
import { getClassificationVersion } from "@/lib/classification/integration";
import { logger } from "@/lib/logger";

/**
 * 输入 Schema
 */
const ClassifyInputSchema = z.object({
  bookmarkId: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("书签ID，用于更新已有书签的分类"),
  title: z
    .string()
    .min(1, "标题不能为空")
    .max(500, "标题不能超过500字符")
    .describe("书签标题，用于分类分析"),
  summary: z
    .string()
    .max(2000, "摘要不能超过2000字符")
    .optional()
    .describe("书签摘要或内容描述"),
  tags: z
    .array(z.string().max(50))
    .max(20)
    .optional()
    .describe("书签标签列表，用于标签增强匹配"),
  url: z.string().url().optional().describe("书签URL"),
  enableAI: z
    .boolean()
    .optional()
    .default(true)
    .describe("是否启用AI辅助分类，默认开启"),
});

/**
 * 输出 Schema
 */
const ClassifyOutputSchema = z.object({
  folderId: z.number().nullable(),
  folderName: z.string(),
  confidence: z.number().min(0).max(100),
  action: z.enum([
    "classify",
    "inbox",
    "suggest",
    "suggest_new",
    "suggest_create",
    "auto_create",
  ]),
  reason: z.string(),
  candidates: z.array(
    z.object({
      folderId: z.number(),
      folderName: z.string(),
      score: z.number(),
      matchType: z.enum(["profile", "name", "ai_select", "ai_create"]),
      topTags: z.array(z.string()),
    }),
  ),
  requiresConfirmation: z.boolean(),
  matchType: z.string().optional(),
});

/**
 * ClassifySkill 实现
 */
export class ClassifySkill extends BaseSkill<
  ClassifySkillInput,
  ClassifySkillOutput
> {
  readonly metadata: SkillMetadata = {
    id: "classify",
    name: "内容分类",
    description:
      "根据书签的标题、摘要和标签，智能推荐最合适的文件夹。支持向量匹配、标签增强和AI辅助选择。当没有合适的文件夹时，会建议创建新文件夹。",
    category: "organizing",
    version: "1.1.0",
    author: "AnyKeep",
    capabilities: [
      "vector-matching",
      "tag-boost",
      "ai-selection",
      "cold-start-support",
      "folder-suggestion",
    ],
    requiresConfirmation: false,
    estimatedDurationMs: 3000,
    maxExecutionTimeMs: 15000,
  };

  readonly inputSchema = ClassifyInputSchema;
  readonly outputSchema = ClassifyOutputSchema;

  /**
   * 执行分类
   */
  protected async executeInternal(
    input: ClassifySkillInput,
    context: SkillContext,
  ): Promise<ClassifySkillOutput> {
    const { title, summary, tags, url, enableAI = true, bookmarkId } = input;

    logger.info(
      {
        skillId: this.metadata.id,
        userId: context.userId,
        title: title.substring(0, 30),
        enableAI,
        bookmarkId,
        traceId: context.traceId,
      },
      "ClassifySkill: Starting classification",
    );

    // 创建 Supabase 客户端
    const supabase = await createClient();

    // 获取分类版本
    const classificationVersion = getClassificationVersion();

    logger.info(
      {
        skillId: this.metadata.id,
        userId: context.userId,
        version: classificationVersion,
        traceId: context.traceId,
      },
      "ClassifySkill: Using classification version",
    );

    // 根据版本选择分类方法
    let result: {
      folderId: number | null;
      folderName: string;
      confidence: number;
      action: string;
      reason: string;
      matchType?: string;
      executionTime?: number;
      candidates?: Array<{
        folderId: number;
        folderName: string;
        score: number;
        matchType?: string;
        topTags?: string[];
      }>;
    };

    if (classificationVersion === "v5.0") {
      // 使用 v5.0 分类系统
      result = await this.classifyWithV5(
        context.userId,
        title,
        summary,
        tags,
        bookmarkId,
        supabase,
      );
    } else {
      // 使用 v4.1 或 v3 分类系统
      const classificationService = createSimpleClassificationService(
        supabase,
        {
          enableAISelection: enableAI,
          enableAICreate: enableAI,
        },
      );

      result = await classificationService.classify(context.userId, {
        id: bookmarkId,
        title,
        summary,
        tags,
        url,
      });
    }

    logger.info(
      {
        skillId: this.metadata.id,
        userId: context.userId,
        version: classificationVersion,
        folderId: result.folderId,
        folderName: result.folderName,
        confidence: result.confidence,
        action: result.action,
        matchType: result.matchType,
        executionTime: result.executionTime,
        traceId: context.traceId,
      },
      "ClassifySkill: Classification completed",
    );

    // 转换候选文件夹格式
    const candidates: ClassifyCandidateFolder[] = (result.candidates || []).map(
      (c) => ({
        folderId: c.folderId,
        folderName: c.folderName,
        score: c.score,
        matchType: (c.matchType ||
          "profile") as ClassifyCandidateFolder["matchType"],
        topTags: c.topTags || [],
      }),
    );

    // 判断是否需要用户确认
    const requiresConfirmation = this.shouldRequireConfirmation(result);

    return {
      folderId: result.folderId,
      folderName: result.folderName,
      confidence: result.confidence,
      action: result.action as ClassificationAction,
      reason: result.reason,
      candidates,
      requiresConfirmation,
      matchType: result.matchType,
    };
  }

  /**
   * 判断是否需要用户确认
   */
  private shouldRequireConfirmation(result: {
    confidence: number;
    action: string;
    folderId: number | null;
  }): boolean {
    // 创建新文件夹时需要确认
    if (result.folderId === null) {
      return true;
    }

    // 低置信度需要确认
    if (result.confidence < 70) {
      return true;
    }

    // inbox 操作需要确认
    if (result.action === "inbox") {
      return true;
    }

    return false;
  }

  /**
   * 使用 v5.0 分类系统进行分类
   * 支持 L0 规则匹配 + T0 快速生成 + T1 深度纠正
   */
  private async classifyWithV5(
    userId: string,
    title: string,
    summary: string | undefined,
    tags: string[] | undefined,
    bookmarkId: number | undefined,
    supabase: Awaited<ReturnType<typeof createClient>>,
  ): Promise<{
    folderId: number | null;
    folderName: string;
    confidence: number;
    action: ClassificationAction;
    reason: string;
    matchType?: string;
    executionTime?: number;
    candidates?: Array<{
      folderId: number;
      folderName: string;
      score: number;
      matchType?: string;
      topTags?: string[];
    }>;
  }> {
    try {
      // 动态导入 v5.0 模块
      const { FeatureFlagService, RolloutStage } = await import(
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
        // 降级到 v4.1
        logger.info(
          {
            userId,
            stage: featureFlagConfig.stage,
            reason: "feature_flag_disabled",
          },
          "ClassifySkill: V5.0 feature flag disabled, fallback to V4.1",
        );

        const classificationService =
          createSimpleClassificationService(supabase);
        return await classificationService.classify(userId, {
          id: bookmarkId,
          title,
          summary,
          tags,
        });
      }

      // 使用 V5.0 ClassificationPipeline
      const loggerService = new LoggerService();
      const embeddingService = new DashScopeEmbeddingAdapter(loggerService);
      const vectorSearchService = new VectorSearchService(loggerService, {
        supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
        supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      });
      const llmService = new LLMService(loggerService);

      // DashScopeEmbeddingAdapter 实现了与 EmbeddingService 相同的接口（duck typing）
      // 但由于类型定义不同，需要使用类型断言来绕过 TypeScript 检查
      const pipeline = new ClassificationPipelineService(
        loggerService,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        embeddingService as any,
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
        bookmarkId: bookmarkId?.toString() || "",
        title,
        description: summary || undefined,
        summary: summary || undefined,
        tags: tags || [],
        url: "",
      };

      const v5Result = await pipeline.classify(v5Request);

      // 转换 V5.0 结果到统一格式
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
          "ClassifySkill: Failed to fetch folder name for V5.0 result",
        );
      }

      // V5.0 返回的置信度是 0-1 范围，需要转换为 0-100 百分比
      const confidencePercent = v5Result.confidence * 100;

      // 置信度阈值（与 integration.ts 保持一致）
      const AUTO_CLASSIFY_THRESHOLD = 80;
      const SUGGEST_THRESHOLD = 60;

      const result = {
        folderId,
        folderName: folderName ?? "",
        confidence: confidencePercent,
        reason: v5Result.usedT1
          ? `T1 纠正: ${v5Result.reasoning || "LLM 推理"}`
          : "T0 快速生成",
        action: (confidencePercent >= AUTO_CLASSIFY_THRESHOLD
          ? "classify"
          : confidencePercent >= SUGGEST_THRESHOLD
            ? "suggest"
            : "inbox") as ClassificationAction,
        matchType: v5Result.usedT1 ? "ai_select" : "profile",
        executionTime: v5Result.totalLatencyMs,
        candidates: [], // v5.0 暂不返回候选列表
      };

      logger.info(
        {
          version: "v5.0",
          userId,
          title: title.substring(0, 30),
          action: result.action,
          confidence: result.confidence,
          usedT1: v5Result.usedT1,
          totalLatencyMs: v5Result.totalLatencyMs,
          t0LatencyMs: v5Result.t0LatencyMs,
          t1LatencyMs: v5Result.t1LatencyMs,
        },
        "ClassifySkill: V5.0 classification completed",
      );

      return result;
    } catch (error) {
      logger.error(
        { error, userId, title: title.substring(0, 30) },
        "ClassifySkill: V5.0 classification failed, fallback to V4.1",
      );

      // 降级到 v4.1
      const classificationService = createSimpleClassificationService(supabase);
      return await classificationService.classify(userId, {
        id: bookmarkId,
        title,
        summary,
        tags,
      });
    }
  }
}

/**
 * 导出单例实例
 */
export const classifySkill = new ClassifySkill();
