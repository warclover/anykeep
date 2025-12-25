/**
 * 整理工作流 UI 组件类型定义
 *
 * @version 1.0.0
 * @since 2025-12-25
 */

import type {
  OrganizeAction,
  CategorizeSuggestion,
  TagSuggestion,
  DuplicateGroup,
  ArchiveCandidate,
  OrganizeStats,
} from "@/lib/ai-skills/skills/batch-organize/types";

// ============================================
// 整理方案类型
// ============================================

/**
 * 整理操作项
 */
export interface OrganizeOperationItem {
  /** 操作 ID */
  id: string;
  /** 操作类型 */
  type: OrganizeAction;
  /** 操作名称 */
  name: string;
  /** 操作描述 */
  description: string;
  /** 图标 */
  icon: string;
  /** 影响的书签数量 */
  affectedCount: number;
  /** 风险等级 */
  riskLevel: "low" | "medium" | "high";
  /** 预估耗时 (ms) */
  estimatedDuration: number;
  /** 警告信息 */
  warnings: string[];
  /** 详细数据（根据类型不同） */
  details?: {
    categorizeSuggestions?: CategorizeSuggestion[];
    tagSuggestions?: TagSuggestion[];
    duplicateGroups?: DuplicateGroup[];
    archiveCandidates?: ArchiveCandidate[];
  };
}

/**
 * 整理方案
 */
export interface OrganizePlan {
  /** 方案 ID */
  id: string;
  /** 操作列表 */
  operations: OrganizeOperationItem[];
  /** 总影响书签数 */
  totalAffected: number;
  /** 总预估耗时 */
  totalDuration: number;
  /** 方案摘要 */
  summary: string;
  /** 创建时间 */
  createdAt: Date;
}

// ============================================
// 执行进度类型
// ============================================

/**
 * 操作执行状态
 */
export type OperationStatus =
  | "pending"
  | "executing"
  | "completed"
  | "failed"
  | "skipped";

/**
 * 操作执行结果
 */
export interface OperationResult {
  /** 操作 ID */
  operationId: string;
  /** 状态 */
  status: OperationStatus;
  /** 影响数量 */
  affectedCount: number;
  /** 执行时间 (ms) */
  duration: number;
  /** 错误信息 */
  error?: string;
}

/**
 * 执行进度
 */
export interface ExecutionProgress {
  /** 当前操作索引 */
  currentIndex: number;
  /** 总操作数 */
  totalOperations: number;
  /** 百分比 0-100 */
  percent: number;
  /** 当前操作名称 */
  currentOperationName: string;
  /** 已完成结果列表 */
  results: OperationResult[];
  /** 是否可取消 */
  cancelable: boolean;
}

// ============================================
// 执行报告类型
// ============================================

/**
 * 执行报告数据
 */
export interface OrganizeReportData {
  /** 报告 ID */
  id: string;
  /** 方案 ID */
  planId: string;
  /** 是否成功 */
  success: boolean;
  /** 统计信息 */
  stats: OrganizeStats;
  /** 操作结果列表 */
  results: OperationResult[];
  /** 快照 ID（用于撤销） */
  snapshotId?: string;
  /** 报告摘要 */
  summary: string;
  /** 生成时间 */
  generatedAt: Date;
  /** 执行耗时 (ms) */
  totalDuration: number;
}

// ============================================
// 组件 Props 类型
// ============================================

/**
 * OrganizePlanConfirm Props
 */
export interface OrganizePlanConfirmProps {
  /** 整理方案 */
  plan: OrganizePlan;
  /** 对话框是否打开 */
  open: boolean;
  /** 打开状态变化回调 */
  onOpenChange: (open: boolean) => void;
  /** 确认回调 */
  onConfirm: (plan: OrganizePlan) => void;
  /** 修改方案回调（移除操作时调用） */
  onModify: (modifiedPlan: OrganizePlan) => void;
  /** 取消回调 */
  onCancel: () => void;
  /** 是否正在执行 */
  isLoading?: boolean;
}

/**
 * OrganizeProgress Props
 */
export interface OrganizeProgressProps {
  /** 执行进度 */
  progress: ExecutionProgress;
  /** 取消回调 */
  onCancel?: () => void;
  /** 自定义类名 */
  className?: string;
}

/**
 * OrganizeReport Props
 */
export interface OrganizeReportProps {
  /** 执行报告 */
  report: OrganizeReportData;
  /** 查看详情回调 */
  onViewDetails?: () => void;
  /** 撤销回调 */
  onUndo?: (snapshotId: string) => void;
  /** 关闭回调 */
  onClose?: () => void;
  /** 是否正在撤销 */
  isUndoing?: boolean;
  /** 自定义类名 */
  className?: string;
}
