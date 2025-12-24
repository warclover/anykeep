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
import { unifiedEngine } from "./engine/unified-engine";
import { knowledgeAgent } from "../ai-agent/core/knowledge-agent";
import { logger } from "@/lib/logger";

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
 */
export function initializeUnifiedEngine(): void {
  if (unifiedEngineInitialized) {
    logger.debug("Unified Engine already initialized");
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  unifiedEngine.registerOrchestrationSkill(knowledgeReviewSkill as any);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  unifiedEngine.registerOrchestrationSkill(dataExportSkill as any);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  unifiedEngine.registerOrchestrationSkill(insightReportSkill as any);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  unifiedEngine.registerOrchestrationSkill(batchOrganizeSkill as any);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  unifiedEngine.registerOrchestrationSkill(duplicateCleanupSkill as any);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  unifiedEngine.registerOrchestrationSkill(quickDigestSkill as any);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  unifiedEngine.registerOrchestrationSkill(smartTaggingSkill as any);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  unifiedEngine.registerOrchestrationSkill(readingPlannerSkill as any);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  unifiedEngine.registerOrchestrationSkill(relatedDiscoverySkill as any);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  unifiedEngine.registerOrchestrationSkill(periodicReportSkill as any);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  unifiedEngine.registerOrchestrationSkill(shareBundleSkill as any);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  unifiedEngine.registerOrchestrationSkill(learningPathSkill as any);

  unifiedEngineInitialized = true;

  logger.info(
    {
      orchestrationSkills:
        unifiedEngine.getRegisteredOrchestrationSkills().length,
      isReady: unifiedEngine.isReady(),
    },
    "Unified Engine initialized",
  );
}

/**
 * 获取已初始化的统一引擎
 *
 * 如果未初始化，会自动初始化
 */
export function getUnifiedEngine() {
  if (!unifiedEngineInitialized) {
    initializeUnifiedEngine();
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
