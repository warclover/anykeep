/**
 * 智能分类调试工具 - 对比服务
 *
 * 执行 V3 vs V4 分类对比，协调两个版本的执行
 * 核心原则：数据隔离，不写入生产数据库
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CompareRequest,
  CompareResponse,
  VersionResult,
  ComparisonDiff,
} from "../types";
import {
  V3_SIMULATION_CONFIG,
  getPresetConfig,
  mergeConfig,
  needsRealData,
} from "../constants";
import { executeClassification } from "./executor.service";
import { getMockContext, loadRealContext } from "./mock-context.service";
import { logger } from "@/lib/logger";

/**
 * 执行 V3 vs V4 vs V4.1 分类对比
 *
 * @param supabase - Supabase 客户端（用于读取数据，不写入）
 * @param request - 对比请求
 * @param currentUserId - 当前用户 ID（用于 real-readonly 场景）
 * @returns 对比响应
 */
export async function compareClassification(
  supabase: SupabaseClient,
  request: CompareRequest,
  currentUserId: string,
): Promise<CompareResponse> {
  const startTime = Date.now();

  logger.info(
    {
      scenario: request.scenario,
      preset: request.preset || "default",
      bookmarkTitle: request.bookmark.title,
    },
    "[ClassificationDebugger] Starting comparison (V3 vs V4 vs V4.1)",
  );

  try {
    // 1. 获取执行上下文
    const context = needsRealData(request.scenario)
      ? await loadRealContext(supabase, currentUserId)
      : getMockContext(request.scenario);

    // 2. 准备配置
    const v4Config = request.customV4Config
      ? mergeConfig(request.preset || "default", request.customV4Config)
      : getPresetConfig(request.preset || "default");

    // 3. 并行执行 V3、V4 和 V4.1 分类
    const [v3Result, v4Result, v41Result] = await Promise.all([
      executeClassification(supabase, {
        bookmark: request.bookmark,
        userId: context.userId,
        config: V3_SIMULATION_CONFIG,
        folders: context.folders,
        history: context.history,
        version: "v3",
        dryRun: true, // 强制 dry-run
      }),
      executeClassification(supabase, {
        bookmark: request.bookmark,
        userId: context.userId,
        config: v4Config,
        folders: context.folders,
        history: context.history,
        version: "v4",
        dryRun: true, // 强制 dry-run
      }),
      executeClassification(supabase, {
        bookmark: request.bookmark,
        userId: context.userId,
        config: {}, // V4.1 使用内置配置
        folders: context.folders,
        history: context.history,
        version: "v41",
        dryRun: true, // 强制 dry-run
      }),
    ]);

    // 4. 生成差异分析
    const comparison = generateComparison(v3Result, v4Result);
    const v41Comparison = generateComparison(v3Result, v41Result);

    // 5. 构建响应
    const response: CompareResponse = {
      success: true,
      v3Result,
      v4Result,
      v41Result,
      comparison,
      v41Comparison,
      configSummary: {
        scenario: request.scenario,
        preset: request.customV4Config ? "custom" : request.preset || "default",
        v4Features: extractV4Features(v4Config),
        v41Features: ["统一向量搜索", "标签增强", "AI选择题", "冷启动支持"],
      },
    };

    logger.info(
      {
        scenario: request.scenario,
        v3Folder: v3Result.folderName,
        v3Confidence: v3Result.confidence,
        v4Folder: v4Result.folderName,
        v4Confidence: v4Result.confidence,
        v41Folder: v41Result.folderName,
        v41Confidence: v41Result.confidence,
        v3v4SameFolder: comparison.sameFolder,
        v3v41SameFolder: v41Comparison.sameFolder,
        totalTime: Date.now() - startTime,
      },
      "[ClassificationDebugger] Comparison completed (V3 vs V4 vs V4.1)",
    );

    return response;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error(
      {
        error: errorMessage,
        scenario: request.scenario,
        bookmarkTitle: request.bookmark.title,
      },
      "[ClassificationDebugger] Comparison failed",
    );

    return {
      success: false,
      v3Result: createEmptyResult("v3"),
      v4Result: createEmptyResult("v4"),
      comparison: createEmptyComparison(),
      error: errorMessage,
      configSummary: {
        scenario: request.scenario,
        preset: request.preset || "default",
        v4Features: [],
      },
    };
  }
}

/**
 * 生成差异分析
 */
function generateComparison(
  v3Result: VersionResult,
  v4Result: VersionResult,
): ComparisonDiff {
  const sameFolder =
    v3Result.folderId === v4Result.folderId ||
    v3Result.folderName === v4Result.folderName;

  const confidenceDiff = v4Result.confidence - v3Result.confidence;
  const confidenceDiffPercent =
    v3Result.confidence > 0
      ? (confidenceDiff / v3Result.confidence) * 100
      : confidenceDiff > 0
        ? 100
        : 0;

  const timeDiff = v4Result.executionTime - v3Result.executionTime;

  const tierDiff =
    v3Result.tier !== v4Result.tier
      ? `${v3Result.tier} → ${v4Result.tier}`
      : null;

  // 识别 V4 改进点
  const v4Improvements: string[] = [];

  if (confidenceDiff > 5) {
    v4Improvements.push(`置信度提升 +${confidenceDiff.toFixed(1)}%`);
  }

  if (v4Result.tier < v3Result.tier) {
    v4Improvements.push(`分层优化 ${tierDiff}`);
  }

  if (v4Result.v4Details?.correctionApplied) {
    v4Improvements.push("应用纠错缓存");
  }

  if (
    v4Result.v4Details?.scenarioWeight &&
    v4Result.v4Details.scenarioWeight > 1
  ) {
    v4Improvements.push(
      `场景权重加成 x${v4Result.v4Details.scenarioWeight.toFixed(2)}`,
    );
  }

  if (!sameFolder && v4Result.confidence > v3Result.confidence) {
    v4Improvements.push("推荐更精准的文件夹");
  }

  return {
    sameFolder,
    confidenceDiff,
    confidenceDiffPercent,
    timeDiff,
    tierDiff,
    v4Improvements,
  };
}

/**
 * 提取 V4 启用的特性列表
 */
function extractV4Features(config: Record<string, unknown>): string[] {
  const features: string[] = [];

  if (config.enableDynamicWeights) features.push("动态权重");
  if (config.enableFolderFingerprint) features.push("文件夹指纹");
  if (config.enableKnnDirect) features.push("k-NN 直接锁定");
  if (config.enableTagMatcher) features.push("标签匹配");
  if (config.enableUniversalCategories) features.push("通用分类");
  if (config.enableCoTPrompt) features.push("CoT 思维链");

  return features;
}

/**
 * 创建空结果（用于错误情况）
 */
function createEmptyResult(_version: "v3" | "v4"): VersionResult {
  return {
    folderId: null,
    folderName: "执行失败",
    confidence: 0,
    reasoning: "分类执行失败",
    executionTime: 0,
    tier: "T3",
    action: "inbox",
  };
}

/**
 * 创建空对比（用于错误情况）
 */
function createEmptyComparison(): ComparisonDiff {
  return {
    sameFolder: false,
    confidenceDiff: 0,
    confidenceDiffPercent: 0,
    timeDiff: 0,
    tierDiff: null,
    v4Improvements: [],
  };
}
