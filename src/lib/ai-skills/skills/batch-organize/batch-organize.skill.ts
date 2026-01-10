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
   *
   * 优先级顺序：
   * 1. 附件书签（用户显式选择）- 最高优先级
   * 2. 指代词解析的搜索结果
   * 3. 上下文中的书签 ID
   * 4. 根据范围关键词查询
   */
  async parseInput(
    message: string,
    context: OrchestrationContext,
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

    // 检测是否为一键整理模式（自动执行）
    // 注意：一键整理模式需要先检测，因为它会影响默认操作和 scope
    const isOneClickMode = /一键|自动|直接/.test(message);

    // 一键整理模式：强制包含分类和打标两个核心操作
    if (isOneClickMode) {
      if (!actions.includes("auto-categorize")) {
        actions.push("auto-categorize");
      }
      if (!actions.includes("auto-tag")) {
        actions.push("auto-tag");
      }
    }

    // 默认操作（仅当没有匹配任何模式时）
    if (actions.length === 0) {
      actions.push("auto-categorize", "auto-tag");
    }

    // 解析范围
    // 一键整理模式默认为 "all"（全部书签），其他模式默认为 "uncategorized"
    let scope: BatchOrganizeInput["scope"] = isOneClickMode
      ? "all"
      : "uncategorized";

    if (/全部|所有/.test(message)) {
      scope = "all";
    } else if (/未分类/.test(message)) {
      scope = "uncategorized";
    } else if (/未打标|没.*标签/.test(message)) {
      scope = "untagged";
    }

    let bookmarkIds: number[] | undefined;

    // ============================================
    // 优先级 1: 附件书签（用户显式选择的内容）
    // 附件书签具有最高优先级
    // ============================================
    if (
      context.attachmentBookmarkIds &&
      context.attachmentBookmarkIds.length > 0
    ) {
      bookmarkIds = context.attachmentBookmarkIds;
      scope = "selected";

      logger.info(
        {
          attachmentCount: bookmarkIds.length,
          message: message.substring(0, 50),
        },
        "BatchOrganizeSkill: Using attachment bookmarks as primary scope",
      );
    } else {
      // ============================================
      // 优先级 2-3: 检测指代词并解析上下文
      // ============================================
      const referencePattern = /这些|那些|它们|搜索结果|刚才.*结果|上面.*结果/;
      const hasReference = referencePattern.test(message);

      if (hasReference && context.lastSearchResults) {
        // 使用最近的搜索结果
        bookmarkIds = context.lastSearchResults.resultIds;
        scope = "selected";

        logger.info(
          {
            query: context.lastSearchResults.query,
            resultCount: bookmarkIds.length,
            message: message.substring(0, 50),
          },
          "BatchOrganizeSkill: Resolved reference to search results",
        );
      } else if (hasReference && context.bookmarkIds?.length) {
        // 如果没有搜索结果，但有预选的书签 ID
        bookmarkIds = context.bookmarkIds;
        scope = "selected";

        logger.info(
          {
            bookmarkCount: bookmarkIds.length,
            message: message.substring(0, 50),
          },
          "BatchOrganizeSkill: Resolved reference to selected bookmarks",
        );
      } else if (hasReference) {
        // 有指代词但没有上下文，记录警告
        logger.warn(
          {
            message: message.substring(0, 50),
            hasLastSearchResults: !!context.lastSearchResults,
            hasBookmarkIds: !!context.bookmarkIds?.length,
            hasAttachments: !!context.attachmentBookmarkIds?.length,
          },
          "BatchOrganizeSkill: Reference detected but no context available",
        );
      }
    }

    // 日志记录一键整理模式
    if (isOneClickMode) {
      logger.info(
        {
          message: message.substring(0, 50),
          actions,
          scope,
        },
        "BatchOrganizeSkill: One-click mode detected, autoExecute enabled",
      );
    }

    return {
      actions,
      scope,
      requireConfirmation: isOneClickMode
        ? false
        : DEFAULT_ORGANIZE_CONFIG.requireConfirmation,
      autoExecute: isOneClickMode ? true : DEFAULT_ORGANIZE_CONFIG.autoExecute,
      // 如果有指代词解析出的书签 ID，添加到筛选条件
      filter: bookmarkIds ? { bookmarkIds } : undefined,
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

    // 详细日志记录输入参数（调试用）
    logger.info(
      {
        skillId: this.metadata.id,
        userId: context.userId,
        actions: input.actions,
        scope: input.scope,
        autoExecute: input.autoExecute,
        hasFilter: !!input.filter,
        filterBookmarkCount: input.filter?.bookmarkIds?.length,
      },
      "BatchOrganizeSkill: Starting execution with params",
    );

    // 初始化进度
    this.initProgress(ORGANIZE_STEPS);

    // 最小延迟函数，确保进度更新可见
    const minDelay = (ms: number) =>
      new Promise((resolve) => setTimeout(resolve, ms));

    try {
      // Step 1: 收集数据
      yield* this.collectData(context.userId, input);
      await minDelay(300); // 确保进度可见

      // 检查取消信号
      if (this.isCancelled(context)) {
        yield* this.emitCancelled(
          "整理操作已取消",
          context.cancellationToken?.reason,
        );
        yield* this.emitDone(false, "用户取消了整理操作");
        return;
      }

      const bookmarks = await fetchBookmarks(context.userId, input);
      const folders = await fetchFolders(context.userId);

      // 检查取消信号
      if (this.isCancelled(context)) {
        yield* this.emitCancelled(
          "整理操作已取消",
          context.cancellationToken?.reason,
        );
        yield* this.emitDone(false, "用户取消了整理操作");
        return;
      }

      yield* this.reportProgress(
        "收集数据",
        15,
        `收集到 ${bookmarks.length} 条书签`,
      );
      yield* this.emitText(`📚 共收集到 **${bookmarks.length}** 条书签。\n\n`);
      await minDelay(500); // 确保进度可见

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
      await minDelay(400); // 确保进度可见

      // 检查取消信号
      if (this.isCancelled(context)) {
        yield* this.emitCancelled(
          "整理操作已取消",
          context.cancellationToken?.reason,
        );
        yield* this.emitDone(false, "用户取消了整理操作");
        return;
      }

      // Step 3: 智能分类
      if (input.actions.includes("auto-categorize")) {
        yield* this.processCategorize(
          bookmarks,
          folders,
          categorizeSuggestions,
        );
        await minDelay(400); // 确保进度可见

        // 检查取消信号
        if (this.isCancelled(context)) {
          yield* this.emitCancelled(
            "整理操作已取消",
            context.cancellationToken?.reason,
          );
          yield* this.emitDone(false, "用户取消了整理操作");
          return;
        }
      }

      // Step 4: 智能打标
      if (input.actions.includes("auto-tag")) {
        yield* this.processTag(bookmarks, tagSuggestions);
        await minDelay(400); // 确保进度可见

        // 检查取消信号
        if (this.isCancelled(context)) {
          yield* this.emitCancelled(
            "整理操作已取消",
            context.cancellationToken?.reason,
          );
          yield* this.emitDone(false, "用户取消了整理操作");
          return;
        }
      }

      // Step 5: 清理和归档
      yield* this.reportProgress("整理清理", 70, "正在检查重复和归档...");
      await minDelay(300); // 确保进度可见

      if (input.actions.includes("clean-duplicates")) {
        yield* this.processDuplicates(bookmarks, duplicateGroups);

        // 检查取消信号
        if (this.isCancelled(context)) {
          yield* this.emitCancelled(
            "整理操作已取消",
            context.cancellationToken?.reason,
          );
          yield* this.emitDone(false, "用户取消了整理操作");
          return;
        }
      }

      if (input.actions.includes("archive-old")) {
        yield* this.processArchive(bookmarks, input, archiveCandidates);

        // 检查取消信号
        if (this.isCancelled(context)) {
          yield* this.emitCancelled(
            "整理操作已取消",
            context.cancellationToken?.reason,
          );
          yield* this.emitDone(false, "用户取消了整理操作");
          return;
        }
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

    // 统计未分类书签数量
    const uncategorizedCount = bookmarks.filter((b) => !b.folder_id).length;
    const categorizedCount = bookmarks.length - uncategorizedCount;

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
      // 提供更详细的反馈
      if (uncategorizedCount === 0) {
        yield* this.emitText(
          `✅ 太棒了！您的 **${categorizedCount}** 条书签都已分类，无需整理。\n`,
        );
      } else if (folders.length === 0) {
        yield* this.emitText(
          `⚠️ 您还没有创建文件夹，建议先创建几个分类文件夹。\n`,
        );
      } else {
        yield* this.emitText(
          `*${uncategorizedCount} 条未分类书签暂无匹配的文件夹建议*\n`,
        );
      }
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

    // 统计标签情况
    const wellTaggedCount = bookmarks.filter(
      (b) => (b.user_tags?.length || 0) >= 2,
    ).length;
    const hasAiTagsCount = bookmarks.filter(
      (b) => (b.ai_tags?.length || 0) > 0,
    ).length;

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
      // 提供更详细的反馈
      if (wellTaggedCount === bookmarks.length) {
        yield* this.emitText(
          `✅ 太棒了！您的 **${wellTaggedCount}** 条书签都已有足够的标签。\n`,
        );
      } else if (hasAiTagsCount === 0) {
        yield* this.emitText(
          `⚠️ 您的书签尚未生成 AI 标签，建议先运行 AI 分析功能。\n`,
        );
      } else {
        yield* this.emitText(`*暂无新的标签建议*\n`);
      }
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

    // 检查是否有建议需要执行
    const hasPendingActions =
      output.stats.categorizeSuggestions > 0 ||
      output.stats.tagSuggestions > 0 ||
      output.stats.duplicatesFound > 0 ||
      output.stats.archiveCandidates > 0;

    // 输出摘要
    yield* this.emitText(`## 📊 整理报告摘要\n\n`);

    // autoExecute 模式下显示执行结果
    if (input.autoExecute) {
      if (output.stats.actionsExecuted > 0) {
        yield* this.emitText(
          `✅ **整理完成！** 已自动执行 **${output.stats.actionsExecuted}** 项整理操作。\n\n`,
        );
      } else if (!hasPendingActions) {
        yield* this.emitText(
          `✅ **整理分析完成！** 您的书签状态良好，无需额外整理。\n\n`,
        );
      } else {
        yield* this.emitText(`${output.summary}\n\n`);
      }
    } else {
      yield* this.emitText(`${output.summary}\n\n`);
    }

    // 输出统计
    yield* this.emitText(`### 统计数据\n\n`);
    yield* this.emitText(`- 处理书签数: **${output.stats.totalProcessed}**\n`);
    if (output.stats.categorizeSuggestions > 0) {
      yield* this.emitText(
        `- 分类建议数: **${output.stats.categorizeSuggestions}**${input.autoExecute ? " ✓" : ""}\n`,
      );
    }
    if (output.stats.tagSuggestions > 0) {
      yield* this.emitText(
        `- 标签建议数: **${output.stats.tagSuggestions}**${input.autoExecute ? " ✓" : ""}\n`,
      );
    }
    if (output.stats.duplicatesFound > 0) {
      yield* this.emitText(
        `- 重复书签组: **${output.stats.duplicatesFound}**${input.autoExecute ? " ✓" : ""}\n`,
      );
    }
    if (output.stats.archiveCandidates > 0) {
      yield* this.emitText(
        `- 归档候选数: **${output.stats.archiveCandidates}**${input.autoExecute ? " ✓" : ""}\n`,
      );
    }
    // 如果没有任何建议，显示说明
    if (!hasPendingActions) {
      yield* this.emitText(`\n📋 **状态检查结果**：\n`);
      yield* this.emitText(`- 所有书签已分类 ✅\n`);
      yield* this.emitText(`- 标签覆盖良好 ✅\n`);
      yield* this.emitText(`- 未发现重复项 ✅\n`);
    }
    // 如果 autoExecute 且有执行操作，显示执行统计
    if (input.autoExecute && output.stats.actionsExecuted > 0) {
      yield* this.emitText(
        `\n**已执行操作数**: **${output.stats.actionsExecuted}** ✓\n`,
      );
    }
    yield* this.emitText(`\n`);

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
