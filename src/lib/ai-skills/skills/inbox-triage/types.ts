/**
 * InboxTriageSkill 类型定义
 *
 * @version 1.0.0
 * @since 2025-01-08
 */

import { z } from "zod";
import type { StepDefinition } from "../../orchestration/types";

// ============================================
// Steps 常量
// ============================================

export const INBOX_TRIAGE_STEPS: StepDefinition[] = [
  { id: "scan", name: "扫描收件箱", description: "检索未分类书签", weight: 20 },
  {
    id: "cluster",
    name: "聚类分析",
    description: "按主题聚类书签",
    weight: 30,
  },
  { id: "suggest", name: "生成建议", description: "制定整理方案", weight: 30 },
  {
    id: "prepare",
    name: "准备操作",
    description: "构建可执行动作",
    weight: 20,
  },
];

// ============================================
// Input Schema
// ============================================

export const InboxTriageInputSchema = z.object({
  autoExecute: z.boolean().default(false).describe("是否自动执行建议"),
  maxItems: z.number().min(1).max(200).default(50).describe("最大处理数量"),
  excludeFolderIds: z.array(z.number()).optional().describe("排除的文件夹 ID"),
});

export type InboxTriageInput = z.infer<typeof InboxTriageInputSchema>;

// ============================================
// Output Schema
// ============================================

export const InboxTriageOutputSchema = z.object({
  totalScanned: z.number(),
  clustersFound: z.number(),
  suggestionsGenerated: z.number(),
  executedCount: z.number().optional(),
});

export type InboxTriageOutput = z.infer<typeof InboxTriageOutputSchema>;

// ============================================
// 内部类型
// ============================================

/**
 * 分拣建议
 */
export interface TriageSuggestion {
  id: string;
  action: "move" | "tag" | "archive";
  bookmarkIds: number[];
  targetFolder?: { id: number; name: string };
  tags?: string[];
  reason: string;
  confidence: number;
}

/**
 * 书签聚类
 */
export interface BookmarkCluster {
  key: string;
  bookmarks: Array<{
    id: number;
    title: string;
    platform?: string;
    tags?: string[];
  }>;
  commonTags: string[];
}
