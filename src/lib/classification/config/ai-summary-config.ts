/**
 * AI Summary Feature Configuration
 *
 * 特性开关配置，支持快速回滚
 *
 * 回滚方法：
 * 1. 环境变量回滚：设置 AI_SUMMARY_JSON_OUTPUT=false
 * 2. 代码回滚：修改 DEFAULT_CONFIG.useJsonOutput = false
 *
 * v3.0 新增：
 * - 摘要模式配置（standard/enhanced）
 * - 增强模式配置（实体提取、关键数据、难度评估）
 *
 * @version 3.0.0
 * @since 2025-12-06
 * @updated 2025-12-14
 */

import type { SummaryMode } from "../types/ai-summary";
import { createClient } from "@/lib/supabase/client";
import { logger } from "@/lib/logger";

/**
 * AI 摘要配置接口
 */
export interface AISummaryConfig {
  /**
   * 是否使用 JSON 结构化输出
   * - true: 新版 JSON 输出（tldr, key_points, sentiment 等）
   * - false: 旧版纯文本输出（回滚模式）
   */
  useJsonOutput: boolean;

  /**
   * 是否使用 Jina Reader 进行内容提取
   * Phase 2 功能，当前默认关闭
   */
  useJinaReader: boolean;

  /**
   * Jina Reader API 超时时间（毫秒）
   */
  jinaReaderTimeout: number;

  /**
   * 是否启用模型路由
   * Phase 3 功能，当前默认关闭
   */
  useModelRouting: boolean;

  /**
   * 长文本阈值（token 数）
   * 超过此阈值时切换到长文本模型
   */
  longContentTokenThreshold: number;

  /**
   * 内容提取相关配置
   */
  contentFetcher: {
    /** Jina Reader 最小有效内容长度（字符数），低于此值视为提取失败 */
    minJinaContentLength: number;
    /** 关键内容最大长度（字符数），用于截取提取后的内容 */
    maxKeyContentLength: number;
    /** 原生 HTTP 提取超时时间（毫秒） */
    nativeFetchTimeout: number;
  };

  /**
   * 回退标签
   * 当 AI 无法提取有效标签时使用的默认标签
   */
  fallbackTags: string[];

  // ============================================================================
  // v3.0: 摘要模式配置
  // ============================================================================

  /**
   * 默认摘要模式
   * - standard: 标准模式（v2.0），兼容现有逻辑
   * - enhanced: 增强模式（v3.0），包含实体提取、关键数据、难度评估
   */
  defaultSummaryMode: SummaryMode;

  /**
   * 是否允许用户切换摘要模式
   */
  allowModeSwitch: boolean;

  /**
   * 增强模式配置
   */
  enhancedMode: EnhancedModeConfig;
}

/**
 * 增强模式配置接口
 */
export interface EnhancedModeConfig {
  /**
   * 是否提取实体（人名、公司、技术等）
   */
  extractEntities: boolean;

  /**
   * 是否提取关键数据（数字、统计等）
   */
  extractKeyData: boolean;

  /**
   * 是否评估内容难度
   */
  evaluateDifficulty: boolean;

  /**
   * 是否识别内容类型
   */
  identifyContentType: boolean;

  /**
   * 最大实体数量
   */
  maxEntities: number;

  /**
   * 最大关键数据条数
   */
  maxKeyData: number;

  /**
   * 实体置信度阈值（低于此值不保存）
   */
  entityConfidenceThreshold: number;
}

/**
 * 默认配置
 *
 * 修改此处可立即影响所有新请求
 */
const DEFAULT_CONFIG: AISummaryConfig = {
  // Phase 1: JSON 结构化输出（初始关闭，测试后开启）
  useJsonOutput: false,

  // Phase 2: Jina Reader（待实施）
  useJinaReader: false,
  jinaReaderTimeout: 10000,

  // Phase 3: 模型路由（待实施）
  useModelRouting: false,
  longContentTokenThreshold: 30000,

  // 内容提取配置
  contentFetcher: {
    minJinaContentLength: 100, // Jina 返回内容少于此值视为失败
    maxKeyContentLength: 5000, // 关键内容截取长度
    nativeFetchTimeout: 10000, // 原生 HTTP 超时
  },

  // 回退标签（AI 无法提取有效标签时使用）
  fallbackTags: ["收藏", "阅读"],

  // v3.0: 摘要模式配置
  defaultSummaryMode: "standard",
  allowModeSwitch: true,

  // 增强模式配置
  enhancedMode: {
    extractEntities: true,
    extractKeyData: true,
    evaluateDifficulty: true,
    identifyContentType: true,
    maxEntities: 10,
    maxKeyData: 5,
    entityConfidenceThreshold: 0.6,
  },
};

/**
 * 从环境变量读取配置（优先级高于默认值）
 */
function getConfigFromEnv(): Partial<AISummaryConfig> {
  const envConfig: Partial<AISummaryConfig> = {};

  // AI_SUMMARY_JSON_OUTPUT: 控制 JSON 输出开关
  const jsonOutput = process.env.AI_SUMMARY_JSON_OUTPUT;
  if (jsonOutput !== undefined) {
    envConfig.useJsonOutput = jsonOutput === "true";
  }

  // AI_SUMMARY_USE_JINA: 控制 Jina Reader 开关
  const useJina = process.env.AI_SUMMARY_USE_JINA;
  if (useJina !== undefined) {
    envConfig.useJinaReader = useJina === "true";
  }

  // AI_SUMMARY_MODEL_ROUTING: 控制模型路由开关
  const modelRouting = process.env.AI_SUMMARY_MODEL_ROUTING;
  if (modelRouting !== undefined) {
    envConfig.useModelRouting = modelRouting === "true";
  }

  // AI_SUMMARY_DEFAULT_MODE: 控制默认摘要模式
  const defaultMode = process.env.AI_SUMMARY_DEFAULT_MODE;
  if (defaultMode === "standard" || defaultMode === "enhanced") {
    envConfig.defaultSummaryMode = defaultMode;
  }

  // AI_SUMMARY_ALLOW_MODE_SWITCH: 控制是否允许用户切换模式
  const allowModeSwitch = process.env.AI_SUMMARY_ALLOW_MODE_SWITCH;
  if (allowModeSwitch !== undefined) {
    envConfig.allowModeSwitch = allowModeSwitch === "true";
  }

  return envConfig;
}

/**
 * 获取当前生效的配置
 *
 * 优先级：环境变量 > 默认配置
 *
 * @example
 * ```typescript
 * const config = getAISummaryConfig();
 *
 * if (config.useJsonOutput) {
 *   // 使用新版 JSON 格式
 *   return generateJsonSummary(content);
 * } else {
 *   // 回滚到纯文本格式
 *   return generateTextSummary(content);
 * }
 * ```
 */
export function getAISummaryConfig(): AISummaryConfig {
  const envConfig = getConfigFromEnv();
  return {
    ...DEFAULT_CONFIG,
    ...envConfig,
  };
}

/**
 * 检查是否启用 JSON 输出
 * 便捷方法，用于快速判断
 */
export function isJsonOutputEnabled(): boolean {
  return getAISummaryConfig().useJsonOutput;
}

/**
 * 检查是否启用 Jina Reader
 */
export function isJinaReaderEnabled(): boolean {
  return getAISummaryConfig().useJinaReader;
}

/**
 * 检查是否启用模型路由
 */
export function isModelRoutingEnabled(): boolean {
  return getAISummaryConfig().useModelRouting;
}

// ============================================================================
// v3.0: 摘要模式辅助函数
// ============================================================================

/**
 * 获取默认摘要模式
 */
export function getDefaultSummaryMode(): SummaryMode {
  return getAISummaryConfig().defaultSummaryMode;
}

/**
 * 检查是否允许用户切换模式
 */
export function isModeSwitchAllowed(): boolean {
  return getAISummaryConfig().allowModeSwitch;
}

/**
 * 获取增强模式配置
 */
export function getEnhancedModeConfig(): EnhancedModeConfig {
  return getAISummaryConfig().enhancedMode;
}

/**
 * 检查是否启用实体提取
 */
export function isEntityExtractionEnabled(): boolean {
  return getAISummaryConfig().enhancedMode.extractEntities;
}

/**
 * 检查是否启用关键数据提取
 */
export function isKeyDataExtractionEnabled(): boolean {
  return getAISummaryConfig().enhancedMode.extractKeyData;
}

/**
 * 获取用户的摘要模式
 *
 * 从数据库获取用户设置的摘要模式，如果未设置则返回默认值
 *
 * @param userId - 用户 ID
 * @returns 用户的摘要模式
 *
 * @example
 * ```typescript
 * const mode = await getUserSummaryMode('user-uuid');
 * if (mode === 'enhanced') {
 *   // 使用增强模式
 * }
 * ```
 */
export async function getUserSummaryMode(userId: string): Promise<SummaryMode> {
  const config = getAISummaryConfig();

  // 如果不允许切换模式，直接返回默认值
  if (!config.allowModeSwitch) {
    return config.defaultSummaryMode;
  }

  try {
    const supabase = createClient();
    const { data, error } = await supabase.rpc("get_user_summary_mode", {
      p_user_id: userId,
    });

    if (error) {
      logger.warn(
        { error: error.message, userId },
        "[ai-summary-config] Failed to get user summary mode",
      );
      return config.defaultSummaryMode;
    }

    // 验证返回值是有效的模式
    if (data === "standard" || data === "enhanced") {
      return data;
    }

    return config.defaultSummaryMode;
  } catch (err) {
    logger.warn(
      { error: err instanceof Error ? err.message : String(err), userId },
      "[ai-summary-config] Error getting user summary mode",
    );
    return config.defaultSummaryMode;
  }
}

/**
 * 设置用户的摘要模式
 *
 * @param userId - 用户 ID
 * @param mode - 摘要模式
 * @returns 是否设置成功
 */
export async function setUserSummaryMode(
  userId: string,
  mode: SummaryMode,
): Promise<boolean> {
  const config = getAISummaryConfig();

  // 如果不允许切换模式，直接返回失败
  if (!config.allowModeSwitch) {
    logger.warn("[ai-summary-config] Mode switch is not allowed");
    return false;
  }

  try {
    const supabase = createClient();
    const { data, error } = await supabase.rpc("set_user_summary_mode", {
      p_user_id: userId,
      p_mode: mode,
    });

    if (error) {
      logger.error(
        { error, mode, userId },
        "[ai-summary-config] Failed to set user summary mode",
      );
      return false;
    }

    return data === true;
  } catch (err) {
    logger.error(
      { error: err, mode },
      "[ai-summary-config] Error setting user summary mode",
    );
    return false;
  }
}

// ============================================================================
// v4.0: 摘要质量增强 Feature Flags
// ============================================================================

/**
 * 是否启用平台定制解析器（内容提取强化）
 * 启用后使用 ParserRegistry 按平台提取正文
 */
export function isEnhancedExtractionEnabled(): boolean {
  return process.env.AI_SUMMARY_ENHANCED_EXTRACTION !== "false";
}

/**
 * 是否启用内容去噪
 * 启用后使用 ContentCleaner 移除广告/导航/推荐
 */
export function isContentCleaningEnabled(): boolean {
  return process.env.AI_SUMMARY_CONTENT_CLEANING !== "false";
}

/**
 * 是否启用 MapReduce 长文分段摘要
 * 启用后超过阈值的长文自动分段摘要再聚合
 */
export function isMapReduceEnabled(): boolean {
  return process.env.AI_SUMMARY_MAP_REDUCE === "true";
}

/**
 * 获取 MapReduce 触发阈值（字符数）
 */
export function getMapReduceThreshold(): number {
  const threshold = process.env.AI_SUMMARY_MAP_REDUCE_THRESHOLD;
  if (threshold) {
    const parsed = parseInt(threshold, 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  return 6000;
}

/**
 * 是否启用 V4 Prompt 引擎
 */
export function isPromptV4Enabled(): boolean {
  return process.env.AI_SUMMARY_PROMPT_V4 !== "false";
}

/**
 * 是否启用 Chain-of-Thought 引导
 */
export function isCotEnabled(): boolean {
  return process.env.AI_SUMMARY_COT !== "false";
}

/**
 * 是否启用 Few-shot 示例
 */
export function isFewShotEnabled(): boolean {
  return process.env.AI_SUMMARY_FEW_SHOT !== "false";
}

/**
 * 是否启用负面约束
 */
export function isNegativeConstraintsEnabled(): boolean {
  return process.env.AI_SUMMARY_NEGATIVE_CONSTRAINTS !== "false";
}

/**
 * 配置版本信息（用于调试和日志）
 */
export const CONFIG_VERSION = {
  version: "4.0.0",
  lastUpdated: "2026-03-07",
  features: {
    jsonOutput: "Phase 1 - 结构化 JSON 输出",
    jinaReader: "Phase 2 - Jina Reader 内容提取",
    modelRouting: "Phase 3 - 智能模型路由",
    enhancedMode: "Phase 4 - 智能浓缩 v3.0（实体提取、关键数据、难度评估）",
    summaryModeSwitch: "Phase 4 - 用户摘要模式切换",
    enhancedExtraction: "Phase 5 - 平台定制解析器（内容提取强化）",
    contentCleaning: "Phase 5 - 内容去噪管线",
    mapReduce: "Phase 5 - MapReduce 长文分段摘要",
    promptV4: "Phase 5 - V4 Prompt 引擎（CoT + Few-shot + 负面约束）",
  },
};
