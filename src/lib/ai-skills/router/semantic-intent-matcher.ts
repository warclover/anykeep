/**
 * SemanticIntentMatcher - 语义意图匹配器
 *
 * 职责：
 * - 将意图模式和用户输入转换为向量
 * - 通过余弦相似度进行语义匹配
 * - 支持口语化、模糊表达
 *
 * 策略：Embedding 相似度匹配
 *
 * @version 1.0.0
 * @since 2026-01-09
 */

import { logger } from "@/lib/logger";
import { generateEmbedding } from "@/lib/utils/embedding-generator";
import type { IntentRule, IntentType } from "./types";

/**
 * 意图 Embedding 缓存
 */
interface IntentEmbedding {
  type: IntentType;
  subType: string;
  embedding: number[];
  examples: string[];
  weight: number;
}

/**
 * 语义匹配结果
 */
export interface SemanticMatch {
  type: IntentType;
  subType: string;
  similarity: number;
  method: "semantic";
}

/**
 * 语义意图匹配器配置
 *
 * 注: 移除了 enableParallel 配置 (Code Review #4)
 * 原因: cosineSimilarity 是同步计算，Promise.all 无法实现真正的并行
 */
export interface SemanticIntentMatcherConfig {
  /** 相似度阈值（默认 0.7） */
  similarityThreshold?: number;
  /** 是否启用缓存（默认 true） */
  enableCache?: boolean;
  /** 调试模式 */
  debug?: boolean;
  /** 最大候选数量（默认 50，用于性能优化） */
  maxCandidates?: number;
}

/**
 * 语义意图匹配器
 */
export class SemanticIntentMatcher {
  private embeddings: Map<string, IntentEmbedding> = new Map();
  private config: Required<SemanticIntentMatcherConfig>;
  private isInitialized: boolean = false;

  constructor(config: SemanticIntentMatcherConfig = {}) {
    this.config = {
      similarityThreshold: config.similarityThreshold ?? 0.7,
      enableCache: config.enableCache ?? true,
      debug: config.debug ?? false,
      maxCandidates: config.maxCandidates ?? 50,
    };
  }

  /**
   * 预计算所有意图的 Embedding
   * 在应用启动时执行一次
   *
   * @param rules - 意图规则列表
   */
  async precomputeEmbeddings(rules: IntentRule[]): Promise<void> {
    if (this.isInitialized) {
      if (this.config.debug) {
        logger.debug("SemanticIntentMatcher: Already initialized");
      }
      return;
    }

    const startTime = performance.now();
    logger.info(
      { ruleCount: rules.length },
      "SemanticIntentMatcher: Starting precomputation",
    );

    try {
      // 按意图类型分组
      const intentGroups = this.groupRulesByIntent(rules);

      // 并发计算 Embedding（限制并发数避免过载）
      const batchSize = 5;
      const batches: IntentRule[][] = [];

      for (let i = 0; i < intentGroups.length; i += batchSize) {
        batches.push(intentGroups.slice(i, i + batchSize));
      }

      for (const batch of batches) {
        await Promise.all(
          batch.map((rule) => this.computeIntentEmbedding(rule)),
        );
      }

      const durationMs = Math.round(performance.now() - startTime);
      logger.info(
        {
          intentCount: this.embeddings.size,
          durationMs,
        },
        "SemanticIntentMatcher: Precomputation completed",
      );

      this.isInitialized = true;
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
        },
        "SemanticIntentMatcher: Precomputation failed",
      );
      throw error;
    }
  }

  /**
   * 语义匹配
   *
   * @param input - 用户输入
   * @returns 匹配结果列表（按相似度降序）
   */
  async match(input: string): Promise<SemanticMatch[]> {
    if (!this.isInitialized || this.embeddings.size === 0) {
      if (this.config.debug) {
        logger.warn(
          "SemanticIntentMatcher: Not initialized, returning empty matches",
        );
      }
      return [];
    }

    const startTime = performance.now();

    try {
      // 1. 生成用户输入的 Embedding（使用向量缓存）
      const inputEmbedding = await generateEmbedding(input);

      if (!inputEmbedding || inputEmbedding.length === 0) {
        logger.warn(
          "SemanticIntentMatcher: Failed to generate input embedding",
        );
        return [];
      }

      // 2. 计算与所有意图的相似度（优化：限制候选数量）
      const matches: SemanticMatch[] = [];
      const intentEntries = Array.from(this.embeddings.entries());

      // 性能优化：如果意图数量很多，先快速筛选 top N 个候选
      if (intentEntries.length > this.config.maxCandidates) {
        // 快速预筛选：计算所有相似度，但只保留 top N
        const similarities = intentEntries.map(([key, intent]) => ({
          key,
          intent,
          similarity: cosineSimilarity(inputEmbedding, intent.embedding),
        }));

        // 按相似度降序排序，取 top N
        similarities.sort((a, b) => b.similarity - a.similarity);
        const topCandidates = similarities.slice(0, this.config.maxCandidates);

        // 只处理 top N 个候选
        for (const { intent, similarity } of topCandidates) {
          if (similarity >= this.config.similarityThreshold) {
            matches.push({
              type: intent.type,
              subType: intent.subType,
              similarity,
              method: "semantic",
            });
          }
        }
      } else {
        // 意图数量较少，直接同步计算所有 (Code Review #4: 移除无效的并行配置)
        for (const [, intent] of intentEntries) {
          const similarity = cosineSimilarity(inputEmbedding, intent.embedding);

          if (similarity >= this.config.similarityThreshold) {
            matches.push({
              type: intent.type,
              subType: intent.subType,
              similarity,
              method: "semantic",
            });
          }
        }
      }

      // 3. 按相似度降序排序
      matches.sort((a, b) => b.similarity - a.similarity);

      const durationMs = Math.round(performance.now() - startTime);

      if (this.config.debug) {
        logger.debug(
          {
            input: input.substring(0, 50),
            matchCount: matches.length,
            topMatch: matches[0],
            durationMs,
            totalIntents: intentEntries.length,
          },
          "SemanticIntentMatcher: Match completed",
        );
      }

      return matches;
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          input: input.substring(0, 50),
        },
        "SemanticIntentMatcher: Match failed",
      );
      return [];
    }
  }

  /**
   * 计算单个意图的 Embedding
   */
  private async computeIntentEmbedding(rule: IntentRule): Promise<void> {
    const key = `${rule.type}:${rule.subType || "default"}`;

    // 如果已存在，跳过
    if (this.embeddings.has(key)) {
      return;
    }

    try {
      // 生成训练样本
      const examples = this.generateExamples(rule);

      // 合并所有样本为一个文本（用于 Embedding）
      const combinedText = examples.join(" ");

      // 生成 Embedding
      const embedding = await generateEmbedding(combinedText);

      if (!embedding || embedding.length === 0) {
        logger.warn(
          { intent: key },
          "SemanticIntentMatcher: Failed to generate embedding for intent",
        );
        return;
      }

      // 存储
      this.embeddings.set(key, {
        type: rule.type,
        subType: rule.subType || "default",
        embedding,
        examples,
        weight: rule.weight || 50,
      });
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          intent: key,
        },
        "SemanticIntentMatcher: Failed to compute embedding for intent",
      );
    }
  }

  /**
   * 为意图生成训练样本
   */
  private generateExamples(rule: IntentRule): string[] {
    const examples: string[] = [];

    // 从正则模式中提取文本（简化处理）
    const patternStr = rule.pattern.toString();

    // 提取正则中的文字部分（去除特殊字符）
    const textParts = patternStr
      .replace(/[\/\^$.*+?()\[\]{}|\\]/g, " ")
      .split(/\s+/)
      .filter((s) => s.length > 1);

    // 基础样本
    for (const part of textParts) {
      if (part.length > 1) {
        examples.push(part);
      }
    }

    // 如果规则有子类型，添加子类型作为样本
    if (rule.subType) {
      examples.push(rule.subType);
    }

    // 添加意图类型
    examples.push(rule.type);

    // 生成口语化变体
    const expanded: string[] = [];
    for (const base of examples) {
      if (base.length > 1) {
        expanded.push(base);
        expanded.push(`帮我${base}`);
        expanded.push(`我想${base}`);
        expanded.push(`能不能${base}`);
        expanded.push(`${base}一下`);
        expanded.push(`请${base}`);
      }
    }

    // 去重并限制数量（避免 Embedding 文本过长）
    return Array.from(new Set(expanded)).slice(0, 20);
  }

  /**
   * 按意图类型分组规则
   */
  private groupRulesByIntent(rules: IntentRule[]): IntentRule[] {
    // 去重：相同 type:subType 的规则只保留权重最高的
    const grouped = new Map<string, IntentRule>();

    for (const rule of rules) {
      const key = `${rule.type}:${rule.subType || "default"}`;
      const existing = grouped.get(key);

      if (!existing || (rule.weight || 0) > (existing.weight || 0)) {
        grouped.set(key, rule);
      }
    }

    return Array.from(grouped.values());
  }

  /**
   * 获取已初始化的意图数量
   */
  getInitializedCount(): number {
    return this.embeddings.size;
  }

  /**
   * 检查是否已初始化
   */
  getIsInitialized(): boolean {
    return this.isInitialized;
  }
}

/**
 * 计算余弦相似度
 *
 * @param vec1 - 向量1
 * @param vec2 - 向量2
 * @returns 相似度 0-1
 */
function cosineSimilarity(vec1: number[], vec2: number[]): number {
  if (vec1.length !== vec2.length) {
    logger.warn(
      {
        vec1Length: vec1.length,
        vec2Length: vec2.length,
      },
      "SemanticIntentMatcher: Vector dimension mismatch",
    );
    return 0;
  }

  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;

  for (let i = 0; i < vec1.length; i++) {
    dotProduct += vec1[i]! * vec2[i]!;
    norm1 += vec1[i]! * vec1[i]!;
    norm2 += vec2[i]! * vec2[i]!;
  }

  const denominator = Math.sqrt(norm1) * Math.sqrt(norm2);

  if (denominator === 0) {
    return 0;
  }

  return dotProduct / denominator;
}
