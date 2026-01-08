/**
 * SnapshotCompareSkill 类型定义
 *
 * @version 1.0.0
 * @since 2025-01-08
 */

import { z } from "zod";

// ============================================
// Input Schema
// ============================================

export const SnapshotCompareInputSchema = z.object({
  snapshotId: z.number().describe("当前快照 ID"),
  compareWithSnapshotId: z.number().optional().describe("对比目标快照 ID"),
  versionNumber: z.number().optional().describe("对比的历史版本号"),
});

export type SnapshotCompareInput = z.infer<typeof SnapshotCompareInputSchema>;

// ============================================
// Output Schema
// ============================================

export const SnapshotCompareOutputSchema = z.object({
  hasChanges: z.boolean(),
  changeType: z.enum(["major", "minor", "none"]),
  summary: z.string(),
  similarityScore: z.number(),
  stats: z.object({
    addedLines: z.number(),
    removedLines: z.number(),
  }),
});

export type SnapshotCompareOutput = z.infer<typeof SnapshotCompareOutputSchema>;

// ============================================
// 内部类型
// ============================================

/**
 * 变更类型
 */
export type ChangeType = "major" | "minor" | "none";

/**
 * 差异统计
 */
export interface DiffStats {
  addedLines: number;
  removedLines: number;
  totalChanges: number;
  similarityScore: number;
}
