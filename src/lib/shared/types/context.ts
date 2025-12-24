/**
 * 共享上下文类型定义
 *
 * 统一各模块的执行上下文类型
 *
 * @module @/lib/shared/types/context
 * @version 1.0.0
 * @since 2025-12-25
 */

// ============================================
// 基础执行上下文
// ============================================

/**
 * 基础执行上下文
 *
 * 所有执行上下文的基础接口
 */
export interface BaseExecutionContext {
  /** 用户 ID */
  userId: string;
  /** 请求追踪 ID */
  traceId?: string;
  /** 是否调试模式 */
  debug?: boolean;
}

// ============================================
// Tool 执行上下文
// ============================================

/**
 * Tool 执行上下文
 *
 * 用于 AI Agent Tool 执行
 */
export interface ToolExecutionContext extends BaseExecutionContext {
  /** 会话 ID */
  conversationId?: string;
  /** 是否已确认 */
  confirmed?: boolean;
  /** 确认 ID */
  confirmationId?: string;
}

// ============================================
// Skill 执行上下文
// ============================================

/**
 * Skill 执行上下文
 *
 * 用于编排 Skill 执行
 */
export interface SkillExecutionContext extends BaseExecutionContext {
  /** 会话 ID */
  conversationId?: string;
  /** 执行模式 */
  mode: "atomic" | "orchestration";
  /** 原始用户消息 */
  originalMessage?: string;
}

// ============================================
// Effect 上下文
// ============================================

/**
 * Effect 上下文
 *
 * 用于 Effect 系统（确认、通知、审计）
 */
export interface EffectContext extends BaseExecutionContext {
  /** 请求 ID */
  requestId: string;
  /** 会话 ID */
  conversationId?: string;
  /** 执行模式 */
  mode: "atomic" | "orchestration";
  /** 确认来源 */
  source: "tool" | "skill";
}

// ============================================
// API 请求上下文
// ============================================

/**
 * API 请求上下文
 *
 * 用于 API 路由处理
 */
export interface ApiRequestContext extends BaseExecutionContext {
  /** 请求 ID */
  requestId: string;
  /** 客户端 IP */
  clientIp?: string;
  /** 用户代理 */
  userAgent?: string;
}
