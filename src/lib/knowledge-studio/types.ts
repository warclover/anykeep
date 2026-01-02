/**
 * Knowledge Studio - 核心类型定义
 * @module knowledge-studio
 * @description 写作蓝图合成系统的共享类型
 */

// ============================================================================
// Blueprint Types
// ============================================================================

/**
 * 蓝图类型枚举
 * - debater: 辩论家 - 正反论证，引用支撑
 * - blogger: 博主 - 个人化叙事，融合观点
 * - thread: 推文串 - 分段式内容，渐进展开
 * - tutorial: 教程 - 步骤化讲解，代码示例
 * - feynman: 费曼 - 简化解释，类比丰富
 */
export type BlueprintType =
  | "debater"
  | "blogger"
  | "thread"
  | "tutorial"
  | "feynman";

/**
 * 语气类型
 */
export type ToneType = "formal" | "casual" | "academic" | "friendly";

/**
 * 蓝图配置
 */
export interface BlueprintConfig {
  type: BlueprintType;
  targetLength?: "short" | "medium" | "long";
  tone?: ToneType;
  includeExamples?: boolean;
}

/**
 * 蓝图元数据
 */
export interface BlueprintMetadata {
  model: string;
  tokens: {
    input: number;
    output: number;
    total: number;
  };
  durationMs: number;
  stagesTiming: Record<GenerationStage, number>;
  reportId?: string;
}

// ============================================================================
// Citation Types
// ============================================================================

/**
 * 引用来源
 */
export interface Citation {
  bookmarkId: string;
  title: string;
  url: string;
  excerpt: string;
  position: number;
}

// ============================================================================
// SSE Streaming Types (Decision 4.4)
// ============================================================================

/**
 * 生成阶段 - 5 阶段进度
 */
export type GenerationStage =
  | "parsing"
  | "outline"
  | "content"
  | "citations"
  | "finalizing";

/**
 * SSE 事件类型
 */
export type StreamEventType =
  | "text"
  | "progress"
  | "citation"
  | "stage"
  | "error"
  | "done";

/**
 * SSE 流式数据块
 */
export interface StreamChunk {
  type: StreamEventType;
  data: {
    // 通用字段
    text?: string;
    stage?: GenerationStage;
    stageProgress?: number;
    totalProgress?: number;
    citation?: Citation;
    error?: {
      code: string;
      message: string;
      recoverable: boolean;
      retryAfterMs?: number;
    };
    // 完成事件字段
    reportId?: string;
    content?: string;
    citations?: Citation[];
    // 编辑事件字段
    newContent?: string;
    diff?: EditDiff;
    success?: boolean;
    message?: string;
    paragraphIndex?: number;
  };
  timestamp: string;
  requestId: string;
}

/**
 * 编辑差异
 */
export interface EditDiff {
  before: string;
  after: string;
  changes: Array<{
    type: "add" | "remove" | "unchanged";
    value: string;
    lineNumber?: number;
  }>;
  stats?: {
    added: number;
    removed: number;
    unchanged: number;
  };
}

/**
 * SSE 事件格式
 */
export interface SSEEvent {
  event: `generation:${StreamEventType}`;
  data: StreamChunk;
}

// ============================================================================
// Synthesis Report Types
// ============================================================================

/**
 * 合成报告（对应数据库表）
 */
export interface SynthesisReport {
  id: string;
  userId: string;
  blueprintType: BlueprintType;
  title: string | null;
  content: string;
  citations: Citation[];
  generationMetadata: BlueprintMetadata;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 创建合成报告请求
 */
export interface CreateSynthesisRequest {
  bookmarkIds: string[];
  blueprint: BlueprintConfig;
  customPrompt?: string;
}

/**
 * 合成报告响应
 */
export interface SynthesisResponse {
  success: boolean;
  data?: SynthesisReport;
  error?: {
    code: string;
    message: string;
    recoverable: boolean;
  };
}

// ============================================================================
// Quota Types (Decision 4.2)
// ============================================================================

/**
 * 配额操作类型
 */
export type QuotaOperationType =
  | "chat_edit"
  | "blueprint_generation"
  | "material_analysis";

/**
 * 配额操作状态
 */
export type QuotaStatus = "pending" | "confirmed" | "refunded";

/**
 * 配额操作记录
 */
export interface QuotaOperation {
  id: string;
  userId: string;
  operationType: QuotaOperationType;
  requestId: string;
  status: QuotaStatus;
  cost: number;
  synthesisReportId?: string;
  errorMessage?: string;
  createdAt: Date;
  confirmedAt?: Date;
  refundedAt?: Date;
}

/**
 * 配额使用摘要
 */
export interface QuotaUsageSummary {
  totalConsumed: number;
  totalPending: number;
  totalRefunded: number;
  operationCount: number;
}

// ============================================================================
// Chat-to-Edit Types (Decision 4.3)
// ============================================================================

/**
 * 编辑上下文 - 滑动窗口
 */
export interface EditContext {
  paragraphIndex: number;
  paragraphContent: string;
  surroundingContext: string;
  recentTurns: EditTurn[];
  summaryOfOlderTurns?: string;
}

/**
 * 编辑对话轮次
 */
export interface EditTurn {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

/**
 * 编辑请求
 */
export interface EditRequest {
  reportId: string;
  paragraphIndex: number;
  instruction: string;
  context: EditContext;
}

/**
 * 编辑响应
 */
export interface EditResponse {
  success: boolean;
  newContent?: string;
  diff?: {
    before: string;
    after: string;
    changes: Array<{
      type: "add" | "remove" | "unchanged";
      value: string;
    }>;
  };
  error?: {
    code: string;
    message: string;
    recoverable: boolean;
  };
}

// ============================================================================
// Material Scorer Types
// ============================================================================

/**
 * 素材健康度评分
 */
export interface MaterialScore {
  bookmarkId: string;
  overallScore: number;
  dimensions: {
    freshness: number;
    relevance: number;
    depth: number;
    credibility: number;
  };
  recommendations: string[];
}

// ============================================================================
// Error Types
// ============================================================================

/**
 * 可恢复错误接口（Project Context 规定）
 */
export interface RecoverableError {
  code: string;
  message: string;
  recoverable: boolean;
  retryAfterMs?: number;
}

/**
 * Knowledge Studio 错误代码
 */
export const ERROR_CODES = {
  // Quota errors
  QUOTA_EXCEEDED: "QUOTA_EXCEEDED",
  QUOTA_PENDING_TIMEOUT: "QUOTA_PENDING_TIMEOUT",

  // Generation errors
  GENERATION_FAILED: "GENERATION_FAILED",
  GENERATION_TIMEOUT: "GENERATION_TIMEOUT",
  INVALID_BLUEPRINT: "INVALID_BLUEPRINT",

  // Material errors
  INSUFFICIENT_MATERIALS: "INSUFFICIENT_MATERIALS",
  INVALID_BOOKMARK_IDS: "INVALID_BOOKMARK_IDS",

  // Edit errors
  EDIT_CONFLICT: "EDIT_CONFLICT",
  PARAGRAPH_NOT_FOUND: "PARAGRAPH_NOT_FOUND",

  // Auth errors
  UNAUTHORIZED: "UNAUTHORIZED",
  PRO_FEATURE_REQUIRED: "PRO_FEATURE_REQUIRED",
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];
