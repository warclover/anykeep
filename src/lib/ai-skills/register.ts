/**
 * AI Skills 注册和初始化
 *
 * 将所有 Skills 注册到 SkillRegistry，
 * 使其可以被 AI Agent 调用。
 *
 * 统一引擎初始化：
 * - 注册原子 Skills
 * - 配置 UnifiedEngine
 * - 连接 KnowledgeAgent 作为原子执行器
 * - 注册编排 Skills
 *
 * @version 2.0.0
 * @since 2025-12-22
 * @updated 2025-12-24 - 添加 UnifiedEngine 集成和编排 Skills
 */

import { skillRegistry } from "./core/skill-registry";
import { searchSkill } from "./skills/search";
import { classifySkill } from "./skills/classify";
import { summarySkill } from "./skills/summary";
import { knowledgeReviewSkill } from "./skills/knowledge-review";
import { dataExportSkill } from "./skills/data-export";
import { insightReportSkill } from "./skills/insight-report";
import { batchOrganizeSkill } from "./skills/batch-organize";
import { duplicateCleanupSkill } from "./skills/duplicate-cleanup";
import { quickDigestSkill } from "./skills/quick-digest";
import { smartTaggingSkill } from "./skills/smart-tagging";
import { readingPlannerSkill } from "./skills/reading-planner";
import { relatedDiscoverySkill } from "./skills/related-discovery";
import { periodicReportSkill } from "./skills/periodic-report";
import { shareBundleSkill } from "./skills/share-bundle";
import { learningPathSkill } from "./skills/learning-path";
import { knowledgeExtractSkill } from "./skills/knowledge-extract";
import { linkHealthCheckSkill } from "./skills/link-health-check";
import { ttsSynthesisSkill } from "./skills/tts-synthesis";
import { wechatDigestSkill } from "./skills/wechat-digest";
import { bilibiliTranscriptSkill } from "./skills/bilibili-transcript";
import { inboxDigestSkill } from "./skills/inbox-digest";
import { contentChangeMonitorSkill } from "./skills/content-change-monitor";
import { activeRecallSkill } from "./skills/active-recall";
import { ThematicSynthesisSkill } from "./skills/thematic-synthesis";
// Skills v1.1.0 新增（2025-01-08）
import { inboxTriageSkill } from "./skills/inbox-triage";
import { folderRecommendSkill } from "./skills/folder-recommend";
import { searchOptimizeSkill } from "./skills/search-optimize";
import { knowledgeGraphExploreSkill } from "./skills/knowledge-graph-explore";
import { folderHealthCheckSkill } from "./skills/folder-health-check";
import { snapshotCompareSkill } from "./skills/snapshot-compare";
import { unifiedEngine } from "./engine/unified-engine";
import { knowledgeAgent } from "../ai-agent/core/knowledge-agent";
import { logger } from "@/lib/logger";
import { FeatureFlags } from "@/lib/ai-agent/config/feature-flags";
// createIntentRouter 暂时保留导入供后续使用
import type { IntentRouter as _IntentRouter } from "./router/intent-router";

// Skill 实例
const thematicSynthesisSkill = new ThematicSynthesisSkill();

/**
 * 默认注册的 Skills
 */
const DEFAULT_SKILLS = [
  { skill: searchSkill, enabled: true },
  { skill: classifySkill, enabled: true },
  { skill: summarySkill, enabled: true },
];

/**
 * 注册所有默认 Skills
 *
 * @returns 注册的 Skill 数量
 */
export function registerDefaultSkills(): number {
  let count = 0;

  for (const { skill, enabled } of DEFAULT_SKILLS) {
    try {
      skillRegistry.register(skill, { enabled });
      count++;
      logger.debug(
        { skillId: skill.metadata.id, enabled },
        `Skill registered: ${skill.metadata.name}`,
      );
    } catch (error) {
      logger.error(
        {
          skillId: skill.metadata.id,
          error: error instanceof Error ? error.message : String(error),
        },
        `Failed to register skill: ${skill.metadata.id}`,
      );
    }
  }

  logger.info(
    { count, total: DEFAULT_SKILLS.length },
    "Default skills registered",
  );

  return count;
}

/**
 * 获取所有 Skills 作为 Vercel AI SDK Tools
 *
 * @param contextProvider - 上下文提供函数
 * @returns Tool 对象集合
 */
export function getSkillsAsTools(
  contextProvider?: () => { userId: string; conversationId?: string },
) {
  // 确保 Skills 已注册
  if (skillRegistry.getStats().total === 0) {
    registerDefaultSkills();
  }

  return skillRegistry.exportAsTools(undefined, contextProvider);
}

/**
 * 初始化标志
 */
let initialized = false;
let unifiedEngineInitialized = false;

/**
 * 初始化 Promise（用于避免竞态条件）
 * Code Review P0-1: 修复初始化竞态条件
 */
let initializationPromise: Promise<void> | null = null;

/**
 * 初始化状态
 */
export interface UnifiedEngineInitStatus {
  initialized: boolean;
  initializing: boolean;
  hybridClassifierReady: boolean;
  orchestrationSkillCount: number;
  error?: string;
}

/**
 * 语义匹配器健康状态
 *
 * Code Review P1-2: 添加详细的健康检查状态
 */
export interface SemanticMatcherHealthStatus {
  /** 是否已初始化 */
  initialized: boolean;
  /** 预计算的意图数量 */
  intentCount: number;
  /** 健康检查是否通过 */
  healthy: boolean;
  /** 最近一次检查时间 */
  lastCheckTime?: number;
  /** 检查延迟（毫秒） */
  checkLatencyMs?: number;
  /** 错误信息（如果有） */
  error?: string;
}

/**
 * 初始化 AI Skills 系统
 *
 * 在应用启动时调用一次
 */
export function initializeAISkills(): void {
  if (initialized) {
    logger.debug("AI Skills already initialized");
    return;
  }

  registerDefaultSkills();
  initialized = true;

  logger.info("AI Skills system initialized");
}

/**
 * 初始化统一引擎
 *
 * 将 KnowledgeAgent 连接为原子执行器
 * 注册编排 Skills
 *
 * Code Review P0-1: 使用 Promise 避免并发初始化竞态条件
 */
export async function initializeUnifiedEngine(): Promise<void> {
  // 已初始化，直接返回
  if (unifiedEngineInitialized) {
    logger.debug("Unified Engine already initialized");
    return;
  }

  // 正在初始化中，等待现有 Promise 完成（避免并发初始化）
  if (initializationPromise) {
    logger.debug("Unified Engine initialization in progress, waiting...");
    return initializationPromise;
  }

  // 创建初始化 Promise
  initializationPromise = doInitializeUnifiedEngine();

  try {
    await initializationPromise;
  } finally {
    // 初始化完成后清除 Promise（允许重试）
    initializationPromise = null;
  }
}

/**
 * 实际执行初始化逻辑
 * @internal
 */
async function doInitializeUnifiedEngine(): Promise<void> {
  if (unifiedEngineInitialized) {
    return;
  }

  // 确保 Skills 已注册
  if (!initialized) {
    initializeAISkills();
  }

  // 设置原子执行器
  unifiedEngine.setAtomicExecutor((input, context) =>
    knowledgeAgent.executeStream(input, context),
  );

  // 注册编排 Skills
  unifiedEngine.registerOrchestrationSkill(knowledgeReviewSkill);
  unifiedEngine.registerOrchestrationSkill(dataExportSkill);
  unifiedEngine.registerOrchestrationSkill(insightReportSkill);
  unifiedEngine.registerOrchestrationSkill(batchOrganizeSkill);
  unifiedEngine.registerOrchestrationSkill(duplicateCleanupSkill);
  unifiedEngine.registerOrchestrationSkill(quickDigestSkill);
  unifiedEngine.registerOrchestrationSkill(smartTaggingSkill);
  unifiedEngine.registerOrchestrationSkill(readingPlannerSkill);
  unifiedEngine.registerOrchestrationSkill(relatedDiscoverySkill);
  unifiedEngine.registerOrchestrationSkill(periodicReportSkill);
  unifiedEngine.registerOrchestrationSkill(shareBundleSkill);
  unifiedEngine.registerOrchestrationSkill(learningPathSkill);
  unifiedEngine.registerOrchestrationSkill(knowledgeExtractSkill);

  // 链接健康检测（支持 Feature Flag 开关）
  if (process.env.ENABLE_LINK_HEALTH_CHECK !== "false") {
    unifiedEngine.registerOrchestrationSkill(linkHealthCheckSkill);
    logger.debug("LinkHealthCheckSkill registered");
  }

  // TTS 语音朗读（支持 Feature Flag 开关）
  if (process.env.ENABLE_TTS_SYNTHESIS !== "false") {
    unifiedEngine.registerOrchestrationSkill(ttsSynthesisSkill);
    logger.debug("TTSSynthesisSkill registered");
  }

  // 微信阅读摘要（支持 Feature Flag 开关）
  if (process.env.ENABLE_WECHAT_DIGEST !== "false") {
    unifiedEngine.registerOrchestrationSkill(wechatDigestSkill);
    logger.debug("WechatDigestSkill registered");
  }

  // B站字幕提取（支持 Feature Flag 开关）
  if (process.env.ENABLE_BILIBILI_TRANSCRIPT !== "false") {
    unifiedEngine.registerOrchestrationSkill(bilibiliTranscriptSkill);
    logger.debug("BilibiliTranscriptSkill registered");
  }

  // 收件箱摘要（支持 Feature Flag 开关）
  if (process.env.ENABLE_INBOX_DIGEST !== "false") {
    unifiedEngine.registerOrchestrationSkill(inboxDigestSkill);
    logger.debug("InboxDigestSkill registered");
  }

  // 内容变更监控（支持 Feature Flag 开关）
  if (process.env.ENABLE_CONTENT_CHANGE_MONITOR !== "false") {
    unifiedEngine.registerOrchestrationSkill(contentChangeMonitorSkill);
    logger.debug("ContentChangeMonitorSkill registered");
  }

  // 主动复习 Brain-Sync（支持 Feature Flag 开关）
  if (process.env.ENABLE_ACTIVE_RECALL !== "false") {
    unifiedEngine.registerOrchestrationSkill(activeRecallSkill);
    logger.debug("ActiveRecallSkill registered");
  }

  // 主题合成器（支持 Feature Flag 开关）
  if (process.env.ENABLE_THEMATIC_SYNTHESIS !== "false") {
    unifiedEngine.registerOrchestrationSkill(thematicSynthesisSkill);
    logger.debug("ThematicSynthesisSkill registered");
  }

  // ============================================
  // Skills v1.1.0 新增（2025-01-08）
  // ============================================

  // P0: InboxTriageSkill - 收件箱智能分拣（编排类型）
  if (process.env.ENABLE_INBOX_TRIAGE !== "false") {
    unifiedEngine.registerOrchestrationSkill(inboxTriageSkill);
    logger.debug("InboxTriageSkill registered");
  }

  // P0: FolderRecommendSkill - 文件夹智能推荐（原子类型）
  if (process.env.ENABLE_FOLDER_RECOMMEND !== "false") {
    skillRegistry.register(folderRecommendSkill, { enabled: true });
    logger.debug("FolderRecommendSkill registered");
  }

  // P0: SearchOptimizeSkill - 搜索优化助手（原子类型）
  if (process.env.ENABLE_SEARCH_OPTIMIZE !== "false") {
    skillRegistry.register(searchOptimizeSkill, { enabled: true });
    logger.debug("SearchOptimizeSkill registered");
  }

  // P1: KnowledgeGraphExploreSkill - 知识图谱探索（编排类型）
  if (process.env.ENABLE_KNOWLEDGE_GRAPH_EXPLORE !== "false") {
    unifiedEngine.registerOrchestrationSkill(knowledgeGraphExploreSkill);
    logger.debug("KnowledgeGraphExploreSkill registered");
  }

  // P1: FolderHealthCheckSkill - 文件夹健康检查（编排类型）
  if (process.env.ENABLE_FOLDER_HEALTH_CHECK !== "false") {
    unifiedEngine.registerOrchestrationSkill(folderHealthCheckSkill);
    logger.debug("FolderHealthCheckSkill registered");
  }

  // P1: SnapshotCompareSkill - 快照对比分析（原子类型）
  if (process.env.ENABLE_SNAPSHOT_COMPARE !== "false") {
    skillRegistry.register(snapshotCompareSkill, { enabled: true });
    logger.debug("SnapshotCompareSkill registered");
  }

  // 初始化混合意图分类器（如果启用）
  if (FeatureFlags.ENABLE_HYBRID_INTENT_CLASSIFIER) {
    try {
      await unifiedEngine.initializeHybridIntentClassifier();
      logger.info("Hybrid Intent Classifier initialized successfully");
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
        },
        "Failed to initialize Hybrid Intent Classifier",
      );
      // 不阻止初始化，继续使用传统分类器
    }
  }

  unifiedEngineInitialized = true;

  logger.info(
    {
      orchestrationSkills:
        unifiedEngine.getRegisteredOrchestrationSkills().length,
      isReady: unifiedEngine.isReady(),
      hybridClassifierEnabled: FeatureFlags.ENABLE_HYBRID_INTENT_CLASSIFIER,
    },
    "Unified Engine initialized",
  );
}

/**
 * 获取已初始化的统一引擎
 *
 * Code Review P0-1: 改进初始化处理
 * - 如果正在初始化，返回引擎实例但记录警告
 * - 如果未初始化，触发异步初始化
 *
 * 注意：如果引擎未初始化，此函数会触发异步初始化（不等待完成）
 * 对于需要确保混合分类器已初始化的场景，请使用 getUnifiedEngineAsync
 */
export function getUnifiedEngine() {
  if (!unifiedEngineInitialized) {
    if (initializationPromise) {
      // 正在初始化中，返回引擎但记录警告
      logger.warn(
        "getUnifiedEngine called while initialization in progress, hybrid classifier may not be ready",
      );
    } else {
      // 触发异步初始化
      initializeUnifiedEngine().catch((error) => {
        logger.error(
          {
            error: error instanceof Error ? error.message : String(error),
          },
          "Failed to initialize Unified Engine",
        );
      });
    }
  }
  return unifiedEngine;
}

/**
 * 异步获取已初始化的统一引擎
 *
 * 如果未初始化，会等待初始化完成
 */
export async function getUnifiedEngineAsync() {
  if (!unifiedEngineInitialized) {
    await initializeUnifiedEngine();
  }
  return unifiedEngine;
}

/**
 * 检查统一引擎是否已初始化
 */
export function isUnifiedEngineInitialized(): boolean {
  return unifiedEngineInitialized;
}

/**
 * 检查 Skills 系统是否已初始化
 */
export function isSkillsInitialized(): boolean {
  return initialized;
}

/**
 * 获取统一引擎初始化状态
 *
 * Code Review P0-1: 添加状态检查函数
 */
export function getUnifiedEngineInitStatus(): UnifiedEngineInitStatus {
  return {
    initialized: unifiedEngineInitialized,
    initializing: initializationPromise !== null,
    hybridClassifierReady:
      unifiedEngineInitialized &&
      FeatureFlags.ENABLE_HYBRID_INTENT_CLASSIFIER &&
      unifiedEngine.isHybridClassifierReady(),
    orchestrationSkillCount: unifiedEngineInitialized
      ? unifiedEngine.getRegisteredOrchestrationSkills().length
      : 0,
  };
}

/**
 * 预热统一引擎（用于应用启动时调用）
 *
 * Code Review P0-1: 添加预热函数，确保首次请求前引擎已就绪
 *
 * @param timeoutMs - 超时时间（毫秒），默认 10000
 * @returns 预热结果
 */
export async function warmupUnifiedEngine(timeoutMs: number = 10000): Promise<{
  success: boolean;
  durationMs: number;
  status: UnifiedEngineInitStatus;
}> {
  const startTime = performance.now();

  try {
    // 带超时的初始化
    const initPromise = initializeUnifiedEngine();
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error(`Warmup timeout after ${timeoutMs}ms`)),
        timeoutMs,
      ),
    );

    await Promise.race([initPromise, timeoutPromise]);

    const durationMs = Math.round(performance.now() - startTime);
    const status = getUnifiedEngineInitStatus();

    logger.info(
      {
        durationMs,
        ...status,
      },
      "Unified Engine warmup completed",
    );

    return {
      success: true,
      durationMs,
      status,
    };
  } catch (error) {
    const durationMs = Math.round(performance.now() - startTime);
    const status = getUnifiedEngineInitStatus();

    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        durationMs,
        ...status,
      },
      "Unified Engine warmup failed",
    );

    return {
      success: false,
      durationMs,
      status: {
        ...status,
        error: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

/**
 * 检查语义匹配器健康状态
 *
 * Code Review P1-2: 添加语义匹配器健康检查
 *
 * @param testInput - 测试输入（用于验证匹配功能）
 * @returns 健康状态
 */
export async function checkSemanticMatcherHealth(
  testInput: string = "搜索书签",
): Promise<SemanticMatcherHealthStatus> {
  const startTime = performance.now();

  try {
    // 检查统一引擎是否已初始化
    if (!unifiedEngineInitialized) {
      return {
        initialized: false,
        intentCount: 0,
        healthy: false,
        lastCheckTime: Date.now(),
        error: "Unified engine not initialized",
      };
    }

    // 获取语义匹配器状态
    const semanticStatus = unifiedEngine.getSemanticMatcherStatus();

    if (!semanticStatus.initialized) {
      return {
        initialized: false,
        intentCount: 0,
        healthy: false,
        lastCheckTime: Date.now(),
        error: "Semantic matcher not initialized",
      };
    }

    // 执行测试匹配验证功能正常
    const testResult = await unifiedEngine.testSemanticMatcher(testInput);

    const checkLatencyMs = Math.round(performance.now() - startTime);

    return {
      initialized: true,
      intentCount: semanticStatus.intentCount,
      healthy: testResult.success,
      lastCheckTime: Date.now(),
      checkLatencyMs,
      error: testResult.error,
    };
  } catch (error) {
    const checkLatencyMs = Math.round(performance.now() - startTime);

    return {
      initialized: false,
      intentCount: 0,
      healthy: false,
      lastCheckTime: Date.now(),
      checkLatencyMs,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * 获取完整的 AI 系统健康状态
 *
 * Code Review P1-2: 综合健康检查
 */
export async function getAISystemHealthStatus(): Promise<{
  engine: UnifiedEngineInitStatus;
  semanticMatcher: SemanticMatcherHealthStatus;
  overall: {
    healthy: boolean;
    issues: string[];
  };
}> {
  const engineStatus = getUnifiedEngineInitStatus();
  const semanticStatus = await checkSemanticMatcherHealth();

  const issues: string[] = [];

  if (!engineStatus.initialized) {
    issues.push("Unified engine not initialized");
  }

  if (engineStatus.initializing) {
    issues.push("Unified engine initialization in progress");
  }

  if (!semanticStatus.healthy) {
    issues.push(semanticStatus.error || "Semantic matcher unhealthy");
  }

  if (semanticStatus.intentCount === 0 && semanticStatus.initialized) {
    issues.push("Semantic matcher has no precomputed intents");
  }

  return {
    engine: engineStatus,
    semanticMatcher: semanticStatus,
    overall: {
      healthy: issues.length === 0,
      issues,
    },
  };
}
