/**
 * 智能分类调试工具 - 分类执行器
 *
 * 独立执行分类逻辑，不依赖全局 Container
 * 支持 V3/V4 配置切换
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { V3Config } from "@/lib/classification/v3/config";
import type {
  VersionResult,
  DebugBookmarkInput,
  MockFolder,
  MockHistoryItem,
} from "../types";
import type { ClassificationAction } from "@/lib/classification/types/classification";
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
 * 创建独立的分类服务实例，不影响全局状态
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

    // 创建独立的分类服务实例
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

    // 确定分层
    const tier = determineTier(result.confidence, params.config);

    // 构建结果
    const versionResult: VersionResult = {
      folderId: result.folderId,
      folderName: result.folderName || "待整理",
      confidence: result.confidence,
      reasoning: result.reason || generateReasoning(result, params.version),
      executionTime,
      tier,
      action: result.action,
    };

    // V4 扩展信息
    if (params.version === "v4") {
      versionResult.v4Details = {
        scenarioWeight: extractScenarioWeight(result.matchDetails),
        correctionApplied: extractCorrectionApplied(result.matchDetails),
        namingEngineUsed: extractNamingEngineUsed(result.matchDetails),
      };

      // 包含决策路径（如果可用）
      if (result.decisionPath) {
        versionResult.decisionPath = result.decisionPath;
      }
    }

    logger.debug(
      {
        version: params.version,
        folderId: result.folderId,
        folderName: result.folderName,
        confidence: result.confidence,
        tier,
        executionTime,
      },
      "[ClassificationDebugger] Classification completed",
    );

    return versionResult;
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
 * 根据配置构建匹配器列表
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

/**
 * 提取场景权重（从匹配详情元数据）
 */
function extractScenarioWeight(
  matchDetails: Array<{ metadata?: Record<string, unknown> }> | undefined,
): number | undefined {
  if (!matchDetails) return undefined;

  for (const detail of matchDetails) {
    if (detail.metadata?.scenarioWeight) {
      return detail.metadata.scenarioWeight as number;
    }
  }
  return undefined;
}

/**
 * 提取纠错缓存应用状态
 */
function extractCorrectionApplied(
  matchDetails: Array<{ metadata?: Record<string, unknown> }> | undefined,
): boolean {
  if (!matchDetails) return false;

  for (const detail of matchDetails) {
    if (detail.metadata?.correctionApplied) {
      return true;
    }
  }
  return false;
}

/**
 * 提取命名引擎使用状态
 */
function extractNamingEngineUsed(
  matchDetails: Array<{ metadata?: Record<string, unknown> }> | undefined,
): boolean {
  if (!matchDetails) return false;

  for (const detail of matchDetails) {
    if (detail.metadata?.namingEngineUsed) {
      return true;
    }
  }
  return false;
}
