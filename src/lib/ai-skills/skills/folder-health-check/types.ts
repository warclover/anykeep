/**
 * FolderHealthCheckSkill 类型定义
 *
 * @version 1.0.0
 * @since 2025-01-08
 */

import { z } from "zod";
import type { StepDefinition } from "../../orchestration/types";

// ============================================
// 步骤定义
// ============================================

export const FOLDER_HEALTH_STEPS: StepDefinition[] = [
  { id: "scan", name: "扫描结构", description: "获取文件夹信息", weight: 20 },
  { id: "diagnose", name: "诊断问题", description: "分析健康状态", weight: 40 },
  { id: "suggest", name: "生成建议", description: "提供优化方案", weight: 40 },
];

// ============================================
// Input Schema
// ============================================

export const FolderHealthCheckInputSchema = z.object({});

export type FolderHealthCheckInput = z.infer<
  typeof FolderHealthCheckInputSchema
>;

// ============================================
// Output Schema
// ============================================

export const FolderHealthCheckOutputSchema = z.object({
  status: z.enum(["healthy", "needs_attention", "critical"]),
  totalFolders: z.number(),
  healthyFolders: z.number(),
  mergeSuggestionsCount: z.number(),
  splitSuggestionsCount: z.number(),
});

export type FolderHealthCheckOutput = z.infer<
  typeof FolderHealthCheckOutputSchema
>;

// ============================================
// 内部类型
// ============================================

/**
 * 健康状态枚举
 */
export type HealthStatus = "healthy" | "needs_attention" | "critical";

/**
 * 合并建议
 */
export interface MergeSuggestion {
  sourceId: number;
  targetId: number;
  reason: string;
  similarity: number;
}

/**
 * 拆分建议
 */
export interface SplitSuggestion {
  folderId: number;
  reason: string;
  suggestedSplits: string[];
}
