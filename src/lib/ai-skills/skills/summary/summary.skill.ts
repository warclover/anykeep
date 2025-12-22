/**
 * SummarySkill - 内容摘要技能
 *
 * 功能：
 * - 为书签内容生成智能摘要
 * - 自动提取标签和关键词
 * - 支持标准模式和增强模式（实体提取、关键数据）
 *
 * @version 1.0.0
 * @since 2025-12-22
 */

import { z } from "zod";
import { BaseSkill } from "../../core/base-skill";
import type { SkillMetadata, SkillContext } from "../../core/types";
import type {
  SummarySkillInput,
  SummarySkillOutput,
  SkillStructuredSummary,
  SkillEnhancedData,
} from "./types";
import { getSummaryService } from "@/lib/summary/services/summary.service";
import type { SummaryMode } from "@/lib/summary/summary.types";
import { logger } from "@/lib/logger";

/**
 * 输入 Schema
 */
const SummaryInputSchema = z.object({
  bookmarkId: z.number().int().positive().optional().describe("书签ID"),
  title: z
    .string()
    .min(1, "标题不能为空")
    .max(500, "标题不能超过500字符")
    .describe("书签标题"),
  url: z.string().url().optional().describe("书签URL"),
  description: z
    .string()
    .max(2000, "描述不能超过2000字符")
    .optional()
    .describe("书签描述"),
  content: z
    .string()
    .max(50000, "内容不能超过50000字符")
    .optional()
    .describe("正文内容，用于更精准的摘要生成"),
  mode: z
    .enum(["standard", "enhanced"])
    .optional()
    .default("standard")
    .describe("摘要模式：standard-标准模式，enhanced-增强模式（含实体提取）"),
  needsClassification: z
    .boolean()
    .optional()
    .default(true)
    .describe("是否需要触发后续分类流程"),
});

/**
 * 输出 Schema
 */
const SummaryOutputSchema = z.object({
  summary: z.string(),
  tags: z.array(z.string()),
  structured: z
    .object({
      tldr: z.string().optional(),
      keyPoints: z.array(z.string()).optional(),
      keywords: z.array(z.string()).optional(),
      sentiment: z.enum(["positive", "neutral", "negative"]).optional(),
      readingTime: z.number().optional(),
      actionItems: z.array(z.string()).optional(),
    })
    .optional(),
  enhanced: z
    .object({
      entities: z.array(
        z.object({
          name: z.string(),
          type: z.string(),
          confidence: z.number().optional(),
        }),
      ),
      keyData: z.array(
        z.object({
          label: z.string(),
          value: z.string(),
          unit: z.string().optional(),
        }),
      ),
      difficulty: z.string().optional(),
    })
    .optional(),
  contentType: z.string().optional(),
  contentTypeConfidence: z.number().optional(),
  providerUsed: z.string().optional(),
  latencyMs: z.number(),
});

/**
 * SummarySkill 实现
 */
export class SummarySkill extends BaseSkill<
  SummarySkillInput,
  SummarySkillOutput
> {
  readonly metadata: SkillMetadata = {
    id: "summary",
    name: "内容摘要",
    description:
      "为书签内容生成智能摘要，自动提取标签和关键词。支持标准模式（快速生成）和增强模式（包含实体提取、关键数据、难度评估）。",
    category: "understanding",
    version: "1.0.0",
    author: "AnyKeep",
    capabilities: [
      "summary-generation",
      "tag-extraction",
      "keyword-extraction",
      "entity-extraction",
      "content-type-detection",
      "difficulty-assessment",
    ],
    requiresConfirmation: false,
    estimatedDurationMs: 5000,
    maxExecutionTimeMs: 30000,
  };

  readonly inputSchema = SummaryInputSchema;
  readonly outputSchema = SummaryOutputSchema;

  /**
   * 执行摘要生成
   */
  protected async executeInternal(
    input: SummarySkillInput,
    context: SkillContext,
  ): Promise<SummarySkillOutput> {
    const {
      bookmarkId,
      title,
      url,
      description,
      content,
      mode = "standard",
      needsClassification = true,
    } = input;

    logger.info(
      {
        skillId: this.metadata.id,
        userId: context.userId,
        title: title.substring(0, 30),
        mode,
        hasContent: !!content,
        traceId: context.traceId,
      },
      "SummarySkill: Starting summary generation",
    );

    // 获取摘要服务
    const summaryService = getSummaryService();

    // 构建输入
    const summaryInput = {
      bookmarkId: bookmarkId || 0, // 如果没有 bookmarkId，使用 0
      userId: context.userId,
      title,
      url,
      description,
      content,
    };

    // 执行摘要生成
    const result = await summaryService.generate(summaryInput, {
      summaryMode: mode as SummaryMode,
      needsClassification,
    });

    logger.info(
      {
        skillId: this.metadata.id,
        userId: context.userId,
        tagsCount: result.tags.length,
        hasStructured: !!result.structured,
        hasEnhanced: !!result.enhanced,
        contentType: result.contentType,
        latencyMs: result.latencyMs,
        traceId: context.traceId,
      },
      "SummarySkill: Summary generated successfully",
    );

    // 转换输出格式
    return this.transformResult(result);
  }

  /**
   * 转换摘要结果为输出格式
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private transformResult(result: any): SummarySkillOutput {
    // 转换结构化摘要
    let structured: SkillStructuredSummary | undefined;
    if (result.structured) {
      structured = {
        tldr: result.structured.tldr,
        keyPoints: result.structured.key_points,
        keywords: result.structured.keywords,
        sentiment: result.structured.sentiment,
        readingTime: result.structured.reading_time,
        actionItems: result.structured.action_items,
      };
    }

    // 转换增强摘要
    let enhanced: SkillEnhancedData | undefined;
    if (result.enhanced) {
      enhanced = {
        entities: (result.enhanced.entities || []).map(
          (e: { name: string; type: string; confidence?: number }) => ({
            name: e.name,
            type: e.type,
            confidence: e.confidence,
          }),
        ),
        keyData: (result.enhanced.key_data || []).map(
          (k: { label: string; value: string; unit?: string }) => ({
            label: k.label,
            value: k.value,
            unit: k.unit,
          }),
        ),
        difficulty: result.enhanced.difficulty,
      };
    }

    return {
      summary: result.summary,
      tags: result.tags,
      structured,
      enhanced,
      contentType: result.contentType,
      contentTypeConfidence: result.contentTypeConfidence,
      providerUsed: result.providerUsed,
      latencyMs: result.latencyMs,
    };
  }
}

/**
 * 导出单例实例
 */
export const summarySkill = new SummarySkill();
