/**
 * DuplicateCleanupSkill - 重复书签清理 Skill
 *
 * 功能：
 * - 精确 URL 匹配检测
 * - 规范化 URL 匹配（移除追踪参数、www等）
 * - 语义相似度检测（可选）
 * - 智能推荐保留策略
 * - 确认后批量清理
 *
 * 执行流程：
 * 1. 收集书签数据
 * 2. 规范化 URL
 * 3. 检测重复
 * 4. 分析完整度
 * 5. 请求确认
 * 6. 执行清理
 *
 * @version 1.1.0
 * @since 2025-12-24
 * @updated 2025-12-25 模块拆分重构
 */

import { z } from "zod";
import { OrchestrationSkill } from "../../orchestration/orchestration-skill";
import type { OrchestrationContext } from "../../orchestration/types";
import type { OrchestrationStreamChunk } from "../../output/types";
import type { SkillContext } from "../../core/types";
import type { OrchestrationSkillMetadata } from "../../orchestration/types";
import { SkillExecutionError } from "../../core/base-skill";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import { SKILL_ERROR_CODES } from "../../config";
import { UrlNormalizer } from "./url-normalizer";
import type {
  DuplicateCleanupInput,
  DuplicateCleanupOutput,
  DuplicateGroup,
  CleanupAction,
  CleanupStats,
  DuplicateStrategy,
  KeepStrategy,
} from "./types";
import { DUPLICATE_CLEANUP_CONFIG, DEFAULT_CLEANUP_INPUT } from "./types";
import { detectDuplicates, type BookmarkRow } from "./detection";
import { analyzeGroupCompleteness } from "./utils";

// ============================================
// Schema 定义
// ============================================

const DuplicateCleanupInputSchema = z.object({
  scope: z
    .enum(["all", "folder", "selected"])
    .default("all")
    .describe("清理范围"),
  folderId: z.number().int().positive().optional().describe("文件夹ID"),
  bookmarkIds: z
    .array(z.number().int().positive())
    .max(DUPLICATE_CLEANUP_CONFIG.MAX_SELECTED_IDS)
    .optional()
    .describe("选中的书签ID"),
  strategy: z
    .enum(["exact", "normalized", "semantic"])
    .default("normalized")
    .describe("去重策略"),
  semanticThreshold: z
    .number()
    .min(DUPLICATE_CLEANUP_CONFIG.MIN_SEMANTIC_THRESHOLD)
    .max(DUPLICATE_CLEANUP_CONFIG.MAX_SEMANTIC_THRESHOLD)
    .default(DUPLICATE_CLEANUP_CONFIG.DEFAULT_SEMANTIC_THRESHOLD)
    .optional()
    .describe("语义相似度阈值"),
  autoCleanup: z.boolean().default(false).describe("是否自动清理"),
  keepStrategy: z
    .enum(["oldest", "newest", "most_complete"])
    .default("most_complete")
    .describe("保留策略"),
});

const DuplicateCleanupOutputSchema = z.object({
  stats: z.object({
    totalScanned: z.number(),
    duplicateGroupsFound: z.number(),
    totalDuplicates: z.number(),
    byStrategy: z.object({
      exact: z.number(),
      normalized: z.number(),
      semantic: z.number(),
    }),
    actionsExecuted: z.number(),
    deletedCount: z.number(),
  }),
  duplicateGroups: z.array(z.any()),
  actionsExecuted: z.array(z.any()),
  summary: z.string(),
  suggestions: z.array(z.string()),
  generatedAt: z.string(),
});

// ============================================
// 步骤定义
// ============================================

const CLEANUP_STEPS = [
  { id: "collect", name: "收集数据", description: "收集书签数据", weight: 15 },
  {
    id: "normalize",
    name: "规范化URL",
    description: "规范化URL便于比较",
    weight: 20,
  },
  {
    id: "detect",
    name: "检测重复",
    description: "检测重复书签",
    weight: 30,
  },
  {
    id: "analyze",
    name: "分析完整度",
    description: "分析书签完整度",
    weight: 15,
  },
  { id: "confirm", name: "确认操作", description: "请求用户确认", weight: 10 },
  { id: "execute", name: "执行清理", description: "执行清理操作", weight: 10 },
];

// ============================================
// DuplicateCleanupSkill 实现
// ============================================

export class DuplicateCleanupSkill extends OrchestrationSkill<
  DuplicateCleanupInput,
  DuplicateCleanupOutput
> {
  readonly metadata: OrchestrationSkillMetadata = {
    id: "duplicate_cleanup",
    name: "重复清理助手",
    description:
      "智能检测并清理重复的书签，支持精确匹配、规范化匹配和语义相似度检测，帮助您保持收藏夹整洁。",
    category: "organizing",
    version: "1.1.0",
    author: "AnyKeep",
    capabilities: [
      "exact-match",
      "normalized-match",
      "semantic-match",
      "completeness-analysis",
      "batch-cleanup",
    ],
    requiresConfirmation: true,
    estimatedDurationMs: 20000,
    maxExecutionTimeMs: 60000,
    deliverableTypes: ["report", "list"],
    outputFormats: ["markdown", "json"],
    steps: CLEANUP_STEPS,
  };

  readonly inputSchema = DuplicateCleanupInputSchema;
  readonly outputSchema = DuplicateCleanupOutputSchema;

  private urlNormalizer = new UrlNormalizer();

  /**
   * 解析自然语言输入
   */
  async parseInput(
    message: string,
    _context: OrchestrationContext,
  ): Promise<DuplicateCleanupInput> {
    // 解析策略
    let strategy: DuplicateStrategy = "normalized";
    if (/精确|exact|完全相同/.test(message)) {
      strategy = "exact";
    } else if (/语义|相似|semantic/.test(message)) {
      strategy = "semantic";
    }

    // 解析保留策略
    let keepStrategy: KeepStrategy = "most_complete";
    if (/保留.*最早|最老|oldest|first/.test(message)) {
      keepStrategy = "oldest";
    } else if (/保留.*最新|newest|latest/.test(message)) {
      keepStrategy = "newest";
    }

    // 解析是否自动执行
    const autoCleanup = /自动|直接|auto/.test(message);

    return {
      ...DEFAULT_CLEANUP_INPUT,
      strategy,
      keepStrategy,
      autoCleanup,
    } as DuplicateCleanupInput;
  }

  /**
   * 流式执行重复清理
   */
  async *executeStream(
    context: OrchestrationContext,
  ): AsyncGenerator<OrchestrationStreamChunk> {
    const startTime = Date.now();
    const input = context.params as DuplicateCleanupInput;

    // 初始化进度
    this.initProgress(CLEANUP_STEPS);

    try {
      // Step 1: 收集数据
      yield* this.reportProgress("收集数据", 5, "正在收集书签数据...");
      yield* this.emitText(
        `🔍 正在扫描书签，查找重复内容（策略: ${this.getStrategyName(input.strategy)}）...\n\n`,
      );

      const bookmarks = await this.fetchBookmarks(context.userId, input);

      yield* this.reportProgress(
        "收集数据",
        15,
        `收集到 ${bookmarks.length} 条书签`,
      );
      yield* this.emitText(`📚 共扫描 **${bookmarks.length}** 条书签。\n\n`);

      if (bookmarks.length === 0) {
        yield* this.emitText("没有找到书签，无需清理。");
        yield* this.emitDone(true, "没有需要检查的书签");
        return;
      }

      if (bookmarks.length < 2) {
        yield* this.emitText("书签数量不足，无法检测重复。");
        yield* this.emitDone(true, "书签数量不足");
        return;
      }

      // Step 2: 规范化 URL
      yield* this.reportProgress("规范化URL", 20, "正在规范化URL...");

      const normalizedBookmarks = bookmarks.map((b) => ({
        ...b,
        normalizedUrl: this.urlNormalizer.normalize(b.url).normalized,
      }));

      yield* this.reportProgress("规范化URL", 35, "URL规范化完成");

      // Step 3: 检测重复（使用提取的模块）
      yield* this.reportProgress("检测重复", 40, "正在检测重复书签...");

      const duplicateGroups = detectDuplicates(
        normalizedBookmarks,
        input.strategy,
        input.semanticThreshold,
      );

      yield* this.reportProgress(
        "检测重复",
        65,
        `发现 ${duplicateGroups.length} 组重复`,
      );

      if (duplicateGroups.length === 0) {
        yield* this.emitText("✅ **太棒了！未发现重复书签。**\n\n");
        yield* this.emitText("您的收藏夹非常整洁，继续保持！");

        const output: DuplicateCleanupOutput = {
          stats: {
            totalScanned: bookmarks.length,
            duplicateGroupsFound: 0,
            totalDuplicates: 0,
            byStrategy: { exact: 0, normalized: 0, semantic: 0 },
            actionsExecuted: 0,
            deletedCount: 0,
          },
          duplicateGroups: [],
          actionsExecuted: [],
          summary: `扫描了 ${bookmarks.length} 条书签，未发现重复。`,
          suggestions: ["继续保持良好的收藏习惯"],
          generatedAt: new Date().toISOString(),
        };

        yield* this.emitDeliverable(
          this.createDeliverable("report", "重复检测报告", output, "markdown", {
            downloadable: true,
          }),
        );
        yield* this.emitDone(true, "未发现重复书签");
        return;
      }

      // Step 4: 分析完整度（使用提取的模块）
      yield* this.reportProgress("分析完整度", 70, "正在分析书签完整度...");

      const analyzedGroups = analyzeGroupCompleteness(
        duplicateGroups,
        input.keepStrategy,
      );

      yield* this.reportProgress("分析完整度", 80, "完整度分析完成");

      // 输出发现的重复
      const totalDuplicates = analyzedGroups.reduce(
        (sum, g) => sum + g.bookmarks.length - 1,
        0,
      );

      yield* this.emitText(`## 🔄 发现重复书签\n\n`);
      yield* this.emitText(
        `共发现 **${analyzedGroups.length}** 组重复，涉及 **${totalDuplicates}** 条可清理的书签。\n\n`,
      );

      // 展示前 5 组
      for (const [index, group] of analyzedGroups.slice(0, 5).entries()) {
        yield* this.emitText(`### 第 ${index + 1} 组\n`);
        yield* this.emitText(
          `**URL**: \`${group.normalizedUrl.slice(0, 60)}${group.normalizedUrl.length > 60 ? "..." : ""}\`\n\n`,
        );

        for (const b of group.bookmarks) {
          const isKeep = b.id === group.recommendedKeep;
          const prefix = isKeep ? "✅ 保留" : "❌ 删除";
          yield* this.emitText(
            `- ${prefix}: **${b.title}** (完整度: ${b.completeness}%)\n`,
          );
        }
        yield* this.emitText(`\n*推荐原因: ${group.reason}*\n\n`);
      }

      if (analyzedGroups.length > 5) {
        yield* this.emitText(
          `*...还有 ${analyzedGroups.length - 5} 组重复*\n\n`,
        );
      }

      // 构建统计
      const stats: CleanupStats = {
        totalScanned: bookmarks.length,
        duplicateGroupsFound: analyzedGroups.length,
        totalDuplicates,
        byStrategy: {
          exact: input.strategy === "exact" ? analyzedGroups.length : 0,
          normalized:
            input.strategy === "normalized" ? analyzedGroups.length : 0,
          semantic: input.strategy === "semantic" ? analyzedGroups.length : 0,
        },
        actionsExecuted: 0,
        deletedCount: 0,
      };

      // Step 5: 确认操作
      let actionsExecuted: CleanupAction[] = [];

      if (input.autoCleanup) {
        // 自动清理模式
        yield* this.reportProgress("执行清理", 85, "正在执行自动清理...");
        actionsExecuted = await this.executeCleanup(
          context.userId,
          analyzedGroups,
        );
        stats.actionsExecuted = actionsExecuted.length;
        stats.deletedCount = actionsExecuted.filter(
          (a) => a.action === "deleted",
        ).length;

        yield* this.emitText(`\n## ✅ 清理完成\n\n`);
        yield* this.emitText(
          `成功删除 **${stats.deletedCount}** 条重复书签。\n`,
        );
      } else {
        // 需要确认
        yield* this.reportProgress("确认操作", 85, "等待用户确认...");

        yield* this.emitConfirmation(
          `确认清理 ${totalDuplicates} 条重复书签？`,
          `将保留每组中完整度最高的书签，删除其余 ${totalDuplicates} 条重复。此操作不可撤销。`,
          [
            { id: "confirm", label: "确认清理", danger: true },
            { id: "cancel", label: "取消" },
          ],
        );

        yield* this.emitText(`\n---\n\n`);
        yield* this.emitText(
          `💡 **请在上方确认清理操作**，或下载报告后手动处理。\n`,
        );
      }

      // 生成输出
      const summary = this.generateSummary(stats, input);
      const suggestions = this.generateSuggestions(stats);

      const output: DuplicateCleanupOutput = {
        stats,
        duplicateGroups: analyzedGroups,
        actionsExecuted,
        summary,
        suggestions,
        generatedAt: new Date().toISOString(),
      };

      // 输出交付物
      yield* this.reportProgress("完成", 95, "正在生成报告...");

      const deliverable = this.createDeliverable(
        "report",
        "重复书签清理报告",
        output,
        "markdown",
        {
          downloadable: true,
          shareable: false,
          metadata: {
            ...stats,
            strategy: input.strategy,
          },
        },
      );

      yield* this.emitDeliverable(deliverable);

      // 输出建议
      yield* this.emitSuggestions(
        suggestions.map((s, i) => ({
          text: s,
          label: `建议 ${i + 1}`,
          action: "cleanup",
          icon: "💡",
        })),
      );

      yield* this.reportProgress("完成", 100, "重复检测完成");
      yield* this.emitDone(true, summary);

      logger.info(
        {
          skillId: this.metadata.id,
          userId: context.userId,
          ...stats,
          durationMs: Date.now() - startTime,
        },
        "DuplicateCleanupSkill: Execution completed",
      );
    } catch (error) {
      logger.error(
        {
          skillId: this.metadata.id,
          userId: context.userId,
          error: error instanceof Error ? error.message : String(error),
        },
        "DuplicateCleanupSkill: Execution failed",
      );

      yield* this.emitError(
        error instanceof Error ? error.message : "重复检测失败",
        "EXECUTION_ERROR",
        true,
      );
      yield* this.emitDone(false, "重复检测失败");
    }
  }

  /**
   * 获取书签数据
   */
  private async fetchBookmarks(
    userId: string,
    input: DuplicateCleanupInput,
  ): Promise<BookmarkRow[]> {
    if (
      input.bookmarkIds &&
      input.bookmarkIds.length > DUPLICATE_CLEANUP_CONFIG.MAX_SELECTED_IDS
    ) {
      throw new SkillExecutionError(
        `单次最多处理 ${DUPLICATE_CLEANUP_CONFIG.MAX_SELECTED_IDS} 条书签`,
        SKILL_ERROR_CODES.INPUT_TOO_LARGE,
      );
    }

    const supabase = await createClient();

    let query = supabase
      .from("bookmarks")
      .select(
        `
        id,
        title,
        url,
        platform,
        ai_summary,
        ai_tags,
        user_tags,
        folder_id,
        created_at,
        folders(name)
      `,
      )
      .eq("user_id", userId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true });

    switch (input.scope) {
      case "folder":
        if (input.folderId) {
          query = query.eq("folder_id", input.folderId);
        }
        break;
      case "selected":
        if (input.bookmarkIds?.length) {
          query = query.in("id", input.bookmarkIds);
        }
        break;
    }

    const { data, error } = await query.limit(
      DUPLICATE_CLEANUP_CONFIG.MAX_SCAN_LIMIT,
    );

    if (error) {
      logger.error(
        { error },
        "DuplicateCleanupSkill: Failed to fetch bookmarks",
      );
      throw new Error(`获取书签失败: ${error.message}`);
    }

    return (data || []) as BookmarkRow[];
  }

  /**
   * 执行清理操作
   */
  private async executeCleanup(
    userId: string,
    groups: DuplicateGroup[],
  ): Promise<CleanupAction[]> {
    const supabase = await createClient();
    const actions: CleanupAction[] = [];

    for (const group of groups) {
      const toDelete = group.bookmarks
        .filter((b) => b.id !== group.recommendedKeep)
        .map((b) => b.id);

      if (toDelete.length > 0) {
        const { error } = await supabase
          .from("bookmarks")
          .update({ deleted_at: new Date().toISOString() })
          .eq("user_id", userId)
          .in("id", toDelete);

        if (error) {
          logger.error(
            { error, bookmarkIds: toDelete },
            "DuplicateCleanupSkill: Failed to delete bookmarks",
          );
          for (const id of toDelete) {
            actions.push({
              action: "skipped",
              bookmarkId: id,
              skipReason: error.message,
            });
          }
        } else {
          for (const id of toDelete) {
            actions.push({
              action: "deleted",
              bookmarkId: id,
              mergedInto: group.recommendedKeep,
            });
          }
        }
      }
    }

    return actions;
  }

  /**
   * 获取策略名称
   */
  private getStrategyName(strategy: DuplicateStrategy): string {
    switch (strategy) {
      case "exact":
        return "精确匹配";
      case "normalized":
        return "规范化匹配";
      case "semantic":
        return "语义相似度";
      default:
        return strategy;
    }
  }

  /**
   * 生成摘要
   */
  private generateSummary(
    stats: CleanupStats,
    input: DuplicateCleanupInput,
  ): string {
    const parts: string[] = [];

    parts.push(`扫描了 **${stats.totalScanned}** 条书签`);

    if (stats.duplicateGroupsFound > 0) {
      parts.push(
        `发现 **${stats.duplicateGroupsFound}** 组重复（共 **${stats.totalDuplicates}** 条可清理）`,
      );
    } else {
      parts.push("未发现重复书签");
    }

    if (stats.deletedCount > 0) {
      parts.push(`已清理 **${stats.deletedCount}** 条`);
    }

    parts.push(`使用策略: ${this.getStrategyName(input.strategy)}`);

    return parts.join("，") + "。";
  }

  /**
   * 生成建议
   */
  private generateSuggestions(stats: CleanupStats): string[] {
    const suggestions: string[] = [];

    if (stats.duplicateGroupsFound === 0) {
      suggestions.push("您的收藏夹非常整洁，继续保持！");
      return suggestions;
    }

    if (stats.totalDuplicates > 10) {
      suggestions.push("建议分批清理，每次处理 10-20 条以便仔细审核");
    }

    if (stats.deletedCount === 0) {
      suggestions.push("点击「确认清理」按钮完成清理操作");
    }

    suggestions.push("定期检查重复书签可以保持收藏夹整洁");
    suggestions.push("收藏前可以先搜索是否已存在相同内容");

    return suggestions;
  }

  /**
   * 非流式执行
   */
  protected async executeInternal(
    input: DuplicateCleanupInput,
    context: SkillContext,
  ): Promise<DuplicateCleanupOutput> {
    const orchestrationContext: OrchestrationContext = {
      ...context,
      params: input,
    };

    let output: DuplicateCleanupOutput | undefined;

    for await (const chunk of this.executeStream(orchestrationContext)) {
      if (chunk.type === "deliverable") {
        output = chunk.data.content as DuplicateCleanupOutput;
      }
    }

    if (!output) {
      throw new Error("重复检测失败");
    }

    return output;
  }
}

// ============================================
// 导出
// ============================================

export const duplicateCleanupSkill = new DuplicateCleanupSkill();
