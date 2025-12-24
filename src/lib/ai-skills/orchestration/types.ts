/**
 * 编排层类型定义
 *
 * 定义编排 Skill 执行相关的类型
 *
 * @version 1.0.0
 * @since 2025-12-24
 */

import type { SkillContext, SkillMetadata } from "../core/types";
import type {
  DeliverableType,
  OutputFormat,
  ConfirmOption,
  ConfirmationResponse,
  OrchestrationStreamChunk,
} from "../output/types";

// ============================================
// 编排上下文
// ============================================

/**
 * 编排执行上下文
 *
 * 继承自 SkillContext，添加编排特有的属性
 */
export interface OrchestrationContext extends SkillContext {
  /** 解析后的输入参数 */
  params: unknown;
  /** 原始用户消息 */
  originalMessage?: string;
  /** 进度回调 */
  onProgress?: (step: string, percent: number, message?: string) => void;
  /** 确认回调 */
  onConfirmation?: (
    options: ConfirmationOptions,
  ) => Promise<ConfirmationResponse>;
}

// ============================================
// 确认相关类型
// ============================================

/**
 * 确认选项配置
 */
export interface ConfirmationOptions {
  /** 确认 ID */
  id: string;
  /** 确认标题 */
  title: string;
  /** 确认消息 */
  message: string;
  /** 选项列表 */
  options: ConfirmOption[];
  /** 预览数据 */
  preview?: unknown;
  /** 超时时间（毫秒） */
  timeout?: number;
  /** 默认选项 */
  defaultOption?: string;
}

/**
 * 确认结果
 */
export interface ConfirmationResult {
  /** 是否已确认 */
  confirmed: boolean;
  /** 选择的选项 */
  selectedOption: string;
  /** 额外数据 */
  data?: unknown;
}

// ============================================
// 交付物相关类型
// ============================================

/**
 * 交付物配置
 */
export interface DeliverableConfig {
  /** 交付物类型 */
  type: DeliverableType;
  /** 输出格式 */
  format: OutputFormat;
  /** 是否可下载 */
  downloadable?: boolean;
  /** 是否可分享 */
  shareable?: boolean;
}

/**
 * 交付物
 */
export interface Deliverable {
  /** 交付物 ID */
  id: string;
  /** 交付物类型 */
  type: DeliverableType;
  /** 标题 */
  title: string;
  /** 输出格式 */
  format: OutputFormat;
  /** 内容 */
  content: unknown;
  /** 是否可下载 */
  downloadable: boolean;
  /** 是否可分享 */
  shareable: boolean;
  /** 元数据 */
  metadata?: Record<string, unknown>;
  /** 创建时间 */
  createdAt: Date;
}

// ============================================
// 进度相关类型
// ============================================

/**
 * 步骤定义
 */
export interface StepDefinition {
  /** 步骤 ID */
  id: string;
  /** 步骤名称 */
  name: string;
  /** 步骤描述 */
  description?: string;
  /** 预估权重（用于计算进度） */
  weight?: number;
}

/**
 * 进度状态
 */
export interface ProgressState {
  /** 当前步骤索引 */
  currentStepIndex: number;
  /** 当前步骤名称 */
  currentStep: string;
  /** 当前百分比 */
  percent: number;
  /** 进度消息 */
  message?: string;
  /** 步骤定义列表 */
  steps: StepDefinition[];
  /** 开始时间 */
  startTime: number;
}

// ============================================
// 编排 Skill 元数据扩展
// ============================================

/**
 * 编排 Skill 元数据（扩展基础 SkillMetadata）
 */
export interface OrchestrationSkillMetadata extends SkillMetadata {
  /** 支持的交付物类型 */
  deliverableTypes?: DeliverableType[];
  /** 支持的输出格式 */
  outputFormats?: OutputFormat[];
  /** 是否需要确认 */
  requiresConfirmation?: boolean;
  /** 预设步骤列表 */
  steps?: StepDefinition[];
}

// ============================================
// 编排执行结果
// ============================================

/**
 * 编排执行结果
 */
export interface OrchestrationResult<T = unknown> {
  /** 是否成功 */
  success: boolean;
  /** 结果数据 */
  data?: T;
  /** 生成的交付物 */
  deliverables?: Deliverable[];
  /** 错误信息 */
  error?: string;
  /** 错误代码 */
  errorCode?: string;
  /** 执行时间（毫秒） */
  durationMs: number;
  /** 步骤执行情况 */
  stepsCompleted: number;
  /** 总步骤数 */
  totalSteps: number;
}

// ============================================
// 工具调用相关类型
// ============================================

/**
 * 工具调用上下文
 */
export interface ToolContext {
  /** 用户 ID */
  userId: string;
  /** 追踪 ID */
  traceId?: string;
  /** 是否调试模式 */
  debug?: boolean;
}

/**
 * 工具调用结果
 */
export interface ToolResult<T = unknown> {
  /** 是否成功 */
  success: boolean;
  /** 结果数据 */
  data?: T;
  /** 错误信息 */
  error?: string;
}

// ============================================
// 编排 Skill 接口
// ============================================

/**
 * 编排 Skill 接口
 */
export interface IOrchestrationSkill<TInput = unknown> {
  /** 元数据 */
  readonly metadata: OrchestrationSkillMetadata;

  /**
   * 解析自然语言输入为结构化参数
   */
  parseInput(message: string, context: OrchestrationContext): Promise<TInput>;

  /**
   * 流式执行
   */
  executeStream(
    context: OrchestrationContext,
  ): AsyncGenerator<OrchestrationStreamChunk>;
}
