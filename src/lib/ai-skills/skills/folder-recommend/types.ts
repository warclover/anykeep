/**
 * FolderRecommendSkill 类型定义
 *
 * @version 1.0.0
 * @since 2025-01-08
 */

import { z } from "zod";

// ============================================
// Input Schema
// ============================================

export const FolderRecommendInputSchema = z.object({
  maxRecommendations: z
    .number()
    .min(1)
    .max(10)
    .default(5)
    .describe("最大推荐数量"),
  considerHierarchy: z.boolean().default(true).describe("是否考虑层级结构"),
  focusOnUnclassified: z.boolean().default(true).describe("是否聚焦未分类书签"),
});

export type FolderRecommendInput = z.infer<typeof FolderRecommendInputSchema>;

// ============================================
// Output Schema
// ============================================

export const FolderRecommendOutputSchema = z.object({
  recommendations: z.array(
    z.object({
      name: z.string(),
      isNew: z.boolean(),
      folderId: z.number().nullable(),
      reason: z.string(),
      matchingBookmarkCount: z.number(),
      confidence: z.number(),
    }),
  ),
  currentFolderCount: z.number(),
  unclassifiedCount: z.number(),
});

export type FolderRecommendOutput = z.infer<typeof FolderRecommendOutputSchema>;

// ============================================
// 内部类型
// ============================================

/**
 * 文件夹推荐项
 */
export interface FolderRecommendationItem {
  name: string;
  isNew: boolean;
  folderId: number | null;
  reason: string;
  matchingBookmarkCount: number;
  confidence: number;
}
