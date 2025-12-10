/**
 * 向量嵌入模型配置
 *
 * V4.1+ 支持多模型切换和 A/B 测试
 *
 * 使用方法：
 * 1. 环境变量切换：设置 EMBEDDING_MODEL=dashscope-v4
 * 2. A/B 测试：设置 EMBEDDING_AB_TEST_ENABLED=true
 *
 * @version 1.0.0
 * @since 2025-12-09
 */

import { logger } from "@/lib/logger";

/**
 * 支持的嵌入模型类型
 */
export type EmbeddingModelId =
  | "dashscope-v3"
  | "dashscope-v4"
  | "bge-large-zh"; // 开源备选

/**
 * 单个模型的配置
 */
export interface EmbeddingModelConfig {
  /** 模型 ID */
  id: EmbeddingModelId;
  /** API 端点 URL */
  baseUrl: string;
  /** 模型名称（API 调用时使用） */
  modelName: string;
  /** 输出向量维度 */
  dimensions: number;
  /** 模型描述 */
  description: string;
  /** 支持的最大 token 数 */
  maxTokens: number;
  /** 是否为默认模型 */
  isDefault?: boolean;
  /** API Key 环境变量名 */
  apiKeyEnvVar: string;
  /** 模型的额外参数 */
  extraParams?: Record<string, unknown>;
}

/**
 * 嵌入配置总体接口
 */
export interface EmbeddingConfig {
  /** 当前活跃的模型 ID */
  activeModel: EmbeddingModelId;
  /** 是否启用 A/B 测试 */
  abTestEnabled: boolean;
  /** A/B 测试分配比例（0-100，表示使用新模型的百分比） */
  abTestNewModelPercentage: number;
  /** A/B 测试新模型 ID */
  abTestNewModel: EmbeddingModelId;
  /** API 超时时间（毫秒） */
  apiTimeout: number;
  /** 批量请求超时倍数 */
  batchTimeoutMultiplier: number;
}

/**
 * 可用的嵌入模型定义
 */
export const EMBEDDING_MODELS: Record<EmbeddingModelId, EmbeddingModelConfig> = {
  "dashscope-v3": {
    id: "dashscope-v3",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    modelName: "text-embedding-v3",
    dimensions: 1024,
    description: "阿里云百炼 text-embedding-v3 (当前默认)",
    maxTokens: 8191,
    isDefault: true,
    apiKeyEnvVar: "DASHSCOPE_API_KEY",
  },
  "dashscope-v4": {
    id: "dashscope-v4",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    modelName: "text-embedding-v4",
    dimensions: 1024,
    description: "阿里云百炼 text-embedding-v4 (测试中)",
    maxTokens: 8191,
    apiKeyEnvVar: "DASHSCOPE_API_KEY",
    // v4 可能需要额外参数
    extraParams: {},
  },
  "bge-large-zh": {
    id: "bge-large-zh",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    modelName: "bge-large-zh-v1.5",
    dimensions: 1024,
    description: "BGE Large Chinese (开源备选)",
    maxTokens: 512,
    apiKeyEnvVar: "DASHSCOPE_API_KEY",
  },
};

/**
 * 默认配置
 */
const DEFAULT_CONFIG: EmbeddingConfig = {
  activeModel: "dashscope-v3",
  abTestEnabled: false,
  abTestNewModelPercentage: 20, // 默认 20% 流量使用新模型
  abTestNewModel: "dashscope-v4",
  apiTimeout: 15000,
  batchTimeoutMultiplier: 2,
};

/**
 * 从环境变量读取配置
 */
function getConfigFromEnv(): Partial<EmbeddingConfig> {
  const envConfig: Partial<EmbeddingConfig> = {};

  // EMBEDDING_MODEL: 设置当前使用的模型
  const modelId = process.env.EMBEDDING_MODEL as EmbeddingModelId | undefined;
  if (modelId && modelId in EMBEDDING_MODELS) {
    envConfig.activeModel = modelId;
  }

  // EMBEDDING_AB_TEST_ENABLED: 是否启用 A/B 测试
  const abTestEnabled = process.env.EMBEDDING_AB_TEST_ENABLED;
  if (abTestEnabled !== undefined) {
    envConfig.abTestEnabled = abTestEnabled === "true";
  }

  // EMBEDDING_AB_TEST_PERCENTAGE: A/B 测试新模型流量百分比
  const abTestPercentage = process.env.EMBEDDING_AB_TEST_PERCENTAGE;
  if (abTestPercentage !== undefined) {
    const percentage = parseInt(abTestPercentage, 10);
    if (!isNaN(percentage) && percentage >= 0 && percentage <= 100) {
      envConfig.abTestNewModelPercentage = percentage;
    }
  }

  // EMBEDDING_AB_TEST_NEW_MODEL: A/B 测试新模型 ID
  const newModelId = process.env
    .EMBEDDING_AB_TEST_NEW_MODEL as EmbeddingModelId | undefined;
  if (newModelId && newModelId in EMBEDDING_MODELS) {
    envConfig.abTestNewModel = newModelId;
  }

  // EMBEDDING_API_TIMEOUT: API 超时时间
  const timeout = process.env.EMBEDDING_API_TIMEOUT;
  if (timeout !== undefined) {
    const ms = parseInt(timeout, 10);
    if (!isNaN(ms) && ms > 0) {
      envConfig.apiTimeout = ms;
    }
  }

  return envConfig;
}

/**
 * 获取当前生效的配置
 */
export function getEmbeddingConfig(): EmbeddingConfig {
  const envConfig = getConfigFromEnv();
  return {
    ...DEFAULT_CONFIG,
    ...envConfig,
  };
}

/**
 * 获取当前活跃的模型配置
 */
export function getActiveModelConfig(): EmbeddingModelConfig {
  const config = getEmbeddingConfig();
  return EMBEDDING_MODELS[config.activeModel];
}

/**
 * 基于用户 ID 确定使用哪个模型（A/B 测试）
 *
 * 使用用户 ID 的哈希值来保证同一用户始终分配到同一组
 *
 * @param userId - 用户 ID
 * @returns 应该使用的模型配置
 */
export function getModelForUser(userId: string): EmbeddingModelConfig {
  const config = getEmbeddingConfig();

  // A/B 测试未启用，直接返回默认模型
  if (!config.abTestEnabled) {
    return EMBEDDING_MODELS[config.activeModel];
  }

  // 计算用户所属组（基于用户 ID 的简单哈希）
  const hash = simpleHash(userId);
  const bucket = hash % 100;

  // 根据分配比例决定使用哪个模型
  const useNewModel = bucket < config.abTestNewModelPercentage;
  const selectedModel = useNewModel
    ? config.abTestNewModel
    : config.activeModel;

  logger.debug(
    {
      userId: userId.slice(0, 8) + "...",
      bucket,
      threshold: config.abTestNewModelPercentage,
      selectedModel,
      isNewModel: useNewModel,
      action: "ab_test_model_selection",
    },
    "Embedding: A/B test model selection"
  );

  return EMBEDDING_MODELS[selectedModel];
}

/**
 * 简单的字符串哈希函数
 * 确保同一用户始终得到相同的哈希值
 */
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

/**
 * 获取模型的 API Key
 */
export function getModelApiKey(modelConfig: EmbeddingModelConfig): string {
  const apiKey = process.env[modelConfig.apiKeyEnvVar];
  if (!apiKey) {
    throw new Error(`${modelConfig.apiKeyEnvVar} 环境变量未配置`);
  }
  return apiKey;
}

/**
 * 检查是否启用 A/B 测试
 */
export function isABTestEnabled(): boolean {
  return getEmbeddingConfig().abTestEnabled;
}

/**
 * 获取当前配置信息（用于调试和日志）
 */
export function getEmbeddingConfigInfo(): {
  activeModel: EmbeddingModelId;
  modelName: string;
  dimensions: number;
  abTestEnabled: boolean;
  abTestNewModel?: EmbeddingModelId;
  abTestPercentage?: number;
} {
  const config = getEmbeddingConfig();
  const activeModelConfig = EMBEDDING_MODELS[config.activeModel];

  return {
    activeModel: config.activeModel,
    modelName: activeModelConfig.modelName,
    dimensions: activeModelConfig.dimensions,
    abTestEnabled: config.abTestEnabled,
    ...(config.abTestEnabled && {
      abTestNewModel: config.abTestNewModel,
      abTestPercentage: config.abTestNewModelPercentage,
    }),
  };
}

/**
 * 配置版本信息
 */
export const EMBEDDING_CONFIG_VERSION = {
  version: "1.0.0",
  lastUpdated: "2025-12-09",
  supportedModels: Object.keys(EMBEDDING_MODELS),
};
