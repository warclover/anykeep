/**
 * 共享确认类型定义
 *
 * 所有模块使用此处定义的确认相关类型，避免重复定义
 *
 * @module @/lib/shared/types/confirmation
 * @version 1.0.0
 * @since 2025-12-25
 */

// ============================================
// 确认选项
// ============================================

/**
 * 确认选项样式
 */
export type ConfirmOptionVariant = "default" | "destructive" | "outline";

/**
 * 确认选项
 *
 * 统一定义，合并 effects/types 和 output/types 中的定义
 */
export interface ConfirmOption {
  /** 选项 ID */
  id: string;
  /** 选项标签 */
  label: string;
  /** 选项样式 */
  variant?: ConfirmOptionVariant;
  /** 是否为主要选项 */
  primary?: boolean;
  /** 是否为危险选项 */
  danger?: boolean;
  /** 是否为默认选项 */
  isDefault?: boolean;
  /** 选项描述 */
  description?: string;
}

// ============================================
// 确认状态
// ============================================

/**
 * 确认状态
 */
export type ConfirmationStatus =
  | "pending"
  | "confirmed"
  | "rejected"
  | "expired"
  | "cancelled";

// ============================================
// 确认结果
// ============================================

/**
 * 确认结果 (统一定义)
 *
 * 合并以下位置的重复定义：
 * - effects/types.ts
 * - orchestration/types.ts
 * - ai-agent/core/confirmation-handler.ts
 * - ai-actions/types.ts
 * - ai-agent/tools/types.ts
 *
 * @example
 * ```typescript
 * const result: ConfirmationResult = {
 *   confirmed: true,
 *   selectedOption: "confirm",
 *   status: "confirmed",
 * };
 * ```
 */
export interface ConfirmationResult {
  /** 是否已确认 */
  confirmed: boolean;
  /** 选择的选项 ID */
  selectedOption: string;
  /** 确认状态（可选，某些场景不需要） */
  status?: ConfirmationStatus;
  /** 额外数据 */
  data?: unknown;
  /** 时间戳（ISO 格式） */
  timestamp?: string;
  /** 上下文数据 */
  contextData?: Record<string, unknown>;
}

// ============================================
// 确认来源与模式
// ============================================

/**
 * 确认来源
 */
export type ConfirmationSource = "tool" | "skill";

/**
 * 确认模式
 */
export type ConfirmationMode = "atomic" | "orchestration";

// ============================================
// 确认响应
// ============================================

/**
 * 确认响应
 */
export interface ConfirmationResponse {
  /** 确认 ID */
  id: string;
  /** 选择的选项 ID */
  selectedOption: string;
  /** 额外数据 */
  data?: unknown;
  /** 响应时间 */
  respondedAt: Date;
}

// ============================================
// 确认请求
// ============================================

/**
 * 确认请求基础配置
 */
export interface ConfirmationRequestBase {
  /** 确认标题 */
  title: string;
  /** 确认消息 */
  message: string;
  /** 确认选项 */
  options?: ConfirmOption[];
  /** 预览数据 */
  preview?: unknown;
  /** 超时时间（毫秒） */
  timeout?: number;
}

/**
 * Tool 确认请求配置
 */
export interface ToolConfirmationRequest extends ConfirmationRequestBase {
  /** Tool 名称 */
  toolName: string;
  /** Tool 参数 */
  params?: unknown;
}

/**
 * Skill 确认请求配置
 */
export interface SkillConfirmationRequest extends ConfirmationRequestBase {
  /** Skill ID */
  skillId: string;
  /** 当前步骤索引 */
  stepIndex: number;
  /** 总步骤数 */
  totalSteps?: number;
}
