/**
 * SearchOptimizeSkill 类型定义
 *
 * @version 1.0.0
 * @since 2025-01-08
 */

import { z } from "zod";

// ============================================
// Input Schema
// ============================================

export const SearchOptimizeInputSchema = z.object({
  originalQuery: z.string().optional().describe("原始搜索词"),
  feedback: z.string().optional().describe("用户反馈（太多/太少/不相关）"),
  autoApply: z.boolean().default(false).describe("是否自动应用优化"),
});

export type SearchOptimizeInput = z.infer<typeof SearchOptimizeInputSchema>;

// ============================================
// Output Schema
// ============================================

export const SearchOptimizeOutputSchema = z.object({
  analysis: z
    .object({
      originalQuery: z.string(),
      issues: z.array(
        z.object({
          type: z.string(),
          suggestion: z.string(),
        }),
      ),
    })
    .nullable(),
  suggestions: z.array(
    z.object({
      optimizedQuery: z.string(),
      explanation: z.string(),
      expectedImprovement: z.string(),
    }),
  ),
  tips: z.array(z.string()),
});

export type SearchOptimizeOutput = z.infer<typeof SearchOptimizeOutputSchema>;

// ============================================
// 内部类型
// ============================================

/**
 * 搜索问题分析结果
 */
export interface SearchAnalysisResult {
  issues: Array<{
    type: string;
    suggestion: string;
  }>;
}

/**
 * 搜索优化建议
 */
export interface SearchOptimizationSuggestion {
  optimizedQuery: string;
  explanation: string;
  expectedImprovement: string;
}
