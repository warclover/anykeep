/**
 * LLMIntentClassifier - LLM 意图分类器
 *
 * 职责：
 * - 当规则匹配置信度不足时，使用 LLM 辅助分类
 * - 缓存分类结果减少 API 调用
 * - 超时控制保障响应速度
 *
 * @version 1.0.0
 * @since 2025-12-26
 */

import { generateObject } from "ai";
import { z } from "zod";
import { aiProviderRouter } from "@/lib/ai-providers";
import { logger } from "@/lib/logger";
import { INTENT_TYPES, type IntentTypeValue } from "./constants";

// ============================================
// Schema 定义
// ============================================

/**
 * LLM 分类结果 Schema
 */
const LLMClassificationSchema = z.object({
  type: z.enum([
    "query",
    "action",
    "organize",
    "analyze",
    "learn",
    "create",
    "chitchat",
  ]),
  subType: z.string().optional(),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
});

export type LLMClassificationResult = z.infer<typeof LLMClassificationSchema>;

// ============================================
// 配置类型
// ============================================

/**
 * LLM 分类器配置
 */
export interface LLMClassifierConfig {
  /** 模型 ID（可选，默认使用 DeepSeek） */
  modelId?: string;
  /** 超时时间（毫秒），默认 5000 */
  timeoutMs?: number;
  /** 最大重试次数，默认 1 */
  maxRetries?: number;
  /** 是否启用缓存，默认 true */
  cacheEnabled?: boolean;
  /** 缓存 TTL（毫秒），默认 60000（1 分钟） */
  cacheTTLMs?: number;
  /** 是否启用调试模式 */
  debug?: boolean;
  /** 温度参数，默认 0.3（更确定性的输出） */
  temperature?: number;
}

/**
 * 缓存条目
 */
interface CacheEntry {
  result: LLMClassificationResult;
  expiry: number;
}

// ============================================
// Prompt 模板
// ============================================

/**
 * 构建分类 Prompt
 */
function buildClassificationPrompt(message: string): string {
  return `你是一个意图分类专家。请分析用户的输入，判断其意图类型。

意图类型说明：
- query: 查询类（搜索、列表、统计、解释）
  子类型: search, list, count, explain, general
- action: 操作类（移动、删除、添加标签、重命名）
  子类型: move, delete, tag, rename
- organize: 整理类（清理、去重、过期检测、分类归档）
  子类型: cleanup, dedupe, expire, classify
- analyze: 分析类（报告、洞察、趋势分析）
  子类型: report, insight
- learn: 学习类（复习、面试准备、学习路径规划）
  子类型: review, interview, path
- create: 创建类（摘要、笔记、分享导出）
  子类型: digest, note, share
- chitchat: 闲聊类（问候、帮助、感谢）
  子类型: greeting, help, thanks, general

用户输入: "${message}"

请分析并返回:
1. type: 意图主类型（必填）
2. subType: 意图子类型（选填，如果能确定）
3. confidence: 置信度 0-1（你对分类结果的确信程度）
4. reasoning: 分类理由（简短说明为什么这样分类）`;
}

// ============================================
// LLMIntentClassifier 类
// ============================================

/**
 * LLM 意图分类器
 *
 * 使用 LLM 进行意图分类，作为规则分类器的兜底方案
 */
export class LLMIntentClassifier {
  private config: Required<LLMClassifierConfig>;
  private cache: Map<string, CacheEntry>;
  private isInitialized: boolean = false;

  constructor(config: LLMClassifierConfig = {}) {
    this.config = {
      modelId: config.modelId ?? "deepseek-chat",
      timeoutMs: config.timeoutMs ?? 5000,
      maxRetries: config.maxRetries ?? 1,
      cacheEnabled: config.cacheEnabled ?? true,
      cacheTTLMs: config.cacheTTLMs ?? 60000,
      debug: config.debug ?? false,
      temperature: config.temperature ?? 0.3,
    };
    this.cache = new Map();
  }

  /**
   * 使用 LLM 分类意图
   *
   * @param message - 用户输入
   * @returns 分类结果，失败时返回 null
   */
  async classify(message: string): Promise<LLMClassificationResult | null> {
    const startTime = performance.now();

    // 1. 检查缓存
    if (this.config.cacheEnabled) {
      const cached = this.getCached(message);
      if (cached) {
        if (this.config.debug) {
          logger.debug(
            { message: message.substring(0, 50) },
            "LLMClassifier: Cache hit",
          );
        }
        return cached;
      }
    }

    // 2. 获取模型
    const model = aiProviderRouter.getModel("deepseek", this.config.modelId);
    if (!model) {
      logger.warn(
        { modelId: this.config.modelId },
        "LLMClassifier: Failed to get model, using fallback",
      );
      // 尝试使用其他可用的 provider
      const fallbackSelection = aiProviderRouter.selectProvider({
        taskType: "classify",
      });
      if (!fallbackSelection) {
        logger.error("LLMClassifier: No available provider for classification");
        return null;
      }
    }

    // 3. 使用 executeWithFallback 进行分类
    try {
      const result = await this.classifyWithModel(message);

      // 4. 缓存结果
      if (this.config.cacheEnabled && result) {
        this.setCache(message, result);
      }

      const durationMs = Math.round(performance.now() - startTime);

      if (this.config.debug) {
        logger.debug(
          {
            message: message.substring(0, 50),
            type: result?.type,
            confidence: result?.confidence,
            durationMs,
          },
          "LLMClassifier: Classification completed",
        );
      }

      return result;
    } catch (error) {
      const durationMs = Math.round(performance.now() - startTime);
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          message: message.substring(0, 50),
          durationMs,
        },
        "LLMClassifier: Classification failed",
      );
      return null;
    }
  }

  /**
   * 使用模型进行分类
   */
  private async classifyWithModel(
    message: string,
  ): Promise<LLMClassificationResult | null> {
    return aiProviderRouter.executeWithFallback("classify", async (model) => {
      // 创建带超时的 AbortController
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        this.config.timeoutMs,
      );

      try {
        const { object } = await generateObject({
          model,
          schema: LLMClassificationSchema,
          prompt: buildClassificationPrompt(message),
          temperature: this.config.temperature,
          maxRetries: this.config.maxRetries,
          abortSignal: controller.signal,
        });

        return object;
      } finally {
        clearTimeout(timeoutId);
      }
    });
  }

  /**
   * 检查意图类型是否有效
   */
  isValidIntentType(type: string): type is IntentTypeValue {
    return Object.values(INTENT_TYPES).includes(type as IntentTypeValue);
  }

  /**
   * 获取缓存
   */
  private getCached(message: string): LLMClassificationResult | null {
    const key = this.getCacheKey(message);
    const cached = this.cache.get(key);

    if (cached && cached.expiry > Date.now()) {
      return cached.result;
    }

    if (cached) {
      this.cache.delete(key);
    }

    return null;
  }

  /**
   * 设置缓存
   */
  private setCache(message: string, result: LLMClassificationResult): void {
    const key = this.getCacheKey(message);
    this.cache.set(key, {
      result,
      expiry: Date.now() + this.config.cacheTTLMs,
    });
  }

  /**
   * 生成缓存键
   *
   * 使用简单的归一化策略：小写、去除首尾空白、截取前 200 字符
   */
  private getCacheKey(message: string): string {
    return message.toLowerCase().trim().substring(0, 200);
  }

  /**
   * 清理过期缓存
   */
  cleanupCache(): number {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, value] of this.cache.entries()) {
      if (value.expiry < now) {
        this.cache.delete(key);
        cleanedCount++;
      }
    }

    if (this.config.debug && cleanedCount > 0) {
      logger.debug({ cleanedCount }, "LLMClassifier: Cache cleanup completed");
    }

    return cleanedCount;
  }

  /**
   * 获取缓存统计
   */
  getCacheStats(): {
    size: number;
    activeCount: number;
    expiredCount: number;
  } {
    const now = Date.now();
    let activeCount = 0;
    let expiredCount = 0;

    for (const value of this.cache.values()) {
      if (value.expiry > now) {
        activeCount++;
      } else {
        expiredCount++;
      }
    }

    return {
      size: this.cache.size,
      activeCount,
      expiredCount,
    };
  }

  /**
   * 清空缓存
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * 获取当前配置
   */
  getConfig(): Readonly<Required<LLMClassifierConfig>> {
    return { ...this.config };
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<LLMClassifierConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };
  }
}

// ============================================
// 工厂函数
// ============================================

/**
 * 创建 LLM 分类器实例
 */
export function createLLMClassifier(
  config?: LLMClassifierConfig,
): LLMIntentClassifier {
  return new LLMIntentClassifier(config);
}

/**
 * 默认 LLM 分类器实例（懒加载）
 */
let defaultLLMClassifier: LLMIntentClassifier | null = null;

export function getLLMClassifier(): LLMIntentClassifier {
  if (!defaultLLMClassifier) {
    defaultLLMClassifier = createLLMClassifier();
  }
  return defaultLLMClassifier;
}
