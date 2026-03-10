/**
 * 过渡类型桥接 — 从旧系统 re-export
 *
 * 目的：让前端组件/hooks 统一从 v2 导入类型，
 * 消除对旧 classification/ 的直接依赖。
 * 后续各 Phase 完成后，逐步替换为 v2 原生定义或独立模块。
 *
 * @version 2.0.0
 * @since 2026-03-10
 */

// ============================================================================
// 书签扩展字段（classification/types/domain-types）
// ============================================================================

export type { BookmarkV42Fields } from "@/lib/classification/types/domain-types";

// ============================================================================
// Inbox 组织建议（classification/types/suggestion）
// ============================================================================

export type {
  ClusterProcessingStatus,
  OrganizationSuggestion,
  OrganizationAnalysis,
  SuggestionInput,
} from "@/lib/classification/types/suggestion";

// ============================================================================
// 批量分类（classification/services/batch-classification）
// Phase 6 迁出后将更新此路径
// ============================================================================

export type {
  ClusterResult,
  UserDecision,
  ConfirmationMode,
  ConflictType,
  ClassificationConflict,
  ClassificationProgress,
  ClassificationPhase,
  StructureMode,
} from "@/lib/classification/services/batch-classification";
