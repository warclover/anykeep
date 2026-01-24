/**
 * 智能分类 v5.1 - 冷启动向量增强器
 *
 * 使用 LLM 语义膨胀 + 规则降级策略，为空文件夹生成丰富的语义向量
 *
 * @module classification/v5/folder-profiler/cold-start-enricher
 * @version 1.0.0
 * @since 2026-01-20
 */

import type { LoggerService } from "../shared/logger";
import type { LLMService } from "../shared/llm";
import { generateFolderTags } from "../../utils/folder-tag-generator";

/**
 * 缓存配置
 */
export interface CacheConfig {
  /** 缓存过期时间（秒），默认 86400 (24h) */
  ttlSeconds: number;
  /** LRU 缓存最大条目数，默认 1000 */
  maxEntries: number;
  /** 缓存 Key 策略 */
  keyStrategy: "name_only" | "name_with_parent";
}

/**
 * ColdStartEnricher 配置
 */
export interface ColdStartEnricherConfig {
  /** LLM 调用超时（毫秒），默认 3000 */
  timeoutMs: number;
  /** 最大关键词数量，默认 20 */
  maxKeywords: number;
  /** LLM 生成温度，默认 0.3 */
  temperature: number;
  /** 缓存配置 */
  cache: CacheConfig;
}

/**
 * 语义膨胀结果
 */
export interface EnrichmentResult {
  /** 扩展后的文本 */
  expandedText: string;
  /** 使用的策略 */
  strategy: "llm" | "rule_based" | "fallback";
  /** 生成的关键词数量 */
  keywordCount: number;
  /** 是否命中缓存 */
  cacheHit: boolean;
  /** 处理延迟（毫秒） */
  latencyMs: number;
}

/**
 * LRU 缓存条目
 */
interface CacheEntry {
  keywords: string[];
  timestamp: number;
}

/**
 * 冷启动向量增强器
 *
 * 为空文件夹（0 个书签）生成丰富的语义向量，解决冷启动问题
 */
export class ColdStartEnricher {
  private logger: LoggerService;
  private llmService?: LLMService;
  private config: ColdStartEnricherConfig;
  private cache: Map<string, CacheEntry>;

  constructor(
    logger: LoggerService,
    llmService?: LLMService,
    config?: Partial<ColdStartEnricherConfig>,
  ) {
    this.logger = logger.child({ service: "ColdStartEnricher" });
    this.llmService = llmService;
    this.config = {
      timeoutMs: config?.timeoutMs ?? 3000,
      maxKeywords: config?.maxKeywords ?? 20,
      temperature: config?.temperature ?? 0.3,
      cache: config?.cache ?? {
        ttlSeconds: 86400,
        maxEntries: 1000,
        keyStrategy: "name_with_parent",
      },
    };
    this.cache = new Map();
  }

  /**
   * 使用 LLM 扩展文件夹名称语义
   *
   * @example
   * const result = await enricher.expandFolderName("教程笔记");
   * // result.expandedText => "教程笔记 学习 指南 手册 课程 How-to 步骤 实操 科研绘图 软件教学"
   */
  async expandFolderName(
    folderName: string,
    parentContext?: string,
  ): Promise<EnrichmentResult> {
    const startTime = Date.now();

    // 边缘情况处理：空名称
    if (!folderName || folderName.trim().length === 0) {
      return {
        expandedText: "",
        strategy: "fallback",
        keywordCount: 0,
        cacheHit: false,
        latencyMs: Date.now() - startTime,
      };
    }

    // 构建缓存 Key
    const cacheKey = this.buildCacheKey(folderName, parentContext);

    // 检查缓存
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      const expandedText = [folderName, ...cached].join(" ");
      this.logger.debug("缓存命中", {
        folderName,
        keywordCount: cached.length,
      });
      return {
        expandedText,
        strategy: "llm", // 缓存的是 LLM 结果
        keywordCount: cached.length,
        cacheHit: true,
        latencyMs: Date.now() - startTime,
      };
    }

    // 尝试 LLM 扩展
    try {
      const keywords = await this.llmExpand(folderName, parentContext);
      if (keywords.length > 0) {
        // 缓存结果
        this.setToCache(cacheKey, keywords);

        const expandedText = [folderName, ...keywords].join(" ");
        this.logEnrichment(
          folderName,
          parentContext,
          "llm",
          keywords.length,
          Date.now() - startTime,
          false,
        );

        return {
          expandedText,
          strategy: "llm",
          keywordCount: keywords.length,
          cacheHit: false,
          latencyMs: Date.now() - startTime,
        };
      }
    } catch (error) {
      this.logger.warn("LLM 语义膨胀失败，降级到规则扩展", {
        error: error instanceof Error ? error.message : String(error),
        folderName,
      });
    }

    // 降级：规则扩展
    const ruleKeywords = this.ruleBasedExpand(folderName);
    const expandedText = [folderName, ...ruleKeywords].join(" ");

    this.logEnrichment(
      folderName,
      parentContext,
      "rule_based",
      ruleKeywords.length,
      Date.now() - startTime,
      false,
    );

    return {
      expandedText,
      strategy: "rule_based",
      keywordCount: ruleKeywords.length,
      cacheHit: false,
      latencyMs: Date.now() - startTime,
    };
  }

  /**
   * LLM 语义膨胀
   */
  private async llmExpand(
    folderName: string,
    parentContext?: string,
  ): Promise<string[]> {
    if (!this.llmService) {
      throw new Error("LLM service not available");
    }

    // 构建上下文
    const context = parentContext
      ? `${parentContext} > ${folderName}`
      : folderName;

    // 构建 Prompt
    const prompt = this.buildExpansionPrompt(context);

    // 调用 LLM（带超时）
    const response = await Promise.race([
      this.llmService.complete(prompt, {
        temperature: this.config.temperature,
        maxTokens: 200,
      }),
      this.createTimeout(this.config.timeoutMs),
    ]);

    // 解析关键词
    return this.parseKeywords(response);
  }

  /**
   * 构建 LLM Prompt（JSON 格式输出）
   */
  private buildExpansionPrompt(context: string): string {
    return `任务：为文件夹生成语义扩展关键词

文件夹路径：「${context}」

要求：
1. 输出 JSON 数组格式：["关键词1", "关键词2", ...]
2. 生成 15-20 个高度相关的关键词
3. 包含：核心概念、同义词、常见工具、子领域
4. 每个关键词 1-3 个词
5. 不要生成与主题无关的通用词

示例输入：「教程笔记」
示例输出：["学习", "指南", "手册", "课程", "How-to", "步骤", "实操", "科研绘图", "软件教学", "文档", "参考", "入门", "进阶", "视频教程", "图文教程"]

请为「${context}」生成关键词：`;
  }

  /**
   * 解析 LLM 返回的 JSON 关键词（带容错）
   */
  private parseKeywords(text: string): string[] {
    try {
      // 提取 JSON 数组（可能被包裹在 markdown 代码块中）
      const jsonMatch = text.match(/\[[\s\S]*?\]/);
      if (!jsonMatch) {
        throw new Error("No JSON array found in response");
      }

      const parsed = JSON.parse(jsonMatch[0]);

      if (!Array.isArray(parsed)) {
        throw new Error("Response is not an array");
      }

      // 过滤和清洗关键词
      return parsed
        .filter((k): k is string => typeof k === "string")
        .map((k) => k.trim())
        .filter((k) => k.length >= 2 && k.length <= 20)
        .slice(0, this.config.maxKeywords);
    } catch (error) {
      this.logger.warn("解析 LLM 关键词失败", {
        error: error instanceof Error ? error.message : String(error),
        text: text.slice(0, 200),
      });
      // 解析失败，返回空数组（会触发降级）
      return [];
    }
  }

  /**
   * 规则扩展（降级策略）
   *
   * 使用 folder-tag-generator 生成标签
   */
  private ruleBasedExpand(folderName: string): string[] {
    return generateFolderTags(folderName, {
      enableSynonyms: true,
      maxTags: this.config.maxKeywords,
    });
  }

  /**
   * 构建缓存 Key
   */
  private buildCacheKey(folderName: string, parentContext?: string): string {
    const normalizedName = folderName.toLowerCase().trim();

    if (this.config.cache.keyStrategy === "name_with_parent") {
      const normalizedParent = (parentContext || "root").toLowerCase().trim();
      return `${normalizedName}:${normalizedParent}`;
    }

    return normalizedName;
  }

  /**
   * 从缓存获取
   */
  private getFromCache(key: string): string[] | null {
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }

    // 检查是否过期
    const now = Date.now();
    const age = (now - entry.timestamp) / 1000;
    if (age > this.config.cache.ttlSeconds) {
      this.cache.delete(key);
      return null;
    }

    return entry.keywords;
  }

  /**
   * 写入缓存
   */
  private setToCache(key: string, keywords: string[]): void {
    // LRU 淘汰
    if (this.cache.size >= this.config.cache.maxEntries) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, {
      keywords,
      timestamp: Date.now(),
    });
  }

  /**
   * 创建超时 Promise
   */
  private createTimeout(ms: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error("LLM request timeout")), ms);
    });
  }

  /**
   * 结构化日志记录
   */
  private logEnrichment(
    folderName: string,
    parentContext: string | undefined,
    strategy: "llm" | "rule_based" | "fallback",
    keywordCount: number,
    latencyMs: number,
    cacheHit: boolean,
  ): void {
    this.logger.info("Cold start enrichment completed", {
      event: "cold_start_enrichment",
      folderName,
      parentName: parentContext,
      hasParentContext: !!parentContext,
      strategy,
      keywordCount,
      latencyMs,
      cacheHit,
    });
  }

  /**
   * 清除缓存（用于测试）
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * 获取缓存统计
   */
  getCacheStats(): { size: number; maxEntries: number } {
    return {
      size: this.cache.size,
      maxEntries: this.config.cache.maxEntries,
    };
  }
}
