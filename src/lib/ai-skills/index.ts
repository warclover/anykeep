/**
 * AI Skills 模块导出
 *
 * @version 1.0.0
 * @since 2025-12-22
 */

// 核心类型
export * from "./core/types";

// BaseSkill 和错误类
export {
  BaseSkill,
  SkillValidationError,
  SkillTimeoutError,
  SkillExecutionError,
} from "./core/base-skill";

// SkillRegistry
export {
  SkillRegistry,
  skillRegistry,
  type SkillRegistryStats,
  type SkillMetadataSummary,
} from "./core/skill-registry";

// Skills 集合
export * from "./skills";

// 注册和初始化
export {
  registerDefaultSkills,
  getSkillsAsTools,
  initializeAISkills,
  isSkillsInitialized,
} from "./register";
