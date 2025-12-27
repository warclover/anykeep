/**
 * Skill 执行流水线类型定义
 *
 * 5 阶段标准化执行流程：解析 → 验证 → 风险检查 → 执行 → 格式化
 *
 * @version 1.0.0
 * @since 2025-12-27
 */

import type { CancellationToken } from "../orchestration/types";
import type { OrchestrationStreamChunk } from "../output/types";
import type { RiskLevel } from "@/lib/ai-agent/core/prompts/response-templates";

// ============================================
// 流水线阶段
// ============================================

/**
 * 流水线阶段枚举
 */
export enum PipelineStage {
  /** 解析阶段 - 从 ID 查找 Skill 实例 */
  RESOLVE = "resolve",
  /** 验证阶段 - 输入验证与清洗 */
  VALIDATE = "validate",
  /** 风险检查阶段 - 风险评估与确认 */
  RISK_CHECK = "risk_check",
  /** 执行阶段 - 执行 Skill + 取消检查 */
  EXECUTE = "execute",
  /** 格式化阶段 - 统一输出格式 */
  FORMAT = "format",
}

/**
 * 阶段状态
 */
export type StageStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "skipped"
  | "needs_confirmation";

// ============================================
// 流水线事件
// ============================================

/**
 * 阶段事件数据
 */
export interface StageEventData {
  /** Skill ID */
  skillId?: string;
  /** 风险级别 */
  riskLevel?: RiskLevel;
  /** 是否需要确认 */
  requiresConfirmation?: boolean;
  /** 验证警告 */
  validationWarnings?: string[];
  /** 影响数量 */
  affectedCount?: number;
  /** 错误消息 */
  error?: string;
  /** 错误码 */
  errorCode?: string;
  /** 是否可重试 */
  retryable?: boolean;
  /** 确认选项（当 needs_confirmation 时） */
  confirmationOptions?: {
    title: string;
    message: string;
    options: Array<{
      id: string;
      label: string;
      primary?: boolean;
      danger?: boolean;
    }>;
  };
}

/**
 * 流水线事件
 *
 * 每个阶段开始/结束/失败时发出
 */
export interface PipelineEvent {
  /** 事件类型标识 */
  type: "pipeline";
  /** 阶段 */
  stage: PipelineStage;
  /** 状态 */
  status: StageStatus;
  /** 时间戳 */
  timestamp: number;
  /** 阶段执行时间（毫秒） */
  durationMs?: number;
  /** 追踪 ID */
  traceId?: string;
  /** 事件数据 */
  data?: StageEventData;
}

/**
 * 流水线输出块类型
 *
 * 可以是流水线事件或 Skill 输出块
 */
export type PipelineChunk = PipelineEvent | OrchestrationStreamChunk;

// ============================================
// 流水线配置
// ============================================

/**
 * 流水线配置
 */
export interface PipelineConfig {
  /** 跳过验证（调试用） */
  skipValidation?: boolean;
  /** 跳过风险检查 */
  skipRiskCheck?: boolean;
  /** 用户已确认（跳过确认流程） */
  userConfirmed?: boolean;
  /** 影响数量（用于批量操作判断） */
  affectedCount?: number;
  /** 执行超时时间（毫秒），默认 60000 */
  timeoutMs?: number;
  /** 最大重试次数，默认 0 */
  maxRetries?: number;
  /** 是否启用详细日志 */
  verbose?: boolean;
}

/**
 * 默认配置
 */
export const DEFAULT_PIPELINE_CONFIG: Required<PipelineConfig> = {
  skipValidation: false,
  skipRiskCheck: false,
  userConfirmed: false,
  affectedCount: 1,
  timeoutMs: 60000,
  maxRetries: 0,
  verbose: false,
};

// ============================================
// 流水线上下文
// ============================================

/**
 * 流水线执行上下文
 */
export interface PipelineContext {
  /** 用户 ID */
  userId: string;
  /** 追踪 ID */
  traceId: string;
  /** 中止信号 */
  signal?: AbortSignal;
  /** 取消令牌 */
  cancellationToken?: CancellationToken;
  /** 流水线配置 */
  config: PipelineConfig;
  /** 会话 ID（可选） */
  conversationId?: string;
  /** 关联书签 ID 列表（可选） */
  bookmarkIds?: number[];
  /** 关联文件夹 ID（可选） */
  folderId?: number;
}

// ============================================
// 阶段结果
// ============================================

/**
 * 解析阶段结果
 */
export interface ResolveStageResult {
  success: true;
  skillId: string;
  skillName: string;
}

/**
 * 验证阶段结果
 */
export interface ValidateStageResult {
  success: boolean;
  sanitizedInput: string;
  warnings: string[];
  error?: string;
}

/**
 * 风险检查阶段结果
 */
export interface RiskCheckStageResult {
  success: boolean;
  riskLevel: RiskLevel;
  requiresConfirmation: boolean;
  /** 如果需要确认，用户是否已确认 */
  confirmed?: boolean;
}

/**
 * 执行阶段结果
 */
export interface ExecuteStageResult {
  success: boolean;
  durationMs: number;
  error?: string;
  errorCode?: string;
  cancelled?: boolean;
}

// ============================================
// 流水线统计
// ============================================

/**
 * 阶段统计
 */
export interface StageStats {
  stage: PipelineStage;
  status: StageStatus;
  startTime: number;
  endTime?: number;
  durationMs?: number;
}

/**
 * 流水线执行统计
 */
export interface PipelineStats {
  /** 开始时间 */
  startTime: number;
  /** 结束时间 */
  endTime?: number;
  /** 总执行时间（毫秒） */
  totalDurationMs?: number;
  /** 各阶段统计 */
  stages: StageStats[];
  /** 是否成功完成 */
  success?: boolean;
  /** 失败阶段 */
  failedStage?: PipelineStage;
}

// ============================================
// 类型守卫
// ============================================

/**
 * 判断是否为流水线事件
 */
export function isPipelineEvent(chunk: PipelineChunk): chunk is PipelineEvent {
  return "type" in chunk && chunk.type === "pipeline";
}

/**
 * 判断是否为 Skill 输出块
 */
export function isSkillChunk(
  chunk: PipelineChunk,
): chunk is OrchestrationStreamChunk {
  return !isPipelineEvent(chunk);
}
