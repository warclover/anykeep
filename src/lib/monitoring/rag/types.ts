/**
 * RAG 评估与监控类型定义
 *
 * @module monitoring/rag/types
 * @version 1.0.0
 * @since 2025-12-28
 */

// ============================================================================
// 评估相关类型
// ============================================================================

/**
 * 评估测试用例
 */
export interface EvaluationTestCase {
  /** 测试用例 ID */
  id: string;
  /** 用户查询 */
  query: string;
  /** 期望的关键词（用于判断相关性） */
  expectedKeywords: string[];
  /** 真实上下文（可选，用于 faithfulness 评估） */
  groundTruthContext?: string;
  /** 测试用例类别 */
  category?: string;
  /** 难度等级 */
  difficulty?: "easy" | "medium" | "hard";
}

/**
 * RAG 响应结果
 */
export interface RAGResponse {
  /** 生成的回答 */
  answer: string;
  /** 检索到的上下文列表 */
  contexts: string[];
  /** 原始搜索结果 */
  searchResults?: Array<{
    id: string | number;
    title: string;
    content: string;
    similarity: number;
  }>;
  /** 响应时间（毫秒） */
  latencyMs: number;
}

/**
 * 单个评估结果
 */
export interface EvaluationResult {
  /** 测试用例 ID */
  testCaseId: string;
  /** 查询 */
  query: string;
  /** 响应 */
  response: RAGResponse;
  /** 指标分数 */
  scores: {
    /** 忠实度：回答是否基于检索内容 */
    faithfulness: number;
    /** 回答相关性：是否回答了用户问题 */
    answerRelevancy: number;
    /** 上下文精确度：检索结果的排序质量 */
    contextPrecision: number;
    /** 上下文召回：检索到了多少相关内容 */
    contextRecall: number;
  };
  /** 评估时间 */
  evaluatedAt: string;
}

/**
 * 批量评估报告
 */
export interface EvaluationReport {
  /** 报告 ID */
  reportId: string;
  /** 创建时间 */
  createdAt: string;
  /** 测试用例总数 */
  totalCases: number;
  /** 成功评估数 */
  successCount: number;
  /** 失败数 */
  failureCount: number;
  /** 聚合分数 */
  aggregateScores: {
    faithfulness: { mean: number; min: number; max: number; std: number };
    answerRelevancy: { mean: number; min: number; max: number; std: number };
    contextPrecision: { mean: number; min: number; max: number; std: number };
    contextRecall: { mean: number; min: number; max: number; std: number };
  };
  /** 详细结果 */
  results: EvaluationResult[];
  /** 性能统计 */
  performanceStats: {
    avgLatencyMs: number;
    p50LatencyMs: number;
    p95LatencyMs: number;
    p99LatencyMs: number;
  };
}

// ============================================================================
// 监控相关类型
// ============================================================================

/**
 * RAG 实时指标
 */
export interface RAGMetrics {
  // 搜索性能
  /** P50 延迟 (ms) */
  searchLatencyP50: number;
  /** P95 延迟 (ms) */
  searchLatencyP95: number;
  /** P99 延迟 (ms) */
  searchLatencyP99: number;
  /** 平均延迟 (ms) */
  searchLatencyAvg: number;

  // 缓存效率
  /** 向量缓存命中率 */
  vectorCacheHitRate: number;
  /** 查询缓存命中率 */
  queryCacheHitRate: number;
  /** 缓存大小 */
  cacheSize: number;

  // 质量指标
  /** 平均相似度分数 */
  avgSimilarityScore: number;
  /** 零结果率 */
  zeroResultRate: number;
  /** 平均结果数 */
  avgResultCount: number;

  // 成本追踪
  /** Embedding API 调用次数 */
  embeddingApiCalls: number;
  /** Rerank API 调用次数 */
  rerankApiCalls: number;
  /** LLM Token 使用量 */
  llmTokensUsed: number;
  /** 预估成本（元） */
  estimatedCostCNY: number;

  // 时间范围
  /** 统计开始时间 */
  periodStart: string;
  /** 统计结束时间 */
  periodEnd: string;
}

/**
 * 指标阈值配置
 */
export interface RAGMetricThresholds {
  searchLatencyP95Warning: number;
  searchLatencyP95Critical: number;
  cacheHitRateWarning: number;
  cacheHitRateCritical: number;
  zeroResultRateWarning: number;
  zeroResultRateCritical: number;
  dailyCostBudgetCNY: number;
}

/**
 * 默认阈值配置
 */
export const DEFAULT_RAG_THRESHOLDS: RAGMetricThresholds = {
  searchLatencyP95Warning: 500, // ms
  searchLatencyP95Critical: 1000,
  cacheHitRateWarning: 0.5, // 50%
  cacheHitRateCritical: 0.3,
  zeroResultRateWarning: 0.1, // 10%
  zeroResultRateCritical: 0.2,
  dailyCostBudgetCNY: 100, // 100 元/天
};

/**
 * RAG 告警
 */
export interface RAGAlert {
  /** 告警时间 */
  timestamp: string;
  /** 告警级别 */
  level: "info" | "warning" | "critical";
  /** 告警类型 */
  type:
    | "latency"
    | "cache"
    | "quality"
    | "cost"
    | "error_rate"
    | "availability";
  /** 指标名称 */
  metric: string;
  /** 当前值 */
  currentValue: number;
  /** 阈值 */
  threshold: number;
  /** 告警消息 */
  message: string;
}

/**
 * 每日统计记录
 */
export interface DailyRAGStats {
  date: string;
  totalSearches: number;
  uniqueUsers: number;
  metrics: RAGMetrics;
  alerts: RAGAlert[];
}
