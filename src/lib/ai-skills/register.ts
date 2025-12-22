/**
 * AI Skills 注册和初始化
 *
 * 将所有 Skills 注册到 SkillRegistry，
 * 使其可以被 AI Agent 调用。
 *
 * @version 1.0.0
 * @since 2025-12-22
 */

import { skillRegistry } from "./core/skill-registry";
import { searchSkill } from "./skills/search";
import { classifySkill } from "./skills/classify";
import { summarySkill } from "./skills/summary";
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
 * 检查 Skills 系统是否已初始化
 */
export function isSkillsInitialized(): boolean {
  return initialized;
}
