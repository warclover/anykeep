/**
 * 统一输出层类型定义
 *
 * 定义所有流式输出块的类型，包括原子模式和编排模式
 *
 * @version 1.1.0
 * @since 2025-12-24
 * @updated 2025-12-27 - 添加 audio 类型支持 TTS 功能
 */

// ============================================
// 基础输出类型
// ============================================

/**
 * 交付物类型
 */
export type DeliverableType =
  | "report" // 报告
  | "list" // 列表
  | "cards" // 卡片组
  | "document" // 文档
  | "mindmap" // 思维导图
  | "graph" // 图表
  | "table" // 表格
  | "audio"; // 音频 (TTS)

/**
 * 输出格式
 */
export type OutputFormat =
  | "markdown"
  | "html"
  | "json"
  | "cards"
  | "mindmap"
  | "plain"
  | "audio"; // 音频格式 (mp3/wav)

/**
 * 确认选项
 */
export interface ConfirmOption {
  /** 选项 ID */
  id: string;
  /** 选项标签 */
  label: string;
  /** 选项描述 */
  description?: string;
  /** 是否为主要选项 */
  primary?: boolean;
  /** 是否为危险操作 */
  danger?: boolean;
}

/**
 * 后续建议
 */
export interface Suggestion {
  /** 建议显示文本 */
  text: string;
  /** 触发的动作 */
  action: string;
  /** 动作参数 */
  params?: Record<string, unknown>;
  /** 图标 */
  icon?: string;
}

/**
 * 交付物操作
 */
export interface DeliverableAction {
  /** 操作 ID */
  id: string;
  /** 操作标签 */
  label: string;
  /** 操作类型 */
  type: "download" | "share" | "copy" | "open" | "custom";
  /** 操作数据 */
  data?: unknown;
}

// ============================================
// 流式输出块类型
// ============================================

/**
 * 文本块
 */
export interface TextChunk {
  type: "text";
  data: {
    /** 文本内容 */
    text: string;
    /** 是否为部分文本（流式） */
    isPartial?: boolean;
  };
}

/**
 * 进度块
 */
export interface ProgressChunk {
  type: "progress";
  data: {
    /** 当前步骤名称 */
    step: string;
    /** 进度百分比 0-100 */
    percent: number;
    /** 进度消息 */
    message?: string;
    /** 时间戳 */
    timestamp: number;
    /** 当前步骤索引 */
    stepIndex?: number;
    /** 总步骤数 */
    totalSteps?: number;
  };
}

/**
 * 工具调用块（原子模式）
 */
export interface ToolCallChunk {
  type: "tool-call";
  data: {
    /** 工具名称 */
    toolName: string;
    /** 调用参数 */
    args: Record<string, unknown>;
    /** 调用状态 */
    status: "pending" | "running" | "completed" | "failed";
    /** 执行结果 */
    result?: unknown;
    /** 错误信息 */
    error?: string;
  };
}

/**
 * 确认请求块
 */
export interface ConfirmationChunk {
  type: "confirmation";
  data: {
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
    timeout?: number;
  };
}

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
}

/**
 * 交付物块
 */
export interface DeliverableChunk {
  type: "deliverable";
  data: {
    /** 交付物 ID */
    id: string;
    /** 交付物类型 */
    type: DeliverableType;
    /** 交付物标题 */
    title: string;
    /** 输出格式 */
    format: OutputFormat;
    /** 交付物内容 */
    content: unknown;
    /** 是否可下载 */
    downloadable?: boolean;
    /** 是否可分享 */
    shareable?: boolean;
    /** 可用操作 */
    actions?: DeliverableAction[];
    /** 元数据 */
    metadata?: Record<string, unknown>;
  };
}

/**
 * 后续建议块
 */
export interface SuggestionsChunk {
  type: "suggestions";
  data: {
    /** 建议列表 */
    suggestions: Suggestion[];
  };
}

/**
 * 路由信息块（调试用）
 */
export interface RoutingChunk {
  type: "routing";
  data: {
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
  };
}

/**
 * 错误块
 */
export interface ErrorChunk {
  type: "error";
  data: {
    /** 错误消息 */
    message: string;
    /** 错误代码 */
    code?: string;
    /** 是否可重试 */
    retryable?: boolean;
    /** 建议操作 */
    suggestion?: string;
  };
}

/**
 * 取消块
 *
 * 当用户取消操作时发送
 */
export interface CancelledChunk {
  type: "cancelled";
  data: {
    /** 取消消息 */
    message: string;
    /** 取消原因 */
    reason?: string;
    /** 取消时间 */
    timestamp: string;
    /** 已完成的步骤 */
    completedSteps?: number;
    /** 总步骤数 */
    totalSteps?: number;
  };
}

/**
 * 初始化块
 *
 * 流式响应开始时发送，包含请求 ID 用于取消
 */
export interface InitChunk {
  type: "init";
  data: {
    /** 请求 ID，用于取消操作 */
    requestId: string;
    /** 时间戳 */
    timestamp: number;
  };
}

/**
 * 回退通知块
 */
export interface FallbackChunk {
  type: "fallback";
  data: {
    /** 回退原因 */
    reason: string;
    /** 原始模式 */
    originalMode: "orchestration";
    /** 回退模式 */
    fallbackMode: "atomic";
  };
}

/**
 * 记忆块（指代解析成功时发送）
 */
export interface MemoryChunk {
  type: "memory";
  data: {
    /** 指代解析是否成功 */
    resolved: boolean;
    /** 原始输入 */
    originalInput: string;
    /** 解析后的输入 */
    resolvedInput: string;
    /** 解析的指代词数量 */
    referenceCount: number;
    /** 解析的指代类型列表 */
    referenceTypes: string[];
  };
}

/**
 * 完成块
 */
export interface DoneChunk {
  type: "done";
  data: {
    /** 是否成功 */
    success: boolean;
    /** 完成摘要 */
    summary?: string;
    /** Token 使用量 */
    tokensUsed?: number;
    /** 执行时间（毫秒） */
    durationMs?: number;
    /** 执行模式 */
    mode?: "atomic" | "orchestration";
    /** Skill ID */
    skillId?: string;
    /** 会话 ID（用于前端持久化） */
    conversationId?: string;
    /** 零接管模式：撤销信息 */
    undoInfo?: {
      undoId: string;
      expiresAt: string;
      canUndo: boolean;
    };
    /** 零接管模式：任务理解详情 */
    understanding?: {
      goal: string;
      reasoning: string;
      confidence: number;
      appliedDefaults?: Array<{
        field: string;
        value: string;
        source: string;
        reason?: string;
      }>;
    };
  };
}

// ============================================
// 零接管模式流类型
// ============================================

/**
 * AI 思考过程块
 *
 * 在零接管模式下，展示 AI 的决策过程
 * 在 ReAct 模式下，展示 Think → Act → Observe 循环
 * 在慢思考模式下，展示深度推理过程
 */
export interface ThinkingChunk {
  type: "thinking";
  data: {
    /** 思考阶段 */
    phase:
      | "understanding"
      | "planning"
      | "deciding"
      | "executing"
      // ReAct 循环阶段
      | "react_think"
      | "react_act"
      | "react_observe"
      | "react_complete"
      // 慢思考阶段
      | "slow_thinking";
    /** 思考内容 */
    content: string;
    /** 时间戳 */
    timestamp: number;
    /** ReAct 轮次（仅 ReAct 模式） */
    round?: number;
    /** 是否为最终状态（仅 ReAct 模式） */
    isFinal?: boolean;
  };
}

/**
 * 撤销可用通知块
 *
 * 操作执行完成后，通知前端撤销功能可用
 */
export interface UndoAvailableChunk {
  type: "undo_available";
  data: {
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
  };
}

/**
 * 零接管确认请求块
 *
 * 仅用于删除等高风险操作
 */
export interface ZeroTakeoverConfirmChunk {
  type: "zero_takeover_confirm";
  data: {
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
  };
}

/**
 * 智能默认值应用块
 *
 * 通知前端 AI 自动应用了哪些默认值
 */
export interface SmartDefaultsAppliedChunk {
  type: "smart_defaults_applied";
  data: {
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
  };
}

// ============================================
// 引用追踪相关类型
// ============================================

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
 * 引用追踪块
 *
 * 当搜索结果被索引为引用时发送
 */
export interface CitationChunk {
  type: "citation";
  data: {
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
  };
}

// ============================================
// 统一流式输出类型
// ============================================

/**
 * 统一流式输出块
 *
 * 无论原子模式还是编排模式，都使用此协议
 */
export type UnifiedStreamChunk =
  | TextChunk
  | ProgressChunk
  | ToolCallChunk
  | ConfirmationChunk
  | DeliverableChunk
  | SuggestionsChunk
  | RoutingChunk
  | ErrorChunk
  | CancelledChunk
  | InitChunk
  | FallbackChunk
  | MemoryChunk
  | DoneChunk
  // 零接管模式专用类型
  | ThinkingChunk
  | UndoAvailableChunk
  | ZeroTakeoverConfirmChunk
  | SmartDefaultsAppliedChunk
  // 引用追踪类型
  | CitationChunk;

/**
 * 编排模式流式输出块（用于编排 Skill 内部）
 */
export type OrchestrationStreamChunk =
  | TextChunk
  | ProgressChunk
  | ConfirmationChunk
  | DeliverableChunk
  | SuggestionsChunk
  | ErrorChunk
  | CancelledChunk
  | DoneChunk;

// ============================================
// 辅助类型
// ============================================

/**
 * 输出块类型映射
 */
export type ChunkTypeMap = {
  text: TextChunk;
  progress: ProgressChunk;
  "tool-call": ToolCallChunk;
  confirmation: ConfirmationChunk;
  deliverable: DeliverableChunk;
  suggestions: SuggestionsChunk;
  routing: RoutingChunk;
  error: ErrorChunk;
  cancelled: CancelledChunk;
  init: InitChunk;
  fallback: FallbackChunk;
  memory: MemoryChunk;
  done: DoneChunk;
  // 零接管模式类型
  thinking: ThinkingChunk;
  undo_available: UndoAvailableChunk;
  zero_takeover_confirm: ZeroTakeoverConfirmChunk;
  smart_defaults_applied: SmartDefaultsAppliedChunk;
  // 引用追踪类型
  citation: CitationChunk;
};

/**
 * 从输出块提取数据类型
 */
export type ChunkData<T extends UnifiedStreamChunk["type"]> =
  ChunkTypeMap[T]["data"];
