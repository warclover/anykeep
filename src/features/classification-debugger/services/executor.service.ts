/**
 * 智能分类调试工具 - 分类执行器
 *
 * V4.2 更新：与生产环境保持一致
 * - V3 使用 ClassificationContainer（与首页分类完全一致）
 * - V4 使用 TieredClassificationService + 动态权重
 * - V4.1 使用 SimpleClassificationService
 *
 * V4 特性：
 * - TieredClassificationService (分层分类)
 * - CorrectionCacheService (纠错缓存)
 * - DynamicWeightsService (动态权重)
 * - RerankerService (语义重排序)
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import type { V3Config } from "@/lib/classification/v3/config";
import type {
  VersionResult,
  DebugBookmarkInput,
  MockFolder,
  MockHistoryItem,
} from "../types";
import type { ClassificationAction } from "@/lib/classification/types/classification";
import type { MatcherContext } from "@/lib/classification/types";
import { logger } from "@/lib/logger";

// V4.2: 简化导入，使用 Container 统一管理
import { WeightedScoreAggregator } from "@/lib/classification/strategies";

// V4.2: 导入 Container 确保与生产一致
import { ClassificationContainer } from "@/lib/classification/container";

// V4 需要生成 embedding
import {
  generateEmbedding,
  buildEmbeddingText,
} from "@/lib/utils/embedding-generator";

// V4 核心服务
import {
  TieredClassificationService,
  type TieredClassificationConfig,
  type TieredResult,
} from "@/lib/classification/v3/services/tiered-classification.service";
import {
  DynamicWeightsService,
  type WeightAdjustmentResult,
} from "@/lib/classification/v3/services/dynamic-weights.service";
// Reranker 可用于后续扩展重排序功能
// import { getReranker } from "@/lib/classification/v3/services/reranker.service";

// V4.1 简化分类服务
import { SimpleClassificationService } from "@/lib/classification/services/simple-classification.service";

/**
 * 执行参数
 */
export interface ExecutionParams {
  bookmark: DebugBookmarkInput;
  userId: string;
  config: Partial<V3Config>;
  folders: MockFolder[];
  history: MockHistoryItem[];
  version: "v3" | "v4" | "v41";
  dryRun: boolean;
}

/**
 * 执行单次分类
 *
 * V3: 使用基础 ClassificationService
 * V4: 使用 TieredClassificationService + 动态权重 + 纠错缓存 + 重排序
 * V4.1: 使用 SimpleClassificationService（统一向量搜索 + 标签增强）
 */
export async function executeClassification(
  supabase: SupabaseClient,
  params: ExecutionParams,
): Promise<VersionResult> {
  const startTime = Date.now();

  logger.debug(
    {
      version: params.version,
      userId: params.userId,
      bookmarkTitle: params.bookmark.title,
      configKeys: Object.keys(params.config),
    },
    "[ClassificationDebugger] Executing classification",
  );

  try {
    // 根据版本选择执行路径
    if (params.version === "v41") {
      return await executeV41Classification(supabase, params, startTime);
    } else if (params.version === "v4") {
      return await executeV4Classification(supabase, params, startTime);
    } else {
      return await executeV3Classification(supabase, params, startTime);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error(
      {
        version: params.version,
        error: errorMessage,
        bookmarkTitle: params.bookmark.title,
      },
      "[ClassificationDebugger] Classification failed",
    );

    return {
      folderId: null,
      folderName: "执行失败",
      confidence: 0,
      reasoning: `分类执行错误: ${errorMessage}`,
      executionTime: Date.now() - startTime,
      tier: "T3",
      action: "inbox",
    };
  }
}

/**
 * V3 分类执行（基础版本）
 *
 * V4.2 更新：使用 ClassificationContainer 确保与生产环境完全一致
 * 这修复了调试工具与首页分类结果不一致的问题
 */
async function executeV3Classification(
  supabase: SupabaseClient,
  params: ExecutionParams,
  startTime: number,
): Promise<VersionResult> {
  // V4.2: 使用 ClassificationContainer（与首页 classifyBookmarkV2 一致）
  const container = ClassificationContainer.initialize(supabase);
  const classificationService = container.getClassificationService();

  logger.debug(
    {
      userId: params.userId,
      title: params.bookmark.title,
      method: "ClassificationContainer",
    },
    "[ClassificationDebugger] V3 using production-consistent Container",
  );

  // 执行分类（与首页完全一致的调用方式）
  const result = await classificationService.classify(params.userId, {
    title: params.bookmark.title,
    summary: params.bookmark.description,
    tags: params.bookmark.tags || [],
    url: params.bookmark.url,
  });

  const executionTime = Date.now() - startTime;
  const tier = determineTier(result.confidence, params.config);

  logger.debug(
    {
      version: "v3",
      folderId: result.folderId,
      folderName: result.folderName,
      confidence: result.confidence,
      tier,
      executionTime,
    },
    "[ClassificationDebugger] V3 classification completed",
  );

  return {
    folderId: result.folderId,
    folderName: result.folderName || "待整理",
    confidence: result.confidence,
    reasoning: result.reason || generateReasoning(result, "v3"),
    executionTime,
    tier,
    action: result.action,
  };
}

/**
 * V4 分类执行（增强版本）
 *
 * V4.2 更新：使用 Container 的 matchers 确保与 V3 一致的基础匹配器
 * 在此基础上叠加 V4 特性：
 * - 纠错缓存（Tier 0）
 * - 分层优化（Tier 1-3）
 * - 动态权重
 * - 语义重排序
 */
async function executeV4Classification(
  supabase: SupabaseClient,
  params: ExecutionParams,
  startTime: number,
): Promise<VersionResult> {
  // V4.2: 使用 Container 获取与 V3 一致的 matchers
  const container = ClassificationContainer.initialize(supabase);

  // 1. 获取动态权重（V4 核心特性）
  let dynamicWeights: WeightAdjustmentResult | null = null;
  if (params.config.enableDynamicWeights !== false) {
    const dynamicWeightsService = new DynamicWeightsService(
      supabase as SupabaseClient<Database>,
    );
    dynamicWeights = await dynamicWeightsService.getWeights(params.userId);

    logger.debug(
      {
        userId: params.userId,
        scenario: dynamicWeights.scenario,
        source: dynamicWeights.source,
        sampleSize: dynamicWeights.sampleSize,
      },
      "[ClassificationDebugger] V4 dynamic weights loaded",
    );
  }

  // V4.2: 使用 Container 的 V3 matchers（与生产一致）
  // 而非手动构建可能不一致的 matchers
  const matchers = container.getV3Matchers();

  logger.debug(
    {
      matcherCount: matchers.length,
      matcherNames: matchers.map((m) => m.name),
    },
    "[ClassificationDebugger] V4 using Container matchers",
  );

  // 3. 创建聚合器
  const aggregator = new WeightedScoreAggregator();

  // 4. 构建 TieredClassificationConfig
  const tieredConfig: Partial<TieredClassificationConfig> = {
    highConfidenceThreshold: params.config.highConfidenceThreshold || 80,
    mediumConfidenceThreshold: params.config.mediumConfidenceThreshold || 60,
    autoCreateConfidenceThreshold:
      params.config.mediumConfidenceThreshold || 50,
    tieredOptimizationEnabled: true,
    metricsEnabled: false, // 调试模式不记录指标
    tracingEnabled: true,
    includeDecisionPath: true, // 调试模式返回完整路径
    correctionCacheEnabled: true, // V4 默认启用纠错缓存
    correctionCacheMinConfidence: 60,
    matcherTimeoutMs: 500,
  };

  // 5. 创建 TieredClassificationService
  const tieredService = new TieredClassificationService(
    supabase as SupabaseClient<Database>,
    matchers,
    aggregator,
    tieredConfig,
  );

  // 6. 生成 embedding（V4 核心修复：必须生成向量才能进行匹配）
  let embedding: number[] = [];
  try {
    const embeddingText = buildEmbeddingText(
      params.bookmark.title,
      params.bookmark.description,
      params.bookmark.tags,
    );
    embedding = await generateEmbedding(embeddingText);

    logger.debug(
      {
        userId: params.userId,
        title: params.bookmark.title,
        embeddingLength: embedding.length,
      },
      "[ClassificationDebugger] V4 embedding generated",
    );
  } catch (error) {
    logger.warn(
      {
        userId: params.userId,
        error: error instanceof Error ? error.message : String(error),
      },
      "[ClassificationDebugger] V4 embedding generation failed",
    );
  }

  // 7. 构建匹配器上下文
  const context: MatcherContext = {
    userId: params.userId,
    title: params.bookmark.title,
    summary: params.bookmark.description || "",
    tags: params.bookmark.tags || [],
    embedding, // 使用生成的 embedding
  };

  // 8. 执行分层分类（使用 classifyWithDetails 获取完整结果）
  const tieredResult: TieredResult = await tieredService.classifyWithDetails(
    params.userId,
    {
      title: params.bookmark.title,
      summary: params.bookmark.description,
      tags: params.bookmark.tags || [],
      url: params.bookmark.url,
    },
    context,
  );

  const result = tieredResult.result;
  const executionTime = Date.now() - startTime;

  // 9. 使用 TieredResult 中的准确信息
  const correctionApplied = tieredResult.cacheHit;
  const actualTier = mapTieredResultTier(tieredResult.tier);

  // 10. 构建 V4 详情（包含完整的分层信息）
  const v4Details: VersionResult["v4Details"] = {
    scenarioWeight: dynamicWeights
      ? calculateScenarioWeight(dynamicWeights)
      : undefined,
    correctionApplied,
    namingEngineUsed: result.action === "suggest_create",
    // 新增：完整的分层执行信息
    tieredDetails: {
      tier: tieredResult.tier,
      aiCalled: tieredResult.aiCalled,
      timings: tieredResult.timings,
      traceId: tieredResult.traceId,
    },
  };

  logger.debug(
    {
      version: "v4",
      folderId: result.folderId,
      folderName: result.folderName,
      confidence: result.confidence,
      tier: actualTier,
      actualTieredTier: tieredResult.tier,
      executionTime,
      correctionApplied,
      aiCalled: tieredResult.aiCalled,
      scenario: dynamicWeights?.scenario,
      timings: tieredResult.timings,
    },
    "[ClassificationDebugger] V4 classification completed",
  );

  return {
    folderId: result.folderId,
    folderName: result.folderName || "待整理",
    confidence: result.confidence,
    reasoning: generateV4Reasoning(
      result,
      dynamicWeights,
      correctionApplied,
      tieredResult,
    ),
    executionTime,
    tier: actualTier,
    action: result.action,
    v4Details,
    decisionPath: result.decisionPath,
  };
}

/**
 * V4.1 分类执行（简化版本）
 *
 * 使用 SimpleClassificationService：
 * - 统一向量搜索（profile + name embedding）
 * - 标签增强（+5%~+15%）
 * - 单阈值决策（70%）
 * - AI 选择题模式
 */
async function executeV41Classification(
  supabase: SupabaseClient,
  params: ExecutionParams,
  startTime: number,
): Promise<VersionResult> {
  // 创建 V4.1 简化分类服务
  const simpleService = new SimpleClassificationService(
    supabase as SupabaseClient<Database>,
    {
      autoClassifyThreshold: 70,
      minMatchThreshold: 40,
      maxCandidates: 5,
      maxTagBoost: 15,
      enableAISelection: true,
      enableAICreate: true,
    },
  );

  // 执行分类
  const result = await simpleService.classify(params.userId, {
    title: params.bookmark.title,
    summary: params.bookmark.description,
    tags: params.bookmark.tags,
    url: params.bookmark.url,
  });

  const executionTime = Date.now() - startTime;

  // 确定分层：V4.1 使用简化分层逻辑
  const tier = determineV41Tier(result.confidence, result.action);

  logger.debug(
    {
      version: "v41",
      folderId: result.folderId,
      folderName: result.folderName,
      confidence: result.confidence,
      tier,
      matchType: result.matchType,
      tagBoost: result.tagBoost,
      executionTime,
    },
    "[ClassificationDebugger] V4.1 classification completed",
  );

  return {
    folderId: result.folderId,
    folderName: result.folderName || "待整理",
    confidence: result.confidence,
    reasoning: generateV41Reasoning(result),
    executionTime,
    tier,
    action: result.action,
    v41Details: {
      matchType: result.matchType as
        | "profile"
        | "name"
        | "ai_select"
        | "ai_create"
        | undefined,
      tagBoost: result.tagBoost,
      candidates: result.candidates?.map((c) => ({
        folderId: c.folderId,
        folderName: c.folderName,
        score: c.score,
        matchType: c.matchType,
        tagBoost: c.tagBoost,
      })),
      aiCalled:
        result.matchType === "ai_select" || result.matchType === "ai_create",
    },
  };
}

/**
 * 确定 V4.1 分层
 */
function determineV41Tier(
  confidence: number,
  action: string,
): "T1" | "T2" | "T3" {
  // V4.1 使用简化的单阈值分层
  if (confidence >= 70) return "T1"; // 高置信度自动归类
  if (action === "classify" && confidence >= 40) return "T2"; // AI 选择完成
  return "T3"; // 需要创建或待整理
}

/**
 * 生成 V4.1 推理说明
 */
function generateV41Reasoning(result: {
  action: string;
  confidence: number;
  folderName?: string;
  matchType?: string;
  tagBoost?: number;
  reason?: string;
}): string {
  const parts: string[] = [];

  // 匹配类型
  if (result.matchType === "profile") {
    parts.push("[V4.1] 内容向量匹配");
  } else if (result.matchType === "name") {
    parts.push("[V4.1] 名称向量匹配(冷启动)");
  } else if (result.matchType === "ai_select") {
    parts.push("[V4.1] AI 选择题");
  } else if (result.matchType === "ai_create") {
    parts.push("[V4.1] AI 创建新文件夹");
  } else {
    parts.push("[V4.1]");
  }

  // 分类结果
  if (result.action === "classify" && result.folderName) {
    parts.push(`归入「${result.folderName}」`);
  } else if (result.action === "suggest_create") {
    parts.push(`建议创建「${result.folderName}」`);
  } else if (result.action === "inbox") {
    parts.push("保留待整理");
  }

  // 标签增强
  if (result.tagBoost && result.tagBoost > 0) {
    parts.push(`标签增强 +${result.tagBoost}%`);
  }

  // 置信度
  parts.push(`置信度 ${result.confidence}%`);

  return parts.join(" | ");
}

/**
 * 映射 TieredResult 的 tier 到 VersionResult 的 tier
 */
function mapTieredResultTier(tier: 0 | 1 | 2 | 3): "T1" | "T2" | "T3" {
  switch (tier) {
    case 0: // 缓存命中或 inbox 兜底
      return "T1"; // 缓存命中视为高置信度
    case 1:
      return "T1";
    case 2:
      return "T2";
    case 3:
      return "T3";
    default:
      return "T3";
  }
}

/**
 * 计算场景权重加成
 */
function calculateScenarioWeight(weights: WeightAdjustmentResult): number {
  // 基于场景调整的权重加成
  if (weights.scenario === "mature") {
    return 1.2; // 成熟用户：历史数据可靠性高
  } else if (weights.scenario === "learning") {
    return 1.1; // 学习期用户：适度加权
  }
  return 1.0; // 冷启动用户：无加成
}

/**
 * 生成 V4 推理说明（增强版）
 */
function generateV4Reasoning(
  result: {
    action: ClassificationAction;
    confidence: number;
    folderName?: string;
    reason?: string;
  },
  dynamicWeights: WeightAdjustmentResult | null,
  correctionApplied: boolean,
  tieredResult?: TieredResult,
): string {
  const parts: string[] = [];

  // 分层信息
  const tierLabel = tieredResult ? `Tier ${tieredResult.tier}` : "Tier ?";

  // 基础分类结果（包含分层信息）
  if (correctionApplied) {
    parts.push(`[${tierLabel}] 纠错缓存命中，直接归入「${result.folderName}」`);
  } else if (result.action === "classify" && result.folderName) {
    parts.push(`[${tierLabel}] V4 分层引擎推荐归入「${result.folderName}」`);
  } else if (result.action === "suggest_create") {
    parts.push(
      `[${tierLabel}] V4 引擎建议创建新文件夹「${result.folderName}」`,
    );
  } else if (result.action === "inbox") {
    parts.push(
      `[${tierLabel}] V4 引擎置信度 ${result.confidence}% 未达阈值，保留待整理`,
    );
  } else {
    parts.push(`[${tierLabel}] V4 分类完成`);
  }

  // V4 特性说明
  const features: string[] = [];

  // 分层执行信息
  if (tieredResult) {
    if (tieredResult.aiCalled) {
      features.push("AI确认");
    } else {
      features.push("跳过AI");
    }
  }

  // 动态权重场景
  if (dynamicWeights) {
    features.push(`${dynamicWeights.scenario}场景`);
    if (dynamicWeights.source === "feedback") {
      features.push("反馈优化");
    }
  }

  if (features.length > 0) {
    parts.push(`[${features.join("+")}]`);
  }

  // 耗时信息
  if (tieredResult?.timings) {
    const timingParts: string[] = [];
    if (tieredResult.timings.tier0Ms !== undefined) {
      timingParts.push(`T0:${tieredResult.timings.tier0Ms}ms`);
    }
    if (tieredResult.timings.tier1Ms !== undefined) {
      timingParts.push(`T1:${tieredResult.timings.tier1Ms}ms`);
    }
    if (tieredResult.timings.tier2Ms !== undefined) {
      timingParts.push(`T2:${tieredResult.timings.tier2Ms}ms`);
    }
    if (tieredResult.timings.tier3Ms !== undefined) {
      timingParts.push(`T3:${tieredResult.timings.tier3Ms}ms`);
    }
    if (timingParts.length > 0) {
      parts.push(`耗时: ${timingParts.join(" ")}`);
    }
  }

  parts.push(`置信度 ${result.confidence}%`);

  return parts.join(" | ");
}

// V4.2: buildMatchers 和 buildMatchersV4 已移除
// 现在统一使用 ClassificationContainer.getV3Matchers() 确保与生产一致

/**
 * 确定分层
 */
function determineTier(
  confidence: number,
  config: Partial<V3Config>,
): "T1" | "T2" | "T3" {
  const highThreshold = config.highConfidenceThreshold || 80;
  const mediumThreshold = config.mediumConfidenceThreshold || 60;

  if (confidence >= highThreshold) return "T1";
  if (confidence >= mediumThreshold) return "T2";
  return "T3";
}

/**
 * 生成推理说明
 */
function generateReasoning(
  result: {
    action: ClassificationAction;
    confidence: number;
    folderName?: string;
  },
  version: "v3" | "v4",
): string {
  const versionLabel = version === "v3" ? "V3" : "V4";

  if (result.action === "classify" && result.folderName) {
    return `${versionLabel} 分类引擎推荐将书签归类到「${result.folderName}」，置信度 ${result.confidence}%`;
  }

  if (result.action === "suggest_new") {
    return `${versionLabel} 分类引擎建议创建新文件夹「${result.folderName}」`;
  }

  if (result.action === "inbox") {
    return `${versionLabel} 分类引擎置信度 ${result.confidence}% 低于阈值，保留在待整理`;
  }

  return `${versionLabel} 分类完成，动作: ${result.action}`;
}
