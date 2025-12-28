/**
 * AI 助手组件类型定义
 *
 * @version 1.2.0
 * @since 2025-12-22
 * @updated 2025-12-24 - 添加统一输出类型支持
 */

import type { AgentMessage, AgentToolCall } from "@/lib/ai-agent";
import type { PendingConfirmation } from "@/lib/ai-agent/tools/types";

// ============================================
// 统一输出块类型（来自 UnifiedEngine）
// ============================================

/**
 * 进度信息
 */
export interface ProgressInfo {
  /** 当前步骤名称 */
  step: string;
  /** 进度百分比 0-100 */
  percent: number;
  /** 进度消息 */
  message?: string;
  /** 当前步骤索引 */
  stepIndex?: number;
  /** 总步骤数 */
  totalSteps?: number;
  /** 时间戳 */
  timestamp: number;
}

/**
 * 交付物类型
 */
export type DeliverableType =
  | "report"
  | "list"
  | "cards"
  | "document"
  | "mindmap"
  | "graph"
  | "table"
  | "search_results" // 搜索结果（使用 FormattedSearchResponse）
  // 整理相关交付物类型
  | "organize_plan" // 整理方案预览
  | "organize_result" // 整理结果（含撤销）
  // 音频相关交付物类型
  | "audio"; // 音频 (TTS)

/**
 * 交付物数据
 */
export interface DeliverableData {
  /** 交付物 ID */
  id: string;
  /** 交付物类型 */
  type: DeliverableType;
  /** 交付物标题 */
  title: string;
  /** 输出格式 */
  format:
    | "markdown"
    | "html"
    | "json"
    | "cards"
    | "mindmap"
    | "plain"
    | "audio";
  /** 交付物内容 */
  content: unknown;
  /** 是否可下载 */
  downloadable?: boolean;
  /** 是否可分享 */
  shareable?: boolean;
  /** 元数据 */
  metadata?: Record<string, unknown>;
}

/**
 * 后续建议
 */
export interface SuggestionItem {
  /** 建议显示文本 */
  text: string;
  /** 建议标签（可选，用于分类） */
  label?: string;
  /** 触发的动作（可选） */
  action?: string;
  /** 动作按钮标签 */
  actionLabel?: string;
  /** 动作参数 */
  params?: Record<string, unknown>;
  /** 图标 */
  icon?: string;
}

/**
 * 路由信息（调试用）
 */
export interface RoutingInfo {
  /** 执行模式 */
  mode: "atomic" | "orchestration";
  /** 路由理由 */
  reason: string;
  /** 建议的 Skill */
  skill: string | null;
  /** 意图类型 */
  intentType?: string;
  /** 复杂度级别 */
  complexityLevel?: string;
}

/**
 * 回退信息
 */
export interface FallbackInfo {
  /** 回退原因 */
  reason: string;
  /** 原始模式 */
  originalMode: "orchestration";
  /** 回退模式 */
  fallbackMode: "atomic";
}

/**
 * 记忆信息（指代解析结果）
 */
export interface MemoryInfo {
  /** 是否解析成功 */
  resolved: boolean;
  /** 原始输入 */
  originalInput: string;
  /** 解析后的输入 */
  resolvedInput: string;
  /** 解析的指代词数量 */
  referenceCount: number;
  /** 解析的指代类型列表 */
  referenceTypes: string[];
}

/**
 * 取消信息
 */
export interface CancelledInfo {
  /** 取消消息 */
  message: string;
  /** 取消原因 */
  reason?: string;
  /** 取消时间 */
  timestamp: string;
  /** 已完成步骤 */
  completedSteps?: number;
  /** 总步骤数 */
  totalSteps?: number;
}

/**
 * 初始化信息
 */
export interface InitInfo {
  /** 请求 ID */
  requestId: string;
  /** 时间戳 */
  timestamp: number;
}

/**
 * 撤销可用信息
 */
export interface UndoAvailableInfo {
  /** 撤销 ID */
  undoId: string;
  /** 操作类型 */
  operationType: string;
  /** 操作摘要 */
  summary: string;
  /** 过期时间 (ISO 字符串) */
  expiresAt: string;
  /** 受影响的书签数量 */
  affectedCount: number;
}

/**
 * 零接管确认请求信息
 */
export interface ZeroTakeoverConfirmInfo {
  /** 确认 ID */
  id: string;
  /** 操作类型 */
  operationType: "delete" | "batch_delete" | "irreversible";
  /** 确认标题 */
  title: string;
  /** 确认消息 */
  message: string;
  /** 受影响的书签 ID 列表 */
  affectedBookmarkIds: number[];
  /** 超时时间（毫秒） */
  timeout?: number;
  /** 默认选项 */
  defaultAction?: "confirm" | "cancel";
}

/**
 * 智能默认值信息
 */
export interface SmartDefaultsInfo {
  /** 应用的默认值列表 */
  defaults: Array<{
    field: string;
    value: string;
    source: "user_preference" | "context_infer" | "system_default";
    confidence: number;
    reason?: string;
  }>;
  /** 总置信度 */
  overallConfidence: number;
}

/**
 * AI 思考过程信息
 */
export interface ThinkingInfo {
  /** 思考阶段 */
  phase:
    | "understanding"
    | "planning"
    | "deciding"
    | "executing"
    | "react_think"
    | "react_act"
    | "react_observe"
    | "react_complete";
  /** 思考内容 */
  content: string;
  /** 时间戳 */
  timestamp: number;
  /** ReAct 轮次 */
  round?: number;
  /** 是否为最终状态 */
  isFinal?: boolean;
}

/**
 * 引用摘要项
 */
export interface CitationSummaryItem {
  /** 引用编号 (1-based) */
  index: number;
  /** 引用标题 */
  title: string;
  /** 书签 ID */
  bookmarkId: number;
}

/**
 * 引用追踪信息
 */
export interface CitationInfo {
  /** 是否已建立索引 */
  indexed: boolean;
  /** 引用总数 */
  totalCitations: number;
  /** 引用摘要列表 */
  citationSummary: CitationSummaryItem[];
  /** 会话 ID */
  conversationId?: string;
  /** 关联的查询 */
  query?: string;
}

/**
 * 消息显示状态
 */
export type MessageDisplayStatus =
  | "sending"
  | "sent"
  | "streaming"
  | "completed"
  | "error";

/**
 * 显示消息（用于 UI 展示）
 */
export interface DisplayMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  status: MessageDisplayStatus;
  toolCalls?: AgentToolCall[];
  /** 待确认操作列表 */
  pendingConfirmations?: PendingConfirmation[];
  createdAt: Date;
  error?: string;

  // ============================================
  // 统一输出扩展字段（来自 UnifiedEngine）
  // ============================================

  /** 进度信息 */
  progress?: ProgressInfo;
  /** 交付物列表 */
  deliverables?: DeliverableData[];
  /** 后续建议 */
  suggestions?: SuggestionItem[];
  /** 路由信息（调试用） */
  routing?: RoutingInfo;
  /** 分类的意图类型（用于学习纠正） */
  classifiedIntent?: string;
  /** 回退信息 */
  fallback?: FallbackInfo;
  /** 记忆信息（指代解析） */
  memory?: MemoryInfo;
  /** 执行模式 */
  executionMode?: "atomic" | "orchestration";
  /** Skill ID */
  skillId?: string;

  // ============================================
  // 零接管模式扩展字段
  // ============================================

  /** 请求 ID（用于取消操作） */
  requestId?: string;
  /** AI 思考过程 */
  thinking?: ThinkingInfo[];
  /** 撤销信息 */
  undoAvailable?: UndoAvailableInfo;
  /** 零接管确认请求 */
  zeroTakeoverConfirm?: ZeroTakeoverConfirmInfo;
  /** 智能默认值 */
  smartDefaults?: SmartDefaultsInfo;
  /** 引用追踪信息 */
  citation?: CitationInfo;
  /** 是否已取消 */
  isCancelled?: boolean;
}

/**
 * AI 助手面板属性
 */
export interface AIAssistantPanelProps {
  /** 是否打开 */
  open: boolean;
  /** 关闭回调 */
  onOpenChange: (open: boolean) => void;
  /** 用户 ID（可选，API 层会从 session 获取） */
  userId?: string;
  /** 会话 ID（可选，用于恢复会话） */
  conversationId?: string;
  /** 关联的书签 ID（可选，提供上下文） */
  bookmarkIds?: number[];
  /** 自定义系统提示语 */
  systemPrompt?: string;
  /** 面板标题 */
  title?: string;
  /** 面板描述 */
  description?: string;
}

/**
 * AI 助手按钮属性
 */
export interface AIAssistantButtonProps {
  /** 用户 ID */
  userId: string;
  /** 关联的书签 ID（可选） */
  bookmarkIds?: number[];
  /** 自定义类名 */
  className?: string;
  /** 按钮尺寸 */
  size?: "sm" | "default" | "lg";
  /** 按钮变体 */
  variant?: "default" | "outline" | "ghost";
}

/**
 * 消息组件属性
 */
export interface AIMessageProps {
  message: DisplayMessage;
  isLast?: boolean;
}

/**
 * 输入框属性
 */
export interface AIInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  placeholder?: string;
}

/**
 * 将 AgentMessage 转换为 DisplayMessage
 */
export function toDisplayMessage(
  msg: AgentMessage,
  status: MessageDisplayStatus = "completed",
): DisplayMessage {
  return {
    id: msg.id,
    role: msg.role as "user" | "assistant" | "system",
    content: msg.content,
    status,
    toolCalls: msg.toolCalls,
    createdAt: msg.createdAt,
  };
}

// ============================================
// 统一流式块类型（用于前端处理）
// ============================================

/**
 * 统一流式块（前端版本）
 *
 * 与后端 UnifiedStreamChunk 保持兼容，
 * 但简化为前端需要的字段
 */
export type UnifiedStreamChunkFrontend =
  | { type: "text"; text: string; isPartial?: boolean }
  | { type: "progress"; progress: ProgressInfo }
  | { type: "tool-call"; toolCall: AgentToolCall }
  | { type: "confirmation"; confirmation: PendingConfirmation }
  | { type: "deliverable"; deliverable: DeliverableData }
  | { type: "suggestions"; suggestions: SuggestionItem[] }
  | { type: "routing"; routing: RoutingInfo }
  | { type: "fallback"; fallback: FallbackInfo }
  | { type: "memory"; memory: MemoryInfo }
  | {
      type: "error";
      error: string;
      errorCode?: string;
      retryable?: boolean;
    }
  | {
      type: "done";
      data: {
        success: boolean;
        summary?: string;
        tokensUsed?: number;
        durationMs?: number;
        mode?: "atomic" | "orchestration";
        skillId?: string;
        conversationId?: string;
        content?: string;
        toolCalls?: AgentToolCall[];
      };
    }
  // 新增：零接管模式块类型
  | { type: "init"; init: InitInfo }
  | { type: "cancelled"; cancelled: CancelledInfo }
  | { type: "thinking"; thinking: ThinkingInfo }
  | { type: "undo_available"; undoAvailable: UndoAvailableInfo }
  | {
      type: "zero_takeover_confirm";
      zeroTakeoverConfirm: ZeroTakeoverConfirmInfo;
    }
  | { type: "smart_defaults_applied"; smartDefaults: SmartDefaultsInfo }
  | { type: "citation"; citation: CitationInfo };

/**
 * 处理统一流式块，更新 DisplayMessage
 *
 * @param chunk - 收到的流式块
 * @param message - 当前消息
 * @returns 更新后的消息
 */
export function processUnifiedChunk(
  chunk: UnifiedStreamChunkFrontend,
  message: DisplayMessage,
): DisplayMessage {
  switch (chunk.type) {
    case "text":
      return {
        ...message,
        content: message.content + chunk.text,
      };

    case "progress":
      return {
        ...message,
        progress: chunk.progress,
      };

    case "tool-call":
      return {
        ...message,
        toolCalls: [...(message.toolCalls || []), chunk.toolCall],
      };

    case "confirmation":
      return {
        ...message,
        pendingConfirmations: [
          ...(message.pendingConfirmations || []),
          chunk.confirmation,
        ],
      };

    case "deliverable":
      return {
        ...message,
        deliverables: [...(message.deliverables || []), chunk.deliverable],
      };

    case "suggestions":
      return {
        ...message,
        suggestions: chunk.suggestions,
      };

    case "routing":
      return {
        ...message,
        routing: chunk.routing,
      };

    case "fallback":
      return {
        ...message,
        fallback: chunk.fallback,
      };

    case "memory":
      return {
        ...message,
        memory: chunk.memory,
      };

    case "error":
      return {
        ...message,
        status: "error",
        error: chunk.error,
      };

    case "done":
      return {
        ...message,
        status: "completed",
        executionMode: chunk.data.mode,
        skillId: chunk.data.skillId,
        content: chunk.data.content || message.content,
        toolCalls: chunk.data.toolCalls || message.toolCalls,
      };

    // 新增：零接管模式块类型处理
    case "init":
      return {
        ...message,
        requestId: chunk.init.requestId,
      };

    case "cancelled":
      return {
        ...message,
        status: "completed",
        isCancelled: true,
        content:
          message.content +
          `\n\n_${chunk.cancelled.message}${chunk.cancelled.reason ? ` (${chunk.cancelled.reason})` : ""}_`,
      };

    case "thinking":
      return {
        ...message,
        thinking: [...(message.thinking || []), chunk.thinking],
      };

    case "undo_available":
      return {
        ...message,
        undoAvailable: chunk.undoAvailable,
      };

    case "zero_takeover_confirm":
      return {
        ...message,
        zeroTakeoverConfirm: chunk.zeroTakeoverConfirm,
      };

    case "smart_defaults_applied":
      return {
        ...message,
        smartDefaults: chunk.smartDefaults,
      };

    case "citation":
      return {
        ...message,
        citation: chunk.citation,
      };

    default:
      return message;
  }
}

// ============================================
// 后端 Chunk 适配器
// ============================================

/**
 * 后端原始 Chunk 类型（所有类型都使用 data 字段）
 */
interface BackendStreamChunk {
  type: string;
  data?: Record<string, unknown>;
}

/**
 * 将后端 Chunk 格式转换为前端期望的格式
 *
 * 后端格式: { type: "text", data: { text: "..." } }
 * 前端格式: { type: "text", text: "..." }
 */
export function adaptBackendChunk(
  backendChunk: BackendStreamChunk,
): UnifiedStreamChunkFrontend {
  const { type, data } = backendChunk;

  switch (type) {
    case "text":
      return {
        type: "text",
        text: (data?.text as string) ?? "",
        isPartial: data?.isPartial as boolean | undefined,
      };

    case "progress":
      return {
        type: "progress",
        progress: {
          step: (data?.step as string) ?? "",
          percent: (data?.percent as number) ?? 0,
          message: data?.message as string | undefined,
          stepIndex: data?.stepIndex as number | undefined,
          totalSteps: data?.totalSteps as number | undefined,
          timestamp: (data?.timestamp as number) ?? Date.now(),
        },
      };

    case "tool-call":
      return {
        type: "tool-call",
        toolCall: {
          id: (data?.id as string) ?? `tool-${Date.now()}`,
          toolName: (data?.toolName as string) ?? "",
          args: (data?.args as Record<string, unknown>) ?? {},
          status:
            (data?.status as "pending" | "running" | "completed" | "failed") ??
            "pending",
          result: data?.result,
          error: data?.error as string | undefined,
        },
      };

    case "confirmation":
      return {
        type: "confirmation",
        confirmation: data as unknown as PendingConfirmation,
      };

    case "deliverable":
      return {
        type: "deliverable",
        deliverable: {
          id: (data?.id as string) ?? `deliverable-${Date.now()}`,
          type: (data?.type as DeliverableType) ?? "document",
          title: (data?.title as string) ?? "",
          format: (data?.format as DeliverableData["format"]) ?? "markdown",
          content: data?.content,
          downloadable: data?.downloadable as boolean | undefined,
          shareable: data?.shareable as boolean | undefined,
          metadata: data?.metadata as Record<string, unknown> | undefined,
        },
      };

    case "suggestions":
      return {
        type: "suggestions",
        suggestions: (data?.suggestions as SuggestionItem[]) ?? [],
      };

    case "routing":
      return {
        type: "routing",
        routing: {
          mode: (data?.mode as "atomic" | "orchestration") ?? "atomic",
          reason: (data?.reason as string) ?? "",
          skill: data?.skill as string | null,
          intentType: data?.intentType as string | undefined,
          complexityLevel: data?.complexityLevel as string | undefined,
        },
      };

    case "fallback":
      return {
        type: "fallback",
        fallback: {
          reason: (data?.reason as string) ?? "",
          originalMode: "orchestration",
          fallbackMode: "atomic",
        },
      };

    case "memory":
      return {
        type: "memory",
        memory: {
          resolved: (data?.resolved as boolean) ?? false,
          originalInput: (data?.originalInput as string) ?? "",
          resolvedInput: (data?.resolvedInput as string) ?? "",
          referenceCount: (data?.referenceCount as number) ?? 0,
          referenceTypes: (data?.referenceTypes as string[]) ?? [],
        },
      };

    case "error":
      return {
        type: "error",
        error: (data?.message as string) ?? "未知错误",
        errorCode: data?.code as string | undefined,
        retryable: data?.retryable as boolean | undefined,
      };

    case "done":
      return {
        type: "done",
        data: {
          success: (data?.success as boolean) ?? false,
          summary: data?.summary as string | undefined,
          tokensUsed: data?.tokensUsed as number | undefined,
          durationMs: data?.durationMs as number | undefined,
          mode: data?.mode as "atomic" | "orchestration" | undefined,
          skillId: data?.skillId as string | undefined,
          conversationId: data?.conversationId as string | undefined,
          content: data?.content as string | undefined,
          toolCalls: data?.toolCalls as AgentToolCall[] | undefined,
        },
      };

    // 新增：零接管模式块类型适配
    case "init":
      return {
        type: "init",
        init: {
          requestId: (data?.requestId as string) ?? "",
          timestamp: (data?.timestamp as number) ?? Date.now(),
        },
      };

    case "cancelled":
      return {
        type: "cancelled",
        cancelled: {
          message: (data?.message as string) ?? "请求已取消",
          reason: data?.reason as string | undefined,
          timestamp: (data?.timestamp as string) ?? new Date().toISOString(),
          completedSteps: data?.completedSteps as number | undefined,
          totalSteps: data?.totalSteps as number | undefined,
        },
      };

    case "thinking":
      return {
        type: "thinking",
        thinking: {
          phase: (data?.phase as ThinkingInfo["phase"]) ?? "understanding",
          content: (data?.content as string) ?? "",
          timestamp: (data?.timestamp as number) ?? Date.now(),
          round: data?.round as number | undefined,
          isFinal: data?.isFinal as boolean | undefined,
        },
      };

    case "undo_available":
      return {
        type: "undo_available",
        undoAvailable: {
          undoId: (data?.undoId as string) ?? "",
          operationType: (data?.operationType as string) ?? "",
          summary: (data?.summary as string) ?? "",
          expiresAt: (data?.expiresAt as string) ?? "",
          affectedCount: (data?.affectedCount as number) ?? 0,
        },
      };

    case "zero_takeover_confirm":
      return {
        type: "zero_takeover_confirm",
        zeroTakeoverConfirm: {
          id: (data?.id as string) ?? "",
          operationType:
            (data?.operationType as ZeroTakeoverConfirmInfo["operationType"]) ??
            "delete",
          title: (data?.title as string) ?? "",
          message: (data?.message as string) ?? "",
          affectedBookmarkIds: (data?.affectedBookmarkIds as number[]) ?? [],
          timeout: data?.timeout as number | undefined,
          defaultAction: data?.defaultAction as
            | "confirm"
            | "cancel"
            | undefined,
        },
      };

    case "smart_defaults_applied":
      return {
        type: "smart_defaults_applied",
        smartDefaults: {
          defaults: (data?.defaults as SmartDefaultsInfo["defaults"]) ?? [],
          overallConfidence: (data?.overallConfidence as number) ?? 0,
        },
      };

    case "citation":
      return {
        type: "citation",
        citation: {
          indexed: (data?.indexed as boolean) ?? false,
          totalCitations: (data?.totalCitations as number) ?? 0,
          citationSummary:
            (data?.citationSummary as CitationSummaryItem[]) ?? [],
          conversationId: data?.conversationId as string | undefined,
          query: data?.query as string | undefined,
        },
      };

    default:
      // 未知类型，返回空文本块（静默处理，避免破坏流式输出）
      return { type: "text", text: "" };
  }
}
