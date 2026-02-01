/**
 * 统一分类器接口
 *
 * 定义意图分类器的标准接口，支持分类器链模式
 *
 * @version 1.0.0
 * @since 2026-02-01
 */

import type { ClassificationContext, ClassifierResult } from "../types";

// ============================================
// 接口定义
// ============================================

/**
 * 意图分类器接口
 *
 * 所有分类器（规则、语义、LLM）都需要实现此接口
 */
export interface IntentClassifier {
  /** 分类器名称 */
  readonly name: string;

  /** 优先级（数字越小优先级越高） */
  readonly priority: number;

  /**
   * 判断是否能处理该消息
   *
   * 快速预检，决定是否调用 classify 方法
   *
   * @param message - 用户输入消息
   * @param context - 分类上下文
   * @returns 是否能处理
   */
  canHandle(message: string, context: ClassificationContext): boolean;

  /**
   * 执行分类
   *
   * @param message - 用户输入消息
   * @param context - 分类上下文
   * @returns 分类结果
   */
  classify(
    message: string,
    context: ClassificationContext,
  ): Promise<ClassifierResult>;

  /**
   * 可选：置信度校准
   *
   * 对分类结果进行校准，调整置信度
   *
   * @param result - 原始分类结果
   * @returns 校准后的结果
   */
  calibrate?(result: ClassifierResult): ClassifierResult;
}

// ============================================
// 分类器配置
// ============================================

/**
 * 分类器链配置
 */
export interface ClassifierChainConfig {
  /** 最低置信度阈值（低于此值继续尝试下一个分类器） */
  minConfidenceThreshold?: number;

  /** 是否启用并行分类 */
  enableParallel?: boolean;

  /** 是否启用缓存 */
  enableCache?: boolean;

  /** 调试模式 */
  debug?: boolean;
}

// ============================================
// 分类器元数据
// ============================================

/**
 * 分类器元数据
 */
export interface ClassifierMetadata {
  /** 分类器 ID */
  id: string;

  /** 分类器名称 */
  name: string;

  /** 分类器类型 */
  type: "rule" | "semantic" | "llm" | "hybrid";

  /** 优先级 */
  priority: number;

  /** 是否启用 */
  enabled: boolean;

  /** 预计延迟（毫秒） */
  estimatedLatencyMs?: number;

  /** 描述 */
  description?: string;
}

// ============================================
// 置信度阈值常量
// ============================================

/**
 * 置信度阈值
 */
export const CONFIDENCE_THRESHOLDS = {
  /** 高置信度（直接使用） */
  HIGH: 0.85,

  /** 中等置信度（可接受） */
  MEDIUM: 0.7,

  /** 低置信度（需要回退） */
  LOW: 0.5,

  /** 最低阈值 */
  MIN: 0.3,
} as const;

// ============================================
// 辅助类型
// ============================================

/**
 * 分类器构造函数类型
 */
export type ClassifierConstructor = new (
  config?: Record<string, unknown>,
) => IntentClassifier;

/**
 * 分类器注册项
 */
export interface ClassifierRegistration {
  /** 分类器构造函数 */
  constructor: ClassifierConstructor;

  /** 元数据 */
  metadata: ClassifierMetadata;

  /** 配置 */
  config?: Record<string, unknown>;
}
