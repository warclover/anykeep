/**
 * DashScope Rerank 模块类型定义
 *
 * @module ai-agent/rerank
 * @version 1.0.0
 * @since 2025-12-28
 */

/**
 * Rerank 配置
 */
export interface DashScopeRerankConfig {
  /** 模型名称 */
  model: "gte-rerank";
  /** 返回的 Top N 结果 */
  topK: number;
  /** 是否返回原始文档 */
  returnDocuments: boolean;
  /** 超时时间 (ms) */
  timeoutMs: number;
}

/**
 * 重排序结果项
 */
export interface RerankResult {
  /** 原始文档索引 */
  index: number;
  /** 相关性分数 (0-1) */
  relevanceScore: number;
  /** 原始文档内容（如果 returnDocuments=true） */
  document?: string;
}

/**
 * DashScope API 响应结构
 */
export interface DashScopeRerankResponse {
  output: {
    results: Array<{
      index: number;
      relevance_score: number;
      document?: { text: string };
    }>;
  };
  usage: {
    total_tokens: number;
  };
  request_id: string;
}

/**
 * 使用量统计
 */
export interface RerankUsageStats {
  /** 今日已使用 Token */
  dailyTokens: number;
  /** 今日请求次数 */
  dailyRequests: number;
  /** 上次重置日期 */
  lastResetDate: string;
}

/**
 * 默认配置
 */
export const DEFAULT_DASHSCOPE_RERANK_CONFIG: DashScopeRerankConfig = {
  model: "gte-rerank",
  topK: 10,
  returnDocuments: false,
  timeoutMs: 5000,
};

/**
 * 每日 Token 限额（默认 100 万）
 */
export const DAILY_TOKEN_LIMIT = 1_000_000;
