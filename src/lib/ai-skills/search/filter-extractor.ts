/**
 * 智能过滤器提取器
 *
 * 从自然语言查询中提取结构化过滤条件
 * 支持规则引擎和 LLM 降级两种模式
 *
 * @version 1.0.0
 * @since 2026-01-02
 */

import type {
  ExtractedFilter,
  FilterExtractionResult,
  FilterExtractorConfig,
  FilterExtractionRule,
} from "./filter-extractor.types";
import { DEFAULT_FILTER_EXTRACTOR_CONFIG } from "./filter-extractor.types";
import { FILTER_EXTRACTION_RULES } from "./filter-extraction-rules";
import { logger as serverLogger } from "@/lib/logger";

// =============================================================================
// 日志前缀
// =============================================================================

const LOG_PREFIX = "[FilterExtractor]";

// =============================================================================
// FilterExtractor 类
// =============================================================================

export class FilterExtractor {
  private config: FilterExtractorConfig;
  private rules: FilterExtractionRule[];

  constructor(
    config: Partial<FilterExtractorConfig> = {},
    customRules?: FilterExtractionRule[],
  ) {
    this.config = { ...DEFAULT_FILTER_EXTRACTOR_CONFIG, ...config };
    this.rules = customRules || FILTER_EXTRACTION_RULES;
  }

  /**
   * 从查询中提取过滤器
   */
  async extract(query: string): Promise<FilterExtractionResult> {
    const startTime = Date.now();
    const debug = this.config.debug;

    // 空查询检查
    if (!query || query.trim().length < this.config.minQueryLength) {
      return {
        success: true,
        filters: [],
        cleanedQuery: query?.trim() || "",
        confidence: 1,
        source: "rule",
        latencyMs: Date.now() - startTime,
        debug: debug
          ? {
              matchedRules: [],
              llmInvoked: false,
              originalQuery: query,
            }
          : undefined,
      };
    }

    const originalQuery = query.trim();
    let cleanedQuery = originalQuery;
    const filters: ExtractedFilter[] = [];
    const matchedRules: string[] = [];

    // 按优先级遍历规则
    for (const rule of this.rules) {
      // 检查过滤器数量限制
      if (filters.length >= this.config.maxFilters) {
        break;
      }

      // 尝试匹配
      const match = cleanedQuery.match(rule.pattern);
      if (!match) continue;

      // 提取过滤器
      try {
        const filter = rule.extract(match, cleanedQuery);
        if (filter) {
          filters.push(filter);
          matchedRules.push(rule.id);

          // 从查询中移除匹配文本
          if (rule.removeFromQuery) {
            cleanedQuery = cleanedQuery.replace(match[0], " ").trim();
          }

          serverLogger.debug(
            {
              ruleId: rule.id,
              filterType: filter.type,
              expression: (filter as { expression?: string }).expression,
            },
            `${LOG_PREFIX} Filter extracted`,
          );
        }
      } catch (error) {
        serverLogger.warn(
          {
            ruleId: rule.id,
            error: error instanceof Error ? error.message : String(error),
          },
          `${LOG_PREFIX} Rule extraction failed`,
        );
      }
    }

    // 清理多余空格
    cleanedQuery = cleanedQuery.replace(/\s+/g, " ").trim();

    // 计算置信度
    const confidence = this.calculateConfidence(filters, originalQuery);

    // 如果规则提取不足且启用 LLM 降级
    const shouldUseLLM =
      this.config.enableLLMFallback &&
      filters.length === 0 &&
      this.hasFilterIndicators(originalQuery);

    if (shouldUseLLM) {
      serverLogger.debug(
        { query: originalQuery },
        `${LOG_PREFIX} LLM fallback triggered`,
      );
      // LLM 降级逻辑（预留接口，暂不实现）
      // const llmResult = await this.extractWithLLM(originalQuery);
      // if (llmResult) { ... }
    }

    const result: FilterExtractionResult = {
      success: true,
      filters,
      cleanedQuery,
      confidence,
      source: "rule",
      latencyMs: Date.now() - startTime,
      debug: debug
        ? {
            matchedRules,
            llmInvoked: false,
            originalQuery,
          }
        : undefined,
    };

    serverLogger.info(
      {
        filterCount: filters.length,
        cleanedQuery,
        confidence,
        latencyMs: result.latencyMs,
      },
      `${LOG_PREFIX} Extraction completed`,
    );

    return result;
  }

  /**
   * 计算提取置信度
   */
  private calculateConfidence(
    filters: ExtractedFilter[],
    originalQuery: string,
  ): number {
    if (filters.length === 0) return 0.5;

    // 基础分：有过滤器 = 0.7
    let confidence = 0.7;

    // 过滤器数量加成（最多 +0.15）
    confidence += Math.min(filters.length * 0.05, 0.15);

    // 不同类型的过滤器加成（多样性）
    const uniqueTypes = new Set(filters.map((f) => f.type));
    confidence += Math.min(uniqueTypes.size * 0.03, 0.1);

    // 清理后查询非空加成
    const totalExpressionLength = filters.reduce(
      (sum, f) =>
        sum + ((f as { expression?: string }).expression?.length || 0),
      0,
    );
    const cleanedRatio = 1 - totalExpressionLength / originalQuery.length;
    if (cleanedRatio > 0.3) {
      confidence += 0.05;
    }

    return Math.min(confidence, 1);
  }

  /**
   * 检查是否有过滤器指示词
   */
  private hasFilterIndicators(query: string): boolean {
    const indicators = [
      /最近|本周|上周|本月|今天|昨天/, // 时间
      /微信|b站|知乎|掘金/, // 平台
      /标签|分类|文件夹/, // 分类
      /星标|收藏|未读|已读/, // 状态
      /相关|关于/, // 主题
      /最新|最早|前\d+/, // 排序/限制
    ];

    return indicators.some((pattern) => pattern.test(query));
  }

  /**
   * 获取配置
   */
  getConfig(): FilterExtractorConfig {
    return { ...this.config };
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<FilterExtractorConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

// =============================================================================
// 单例实例
// =============================================================================

let filterExtractorInstance: FilterExtractor | null = null;

/**
 * 获取 FilterExtractor 单例
 */
export function getFilterExtractor(
  config?: Partial<FilterExtractorConfig>,
): FilterExtractor {
  if (!filterExtractorInstance) {
    filterExtractorInstance = new FilterExtractor(config);
  }
  return filterExtractorInstance;
}

/**
 * 重置 FilterExtractor 单例（用于测试）
 */
export function resetFilterExtractor(): void {
  filterExtractorInstance = null;
}

// =============================================================================
// 便捷函数
// =============================================================================

/**
 * 快速提取过滤器
 */
export async function extractFilters(
  query: string,
  config?: Partial<FilterExtractorConfig>,
): Promise<FilterExtractionResult> {
  const extractor = config ? new FilterExtractor(config) : getFilterExtractor();
  return extractor.extract(query);
}
