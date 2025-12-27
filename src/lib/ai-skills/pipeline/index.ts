/**
 * Skill 执行流水线模块
 *
 * 提供标准化的 Skill 执行流程：
 * - 5 阶段执行：解析 → 验证 → 风险检查 → 执行 → 格式化
 * - 统一的错误处理
 * - 风险门控与确认机制
 * - 执行状态追踪
 *
 * @example
 * ```typescript
 * import {
 *   SkillExecutionPipeline,
 *   PipelineStage,
 *   isPipelineEvent,
 * } from '@/lib/ai-skills/pipeline';
 *
 * const pipeline = new SkillExecutionPipeline({ skillRegistry });
 *
 * for await (const chunk of pipeline.execute(skillId, input, context)) {
 *   if (isPipelineEvent(chunk)) {
 *     console.log(`Stage: ${chunk.stage}`);
 *   }
 * }
 * ```
 *
 * @module ai-skills/pipeline
 * @version 1.0.0
 * @since 2025-12-27
 */

// 类型导出
export {
  PipelineStage,
  type StageStatus,
  type StageEventData,
  type PipelineEvent,
  type PipelineChunk,
  type PipelineConfig,
  type PipelineContext,
  type ResolveStageResult,
  type ValidateStageResult,
  type RiskCheckStageResult,
  type ExecuteStageResult,
  type StageStats,
  type PipelineStats,
  DEFAULT_PIPELINE_CONFIG,
  isPipelineEvent,
  isSkillChunk,
} from "./types";

// 错误导出
export {
  PipelineError,
  SkillNotFoundError,
  SkillDisabledError,
  ValidationError,
  RiskConfirmationRequiredError,
  ExecutionTimeoutError,
  ExecutionCancelledError,
  ExecutionFailedError,
  PIPELINE_ERROR_CODES,
  type PipelineErrorCode,
  createPipelineError,
  isPipelineError,
  isRetryableError,
} from "./errors";

// 核心类导出
export {
  SkillExecutionPipeline,
  createSkillExecutionPipeline,
  type SkillRegistry,
  type PipelineOptions,
} from "./skill-execution-pipeline";
