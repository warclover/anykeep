/**
 * 智能分类调试工具 - 分类执行器
 *
 * 独立执行分类逻辑，不依赖全局 Container
 * 支持 V3/V4 配置切换
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

// 导入核心分类组件
import {
  FolderProfileRepository,
  BookmarkRepository,
} from "@/lib/classification/repositories";
import {
  VectorMatcher,
  HistoryMatcher,
  AIRecommender,
  WeightedScoreAggregator,
} from "@/lib/classification/strategies";
import {
  UniversalCategoryMatcher,
  KnnDirectMatcher,
  FingerprintMatcher,
  TagMatcher,
} from "@/lib/classification/v3/strategies";
import {
  ClassificationService,
  UserStageService,
} from "@/lib/classification/services";
import { CLASSIFICATION_WEIGHTS } from "@/lib/classification/constants";
import type { IMatcher } from "@/lib/classification/strategies/interfaces";

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

/**
 * 执行参数
 */
export interface ExecutionParams {
  bookmark: DebugBookmarkInput;
  userId: string;
  config: Partial<V3Config>;
  folders: MockFolder[];
  history: MockHistoryItem[];
  version: "v3" | "v4";
  dryRun: boolean;
}

/**
 * 执行单次分类
 *
 * V3: 使用基础 ClassificationService
 * V4: 使用 TieredClassificationService + 动态权重 + 纠错缓存 + 重排序
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
    if (params.version === "v4") {
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
 * 使用 ClassificationService，无 V4 增强功能
 */
async function executeV3Classification(
  supabase: SupabaseClient,
  params: ExecutionParams,
  startTime: number,
): Promise<VersionResult> {
  // 创建独立的仓库实例
  const folderProfileRepo = new FolderProfileRepository(supabase);
  const bookmarkRepo = new BookmarkRepository(supabase);

  // 根据配置构建匹配器
  const matchers = buildMatchers(
    supabase,
    folderProfileRepo,
    bookmarkRepo,
    params.config,
  );

  // 创建聚合器和用户阶段服务
  const aggregator = new WeightedScoreAggregator();
  const userStageService = new UserStageService(supabase);

  // 创建基础分类服务实例
  const classificationService = new ClassificationService(
    matchers,
    aggregator,
    userStageService,
    supabase,
  );

  // 执行分类
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
 * 使用 TieredClassificationService + 完整 V4 特性：
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
  // 创建独立的仓库实例
  const folderProfileRepo = new FolderProfileRepository(supabase);
  const bookmarkRepo = new BookmarkRepository(supabase);

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

  // 2. 根据配置和动态权重构建匹配器
  const matchers = buildMatchersV4(
    supabase,
    folderProfileRepo,
    bookmarkRepo,
    params.config,
    dynamicWeights,
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

  // 6. 构建匹配器上下文
  const context: MatcherContext = {
    userId: params.userId,
    title: params.bookmark.title,
    summary: params.bookmark.description || "",
    tags: params.bookmark.tags || [],
    embedding: [], // 调试模式下不需要 embedding，由各匹配器按需生成
  };

  // 7. 执行分层分类（使用 classifyWithDetails 获取完整结果）
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

  // 8. 使用 TieredResult 中的准确信息
  const correctionApplied = tieredResult.cacheHit;
  const actualTier = mapTieredResultTier(tieredResult.tier);

  // 9. 构建 V4 详情（包含完整的分层信息）
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

/**
 * 根据配置构建匹配器列表（V3 基础版本）
 */
function buildMatchers(
  supabase: SupabaseClient,
  folderProfileRepo: FolderProfileRepository,
  bookmarkRepo: BookmarkRepository,
  config: Partial<V3Config>,
): IMatcher[] {
  const matchers: IMatcher[] = [];

  // k-NN 直接锁定
  if (config.enableKnnDirect !== false) {
    matchers.push(
      new KnnDirectMatcher(bookmarkRepo, {
        weight: 1.0,
        thresholds: { similarity: config.knnDirectThreshold || 0.85 },
      }),
    );
  }

  // 文件夹指纹匹配
  if (config.enableFolderFingerprint !== false) {
    matchers.push(
      new FingerprintMatcher(supabase, {
        weight: 0.25,
      }),
    );
  }

  // 标签匹配
  if (config.enableTagMatcher !== false) {
    matchers.push(
      new TagMatcher(supabase, {
        weight: 0.3,
      }),
    );
  }

  // 向量匹配（始终启用）
  matchers.push(
    new VectorMatcher(folderProfileRepo, {
      weight: CLASSIFICATION_WEIGHTS.VECTOR,
    }),
  );

  // 通用分类
  if (config.enableUniversalCategories !== false) {
    matchers.push(
      new UniversalCategoryMatcher(folderProfileRepo, {
        weight: 0.2,
      }),
    );
  }

  // 历史匹配
  matchers.push(
    new HistoryMatcher(bookmarkRepo, {
      weight: CLASSIFICATION_WEIGHTS.HISTORY,
    }),
  );

  // AI 推荐
  matchers.push(
    new AIRecommender(folderProfileRepo, {
      weight: CLASSIFICATION_WEIGHTS.AI,
    }),
  );

  return matchers;
}

/**
 * 根据配置和动态权重构建匹配器列表（V4 增强版本）
 *
 * 使用动态权重服务返回的权重配置
 */
function buildMatchersV4(
  supabase: SupabaseClient,
  folderProfileRepo: FolderProfileRepository,
  bookmarkRepo: BookmarkRepository,
  config: Partial<V3Config>,
  dynamicWeights: WeightAdjustmentResult | null,
): IMatcher[] {
  const matchers: IMatcher[] = [];

  // 获取动态权重或使用默认值
  const weights = dynamicWeights?.weights || {
    vector: CLASSIFICATION_WEIGHTS.VECTOR,
    history: CLASSIFICATION_WEIGHTS.HISTORY,
    ai: CLASSIFICATION_WEIGHTS.AI,
    universal: 0.2,
    tag: 0.3,
    fingerprint: 0.25,
    knnDirect: 1.0,
    queryExpansion: 0.25,
  };

  // 获取动态阈值或使用默认值
  const thresholds = dynamicWeights?.thresholds || {
    highConfidence: config.highConfidenceThreshold || 80,
    mediumConfidence: config.mediumConfidenceThreshold || 60,
    autoCreate: config.mediumConfidenceThreshold || 50,
    knnDirect: config.knnDirectThreshold || 0.85,
  };

  // k-NN 直接锁定（高优先级）
  if (config.enableKnnDirect !== false) {
    matchers.push(
      new KnnDirectMatcher(bookmarkRepo, {
        weight: weights.knnDirect || 1.0,
        thresholds: { similarity: thresholds.knnDirect },
      }),
    );
  }

  // 文件夹指纹匹配
  if (config.enableFolderFingerprint !== false) {
    matchers.push(
      new FingerprintMatcher(supabase, {
        weight: weights.fingerprint,
      }),
    );
  }

  // 标签匹配
  if (config.enableTagMatcher !== false) {
    matchers.push(
      new TagMatcher(supabase, {
        weight: weights.tag,
      }),
    );
  }

  // 向量匹配（始终启用，使用动态权重）
  matchers.push(
    new VectorMatcher(folderProfileRepo, {
      weight: weights.vector,
    }),
  );

  // 通用分类
  if (config.enableUniversalCategories !== false) {
    matchers.push(
      new UniversalCategoryMatcher(folderProfileRepo, {
        weight: weights.universal,
      }),
    );
  }

  // 历史匹配（使用动态权重）
  matchers.push(
    new HistoryMatcher(bookmarkRepo, {
      weight: weights.history,
    }),
  );

  // AI 推荐（使用动态权重）
  matchers.push(
    new AIRecommender(folderProfileRepo, {
      weight: weights.ai,
    }),
  );

  return matchers;
}

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
