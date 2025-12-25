/**
 * BatchOrganizeSkill - 批量整理编排 Skill（协调器）
 *
 * 功能：
 * - 智能分类：根据内容推荐文件夹
 * - 智能打标：根据内容推荐标签
 * - 清理重复：查找并合并重复书签
 * - 归档旧内容：归档长期未访问的书签
 * - 验证链接：检查书签链接有效性
 *
 * @version 2.0.0
 * @since 2025-12-24
 * @updated 2025-12-25 - Refactored into coordinator pattern
 */

import { OrchestrationSkill } from "../../orchestration/orchestration-skill";
import type { OrchestrationContext } from "../../orchestration/types";
import type { OrchestrationStreamChunk } from "../../output/types";
import type { SkillContext } from "../../core/types";
import type { OrchestrationSkillMetadata } from "../../orchestration/types";
import { logger } from "@/lib/logger";
import { BATCH_ORGANIZE_CONFIG } from "../../config";

// Import types
import type {
  BatchOrganizeInput,
  BatchOrganizeOutput,
  OrganizeAction,
  OrganizeStats,
  CategorizeSuggestion,
  TagSuggestion,
  DuplicateGroup,
  ArchiveCandidate,
  UrlValidationResult,
} from "./types";
import { ORGANIZE_ACTION_CONFIG, DEFAULT_ORGANIZE_CONFIG } from "./types";

// Import schemas
import {
  BatchOrganizeInputSchema,
  BatchOrganizeOutputSchema,
  ORGANIZE_STEPS,
} from "./schema";

// Import step functions
import {
  fetchBookmarks,
  fetchFolders,
  generateCategorizeSuggestions,
  generateTagSuggestions,
  findDuplicates,
  findArchiveCandidates,
  generateSummary,
  generateOrganizeSuggestions,
  buildConfirmationMessage,
  executeCategorizeSuggestions,
  executeTagSuggestions,
  executeDuplicateCleanup,
  executeArchive,
} from "./steps";

// ============================================
// BatchOrganizeSkill 实现
// ============================================

export class BatchOrganizeSkill extends OrchestrationSkill<
  BatchOrganizeInput,
  BatchOrganizeOutput
> {
  readonly metadata: OrchestrationSkillMetadata = {
    id: "batch_organize",
    name: "智能整理助手",
    description:
      "智能整理您的收藏书签，包括自动分类、智能打标、清理重复、归档旧内容等功能，让您的知识库保持整洁有序。",
    category: "utility",
    version: "2.0.0",
    author: "AnyKeep",
    capabilities: [
      "auto-categorize",
      "auto-tag",
      "duplicate-detection",
      "archive-management",
      "url-validation",
    ],
    requiresConfirmation: true,
    estimatedDurationMs: 30000,
    maxExecutionTimeMs: 120000,
    deliverableTypes: ["report", "list"],
    outputFormats: ["markdown", "json"],
    steps: ORGANIZE_STEPS,
  };

  readonly inputSchema = BatchOrganizeInputSchema;
  readonly outputSchema = BatchOrganizeOutputSchema;

  /**
   * 解析自然语言输入
   */
  async parseInput(
    message: string,
    _context: OrchestrationContext,
  ): Promise<BatchOrganizeInput> {
    const actions: OrganizeAction[] = [];

    // 解析操作类型
    if (/整理|分类|归类/.test(message)) {
      actions.push("auto-categorize");
    }
    if (/打标|标签|加标签/.test(message)) {
      actions.push("auto-tag");
    }
    if (/重复|去重|清理重复/.test(message)) {
      actions.push("clean-duplicates");
    }
    if (/归档|旧.*内容|清理.*旧/.test(message)) {
      actions.push("archive-old");
    }
    if (/验证|检查.*链接|失效/.test(message)) {
      actions.push("validate-urls");
    }

    // 默认操作
    if (actions.length === 0) {
      actions.push("auto-categorize", "auto-tag");
    }

    // 解析范围
    let scope: BatchOrganizeInput["scope"] = "uncategorized";
    if (/全部|所有/.test(message)) {
      scope = "all";
    } else if (/未分类/.test(message)) {
      scope = "uncategorized";
    } else if (/未打标|没.*标签/.test(message)) {
      scope = "untagged";
    }

    return {
      actions,
      scope,
      requireConfirmation: DEFAULT_ORGANIZE_CONFIG.requireConfirmation,
      autoExecute: DEFAULT_ORGANIZE_CONFIG.autoExecute,
    };
  }

  /**
   * 流式执行整理
   */
  async *executeStream(
    context: OrchestrationContext,
  ): AsyncGenerator<OrchestrationStreamChunk> {
    const startTime = Date.now();
    const input = context.params as BatchOrganizeInput;

    // 初始化进度
    this.initProgress(ORGANIZE_STEPS);

    try {
      // Step 1: 收集数据
      yield* this.collectData(context.userId, input);

      const bookmarks = await fetchBookmarks(context.userId, input);
      const folders = await fetchFolders(context.userId);

      yield* this.reportProgress(
        "收集数据",
        15,
        `收集到 ${bookmarks.length} 条书签`,
      );
      yield* this.emitText(`📚 共收集到 **${bookmarks.length}** 条书签。\n\n`);

      if (bookmarks.length === 0) {
        yield* this.emitText("没有找到需要整理的书签。");
        yield* this.emitDone(true, "没有需要整理的书签");
        return;
      }

      // 初始化结果容器
      const categorizeSuggestions: CategorizeSuggestion[] = [];
      const tagSuggestions: TagSuggestion[] = [];
      const duplicateGroups: DuplicateGroup[] = [];
      const archiveCandidates: ArchiveCandidate[] = [];
      const urlValidations: UrlValidationResult[] = [];

      // Step 2: 分析内容
      yield* this.reportProgress("分析内容", 20, "正在分析书签内容...");

      // Step 3: 智能分类
      if (input.actions.includes("auto-categorize")) {
        yield* this.processCategorize(
          bookmarks,
          folders,
          categorizeSuggestions,
        );
      }

      // Step 4: 智能打标
      if (input.actions.includes("auto-tag")) {
        yield* this.processTag(bookmarks, tagSuggestions);
      }

      // Step 5: 清理和归档
      yield* this.reportProgress("整理清理", 70, "正在检查重复和归档...");

      if (input.actions.includes("clean-duplicates")) {
        yield* this.processDuplicates(bookmarks, duplicateGroups);
      }

      if (input.actions.includes("archive-old")) {
        yield* this.processArchive(bookmarks, input, archiveCandidates);
      }

      yield* this.reportProgress("整理清理", 85, "整理检查完成");

      // Step 6: 生成报告
      const output = await this.generateReport(
        context.userId,
        input,
        {
          categorizeSuggestions,
          tagSuggestions,
          duplicateGroups,
          archiveCandidates,
          urlValidations,
        },
        bookmarks.length,
      );

      // 输出交付物和结果
      yield* this.outputResults(output, input);

      logger.info(
        {
          skillId: this.metadata.id,
          userId: context.userId,
          actions: input.actions,
          ...output.stats,
          durationMs: Date.now() - startTime,
        },
        "BatchOrganizeSkill: Execution completed",
      );
    } catch (error) {
      logger.error(
        {
          skillId: this.metadata.id,
          userId: context.userId,
          error: error instanceof Error ? error.message : String(error),
        },
        "BatchOrganizeSkill: Execution failed",
      );

      yield* this.emitError(
        error instanceof Error ? error.message : "整理失败",
        "EXECUTION_ERROR",
        true,
      );
      yield* this.emitDone(false, "整理失败");
    }
  }

  // ============================================
  // 步骤处理方法
  // ============================================

  private async *collectData(
    _userId: string,
    input: BatchOrganizeInput,
  ): AsyncGenerator<OrchestrationStreamChunk> {
    const actionNames = input.actions
      .map((a) => ORGANIZE_ACTION_CONFIG[a].name)
      .join("、");

    yield* this.reportProgress("收集数据", 5, "正在收集书签数据...");
    yield* this.emitText(
      `🔧 正在执行智能整理（${actionNames}），请稍候...\n\n`,
    );
  }

  private async *processCategorize(
    bookmarks: Awaited<ReturnType<typeof fetchBookmarks>>,
    folders: Awaited<ReturnType<typeof fetchFolders>>,
    suggestions: CategorizeSuggestion[],
  ): AsyncGenerator<OrchestrationStreamChunk> {
    yield* this.reportProgress("智能分类", 30, "正在生成分类建议...");
    yield* this.emitText(`### 📁 智能分类建议\n\n`);

    const generated = generateCategorizeSuggestions(bookmarks, folders);
    suggestions.push(...generated);

    if (generated.length > 0) {
      for (const s of generated.slice(0, 5)) {
        yield* this.emitText(
          `- **${s.bookmarkTitle}** → ${s.suggestedFolder}（${(s.confidence * 100).toFixed(0)}%）\n`,
        );
      }
      if (generated.length > 5) {
        yield* this.emitText(`- *...还有 ${generated.length - 5} 条建议*\n`);
      }
    } else {
      yield* this.emitText(`*暂无分类建议*\n`);
    }
    yield* this.emitText(`\n`);

    yield* this.reportProgress(
      "智能分类",
      45,
      `生成 ${generated.length} 条分类建议`,
    );
  }

  private async *processTag(
    bookmarks: Awaited<ReturnType<typeof fetchBookmarks>>,
    suggestions: TagSuggestion[],
  ): AsyncGenerator<OrchestrationStreamChunk> {
    yield* this.reportProgress("智能打标", 50, "正在生成标签建议...");
    yield* this.emitText(`### 🏷️ 智能标签建议\n\n`);

    const generated = generateTagSuggestions(bookmarks);
    suggestions.push(...generated);

    if (generated.length > 0) {
      for (const s of generated.slice(0, 5)) {
        yield* this.emitText(
          `- **${s.bookmarkTitle}** → ${s.suggestedTags.map((t) => `\`${t}\``).join(" ")}\n`,
        );
      }
      if (generated.length > 5) {
        yield* this.emitText(`- *...还有 ${generated.length - 5} 条建议*\n`);
      }
    } else {
      yield* this.emitText(`*暂无标签建议*\n`);
    }
    yield* this.emitText(`\n`);

    yield* this.reportProgress(
      "智能打标",
      65,
      `生成 ${generated.length} 条标签建议`,
    );
  }

  private async *processDuplicates(
    bookmarks: Awaited<ReturnType<typeof fetchBookmarks>>,
    groups: DuplicateGroup[],
  ): AsyncGenerator<OrchestrationStreamChunk> {
    yield* this.emitText(`### 🔄 重复书签检测\n\n`);

    const found = findDuplicates(bookmarks);
    groups.push(...found);

    if (found.length > 0) {
      yield* this.emitText(`发现 **${found.length}** 组重复书签：\n\n`);
      for (const g of found.slice(0, 3)) {
        yield* this.emitText(
          `- ${g.bookmarks[0].title}（${g.bookmarks.length} 个重复）\n`,
        );
      }
      if (found.length > 3) {
        yield* this.emitText(`- *...还有 ${found.length - 3} 组*\n`);
      }
    } else {
      yield* this.emitText(`*未发现重复书签* ✅\n`);
    }
    yield* this.emitText(`\n`);
  }

  private async *processArchive(
    bookmarks: Awaited<ReturnType<typeof fetchBookmarks>>,
    input: BatchOrganizeInput,
    candidates: ArchiveCandidate[],
  ): AsyncGenerator<OrchestrationStreamChunk> {
    yield* this.emitText(`### 📦 归档候选\n\n`);

    const found = findArchiveCandidates(
      bookmarks,
      input.filter?.olderThanDays || BATCH_ORGANIZE_CONFIG.DEFAULT_ARCHIVE_DAYS,
    );
    candidates.push(...found);

    if (found.length > 0) {
      yield* this.emitText(`发现 **${found.length}** 条可归档书签：\n\n`);
      for (const c of found.slice(0, 5)) {
        yield* this.emitText(
          `- ${c.bookmarkTitle}（${c.daysSinceCreated} 天前）\n`,
        );
      }
      if (found.length > 5) {
        yield* this.emitText(`- *...还有 ${found.length - 5} 条*\n`);
      }
    } else {
      yield* this.emitText(`*暂无需要归档的书签*\n`);
    }
    yield* this.emitText(`\n`);
  }

  // ============================================
  // 报告和输出
  // ============================================

  private async generateReport(
    userId: string,
    input: BatchOrganizeInput,
    results: {
      categorizeSuggestions: CategorizeSuggestion[];
      tagSuggestions: TagSuggestion[];
      duplicateGroups: DuplicateGroup[];
      archiveCandidates: ArchiveCandidate[];
      urlValidations: UrlValidationResult[];
    },
    totalProcessed: number,
  ): Promise<BatchOrganizeOutput> {
    const stats: OrganizeStats = {
      totalProcessed,
      categorizeSuggestions: results.categorizeSuggestions.length,
      tagSuggestions: results.tagSuggestions.length,
      duplicatesFound: results.duplicateGroups.length,
      archiveCandidates: results.archiveCandidates.length,
      invalidUrls: results.urlValidations.filter((v) => !v.isValid).length,
      actionsExecuted: 0,
    };

    // 如果 autoExecute，执行操作
    if (input.autoExecute) {
      stats.actionsExecuted = await this.executeActions(userId, results);
    }

    const summary = generateSummary(stats, input.actions);
    const suggestions = generateOrganizeSuggestions(stats);

    return {
      stats,
      ...results,
      summary,
      suggestions,
      generatedAt: new Date().toISOString(),
    };
  }

  private async executeActions(
    userId: string,
    results: {
      categorizeSuggestions: CategorizeSuggestion[];
      tagSuggestions: TagSuggestion[];
      duplicateGroups: DuplicateGroup[];
      archiveCandidates: ArchiveCandidate[];
    },
  ): Promise<number> {
    let totalSuccess = 0;

    if (results.categorizeSuggestions.length > 0) {
      const result = await executeCategorizeSuggestions(
        userId,
        results.categorizeSuggestions,
      );
      totalSuccess += result.success;
    }

    if (results.tagSuggestions.length > 0) {
      const result = await executeTagSuggestions(
        userId,
        results.tagSuggestions,
      );
      totalSuccess += result.success;
    }

    if (results.duplicateGroups.length > 0) {
      const result = await executeDuplicateCleanup(
        userId,
        results.duplicateGroups,
      );
      totalSuccess += result.success;
    }

    if (results.archiveCandidates.length > 0) {
      const result = await executeArchive(userId, results.archiveCandidates);
      totalSuccess += result.success;
    }

    return totalSuccess;
  }

  private async *outputResults(
    output: BatchOrganizeOutput,
    input: BatchOrganizeInput,
  ): AsyncGenerator<OrchestrationStreamChunk> {
    yield* this.reportProgress("生成报告", 90, "正在生成整理报告...");

    // 输出摘要
    yield* this.emitText(`## 📊 整理报告摘要\n\n`);
    yield* this.emitText(`${output.summary}\n\n`);

    // 输出统计
    yield* this.emitText(`### 统计数据\n\n`);
    yield* this.emitText(`- 处理书签数: **${output.stats.totalProcessed}**\n`);
    if (output.stats.categorizeSuggestions > 0) {
      yield* this.emitText(
        `- 分类建议数: **${output.stats.categorizeSuggestions}**\n`,
      );
    }
    if (output.stats.tagSuggestions > 0) {
      yield* this.emitText(
        `- 标签建议数: **${output.stats.tagSuggestions}**\n`,
      );
    }
    if (output.stats.duplicatesFound > 0) {
      yield* this.emitText(
        `- 重复书签组: **${output.stats.duplicatesFound}**\n`,
      );
    }
    if (output.stats.archiveCandidates > 0) {
      yield* this.emitText(
        `- 归档候选数: **${output.stats.archiveCandidates}**\n`,
      );
    }
    yield* this.emitText(`\n`);

    // 检查是否有需要确认的操作
    const hasPendingActions =
      output.stats.categorizeSuggestions > 0 ||
      output.stats.tagSuggestions > 0 ||
      output.stats.duplicatesFound > 0 ||
      output.stats.archiveCandidates > 0;

    if (hasPendingActions && input.requireConfirmation && !input.autoExecute) {
      yield* this.reportProgress("确认操作", 85, "等待用户确认...");

      const confirmMessage = buildConfirmationMessage(output.stats);

      yield* this.emitConfirmation("确认执行智能整理？", confirmMessage, [
        { id: "confirm", label: "确认执行", danger: false },
        { id: "preview", label: "仅保存报告", danger: false },
        { id: "cancel", label: "取消" },
      ]);

      yield* this.emitText(`\n---\n\n`);
      yield* this.emitText(
        `💡 **请在上方选择操作**：\n` +
          `- 点击"确认执行"将自动应用建议的整理操作\n` +
          `- 点击"仅保存报告"可下载报告后手动处理\n\n`,
      );
    }

    // 输出交付物
    const deliverable = this.createDeliverable(
      "report",
      "智能整理报告",
      output,
      "markdown",
      {
        downloadable: true,
        shareable: false,
        metadata: {
          actions: input.actions,
          ...output.stats,
        },
      },
    );

    yield* this.emitDeliverable(deliverable);

    // 输出建议
    if (output.suggestions.length > 0) {
      yield* this.emitSuggestions(
        output.suggestions.map((s, i) => ({
          text: s,
          label: `建议 ${i + 1}`,
          action: "organize",
          icon: "💡",
        })),
      );
    }

    yield* this.reportProgress("完成", 100, "整理完成");
    yield* this.emitDone(true, output.summary);
  }

  // ============================================
  // 非流式执行
  // ============================================

  protected async executeInternal(
    input: BatchOrganizeInput,
    context: SkillContext,
  ): Promise<BatchOrganizeOutput> {
    const orchestrationContext: OrchestrationContext = {
      ...context,
      params: input,
    };

    let output: BatchOrganizeOutput | undefined;

    for await (const chunk of this.executeStream(orchestrationContext)) {
      if (chunk.type === "deliverable") {
        output = chunk.data.content as BatchOrganizeOutput;
      }
    }

    if (!output) {
      throw new Error("整理失败");
    }

    return output;
  }
}

// ============================================
// 导出
// ============================================

export const batchOrganizeSkill = new BatchOrganizeSkill();
