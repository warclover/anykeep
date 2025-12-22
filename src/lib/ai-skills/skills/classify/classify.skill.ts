/**
 * ClassifySkill - 内容分类技能
 *
 * 功能：
 * - 根据书签内容智能推荐文件夹
 * - 支持向量匹配、标签增强、AI 选择
 * - 冷启动时使用名称匹配
 *
 * @version 1.0.0
 * @since 2025-12-22
 */

import { z } from "zod";
import { BaseSkill } from "../../core/base-skill";
import type { SkillMetadata, SkillContext } from "../../core/types";
import type {
  ClassifySkillInput,
  ClassifySkillOutput,
  ClassifyCandidateFolder,
} from "./types";
import { createClient } from "@/lib/supabase/server";
import { createSimpleClassificationService } from "@/lib/classification/services/simple-classification.service";
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
    version: "1.0.0",
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
    const { title, summary, tags, url, enableAI = true, bookmarkId } = input;

    logger.info(
      {
        skillId: this.metadata.id,
        userId: context.userId,
        title: title.substring(0, 30),
        enableAI,
        traceId: context.traceId,
      },
      "ClassifySkill: Starting classification",
    );

    // 创建 Supabase 客户端
    const supabase = await createClient();

    // 创建分类服务
    const classificationService = createSimpleClassificationService(supabase, {
      enableAISelection: enableAI,
      enableAICreate: enableAI,
    });

    // 执行分类
    const result = await classificationService.classify(context.userId, {
      id: bookmarkId,
      title,
      summary,
      tags,
      url,
    });

    logger.info(
      {
        skillId: this.metadata.id,
        userId: context.userId,
        folderId: result.folderId,
        folderName: result.folderName,
        confidence: result.confidence,
        action: result.action,
        matchType: result.matchType,
        executionTime: result.executionTime,
        traceId: context.traceId,
      },
      "ClassifySkill: Classification completed",
    );

    // 转换候选文件夹格式
    const candidates: ClassifyCandidateFolder[] = (result.candidates || []).map(
      (c) => ({
        folderId: c.folderId,
        folderName: c.folderName,
        score: c.score,
        matchType: c.matchType || "profile",
        topTags: c.topTags || [],
      }),
    );

    // 判断是否需要用户确认
    const requiresConfirmation = this.shouldRequireConfirmation(result);

    return {
      folderId: result.folderId,
      folderName: result.folderName,
      confidence: result.confidence,
      action: result.action,
      reason: result.reason,
      candidates,
      requiresConfirmation,
      matchType: result.matchType,
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
