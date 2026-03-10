/**
 * ClassifySkill - 内容分类技能
 *
 * 功能：
 * - 根据书签内容智能推荐文件夹
 * - 支持多 Scorer 融合评分（向量、历史、规则、LLM）
 * - CascadeRanker 三级提前终止
 *
 * @version 2.0.0 - 直接调用 classification-v2
 * @since 2025-12-22
 * @updated 2026-03-09 Phase 5
 */

import { z } from "zod";
import { BaseSkill } from "../../core/base-skill";
import type { SkillMetadata, SkillContext } from "../../core/types";
import type {
  ClassifySkillInput,
  ClassifySkillOutput,
  ClassifyCandidateFolder,
} from "./types";
import type { ClassificationAction } from "@/lib/classification-v2/types/legacy-compat";
import { classify } from "@/lib/classification-v2";
import { logger } from "@/lib/logger";

/**
 * 输入 Schema
 */
const ClassifyInputSchema = z.object({
  bookmarkId: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("书签ID，用于更新已有书签的分类"),
  title: z
    .string()
    .min(1, "标题不能为空")
    .max(500, "标题不能超过500字符")
    .describe("书签标题，用于分类分析"),
  summary: z
    .string()
    .max(2000, "摘要不能超过2000字符")
    .optional()
    .describe("书签摘要或内容描述"),
  tags: z
    .array(z.string().max(50))
    .max(20)
    .optional()
    .describe("书签标签列表，用于标签增强匹配"),
  url: z.string().url().optional().describe("书签URL"),
  enableAI: z
    .boolean()
    .optional()
    .default(true)
    .describe("是否启用AI辅助分类，默认开启"),
});

/**
 * 输出 Schema
 */
const ClassifyOutputSchema = z.object({
  folderId: z.number().nullable(),
  folderName: z.string(),
  confidence: z.number().min(0).max(100),
  action: z.enum([
    "classify",
    "inbox",
    "suggest",
    "suggest_new",
    "suggest_create",
    "auto_create",
  ]),
  reason: z.string(),
  candidates: z.array(
    z.object({
      folderId: z.number(),
      folderName: z.string(),
      score: z.number(),
      matchType: z.enum(["profile", "name", "ai_select", "ai_create"]),
      topTags: z.array(z.string()),
    }),
  ),
  requiresConfirmation: z.boolean(),
  matchType: z.string().optional(),
});

/**
 * ClassifySkill 实现
 */
export class ClassifySkill extends BaseSkill<
  ClassifySkillInput,
  ClassifySkillOutput
> {
  readonly metadata: SkillMetadata = {
    id: "classify",
    name: "内容分类",
    description:
      "根据书签的标题、摘要和标签，智能推荐最合适的文件夹。支持向量匹配、标签增强和AI辅助选择。当没有合适的文件夹时，会建议创建新文件夹。",
    category: "organizing",
    version: "2.0.0",
    author: "AnyKeep",
    capabilities: [
      "vector-matching",
      "tag-boost",
      "ai-selection",
      "cold-start-support",
      "folder-suggestion",
    ],
    requiresConfirmation: false,
    estimatedDurationMs: 3000,
    maxExecutionTimeMs: 15000,
  };

  readonly inputSchema = ClassifyInputSchema;
  readonly outputSchema = ClassifyOutputSchema;

  /**
   * 执行分类
   */
  protected async executeInternal(
    input: ClassifySkillInput,
    context: SkillContext,
  ): Promise<ClassifySkillOutput> {
    const { title, summary, tags, url, bookmarkId } = input;

    logger.info(
      {
        skillId: this.metadata.id,
        userId: context.userId,
        title: title.substring(0, 30),
        bookmarkId,
        traceId: context.traceId,
      },
      "ClassifySkill: Starting classification",
    );

    // 直接调用 classification-v2 新系统
    const result = await classify({
      bookmarkId: bookmarkId ? String(bookmarkId) : "",
      title,
      summary,
      tags,
      url,
      userId: context.userId,
    });

    logger.info(
      {
        skillId: this.metadata.id,
        userId: context.userId,
        folderId: result.folderId,
        folderName: result.folderName,
        confidence: result.confidence,
        action: result.action,
        earlyExitTier: result.timing.earlyExitTier,
        totalMs: result.timing.totalMs,
        traceId: context.traceId,
      },
      "ClassifySkill: Classification completed",
    );

    // 转换候选文件夹格式
    const candidates: ClassifyCandidateFolder[] = result.candidates.map(
      (c) => ({
        folderId: c.folderId,
        folderName: c.folderName,
        score: Math.round(c.mergedScore * 100),
        matchType: "profile" as const,
        topTags: [],
      }),
    );

    // v2 返回 0~1 浮点数，输出 schema 期望 0~100 整数
    const confidencePercent = Math.round(result.confidence * 100);

    // 判断是否需要用户确认
    const requiresConfirmation = this.shouldRequireConfirmation({
      confidence: confidencePercent,
      action: result.action,
      folderId: result.folderId,
    });

    return {
      folderId: result.folderId,
      folderName: result.folderName || "",
      confidence: confidencePercent,
      action: result.action as ClassificationAction,
      reason: result.reason || "",
      candidates,
      requiresConfirmation,
      matchType:
        result.timing.earlyExitTier === undefined ? "ai_select" : "profile",
    };
  }

  /**
   * 判断是否需要用户确认
   */
  private shouldRequireConfirmation(result: {
    confidence: number;
    action: string;
    folderId: number | null;
  }): boolean {
    // 创建新文件夹时需要确认
    if (result.folderId === null) {
      return true;
    }

    // 低置信度需要确认
    if (result.confidence < 70) {
      return true;
    }

    // inbox 操作需要确认
    if (result.action === "inbox") {
      return true;
    }

    return false;
  }
}

/**
 * 导出单例实例
 */
export const classifySkill = new ClassifySkill();
