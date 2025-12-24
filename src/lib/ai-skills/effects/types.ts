/**
 * Effect 类型定义
 *
 * 定义统一的 Effect 系统，用于适配 Tool 和 Skill 确认流程
 *
 * @version 1.0.0
 * @since 2025-12-24
 */

// ============================================
// Effect 上下文
// ============================================

/**
 * Effect 上下文
 *
 * 包含执行环境信息，用于追踪和权限控制
 */
export interface EffectContext {
  /** 请求 ID */
  requestId: string;
  /** 用户 ID */
  userId: string;
  /** 会话 ID */
  conversationId?: string;
  /** 执行模式 */
  mode: "atomic" | "orchestration";
  /** 确认来源 */
  source: "tool" | "skill";
}

// ============================================
// Effect 基础类型
// ============================================

/**
 * Effect 类型枚举
 */
export type EffectType = "confirmation" | "notification" | "audit";

/**
 * Effect 基础接口
 */
export interface Effect<T = unknown> {
  /** Effect 类型 */
  type: EffectType;
  /** Effect 载荷 */
  payload: T;
  /** Effect 上下文 */
  context: EffectContext;
}

// ============================================
// 确认 Effect 类型
// ============================================

/**
 * 确认选项
 */
export interface ConfirmOption {
  /** 选项 ID */
  id: string;
  /** 选项标签 */
  label: string;
  /** 选项样式 */
  variant: "default" | "destructive" | "outline";
  /** 是否为默认选项 */
  isDefault?: boolean;
  /** 选项描述 */
  description?: string;
}

/**
 * 确认载荷
 */
export interface ConfirmationPayload {
  /** 确认 ID */
  id: string;
  /** 确认标题 */
  title: string;
  /** 确认消息 */
  message: string;
  /** 确认选项 */
  options: ConfirmOption[];
  /** 预览数据 */
  preview?: unknown;
  /** 超时时间（毫秒） */
  timeout: number;
  /** 元数据 */
  metadata?: Record<string, unknown>;
}

/**
 * 确认 Effect
 */
export interface ConfirmationEffect extends Effect<ConfirmationPayload> {
  type: "confirmation";
  /** 确认回调 */
  onConfirm?: () => Promise<void>;
  /** 取消回调 */
  onCancel?: () => Promise<void>;
}

// ============================================
// Tool 确认配置
// ============================================

/**
 * Tool 确认配置
 */
export interface ToolConfirmationConfig {
  /** 确认标题 */
  title: string;
  /** 确认消息 */
  message: string;
  /** 确认选项（可选，默认使用确认/取消） */
  options?: ConfirmOption[];
  /** 预览数据 */
  preview?: unknown;
  /** 超时时间（毫秒） */
  timeout?: number;
}

/**
 * Skill 确认配置
 */
export interface SkillConfirmationConfig extends ToolConfirmationConfig {
  /** Skill ID */
  skillId: string;
  /** 当前步骤索引 */
  stepIndex: number;
  /** 总步骤数 */
  totalSteps?: number;
}

// ============================================
// 确认结果
// ============================================

/**
 * 确认结果
 */
export interface ConfirmationResult {
  /** 是否已确认 */
  confirmed: boolean;
  /** 选择的选项 ID */
  selectedOption: string;
  /** 额外数据 */
  data?: unknown;
  /** 时间戳 */
  timestamp: string;
}

// ============================================
// 通知 Effect 类型
// ============================================

/**
 * 通知级别
 */
export type NotificationLevel = "info" | "success" | "warning" | "error";

/**
 * 通知载荷
 */
export interface NotificationPayload {
  /** 通知 ID */
  id: string;
  /** 通知级别 */
  level: NotificationLevel;
  /** 通知标题 */
  title: string;
  /** 通知消息 */
  message: string;
  /** 自动关闭时间（毫秒），0 表示不自动关闭 */
  autoCloseMs?: number;
}

/**
 * 通知 Effect
 */
export interface NotificationEffect extends Effect<NotificationPayload> {
  type: "notification";
}

// ============================================
// 审计 Effect 类型
// ============================================

/**
 * 审计操作类型
 */
export type AuditAction =
  | "create"
  | "update"
  | "delete"
  | "move"
  | "export"
  | "import";

/**
 * 审计载荷
 */
export interface AuditPayload {
  /** 操作类型 */
  action: AuditAction;
  /** 资源类型 */
  resourceType: string;
  /** 资源 ID 列表 */
  resourceIds: string[];
  /** 变更详情 */
  changes?: Record<string, unknown>;
  /** 操作时间戳 */
  timestamp: string;
}

/**
 * 审计 Effect
 */
export interface AuditEffect extends Effect<AuditPayload> {
  type: "audit";
}

// ============================================
// 统一 Effect 类型
// ============================================

/**
 * 统一 Effect 类型
 */
export type UnifiedEffect =
  | ConfirmationEffect
  | NotificationEffect
  | AuditEffect;
