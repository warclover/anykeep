/**
 * AI Summary Feature Configuration
 *
 * 特性开关配置，支持快速回滚
 *
 * 回滚方法：
 * 1. 环境变量回滚：设置 AI_SUMMARY_JSON_OUTPUT=false
 * 2. 代码回滚：修改 DEFAULT_CONFIG.useJsonOutput = false
 *
 * @version 2.0.0
 * @since 2025-12-06
 */

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

/**
 * 配置版本信息（用于调试和日志）
 */
export const CONFIG_VERSION = {
  version: "2.0.0",
  lastUpdated: "2025-12-06",
  features: {
    jsonOutput: "Phase 1 - 结构化 JSON 输出",
    jinaReader: "Phase 2 - Jina Reader 内容提取",
    modelRouting: "Phase 3 - 智能模型路由",
  },
};
