/**
 * SSE 流响应类型定义
 *
 * 统一的流式响应格式
 *
 * @module @/lib/shared/types/stream
 * @version 1.0.0
 * @since 2026-01-11
 */

// ============================================
// 统一流块类型
// ============================================

/**
 * 统一流块类型
 */
export type UnifiedStreamChunkType =
  | "text" // 文本内容
  | "progress" // 进度更新
  | "deliverable" // 交付物
  | "routing" // 路由信息
  | "fallback" // 回退通知
  | "tool-call" // 工具调用
  | "tool-result" // 工具结果
  | "confirmation" // 确认请求
  | "error" // 错误
  | "done"; // 完成

/**
 * 统一流块接口
 *
 * 所有 SSE 响应使用此统一格式
 */
export interface UnifiedStreamChunk {
  /** 块类型 */
  type: UnifiedStreamChunkType;
  /** 数据载荷 */
  data: StreamChunkData;
}

/**
 * 流块数据
 */
export interface StreamChunkData {
  /** 文本内容（type=text 时） */
  text?: string;
  /** 当前步骤（type=progress 时） */
  step?: string;
  /** 进度百分比 0-100（type=progress 时） */
  percent?: number;
  /** 交付物格式（type=deliverable 时） */
  format?: string;
  /** 交付物内容（type=deliverable 时） */
  content?: unknown;
  /** 路由模式（type=routing 时） */
  mode?: string;
  /** 路由/回退原因 */
  reason?: string;
  /** 错误信息（type=error 时） */
  message?: string;
  /** 是否可重试（type=error 时） */
  retryable?: boolean;
  /** 工具调用信息（type=tool-call 时） */
  toolCall?: ToolCallInfo;
  /** 工具结果（type=tool-result 时） */
  toolResult?: unknown;
  /** 确认请求（type=confirmation 时） */
  confirmation?: ConfirmationInfo;
  /** 最终结果（type=done 时） */
  result?: FinalResult;
}

// ============================================
// 工具调用信息
// ============================================

/**
 * 工具调用信息
 */
export interface ToolCallInfo {
  /** 调用 ID */
  id: string;
  /** 工具名称 */
  toolName: string;
  /** 调用参数 */
  args: Record<string, unknown>;
  /** 状态 */
  status: "pending" | "running" | "completed" | "failed";
}

// ============================================
// 确认信息
// ============================================

/**
 * 确认请求信息
 */
export interface ConfirmationInfo {
  /** 确认 ID */
  id: string;
  /** 操作类型 */
  operation: string;
  /** 操作描述 */
  description: string;
  /** 影响数量 */
  affectedCount?: number;
  /** 风险级别 */
  riskLevel?: "low" | "medium" | "high";
}

// ============================================
// 最终结果
// ============================================

/**
 * 最终结果
 */
export interface FinalResult {
  /** 是否成功 */
  success: boolean;
  /** 响应内容 */
  content?: string;
  /** 使用的 Token 数 */
  tokensUsed?: {
    prompt: number;
    completion: number;
    total: number;
  };
  /** 执行耗时（毫秒） */
  durationMs?: number;
  /** 完成原因 */
  finishReason?: "stop" | "length" | "tool-calls" | "error";
}

// ============================================
// 错误块（统一格式）
// ============================================

/**
 * 统一错误块格式
 *
 * 所有错误响应使用此格式
 */
export interface ErrorChunk {
  type: "error";
  data: {
    /** 错误信息 */
    message: string;
    /** 是否可重试 */
    retryable?: boolean;
    /** 错误代码（可选） */
    code?: string;
  };
}

/**
 * 创建统一错误块
 */
export function createErrorChunk(
  message: string,
  retryable: boolean = false,
  code?: string,
): ErrorChunk {
  return {
    type: "error",
    data: { message, retryable, code },
  };
}
