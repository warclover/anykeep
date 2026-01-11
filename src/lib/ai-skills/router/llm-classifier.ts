/**
 * LLMIntentClassifier - LLM 意图分类器
 *
 * 职责：
 * - 当规则匹配置信度不足时，使用 LLM 辅助分类
 * - 缓存分类结果减少 API 调用
 * - 超时控制保障响应速度
 *
 * Code Review P1-1: 添加外部 AbortSignal 支持
 *
 * @version 1.2.0
 * @since 2025-12-26
 * @updated 2026-01-10 - 改进缓存键生成策略 (Code Review #5)
 * @updated 2026-01-10 - 添加外部 AbortSignal 支持 (Code Review P1-1)
 */

import { generateObject } from "ai";
import { z } from "zod";
import { aiProviderRouter } from "@/lib/ai-providers";
import { logger } from "@/lib/logger";
import { INTENT_TYPES, type IntentTypeValue } from "./constants";
import { IntentSlotsSchema, validateSlotCompleteness } from "./slot-schemas";
import type { ClassificationContext } from "./hybrid-intent-classifier";

// ============================================
// 工具函数
// ============================================

/**
 * 简单的字符串哈希函数 (djb2 算法)
 * 用于生成缓存键，避免冲突
 *
 * @param str - 输入字符串
 * @returns 32 位十六进制哈希字符串
 */
function simpleHash(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
  }
  // 转换为正数并格式化为16进制
  return (hash >>> 0).toString(16).padStart(8, "0");
}

// ============================================
// Schema 定义
// ============================================

/**
 * LLM 分类结果 Schema（不含槽位，向后兼容）
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

/**
 * LLM 分类 + 槽位提取结果 Schema（Phase 2 新增）
 */
const LLMClassificationWithSlotsSchema = z.object({
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
  slots: IntentSlotsSchema.optional(),
  alternatives: z
    .array(
      z.object({
        type: z.string(),
        subType: z.string().optional(),
        confidence: z.number().min(0).max(1),
      }),
    )
    .optional(),
});

export type LLMClassificationWithSlotsResult = z.infer<
  typeof LLMClassificationWithSlotsSchema
>;

// ============================================
// 配置类型
// ============================================

/**
 * LLM 分类器配置
 */
export interface LLMClassifierConfig {
  /** 模型 ID（可选，默认使用 DeepSeek） */
  modelId?: string;
  /** 超时时间（毫秒），默认 1500（符合 Slow Track 规范） */
  timeoutMs?: number;
  /** 最大重试次数，默认 1 */
  maxRetries?: number;
  /** 是否启用缓存，默认 true */
  cacheEnabled?: boolean;
  /** 缓存 TTL（毫秒），默认 300000（5 分钟） */
  cacheTTLMs?: number;
  /** 是否启用调试模式 */
  debug?: boolean;
  /** 温度参数，默认 0.3（更确定性的输出） */
  temperature?: number;
  /** 是否启用槽位提取（Phase 2 新增，默认 false 保持向后兼容） */
  enableSlotExtraction?: boolean;
}

/**
 * 缓存条目（支持两种结果类型）
 */
interface CacheEntry {
  result: LLMClassificationResult | LLMClassificationWithSlotsResult;
  expiry: number;
  hasSlots: boolean;
}

/**
 * LLM 分类选项
 *
 * P1-1: 添加外部 AbortSignal 支持
 */
export interface LLMClassificationOptions {
  /** 外部取消信号（优先于内部超时） */
  signal?: AbortSignal;
}

// ============================================
// Prompt 模板
// ============================================

/**
 * 构建分类 Prompt（不含槽位）
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

/**
 * 构建带槽位提取的分类 Prompt（Phase 2 新增）
 */
function buildClassificationWithSlotsPrompt(
  message: string,
  context?: ClassificationContext,
): string {
  const contextInfo = context
    ? `
对话上下文:
${context.selectedBookmarks ? `- 已选中书签: ${context.selectedBookmarks.length} 个` : ""}
${context.currentFolder ? `- 当前文件夹: ${context.currentFolder}` : ""}
${context.messageHistory ? `- 历史消息: ${context.messageHistory.length} 条` : ""}
`
    : "";

  return `你是一个意图分类和参数提取专家。请分析用户的输入，完成以下任务：
1. 识别用户意图（type + subType）
2. 提取结构化参数（slots）

## 意图类型说明
- query: 查询类（搜索、列表、统计、解释）
  - search: 搜索书签（需要: query）
  - list: 列出书签（可选: folder, tags, platform, limit）
  - count: 统计数量（可选: folder, tags, platform）
- action: 操作类（移动、删除、添加标签、重命名）
  - move: 移动书签（需要: targetFolder，可选: bookmarkIds, sourceFolder）
  - delete: 删除书签（可选: bookmarkIds, scope, confirm）
  - tag: 添加标签（需要: tags，可选: bookmarkIds, scope）
  - rename: 重命名（需要: newTitle，可选: bookmarkId）
- organize: 整理类（清理、去重、过期检测、分类归档）
  - move: 移动书签（需要: targetFolder，可选: sourceFolder, bookmarkIds, filter）
  - cleanup: 清理书签（可选: scope, strategy, dryRun）
  - dedupe: 去重（可选: scope, strategy）
  - classify: 自动分类（可选: scope, autoTag）
  - tag: 添加标签（需要: tags，可选: bookmarkIds, scope）
- analyze: 分析类（报告、洞察、趋势分析）
  - report: 生成报告（可选: scope, period, format）
  - insight: 洞察分析（可选: scope, dimension）
- learn: 学习类（复习、面试准备、学习路径规划）
  - review: 知识回顾（可选: scope, mode）
  - path: 学习路径（可选: topic, level）
- create: 创建类（摘要、笔记、分享导出）
  - export: 导出书签（需要: format，可选: bookmarkIds, fields, outputPath）
  - digest: 生成摘要（可选: bookmarkIds, scope, format）
  - note: 创建笔记（需要: content，可选: folder, tags）
  - synthesis: 主题合成（可选: bookmarkIds, topic, format）
- chitchat: 闲聊类（问候、帮助、感谢）
  - greeting: 问候
  - help: 帮助
  - thanks: 感谢

## 用户输入
"${message}"
${contextInfo}

## 输出要求
1. type: 意图主类型（必填）
2. subType: 意图子类型（选填，如果能确定）
3. confidence: 置信度 0-1
4. reasoning: 分类理由
5. slots: 结构化参数（对象，键为槽位名称）
   - 每个槽位包含: value（值）、type（类型：string/number/boolean/array/object）、confidence（置信度 0-1）、source（来源）
   - source 可选值: "extracted"（从输入提取）、"inferred"（从上下文推断）、"default"（默认值）、"context"（从上下文获取）
6. alternatives: 备选意图（可选，当置信度较低时提供）

## 注意事项
- 只提取用户明确提及或可以从上下文推断的参数
- 如果参数不明确，不要猜测，留空即可
- 对于指代（如"这些"、"那个"），尝试从上下文推断具体值`;
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
      timeoutMs: config.timeoutMs ?? 1500, // Slow Track: ≤1500ms
      maxRetries: config.maxRetries ?? 1,
      cacheEnabled: config.cacheEnabled ?? true,
      cacheTTLMs: config.cacheTTLMs ?? 300000, // Phase 1: 5 分钟 (原 60s)
      debug: config.debug ?? false,
      temperature: config.temperature ?? 0.3,
      enableSlotExtraction: config.enableSlotExtraction ?? false,
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
   * 使用 LLM 分类意图并提取槽位（Phase 2 新增）
   *
   * P1-1: 添加外部 AbortSignal 支持
   *
   * @param message - 用户输入
   * @param context - 分类上下文（可选）
   * @param options - 分类选项（可选，包含取消信号）
   * @returns 分类结果（含槽位），失败时返回 null
   */
  async classifyWithSlots(
    message: string,
    context?: ClassificationContext,
    options?: LLMClassificationOptions,
  ): Promise<LLMClassificationWithSlotsResult | null> {
    const startTime = performance.now();
    const { signal } = options || {};

    // P1-1: 检查是否已取消
    if (signal?.aborted) {
      throw new DOMException("LLM classification aborted", "AbortError");
    }

    // 1. 检查缓存
    if (this.config.cacheEnabled) {
      const cached = this.getCachedWithSlots(message);
      if (cached) {
        if (this.config.debug) {
          logger.debug(
            { message: message.substring(0, 50) },
            "LLMClassifier: Cache hit (with slots)",
          );
        }
        return cached;
      }
    }

    // 2. 如果未启用槽位提取，回退到普通分类
    if (!this.config.enableSlotExtraction) {
      const result = await this.classify(message);
      if (!result) {
        return null;
      }
      // 转换为带槽位的结果（槽位为空）
      return {
        ...result,
        slots: undefined,
      };
    }

    // 3. 使用 executeWithFallback 进行分类（带槽位）
    try {
      // P1-1: 传递外部 signal
      const result = await this.classifyWithSlotsModel(
        message,
        context,
        signal,
      );

      // 4. 验证槽位完整性
      if (result && result.slots) {
        const validation = validateSlotCompleteness(
          result.type,
          result.subType,
          result.slots,
        );
        if (this.config.debug && !validation.complete) {
          logger.debug(
            {
              intentType: result.type,
              subType: result.subType,
              missing: validation.missing,
              completeness: validation.completeness,
            },
            "LLMClassifier: Slot completeness validation",
          );
        }
      }

      // 5. 缓存结果
      if (this.config.cacheEnabled && result) {
        this.setCacheWithSlots(message, result);
      }

      const durationMs = Math.round(performance.now() - startTime);

      if (this.config.debug) {
        logger.debug(
          {
            message: message.substring(0, 50),
            type: result?.type,
            subType: result?.subType,
            confidence: result?.confidence,
            slotsCount: result?.slots ? Object.keys(result.slots).length : 0,
            durationMs,
          },
          "LLMClassifier: Classification with slots completed",
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
        "LLMClassifier: Classification with slots failed",
      );
      return null;
    }
  }

  /**
   * 使用模型进行分类（带槽位提取）
   *
   * P1-1: 添加外部 AbortSignal 支持
   *
   * @param message - 用户输入
   * @param context - 分类上下文
   * @param externalSignal - 外部取消信号
   */
  private async classifyWithSlotsModel(
    message: string,
    context?: ClassificationContext,
    externalSignal?: AbortSignal,
  ): Promise<LLMClassificationWithSlotsResult | null> {
    return aiProviderRouter.executeWithFallback("classify", async (model) => {
      // P1-1: 检查外部信号是否已取消
      if (externalSignal?.aborted) {
        throw new DOMException("LLM classification aborted", "AbortError");
      }

      // 创建内部 AbortController（用于超时控制）
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        this.config.timeoutMs,
      );

      // P1-1: 监听外部取消信号，联动取消内部操作
      const externalAbortHandler = () => {
        controller.abort();
      };
      externalSignal?.addEventListener("abort", externalAbortHandler);

      try {
        const { object } = await generateObject({
          model,
          schema: LLMClassificationWithSlotsSchema,
          prompt: buildClassificationWithSlotsPrompt(message, context),
          temperature: this.config.temperature,
          maxRetries: this.config.maxRetries,
          abortSignal: controller.signal,
        });

        // 验证意图类型
        if (!this.isValidIntentType(object.type)) {
          logger.warn(
            { type: object.type },
            "LLMClassifier: Invalid intent type from LLM",
          );
          return null;
        }

        return object;
      } finally {
        clearTimeout(timeoutId);
        externalSignal?.removeEventListener("abort", externalAbortHandler);
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
   * 获取缓存（不含槽位）
   */
  private getCached(message: string): LLMClassificationResult | null {
    const key = this.getCacheKey(message);
    const cached = this.cache.get(key);

    if (cached && cached.expiry > Date.now() && !cached.hasSlots) {
      return cached.result as LLMClassificationResult;
    }

    if (cached && cached.expiry <= Date.now()) {
      this.cache.delete(key);
    }

    return null;
  }

  /**
   * 获取缓存（含槽位）
   */
  private getCachedWithSlots(
    message: string,
  ): LLMClassificationWithSlotsResult | null {
    const key = this.getCacheKey(message);
    const cached = this.cache.get(key);

    if (cached && cached.expiry > Date.now() && cached.hasSlots) {
      return cached.result as LLMClassificationWithSlotsResult;
    }

    if (cached && cached.expiry <= Date.now()) {
      this.cache.delete(key);
    }

    return null;
  }

  /**
   * 设置缓存（不含槽位）
   */
  private setCache(message: string, result: LLMClassificationResult): void {
    const key = this.getCacheKey(message);
    this.cache.set(key, {
      result,
      expiry: Date.now() + this.config.cacheTTLMs,
      hasSlots: false,
    });
  }

  /**
   * 设置缓存（含槽位）
   */
  private setCacheWithSlots(
    message: string,
    result: LLMClassificationWithSlotsResult,
  ): void {
    const key = this.getCacheKey(message);
    this.cache.set(key, {
      result,
      expiry: Date.now() + this.config.cacheTTLMs,
      hasSlots: true,
    });
  }

  /**
   * 生成缓存键
   *
   * 使用哈希算法避免键冲突 (Code Review #5)
   * - 归一化: 小写、去除首尾空白
   * - 哈希: 使用 djb2 算法生成唯一键
   */
  private getCacheKey(message: string): string {
    const normalized = message.toLowerCase().trim();
    // 使用哈希避免长消息截断导致的冲突
    return simpleHash(normalized);
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
