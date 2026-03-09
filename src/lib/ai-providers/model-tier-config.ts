/**
 * 模型分层配置
 *
 * 定义三层模型架构：快速层、标准层、深度层
 * 根据任务复杂度选择最合适的模型，实现成本与性能的平衡
 *
 * @version 1.0.0
 * @since 2025-12-26
 */

// =============================================================================
// 类型定义
// =============================================================================

/**
 * 模型层级 ID
 */
export type ModelTierId = "fast" | "standard" | "deep";

/**
 * 模型 Provider 配置
 */
export interface TierProviderConfig {
  /** Provider 名称 */
  name: "deepseek" | "openai" | "anthropic";
  /** 模型 ID */
  model: string;
  /** 温度参数 */
  temperature: number;
  /** 最大输出 Token 数 */
  maxTokens: number;
}

/**
 * 层级配置
 */
export interface TierConfig {
  /** 层级 ID */
  id: ModelTierId;
  /** 层级名称（中文） */
  name: string;
  /** 层级描述 */
  description: string;
  /** 目标延迟（毫秒） */
  targetLatencyMs: number;
  /** 最大延迟（毫秒） */
  maxLatencyMs: number;
  /** 相对成本系数（以快速层为基准） */
  costFactor: number;
  /** 模型配置 */
  provider: TierProviderConfig;
  /** 适用的任务类型 */
  applicableTasks: string[];
}

// =============================================================================
// 层级配置
// =============================================================================

/**
 * 模型分层配置表
 *
 * 三层架构设计：
 * - 快速层：简单任务，速度优先，低成本
 * - 标准层：常规任务，平衡性能与成本
 * - 深度层：复杂推理，质量优先
 */
export const MODEL_TIER_CONFIG: Record<ModelTierId, TierConfig> = {
  /**
   * 快速层
   *
   * 适用场景：
   * - 闲聊问候
   * - 简单数量查询
   * - 意图分类
   * - 上下文已预加载的问题
   */
  fast: {
    id: "fast",
    name: "快速层",
    description: "简单任务，速度优先",
    targetLatencyMs: 1500,
    maxLatencyMs: 3000,
    costFactor: 1,
    provider: {
      name: "deepseek",
      model: "deepseek-chat",
      temperature: 0.3, // 低温度，更确定性
      maxTokens: 500, // 限制输出长度
    },
    applicableTasks: [
      "chitchat", // 闲聊
      "simple_query", // 简单查询
      "intent_classification", // 意图分类
      "query:count", // 数量统计
      "query:list", // 简单列表
    ],
  },

  /**
   * 标准层
   *
   * 适用场景：
   * - 工具调用
   * - 摘要生成
   * - 内容分类
   * - 搜索操作
   * - 一般的增删改操作
   */
  standard: {
    id: "standard",
    name: "标准层",
    description: "常规任务，平衡性能",
    targetLatencyMs: 4000,
    maxLatencyMs: 8000,
    costFactor: 1.5,
    provider: {
      name: "deepseek",
      model: "deepseek-chat",
      temperature: 0.5,
      maxTokens: 2000,
    },
    applicableTasks: [
      "tool_calling", // 工具调用
      "summary_generation", // 摘要生成
      "classification", // 分类
      "search", // 搜索
      "query:search", // 搜索查询
      "action:tag", // 标签操作
      "action:move", // 移动操作
      "action:delete", // 删除操作
      "create:summary", // 创建摘要
      "create:export", // 导出操作
    ],
  },

  /**
   * 深度层
   *
   * 适用场景：
   * - 洞察分析
   * - 学习路径规划
   * - 复杂推理
   * - 批量整理
   * - 知识复习
   */
  deep: {
    id: "deep",
    name: "深度层",
    description: "复杂推理，质量优先",
    targetLatencyMs: 12000,
    maxLatencyMs: 30000,
    costFactor: 4,
    provider: {
      name: "deepseek",
      model: "deepseek-reasoner", // 推理增强模型
      temperature: 0.7,
      maxTokens: 4000,
    },
    applicableTasks: [
      "insight_analysis", // 洞察分析
      "complex_reasoning", // 复杂推理
      "batch_organize", // 批量整理
      "analyze:insight", // 分析洞察
      "analyze:report", // 分析报告
      "learn:review", // 知识复习
      "organize:cleanup", // 整理清理
      "organize:classify", // 整理分类
    ],
  },
};

// =============================================================================
// 辅助函数
// =============================================================================

/**
 * 获取层级配置
 */
export function getTierConfig(tierId: ModelTierId): TierConfig {
  return MODEL_TIER_CONFIG[tierId];
}

/**
 * 获取层级的模型配置
 */
export function getTierProviderConfig(tierId: ModelTierId): TierProviderConfig {
  return MODEL_TIER_CONFIG[tierId].provider;
}

/**
 * 获取所有层级 ID
 */
export function getAllTierIds(): ModelTierId[] {
  return Object.keys(MODEL_TIER_CONFIG) as ModelTierId[];
}

/**
 * 检查是否为有效的层级 ID
 */
export function isValidTierId(id: string): id is ModelTierId {
  return id in MODEL_TIER_CONFIG;
}

/**
 * 获取层级的目标延迟
 */
export function getTierTargetLatency(tierId: ModelTierId): number {
  return MODEL_TIER_CONFIG[tierId].targetLatencyMs;
}

/**
 * 获取层级的成本系数
 */
export function getTierCostFactor(tierId: ModelTierId): number {
  return MODEL_TIER_CONFIG[tierId].costFactor;
}

/**
 * 默认层级（兜底使用）
 */
export const DEFAULT_TIER_ID: ModelTierId = "standard";

/**
 * 层级优先级顺序（从低到高）
 */
export const TIER_PRIORITY_ORDER: ModelTierId[] = ["fast", "standard", "deep"];
