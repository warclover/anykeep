/**
 * RRF Fusion 类型定义
 *
 * @module ai-agent/rerank/rrf-types
 * @version 1.0.0
 * @since 2025-12-28
 */

/**
 * 排名列表项
 */
export interface RankItem {
  /** 唯一标识符（通常是书签 ID） */
  id: string | number;
  /** 原始分数（可选） */
  score?: number;
  /** 原始排名（1-based） */
  rank: number;
  /** 来源标识 */
  source: string;
  /** 附加数据 */
  payload?: Record<string, unknown>;
}

/**
 * RRF 融合结果
 */
export interface RRFResult {
  /** 唯一标识符 */
  id: string | number;
  /** RRF 融合分数 */
  rrfScore: number;
  /** 参与融合的来源列表 */
  sources: string[];
  /** 每个来源的原始排名 */
  sourceRanks: Record<string, number>;
  /** 每个来源的原始分数 */
  sourceScores: Record<string, number | undefined>;
  /** 合并后的附加数据 */
  payload?: Record<string, unknown>;
}

/**
 * RRF 配置
 */
export interface RRFConfig {
  /** RRF k 参数，用于控制排名权重衰减 (默认 60) */
  k: number;
  /** 是否对每个来源的排名进行归一化 (默认 false) */
  normalizeRanks: boolean;
  /** 来源权重映射 (默认全部为 1.0) */
  sourceWeights: Record<string, number>;
  /** 最大返回数量 (默认 不限制) */
  topK?: number;
}

/**
 * 默认 RRF 配置
 */
export const DEFAULT_RRF_CONFIG: RRFConfig = {
  k: 60,
  normalizeRanks: false,
  sourceWeights: {},
};

/**
 * RRF 融合统计
 */
export interface RRFStats {
  /** 来源数量 */
  sourceCount: number;
  /** 每个来源的项目数 */
  itemsPerSource: Record<string, number>;
  /** 融合后的唯一项目数 */
  uniqueItems: number;
  /** 平均出现次数 */
  avgAppearances: number;
  /** 仅出现在单一来源的项目数 */
  singleSourceItems: number;
}
