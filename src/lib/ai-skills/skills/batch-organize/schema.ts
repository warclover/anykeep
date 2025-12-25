/**
 * BatchOrganizeSkill Schema 定义
 *
 * 包含所有输入输出的 Zod Schema
 *
 * @module ai-skills/skills/batch-organize/schema
 * @version 1.0.0
 * @since 2025-12-25
 */

import { z } from "zod";
import { BATCH_ORGANIZE_CONFIG } from "../../config";

// ============================================
// 输入 Schema
// ============================================

export const BatchOrganizeInputSchema = z.object({
  actions: z
    .array(
      z.enum([
        "auto-categorize",
        "auto-tag",
        "clean-duplicates",
        "archive-old",
        "validate-urls",
      ]),
    )
    .min(1)
    .describe("整理操作"),
  scope: z
    .enum(["all", "uncategorized", "untagged", "selected"])
    .default("uncategorized")
    .describe("整理范围"),
  requireConfirmation: z.boolean().default(true).describe("是否需要确认"),
  autoExecute: z.boolean().default(false).describe("自动执行"),
  filter: z
    .object({
      folderId: z.number().optional(),
      platforms: z.array(z.string()).optional(),
      bookmarkIds: z
        .array(z.number())
        .max(BATCH_ORGANIZE_CONFIG.MAX_BOOKMARK_IDS)
        .optional(),
      olderThanDays: z.number().optional(),
    })
    .optional()
    .describe("筛选条件"),
});

// ============================================
// 统计数据 Schema
// ============================================

export const OrganizeStatsSchema = z.object({
  totalProcessed: z.number(),
  categorizeSuggestions: z.number(),
  tagSuggestions: z.number(),
  duplicatesFound: z.number(),
  archiveCandidates: z.number(),
  invalidUrls: z.number(),
  actionsExecuted: z.number(),
});

// ============================================
// 建议 Schema
// ============================================

export const CategorizeSuggestionSchema = z.object({
  bookmarkId: z.number(),
  bookmarkTitle: z.string(),
  currentFolder: z.string().nullable(),
  suggestedFolder: z.string(),
  suggestedFolderId: z.number().optional(),
  confidence: z.number().min(0).max(1),
  reason: z.string(),
});

export const TagSuggestionSchema = z.object({
  bookmarkId: z.number(),
  bookmarkTitle: z.string(),
  currentTags: z.array(z.string()),
  suggestedTags: z.array(z.string()),
  confidence: z.number().min(0).max(1),
});

export const DuplicateGroupSchema = z.object({
  normalizedUrl: z.string(),
  bookmarks: z.array(
    z.object({
      id: z.number(),
      title: z.string(),
      createdAt: z.string(),
      folderId: z.number().nullable(),
    }),
  ),
  keepBookmarkId: z.number(),
});

export const ArchiveCandidateSchema = z.object({
  bookmarkId: z.number(),
  bookmarkTitle: z.string(),
  daysSinceCreated: z.number(),
  neverAccessed: z.boolean(),
  reason: z.string(),
});

export const UrlValidationResultSchema = z.object({
  bookmarkId: z.number(),
  bookmarkTitle: z.string(),
  url: z.string(),
  isValid: z.boolean(),
  statusCode: z.number().optional(),
  error: z.string().optional(),
});

// ============================================
// 输出 Schema
// ============================================

export const BatchOrganizeOutputSchema = z.object({
  stats: OrganizeStatsSchema,
  categorizeSuggestions: z.array(CategorizeSuggestionSchema),
  tagSuggestions: z.array(TagSuggestionSchema),
  duplicateGroups: z.array(DuplicateGroupSchema),
  archiveCandidates: z.array(ArchiveCandidateSchema),
  urlValidations: z.array(UrlValidationResultSchema),
  summary: z.string(),
  suggestions: z.array(z.string()),
  generatedAt: z.string(),
});

// ============================================
// 步骤定义
// ============================================

export const ORGANIZE_STEPS = [
  { id: "collect", name: "收集数据", description: "收集书签数据", weight: 15 },
  { id: "analyze", name: "分析内容", description: "分析书签内容", weight: 25 },
  {
    id: "categorize",
    name: "智能分类",
    description: "生成分类建议",
    weight: 20,
  },
  { id: "tag", name: "智能打标", description: "生成标签建议", weight: 20 },
  { id: "clean", name: "整理清理", description: "查找重复和归档", weight: 15 },
  { id: "report", name: "生成报告", description: "生成整理报告", weight: 5 },
];
