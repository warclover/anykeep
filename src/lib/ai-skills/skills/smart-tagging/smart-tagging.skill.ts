/**
 * SmartTaggingSkill - 智能标签推荐 Skill
 *
 * 功能：
 * - AI 驱动的标签建议生成
 * - 基于现有标签词汇的匹配
 * - 标签库规范化（合并、去重）
 * - 标签统计分析
 *
 * 执行流程：
 * 1. 分析 - 分析书签内容
 * 2. 提取 - 提取关键词和实体
 * 3. 匹配 - 匹配现有标签词汇
 * 4. 生成 - 生成标签建议
 * 5. 报告 - 生成摘要报告
 *
 * @version 1.0.0
 * @since 2025-12-24
 */

import { z } from "zod";
import { OrchestrationSkill } from "../../orchestration/orchestration-skill";
import type { OrchestrationContext } from "../../orchestration/types";
import type { OrchestrationStreamChunk } from "../../output/types";
import type { OrchestrationSkillMetadata } from "../../orchestration/types";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import type {
  SmartTaggingInput,
  SmartTaggingOutput,
  BookmarkTagSuggestion,
  NormalizationResult,
  TagStatistics,
  SmartTaggingStats,
} from "./types";
import { SMART_TAGGING_CONFIG, DEFAULT_TAGGING_INPUT } from "./types";
import { TagAnalyzer, type BookmarkData } from "./tag-analyzer";

// ============================================
// Schema 定义
// ============================================

const SmartTaggingInputSchema = z.object({
  scope: z
    .enum(["untagged", "all", "selected"])
    .default("untagged")
    .describe("处理范围"),
  bookmarkIds: z
    .array(z.number().int().positive())
    .max(SMART_TAGGING_CONFIG.MAX_BOOKMARKS)
    .optional()
    .describe("书签 ID 列表"),
  mode: z
    .enum(["suggest", "auto-apply", "normalize"])
    .default("suggest")
    .describe("处理模式"),
  maxTagsPerBookmark: z
    .number()
    .int()
    .min(SMART_TAGGING_CONFIG.MIN_TAGS)
    .max(SMART_TAGGING_CONFIG.MAX_TAGS)
    .default(SMART_TAGGING_CONFIG.DEFAULT_MAX_TAGS)
    .describe("每个书签最大标签数"),
  useExistingTags: z
    .boolean()
    .default(true)
    .describe("是否优先使用现有标签词汇"),
  normalizeOptions: z
    .object({
      mergeSimilar: z.boolean().default(true),
      removeRare: z.boolean().default(false),
      translateToLanguage: z.string().optional(),
    })
    .optional()
    .describe("规范化选项"),
});

const SmartTaggingOutputSchema = z.object({
  stats: z.object({
    totalProcessed: z.number(),
    suggestionsGenerated: z.number(),
    tagsNormalized: z.number(),
    tagsApplied: z.number(),
  }),
  suggestions: z.array(z.any()),
  normalization: z.any().optional(),
  tagStatistics: z.object({
    totalUniqueTags: z.number(),
    topTags: z.array(z.object({ tag: z.string(), count: z.number() })),
    suggestedNewTags: z.array(z.string()),
  }),
  summary: z.string(),
  generatedAt: z.string(),
});

// ============================================
// 步骤定义
// ============================================

const TAGGING_STEPS = [
  {
    id: "analyze",
    name: "分析内容",
    description: "分析书签内容和现有标签",
    weight: 20,
  },
  {
    id: "extract",
    name: "提取关键词",
    description: "从标题和摘要提取关键词",
    weight: 25,
  },
  {
    id: "match",
    name: "匹配词汇",
    description: "匹配现有标签词汇库",
    weight: 20,
  },
  {
    id: "generate",
    name: "生成建议",
    description: "生成标签建议",
    weight: 25,
  },
  {
    id: "report",
    name: "生成报告",
    description: "生成统计报告",
    weight: 10,
  },
];

// ============================================
// SmartTaggingSkill 实现
// ============================================

export class SmartTaggingSkill extends OrchestrationSkill<
  SmartTaggingInput,
  SmartTaggingOutput
> {
  readonly metadata: OrchestrationSkillMetadata = {
    id: "smart_tagging",
    name: "智能标签助手",
    description:
      "AI 驱动的智能标签推荐系统，分析您的收藏内容并生成精准的标签建议，帮助您更好地组织和检索知识。",
    category: "organizing",
    version: "1.0.0",
    author: "AnyKeep",
    capabilities: [
      "tag-suggestion",
      "keyword-extraction",
      "vocabulary-matching",
      "tag-normalization",
    ],
    requiresConfirmation: false,
    estimatedDurationMs: 15000,
    maxExecutionTimeMs: 90000,
    deliverableTypes: ["report", "list"],
    outputFormats: ["markdown", "json"],
    steps: TAGGING_STEPS,
  };

  readonly inputSchema = SmartTaggingInputSchema;
  readonly outputSchema = SmartTaggingOutputSchema;

  private tagAnalyzer: TagAnalyzer;

  constructor() {
    super();
    this.tagAnalyzer = new TagAnalyzer();
  }

  // ============================================
  // 输入解析
  // ============================================

  async parseInput(
    userMessage: string,
    context: OrchestrationContext,
  ): Promise<SmartTaggingInput> {
    const input: SmartTaggingInput = {
      ...(DEFAULT_TAGGING_INPUT as SmartTaggingInput),
    };

    // 解析范围
    if (/无标签|未标签|untagged/i.test(userMessage)) {
      input.scope = "untagged";
    } else if (/全部|所有|all/i.test(userMessage)) {
      input.scope = "all";
    }

    // 解析模式
    if (/自动|auto|apply/i.test(userMessage)) {
      input.mode = "auto-apply";
    } else if (/规范化|normalize|整理标签/i.test(userMessage)) {
      input.mode = "normalize";
    }

    // 解析是否使用现有标签
    if (/新标签|不用现有|ignore.*existing/i.test(userMessage)) {
      input.useExistingTags = false;
    }

    // 解析规范化选项
    if (input.mode === "normalize") {
      input.normalizeOptions = {
        mergeSimilar: true,
        removeRare: /移除.*稀有|remove.*rare/i.test(userMessage),
      };
    }

    // 使用上下文中的参数覆盖
    const params = context.params as Record<string, unknown> | undefined;
    if (params?.bookmarkIds) {
      input.scope = "selected";
      input.bookmarkIds = params.bookmarkIds as number[];
    }

    return input;
  }

  // ============================================
  // 主执行流程
  // ============================================

  async *executeStream(
    context: OrchestrationContext,
  ): AsyncGenerator<OrchestrationStreamChunk> {
    const startTime = Date.now();

    // 初始化进度
    this.initProgress(TAGGING_STEPS);

    try {
      const input = context.params as SmartTaggingInput;

      // 步骤 1: 分析内容
      yield* this.reportProgress("分析内容", 0, "正在分析书签内容...");

      // 获取书签数据
      const bookmarks = await this.fetchBookmarks(input, context.userId);

      if (bookmarks.length === 0) {
        yield* this.emitText("未找到符合条件的书签，请调整筛选条件后重试。\n");
        yield* this.emitDone(true, "未找到书签");
        return;
      }

      yield* this.reportProgress(
        "分析内容",
        10,
        `已加载 ${bookmarks.length} 条书签`,
      );

      yield* this.emitText(
        `📚 找到 ${bookmarks.length} 条书签，开始分析标签...\n`,
      );

      // 获取现有标签词汇
      const existingVocabulary = await this.getExistingVocabulary(
        context.userId,
      );

      yield* this.reportProgress(
        "分析内容",
        20,
        `现有标签词汇: ${existingVocabulary.size} 个`,
      );

      // 步骤 2 & 3: 提取关键词和匹配词汇
      yield* this.reportProgress("提取关键词", 25, "正在提取关键词...");

      const suggestions: BookmarkTagSuggestion[] = [];
      const batchSize = 20;
      let processed = 0;

      for (let i = 0; i < bookmarks.length; i += batchSize) {
        const batch = bookmarks.slice(i, i + batchSize);

        for (const bookmark of batch) {
          const suggestion = this.tagAnalyzer.generateSuggestions(
            bookmark,
            existingVocabulary,
            input.maxTagsPerBookmark,
            input.useExistingTags,
          );

          if (suggestion.suggestedTags.length > 0) {
            suggestions.push(suggestion);
          }
        }

        processed += batch.length;
        const percent = 25 + Math.floor((processed / bookmarks.length) * 40);

        yield* this.reportProgress(
          "匹配词汇",
          percent,
          `已处理 ${processed}/${bookmarks.length} 条书签`,
        );
      }

      yield* this.emitText(`🎯 生成 ${suggestions.length} 条标签建议\n`);

      // 步骤 4: 生成建议（或自动应用）
      yield* this.reportProgress("生成建议", 70, "正在整理建议...");

      let normalization: NormalizationResult | undefined;
      let tagsApplied = 0;

      // 如果是规范化模式
      if (input.mode === "normalize" && input.normalizeOptions) {
        const allTagsWithCount = await this.getAllTagsWithCount(context.userId);
        const normalizeResult = this.tagAnalyzer.normalizeTagLibrary(
          allTagsWithCount,
          input.normalizeOptions,
        );
        // 映射到 NormalizationResult 类型
        normalization = {
          mergedTags: normalizeResult.merged,
          removedTags: normalizeResult.removed,
        };

        yield* this.emitText(`🔄 标签规范化分析完成：\n`);
        yield* this.emitText(
          `   - 可合并标签组: ${normalization.mergedTags.length} 个\n`,
        );
        yield* this.emitText(
          `   - 建议移除标签: ${normalization.removedTags.length} 个\n`,
        );
      }

      // 如果是自动应用模式
      if (input.mode === "auto-apply") {
        tagsApplied = await this.applyTags(suggestions, context.userId);
        yield* this.emitText(`✅ 已自动应用 ${tagsApplied} 个标签\n`);
      }

      yield* this.reportProgress("生成建议", 90, "生成建议完成");

      // 步骤 5: 生成报告
      yield* this.reportProgress("生成报告", 95, "正在生成报告...");

      // 收集新建议的标签
      const newSuggestedTags = suggestions.flatMap((s) =>
        s.suggestedTags
          .filter((t) => !existingVocabulary.has(t.tag.toLowerCase()))
          .map((t) => t.tag),
      );

      // 生成标签统计
      const allTagsWithCount = await this.getAllTagsWithCount(context.userId);
      const tagStatistics = this.tagAnalyzer.generateStatistics(
        allTagsWithCount,
        newSuggestedTags,
      );

      // 构建统计
      const stats: SmartTaggingStats = {
        totalProcessed: bookmarks.length,
        suggestionsGenerated: suggestions.reduce(
          (sum, s) => sum + s.suggestedTags.length,
          0,
        ),
        tagsNormalized: normalization
          ? normalization.mergedTags.length + normalization.removedTags.length
          : 0,
        tagsApplied,
      };

      // 生成摘要
      const summary = this.generateSummary(stats, input.mode, tagStatistics);

      // 构建输出
      const output: SmartTaggingOutput = {
        stats,
        suggestions,
        normalization,
        tagStatistics,
        summary,
        generatedAt: new Date().toISOString(),
      };

      // 生成 Markdown 报告
      const report = this.generateReport(output, input);

      // 输出交付物
      const deliverable = this.createDeliverable(
        "report",
        "智能标签分析报告",
        { report, output },
        "markdown",
        {
          downloadable: true,
          shareable: false,
          metadata: {
            filename: `tag-suggestions-${new Date().toISOString().split("T")[0]}.md`,
            totalProcessed: stats.totalProcessed,
            suggestionsGenerated: stats.suggestionsGenerated,
          },
        },
      );

      yield* this.emitDeliverable(deliverable);

      yield* this.reportProgress("生成报告", 100, "报告生成完成");

      // 输出摘要
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      yield* this.emitText(`\n✅ 标签分析完成！\n`);
      yield* this.emitText(
        `   📊 处理 ${stats.totalProcessed} 条书签，生成 ${stats.suggestionsGenerated} 个建议\n`,
      );
      yield* this.emitText(`   ⏱️ 用时 ${duration} 秒\n`);

      // 输出热门建议
      if (suggestions.length > 0) {
        yield* this.emitText(`\n📌 热门标签建议：\n`);

        // 统计标签出现频率
        const tagFreq = new Map<string, number>();
        suggestions.forEach((s) => {
          s.suggestedTags.forEach((t) => {
            tagFreq.set(t.tag, (tagFreq.get(t.tag) || 0) + 1);
          });
        });

        const topSuggested = Array.from(tagFreq.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5);

        for (const [tag, count] of topSuggested) {
          yield* this.emitText(`   - ${tag} (建议添加到 ${count} 条书签)\n`);
        }
      }

      yield* this.emitDone(
        true,
        `处理了 ${stats.totalProcessed} 条书签，生成 ${stats.suggestionsGenerated} 个标签建议`,
      );
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          context,
        },
        "SmartTaggingSkill: Execution failed",
      );

      yield* this.emitError(
        error instanceof Error ? error.message : "标签分析失败，请稍后重试",
        "EXECUTION_ERROR",
        true,
      );
    }
  }

  // ============================================
  // 辅助方法
  // ============================================

  /**
   * 获取书签数据
   */
  private async fetchBookmarks(
    input: SmartTaggingInput,
    userId: string,
  ): Promise<BookmarkData[]> {
    const supabase = await createClient();

    let query = supabase
      .from("bookmarks")
      .select(
        `
        id, title, url, ai_summary, ai_tags, platform
      `,
      )
      .eq("user_id", userId)
      .is("deleted_at", null)
      .limit(SMART_TAGGING_CONFIG.MAX_BOOKMARKS);

    switch (input.scope) {
      case "untagged":
        // 查询没有标签的书签
        // 注意：这需要一个子查询或不同的查询策略
        // 简化实现：获取所有书签后在客户端过滤
        break;
      case "selected":
        if (input.bookmarkIds && input.bookmarkIds.length > 0) {
          query = query.in("id", input.bookmarkIds);
        }
        break;
      // "all" 不需要额外筛选
    }

    const { data, error } = await query;

    if (error) {
      logger.error({ error }, "SmartTaggingSkill: Failed to fetch bookmarks");
      throw new Error("获取书签数据失败");
    }

    // 如果需要获取标签，单独查询
    const bookmarkIds = (data || []).map((b) => b.id);
    const bookmarkTags: Map<number, string[]> = new Map();

    if (bookmarkIds.length > 0) {
      // 使用 any 断言绕过表名类型检查（bookmark_tags 和 tags 不在生成的类型中）
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: tagData } = (await (supabase as any)
        .from("bookmark_tags")
        .select("bookmark_id, tag_id")
        .in("bookmark_id", bookmarkIds)) as {
        data: Array<{ bookmark_id: number; tag_id: number }> | null;
      };

      if (tagData && tagData.length > 0) {
        // 获取所有标签 ID
        const tagIds = [...new Set(tagData.map((bt) => bt.tag_id))];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: tagsData } = (await (supabase as any)
          .from("tags")
          .select("id, name")
          .in("id", tagIds)) as {
          data: Array<{ id: number; name: string }> | null;
        };

        // 创建 tagId -> tagName 映射
        const tagNameMap = new Map<number, string>();
        (tagsData || []).forEach((t) => {
          tagNameMap.set(t.id, t.name);
        });

        // 填充 bookmarkTags
        for (const bt of tagData) {
          const tagName = tagNameMap.get(bt.tag_id);
          if (tagName) {
            const existing = bookmarkTags.get(bt.bookmark_id) || [];
            existing.push(tagName);
            bookmarkTags.set(bt.bookmark_id, existing);
          }
        }
      }
    }

    // 转换数据格式
    let bookmarks: BookmarkData[] = (data || []).map((item) => ({
      id: item.id,
      title: item.title,
      url: item.url,
      ai_summary: item.ai_summary,
      ai_tags: item.ai_tags,
      platform: item.platform,
      tags: (bookmarkTags.get(item.id) || []).map((name) => ({ name })),
    }));

    // 如果是 untagged 范围，过滤没有标签的书签
    if (input.scope === "untagged") {
      bookmarks = bookmarks.filter((b) => !b.tags || b.tags.length === 0);
    }

    return bookmarks;
  }

  /**
   * 获取现有标签词汇
   */
  private async getExistingVocabulary(userId: string): Promise<Set<string>> {
    const supabase = await createClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = (await (supabase as any)
      .from("tags")
      .select("name")
      .eq("user_id", userId)) as {
      data: Array<{ name: string }> | null;
      error: unknown;
    };

    if (error) {
      logger.warn(
        { error },
        "SmartTaggingSkill: Failed to fetch existing tags",
      );
      return new Set();
    }

    return new Set((data || []).map((t) => t.name.toLowerCase()));
  }

  /**
   * 获取所有标签及其使用次数
   */
  private async getAllTagsWithCount(
    userId: string,
  ): Promise<Array<{ tag: string; count: number; bookmarkIds: number[] }>> {
    const supabase = await createClient();

    // 先获取所有标签
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: tagsData, error: tagsError } = (await (supabase as any)
      .from("tags")
      .select("id, name")
      .eq("user_id", userId)) as {
      data: Array<{ id: number; name: string }> | null;
      error: unknown;
    };

    if (tagsError) {
      logger.warn(
        { error: tagsError },
        "SmartTaggingSkill: Failed to fetch tag counts",
      );
      return [];
    }

    if (!tagsData || tagsData.length === 0) {
      return [];
    }

    // 再获取标签关联
    const tagIds = tagsData.map((t) => t.id);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: bookmarkTagsData } = (await (supabase as any)
      .from("bookmark_tags")
      .select("tag_id, bookmark_id")
      .in("tag_id", tagIds)) as {
      data: Array<{ tag_id: number; bookmark_id: number }> | null;
    };

    // 构建 tagId -> bookmarkIds 映射
    const tagBookmarkMap = new Map<number, number[]>();
    (bookmarkTagsData || []).forEach((bt) => {
      const existing = tagBookmarkMap.get(bt.tag_id) || [];
      existing.push(bt.bookmark_id);
      tagBookmarkMap.set(bt.tag_id, existing);
    });

    return tagsData.map((t) => ({
      tag: t.name,
      count: tagBookmarkMap.get(t.id)?.length || 0,
      bookmarkIds: tagBookmarkMap.get(t.id) || [],
    }));
  }

  /**
   * 应用标签（自动模式）
   */
  private async applyTags(
    suggestions: BookmarkTagSuggestion[],
    userId: string,
  ): Promise<number> {
    const supabase = await createClient();
    let appliedCount = 0;

    for (const suggestion of suggestions) {
      for (const tagSuggestion of suggestion.suggestedTags) {
        if (tagSuggestion.confidence >= 0.7) {
          // 只应用高置信度的标签
          try {
            // 1. 确保标签存在
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data: existingTag } = (await (supabase as any)
              .from("tags")
              .select("id")
              .eq("user_id", userId)
              .eq("name", tagSuggestion.tag)
              .single()) as { data: { id: number } | null };

            let tagId: number;

            if (existingTag) {
              tagId = Number(existingTag.id);
            } else {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const { data: newTag, error: createError } = (await (
                supabase as any
              )
                .from("tags")
                .insert({ user_id: userId, name: tagSuggestion.tag })
                .select("id")
                .single()) as { data: { id: number } | null; error: unknown };

              if (createError || !newTag) continue;
              tagId = Number(newTag.id);
            }

            // 2. 创建关联
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { error: linkError } = await (supabase as any)
              .from("bookmark_tags")
              .insert({
                bookmark_id: suggestion.bookmarkId,
                tag_id: tagId,
              });

            if (!linkError) {
              appliedCount++;
            }
          } catch {
            // 忽略单个标签应用失败
          }
        }
      }
    }

    return appliedCount;
  }

  /**
   * 生成摘要
   */
  private generateSummary(
    stats: SmartTaggingStats,
    mode: string,
    tagStats: TagStatistics,
  ): string {
    const parts: string[] = [];

    parts.push(`分析了 ${stats.totalProcessed} 条书签`);

    if (mode === "suggest") {
      parts.push(`生成了 ${stats.suggestionsGenerated} 个标签建议`);
    } else if (mode === "auto-apply") {
      parts.push(`自动应用了 ${stats.tagsApplied} 个标签`);
    } else if (mode === "normalize") {
      parts.push(`发现 ${stats.tagsNormalized} 个可优化的标签`);
    }

    if (tagStats.suggestedNewTags.length > 0) {
      parts.push(`建议创建 ${tagStats.suggestedNewTags.length} 个新标签`);
    }

    return parts.join("，") + "。";
  }

  /**
   * 生成 Markdown 报告
   */
  private generateReport(
    output: SmartTaggingOutput,
    input: SmartTaggingInput,
  ): string {
    const lines: string[] = [];

    lines.push("# 智能标签分析报告");
    lines.push("");
    lines.push(`> 生成时间: ${new Date().toLocaleString("zh-CN")}`);
    lines.push(`> 处理模式: ${input.mode}`);
    lines.push("");

    // 统计概览
    lines.push("## 📊 统计概览");
    lines.push("");
    lines.push(`- 处理书签数: ${output.stats.totalProcessed}`);
    lines.push(`- 生成建议数: ${output.stats.suggestionsGenerated}`);
    if (output.stats.tagsApplied > 0) {
      lines.push(`- 应用标签数: ${output.stats.tagsApplied}`);
    }
    if (output.stats.tagsNormalized > 0) {
      lines.push(`- 可优化标签: ${output.stats.tagsNormalized}`);
    }
    lines.push("");

    // 热门标签
    if (output.tagStatistics.topTags.length > 0) {
      lines.push("## 🏷️ 热门标签");
      lines.push("");
      output.tagStatistics.topTags.slice(0, 10).forEach((t, i) => {
        lines.push(`${i + 1}. **${t.tag}** (${t.count} 次)`);
      });
      lines.push("");
    }

    // 标签建议
    if (output.suggestions.length > 0 && input.mode === "suggest") {
      lines.push("## 💡 标签建议");
      lines.push("");

      output.suggestions.slice(0, 20).forEach((s) => {
        lines.push(`### ${s.bookmarkTitle}`);
        lines.push("");
        if (s.currentTags.length > 0) {
          lines.push(`**当前标签**: ${s.currentTags.join(", ")}`);
        }
        lines.push("**建议添加**:");
        s.suggestedTags.forEach((t) => {
          lines.push(
            `- ${t.tag} (置信度: ${(t.confidence * 100).toFixed(0)}%) - ${t.reason}`,
          );
        });
        lines.push("");
      });
    }

    // 规范化建议
    if (output.normalization) {
      if (output.normalization.mergedTags.length > 0) {
        lines.push("## 🔄 建议合并的标签");
        lines.push("");
        output.normalization.mergedTags.forEach((m) => {
          lines.push(
            `- ${m.original.join(", ")} → **${m.normalized}** (影响 ${m.affectedBookmarks} 条书签)`,
          );
        });
        lines.push("");
      }

      if (output.normalization.removedTags.length > 0) {
        lines.push("## 🗑️ 建议移除的标签");
        lines.push("");
        output.normalization.removedTags.forEach((r) => {
          lines.push(`- ${r.tag} - ${r.reason}`);
        });
        lines.push("");
      }
    }

    // 新标签建议
    if (output.tagStatistics.suggestedNewTags.length > 0) {
      lines.push("## 🆕 建议创建的新标签");
      lines.push("");
      lines.push(output.tagStatistics.suggestedNewTags.join(", "));
      lines.push("");
    }

    return lines.join("\n");
  }
}

// 导出单例实例
export const smartTaggingSkill = new SmartTaggingSkill();
