/**
 * AI Skills 配置模块导出
 *
 * 提供：
 * - Skill 运行配置（限制、阈值等）
 * - 意图模式配置
 * - Skill 映射配置
 * - 配置索引和查找工具
 *
 * @module ai-skills/config
 * @version 2.0.0
 * @since 2025-12-24
 */

// ============================================
// Skill 运行配置
// ============================================

export * from "./skill-config";

// ============================================
// 类型导出
// ============================================

export type {
  IntentType,
  ComplexityLevel,
  ExecutionMode,
  IntentPattern,
  SkillMapping,
  ExplicitToolMapping,
  UserMappingPreference,
  MappingIndex,
  PatternIndex,
  MappingLookupResult,
  IntentMatch,
} from "./types";

// ============================================
// 意图模式导出
// ============================================

export {
  INTENT_PATTERNS,
  SORTED_PATTERNS,
  getCompiledPattern,
  clearPatternCache,
} from "./intent-patterns";

// ============================================
// Skill 映射导出
// ============================================

export {
  SKILL_MAPPINGS,
  EXPLICIT_TOOL_MAPPINGS,
  buildMappingIndex,
  findMapping,
  findExplicitTool,
  getMappingIndex,
  resetMappingIndex,
} from "./skill-mappings";
