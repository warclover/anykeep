/**
 * 向量嵌入生成工具
 * 使用阿里云百炼 DashScope API (OpenAI 兼容模式)
 * 用于语义搜索功能
 *
 * V4.1+ 增强：
 * - 支持多模型配置
 * - 支持 A/B 测试用户分组
 * - 配置化管理
 *
 * @version 2.0.0
 * @since 2025-12-09
 */

import { logger } from "@/lib/logger";
import {
  getEmbeddingConfig,
  getActiveModelConfig,
  getModelForUser,
  getModelApiKey,
  type EmbeddingModelConfig,
  type EmbeddingModelId,
} from "@/lib/classification/config/embedding-config";

/**
 * 向量嵌入配置（兼容旧接口）
 */
export interface EmbeddingConfig {
  model?: "text-embedding-v3" | "text-embedding-v4";
  dimensions?: number;
}

/**
 * 扩展的向量嵌入配置（支持用户 A/B 测试）
 */
export interface EmbeddingOptionsExtended {
  /** 指定模型 ID（覆盖配置） */
  modelId?: EmbeddingModelId;
  /** 用户 ID（用于 A/B 测试分组） */
  userId?: string;
  /** 指定维度（如果模型支持） */
  dimensions?: number;
}

/**
 * API 响应类型
 */
interface EmbeddingResponse {
  object: string;
  data: Array<{
    object: string;
    index: number;
    embedding: number[];
  }>;
  model: string;
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

/**
 * 生成单个文本的向量嵌入
 * @param text - 要生成向量的文本
 * @param config - 可选配置（兼容旧接口）
 * @returns 向量数组
 */
export async function generateEmbedding(
  text: string,
  config?: Partial<EmbeddingConfig>,
): Promise<number[]> {
  // 使用全局配置的活跃模型
  const modelConfig = getActiveModelConfig();
  return generateEmbeddingWithModel(text, modelConfig, config?.dimensions);
}

/**
 * 生成单个文本的向量嵌入（支持 A/B 测试）
 *
 * 当启用 A/B 测试时，会根据用户 ID 自动分配到不同的模型组
 *
 * @param text - 要生成向量的文本
 * @param options - 扩展选项（支持用户 ID 和模型指定）
 * @returns 包含向量和使用模型信息的结果
 */
export async function generateEmbeddingForUser(
  text: string,
  options: EmbeddingOptionsExtended,
): Promise<{ embedding: number[]; modelId: EmbeddingModelId }> {
  // 确定使用的模型
  let modelConfig: EmbeddingModelConfig;

  if (options.modelId) {
    // 显式指定模型
    const { EMBEDDING_MODELS } = await import(
      "@/lib/classification/config/embedding-config"
    );
    modelConfig = EMBEDDING_MODELS[options.modelId];
  } else if (options.userId) {
    // 基于用户 ID 的 A/B 测试分组
    modelConfig = getModelForUser(options.userId);
  } else {
    // 使用默认活跃模型
    modelConfig = getActiveModelConfig();
  }

  const embedding = await generateEmbeddingWithModel(
    text,
    modelConfig,
    options.dimensions,
  );

  return {
    embedding,
    modelId: modelConfig.id,
  };
}

/**
 * 使用指定模型配置生成向量
 * @internal
 */
async function generateEmbeddingWithModel(
  text: string,
  modelConfig: EmbeddingModelConfig,
  dimensions?: number,
): Promise<number[]> {
  const apiKey = getModelApiKey(modelConfig);
  const globalConfig = getEmbeddingConfig();

  // 文本预处理：截断过长文本，避免超过 token 限制
  const maxChars = Math.min(modelConfig.maxTokens * 4, 32000); // 估算字符数
  const truncatedText = truncateText(text, maxChars);

  if (!truncatedText || truncatedText.trim().length === 0) {
    throw new Error("输入文本不能为空");
  }

  try {
    const requestBody: Record<string, unknown> = {
      model: modelConfig.modelName,
      input: truncatedText,
      dimensions: dimensions || modelConfig.dimensions,
      ...modelConfig.extraParams,
    };

    const response = await fetch(`${modelConfig.baseUrl}/embeddings`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(globalConfig.apiTimeout),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error(
        {
          status: response.status,
          error: errorText,
          modelId: modelConfig.id,
          action: "embedding_api_error",
        },
        "Embedding: API error",
      );
      throw new Error(
        `${modelConfig.modelName} API 错误: ${response.status} - ${errorText}`,
      );
    }

    const data: EmbeddingResponse = await response.json();

    if (!data.data?.[0]?.embedding) {
      throw new Error("API 未返回有效的向量数据");
    }

    const embedding = data.data[0].embedding;
    const expectedDimensions = dimensions || modelConfig.dimensions;

    // V4.2.5: 验证向量格式安全性
    if (!Array.isArray(embedding) || embedding.length === 0) {
      throw new Error("API 返回的向量格式无效：不是数组或为空");
    }

    // V4.2.6: 验证向量维度
    if (embedding.length !== expectedDimensions) {
      logger.error(
        {
          modelId: modelConfig.id,
          actualDimensions: embedding.length,
          expectedDimensions,
          action: "embedding_dimension_mismatch",
        },
        "Embedding: Dimension mismatch - API returned different dimensions",
      );
      throw new Error(
        `向量维度不匹配：期望 ${expectedDimensions}，实际 ${embedding.length}`,
      );
    }

    // V4.2.5: 检查向量中是否包含非法值（NaN、Infinity）
    const hasInvalidValues = embedding.some(
      (val) => typeof val !== "number" || !isFinite(val),
    );
    if (hasInvalidValues) {
      logger.error(
        { modelId: modelConfig.id, embeddingLength: embedding.length },
        "Embedding: Vector contains invalid values (NaN or Infinity)",
      );
      throw new Error("向量数据包含无效值（NaN 或 Infinity）");
    }

    logger.info(
      {
        modelId: modelConfig.id,
        modelName: data.model,
        dimensions: embedding.length,
        tokens: data.usage?.total_tokens,
        action: "embedding_generated",
      },
      "Embedding: Success",
    );

    return embedding;
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === "TimeoutError" || error.name === "AbortError") {
        logger.error(
          { modelId: modelConfig.id, action: "embedding_timeout" },
          "Embedding: Timeout",
        );
        throw new Error("向量生成超时，请稍后重试");
      }
      logger.error(
        {
          error: error.message,
          modelId: modelConfig.id,
          action: "embedding_failed",
        },
        "Embedding: Failed",
      );
      throw error;
    }
    throw new Error("向量生成失败");
  }
}

/**
 * 批量生成多个文本的向量嵌入
 * @param texts - 文本数组
 * @param config - 可选配置（兼容旧接口）
 * @returns 向量数组的数组
 */
export async function generateEmbeddingsBatch(
  texts: string[],
  config?: Partial<EmbeddingConfig>,
): Promise<number[][]> {
  const modelConfig = getActiveModelConfig();
  return generateEmbeddingsBatchWithModel(
    texts,
    modelConfig,
    config?.dimensions,
  );
}

/**
 * 批量生成向量嵌入（支持 A/B 测试）
 *
 * @param texts - 文本数组
 * @param options - 扩展选项（支持用户 ID 和模型指定）
 * @returns 包含向量数组和使用模型信息的结果
 */
export async function generateEmbeddingsBatchForUser(
  texts: string[],
  options: EmbeddingOptionsExtended,
): Promise<{ embeddings: number[][]; modelId: EmbeddingModelId }> {
  let modelConfig: EmbeddingModelConfig;

  if (options.modelId) {
    const { EMBEDDING_MODELS } = await import(
      "@/lib/classification/config/embedding-config"
    );
    modelConfig = EMBEDDING_MODELS[options.modelId];
  } else if (options.userId) {
    modelConfig = getModelForUser(options.userId);
  } else {
    modelConfig = getActiveModelConfig();
  }

  const embeddings = await generateEmbeddingsBatchWithModel(
    texts,
    modelConfig,
    options.dimensions,
  );

  return {
    embeddings,
    modelId: modelConfig.id,
  };
}

/**
 * 使用指定模型配置批量生成向量
 * @internal
 */
async function generateEmbeddingsBatchWithModel(
  texts: string[],
  modelConfig: EmbeddingModelConfig,
  dimensions?: number,
): Promise<number[][]> {
  const apiKey = getModelApiKey(modelConfig);
  const globalConfig = getEmbeddingConfig();

  if (!texts || texts.length === 0) {
    return [];
  }

  // 预处理：截断过长文本
  const maxChars = Math.min(modelConfig.maxTokens * 4, 32000);
  const truncatedTexts = texts.map((text) => truncateText(text, maxChars));
  const validTexts = truncatedTexts.filter((t) => t && t.trim().length > 0);

  if (validTexts.length === 0) {
    return [];
  }

  try {
    const requestBody: Record<string, unknown> = {
      model: modelConfig.modelName,
      input: validTexts,
      dimensions: dimensions || modelConfig.dimensions,
      ...modelConfig.extraParams,
    };

    const batchTimeout =
      globalConfig.apiTimeout * globalConfig.batchTimeoutMultiplier;

    const response = await fetch(`${modelConfig.baseUrl}/embeddings`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(batchTimeout),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error(
        {
          status: response.status,
          error: errorText,
          count: validTexts.length,
          modelId: modelConfig.id,
          action: "embedding_batch_api_error",
        },
        "Embedding Batch: API error",
      );
      throw new Error(
        `${modelConfig.modelName} API 错误: ${response.status} - ${errorText}`,
      );
    }

    const data: EmbeddingResponse = await response.json();

    if (!data.data || data.data.length === 0) {
      throw new Error("API 未返回有效的向量数据");
    }

    // 按 index 排序，确保顺序正确
    const sortedData = [...data.data].sort((a, b) => a.index - b.index);
    const embeddings = sortedData.map((item) => item.embedding);

    // V4.2.5: 批量向量验证 - 检查每个向量的有效性
    const expectedDimensions = dimensions || modelConfig.dimensions;
    let invalidCount = 0;
    const validatedEmbeddings = embeddings.map((embedding, idx) => {
      // 检查数组有效性
      if (!Array.isArray(embedding) || embedding.length === 0) {
        invalidCount++;
        logger.warn(
          { index: idx, modelId: modelConfig.id },
          "Embedding Batch: Invalid embedding format at index",
        );
        // 返回零向量作为占位符
        return new Array(expectedDimensions).fill(0);
      }

      // 检查 NaN/Infinity
      const hasInvalidValues = embedding.some(
        (val) => typeof val !== "number" || !isFinite(val),
      );
      if (hasInvalidValues) {
        invalidCount++;
        logger.warn(
          { index: idx, modelId: modelConfig.id },
          "Embedding Batch: Vector contains NaN or Infinity at index",
        );
        // 替换无效值为 0
        return embedding.map((val) =>
          typeof val === "number" && isFinite(val) ? val : 0,
        );
      }

      return embedding;
    });

    if (invalidCount > 0) {
      logger.warn(
        { invalidCount, total: embeddings.length, modelId: modelConfig.id },
        "Embedding Batch: Some vectors had invalid values and were sanitized",
      );
    }

    logger.info(
      {
        modelId: modelConfig.id,
        modelName: data.model,
        count: validatedEmbeddings.length,
        tokens: data.usage?.total_tokens,
        action: "embedding_batch_generated",
      },
      "Embedding Batch: Success",
    );

    return validatedEmbeddings;
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === "TimeoutError" || error.name === "AbortError") {
        logger.error(
          {
            count: validTexts.length,
            modelId: modelConfig.id,
            action: "embedding_batch_timeout",
          },
          "Embedding Batch: Timeout",
        );
        throw new Error("批量向量生成超时，请减少数量后重试");
      }
      logger.error(
        {
          error: error.message,
          count: validTexts.length,
          modelId: modelConfig.id,
          action: "embedding_batch_failed",
        },
        "Embedding Batch: Failed",
      );
      throw error;
    }
    throw new Error("批量向量生成失败");
  }
}

/**
 * 为书签内容生成向量文本
 * 合并标题、摘要、标签为一个搜索友好的文本
 */
export function buildEmbeddingText(
  title: string,
  summary?: string | null,
  tags?: string[] | null,
): string {
  const parts: string[] = [];

  if (title) {
    parts.push(title);
  }

  if (summary) {
    parts.push(summary);
  }

  if (tags && tags.length > 0) {
    parts.push(tags.join(" "));
  }

  return parts.join(" ").trim();
}

/**
 * 截断文本到指定字符数
 * 避免超过 API 的 token 限制
 */
function truncateText(text: string, maxLength: number): string {
  if (!text) return "";
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength);
}

/**
 * 检查向量是否有效
 *
 * V4.2.6: 修复验证逻辑 - 使用 isFinite 同时检查 NaN 和 Infinity
 *
 * @param embedding - 待检查的向量
 * @param expectedDimensions - 期望的维度（可选，默认使用当前活跃模型的维度）
 */
export function isValidEmbedding(
  embedding: unknown,
  expectedDimensions?: number,
): embedding is number[] {
  // 类型检查
  if (!Array.isArray(embedding) || embedding.length === 0) {
    return false;
  }

  // 维度检查（如果指定了期望维度）
  if (
    expectedDimensions !== undefined &&
    embedding.length !== expectedDimensions
  ) {
    return false;
  }

  // V4.2.6: 使用 isFinite 检查每个值（同时排除 NaN 和 Infinity）
  return embedding.every((val) => typeof val === "number" && isFinite(val));
}

/**
 * V4.2.6: 验证并修复向量中的无效值
 *
 * @param embedding - 原始向量
 * @param expectedDimensions - 期望的维度
 * @returns 修复后的向量，如果无法修复则返回 null
 */
export function sanitizeEmbedding(
  embedding: unknown,
  expectedDimensions?: number,
): number[] | null {
  // 类型检查
  if (!Array.isArray(embedding) || embedding.length === 0) {
    return null;
  }

  // 维度检查
  const dimensions = expectedDimensions || getActiveModelConfig().dimensions;
  if (embedding.length !== dimensions) {
    logger.warn(
      {
        actual: embedding.length,
        expected: dimensions,
        action: "embedding_dimension_mismatch",
      },
      "Embedding: Dimension mismatch detected",
    );
    return null;
  }

  // 检查并修复无效值
  let hasInvalidValues = false;
  const sanitized = embedding.map((val) => {
    if (typeof val !== "number" || !isFinite(val)) {
      hasInvalidValues = true;
      return 0; // 替换为 0
    }
    return val;
  });

  if (hasInvalidValues) {
    logger.warn(
      { dimensions, action: "embedding_values_sanitized" },
      "Embedding: Invalid values replaced with 0",
    );
  }

  return sanitized;
}

/**
 * 获取当前活跃模型的向量维度
 */
export function getEmbeddingDimensions(): number {
  return getActiveModelConfig().dimensions;
}

// Re-export 配置相关的类型和函数
export {
  type EmbeddingModelId,
  type EmbeddingModelConfig,
  getEmbeddingConfig,
  getActiveModelConfig,
  getModelForUser,
  isABTestEnabled,
  getEmbeddingConfigInfo,
  EMBEDDING_CONFIG_VERSION,
} from "@/lib/classification/config/embedding-config";
