/**
 * InboxTriageSkill - 收件箱智能分拣
 *
 * 将 InboxOrganizationBanner 组件的整理能力封装为可对话调用的 Skill
 *
 * @version 1.0.0
 * @since 2025-01-08
 */

import { OrchestrationSkill } from "../../orchestration/orchestration-skill";
import type {
  OrchestrationSkillMetadata,
  OrchestrationContext,
} from "../../orchestration/types";
import type { OrchestrationStreamChunk } from "../../output/types";
import { createClient } from "@/lib/supabase/server";
import {
  INBOX_TRIAGE_STEPS,
  InboxTriageInputSchema,
  InboxTriageOutputSchema,
  type InboxTriageInput,
  type InboxTriageOutput,
  type TriageSuggestion,
} from "./types";
import {
  GardenerTriggerService,
  type GardenerSuggestion,
} from "@/lib/classification/services/batch-classification/triggers/gardener-trigger";

/**
 * 收件箱智能分拣 Skill
 *
 * 分析未分类书签，提供智能整理建议和一键执行
 */
export class InboxTriageSkill extends OrchestrationSkill<
  InboxTriageInput,
  InboxTriageOutput
> {
  readonly metadata: OrchestrationSkillMetadata = {
    id: "inbox_triage",
    name: "收件箱智能分拣",
    description: "分析未分类书签，提供智能整理建议和一键执行",
    category: "organizing",
    version: "1.0.0",
    author: "AnyKeep",
    capabilities: ["analyze", "suggest", "batch-action"],
    steps: INBOX_TRIAGE_STEPS,
  };

  readonly inputSchema = InboxTriageInputSchema;
  readonly outputSchema = InboxTriageOutputSchema;

  /**
   * 解析用户输入
   */
  async parseInput(
    message: string,
    _context: OrchestrationContext,
  ): Promise<InboxTriageInput> {
    const autoExecute = /自动|直接|立即/.test(message);
    const maxMatch = message.match(/(\d+)\s*条/);
    const maxItems = maxMatch ? Math.min(parseInt(maxMatch[1], 10), 200) : 50;

    return {
      autoExecute,
      maxItems,
      excludeFolderIds: [],
    };
  }

  /**
   * 流式执行
   */
  async *executeStream(
    context: OrchestrationContext,
  ): AsyncGenerator<OrchestrationStreamChunk> {
    const input = context.params as InboxTriageInput;
    const supabase = await createClient();

    // 初始化进度
    this.initProgress(INBOX_TRIAGE_STEPS);

    // Step 1: 扫描收件箱
    yield* this.reportProgress("scan", 10, "正在扫描未分类书签...");

    // 检查是否有待处理的批量分类建议
    const gardenerService = new GardenerTriggerService(supabase);
    const pendingSuggestions = await gardenerService.getPendingSuggestions(
      context.userId,
    );

    if (pendingSuggestions.length > 0) {
      // 优先处理批量分类建议
      yield* this.handlePendingBatchClassification(
        pendingSuggestions,
        context.userId,
        gardenerService,
      );
      return;
    }

    const { data: unclassified, error } = await supabase
      .from("bookmarks")
      .select("id, title, url, platform, user_tags, created_at")
      .eq("user_id", context.userId)
      .is("folder_id", null)
      .order("created_at", { ascending: false })
      .limit(input.maxItems);

    if (error) {
      yield* this.emitError(`扫描失败: ${error.message}`);
      return;
    }

    if (!unclassified || unclassified.length === 0) {
      yield* this.emitText("✨ 收件箱已经很整洁，没有需要整理的书签！");
      yield* this.emitDone(true, "收件箱为空");
      return;
    }

    yield* this.reportProgress(
      "scan",
      20,
      `发现 ${unclassified.length} 条未分类书签`,
    );

    // Step 2: 聚类分析
    yield* this.reportProgress("cluster", 30, "正在分析内容主题...");

    const clusters = this.clusterBookmarks(unclassified);
    yield* this.reportProgress(
      "cluster",
      50,
      `识别出 ${clusters.size} 个主题分组`,
    );

    // Step 3: 生成整理建议
    yield* this.reportProgress("suggest", 60, "正在生成整理建议...");
    const suggestions = await this.generateSuggestions(
      clusters,
      context.userId,
      supabase,
    );
    yield* this.reportProgress(
      "suggest",
      80,
      `生成 ${suggestions.length} 条整理建议`,
    );

    // Step 4: 准备操作
    yield* this.reportProgress("prepare", 90, "准备整理方案...");

    // 创建交付物
    const deliverable = this.createDeliverable(
      "list",
      "收件箱整理方案",
      {
        items: suggestions.map((s) => ({
          id: s.id,
          action: s.action,
          bookmarkCount: s.bookmarkIds.length,
          targetFolder: s.targetFolder?.name,
          tags: s.tags,
          confidence: s.confidence,
          reason: s.reason,
        })),
      },
      "json",
      {
        metadata: {
          subType: "action_plan",
          totalBookmarks: unclassified.length,
          suggestionsCount: suggestions.length,
        },
      },
    );
    yield* this.emitDeliverable(deliverable);

    // 输出文本摘要
    yield* this.emitText(
      `📋 已分析 ${unclassified.length} 条未分类书签，生成 ${suggestions.length} 条整理建议。\n` +
        `请在上方查看详细方案，点击"执行"按钮可一键应用。`,
    );

    yield* this.reportProgress("prepare", 100, "完成");
    yield* this.emitDone(true, `生成 ${suggestions.length} 条整理建议`, true);
  }

  // ============================================
  // 私有辅助方法
  // ============================================

  /**
   * 按平台和标签聚类书签
   *
   * TODO: 优化聚类算法 (P3 #6)
   * 当前实现：简单按平台分组，MVP 可接受
   * 后续优化方向：
   * 1. 引入 TF-IDF 或 embedding 相似度计算
   * 2. 支持多维度聚类（平台 + 标签 + 标题语义）
   * 3. 动态调整聚类阈值
   * 4. 考虑用户历史整理行为
   */
  private clusterBookmarks(
    bookmarks: Array<{
      id: number;
      title: string;
      platform?: string | null;
      user_tags?: string[] | null;
    }>,
  ): Map<string, typeof bookmarks> {
    const clusters = new Map<string, typeof bookmarks>();

    for (const bookmark of bookmarks) {
      // 优先按平台聚类
      const key = bookmark.platform || "other";
      if (!clusters.has(key)) {
        clusters.set(key, []);
      }
      const cluster = clusters.get(key);
      if (cluster) {
        cluster.push(bookmark);
      }
    }

    return clusters;
  }

  /**
   * 生成整理建议
   */
  private async generateSuggestions(
    clusters: Map<
      string,
      Array<{
        id: number;
        title: string;
        platform?: string | null;
        user_tags?: string[] | null;
      }>
    >,
    userId: string,
    supabase: Awaited<ReturnType<typeof createClient>>,
  ): Promise<TriageSuggestion[]> {
    const suggestions: TriageSuggestion[] = [];

    // 获取用户现有文件夹
    const { data: folders } = await supabase
      .from("folders")
      .select("id, name")
      .eq("user_id", userId);

    const folderMap = new Map(
      (folders || []).map((f) => [f.name.toLowerCase(), f]),
    );

    for (const [platform, bookmarks] of clusters) {
      if (bookmarks.length < 3) continue;

      // 尝试匹配现有文件夹
      const matchedFolder = folderMap.get(platform.toLowerCase());

      suggestions.push({
        id: `cluster-${platform}`,
        action: matchedFolder ? "move" : "tag",
        bookmarkIds: bookmarks.map((b) => b.id),
        targetFolder: matchedFolder
          ? { id: matchedFolder.id, name: matchedFolder.name }
          : undefined,
        tags: matchedFolder ? undefined : [platform],
        reason: matchedFolder
          ? `${bookmarks.length} 条 ${platform} 内容，建议移动到「${matchedFolder.name}」`
          : `${bookmarks.length} 条 ${platform} 内容，建议添加标签`,
        confidence: matchedFolder ? 85 : 70,
      });
    }

    return suggestions.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * 处理待处理的批量分类建议
   */
  private async *handlePendingBatchClassification(
    suggestions: GardenerSuggestion[],
    _userId: string,
    _gardenerService: GardenerTriggerService,
  ): AsyncGenerator<OrchestrationStreamChunk> {
    const suggestion = suggestions[0]; // 取最新的建议

    yield* this.reportProgress("scan", 50, "发现待处理的智能整理建议...");

    // 创建交付物展示批量分类建议
    const deliverable = this.createDeliverable(
      "list",
      "批量分类建议",
      {
        items: [
          {
            id: suggestion.id,
            type: suggestion.type,
            title: suggestion.title,
            description: suggestion.description,
            bookmarkCount: suggestion.bookmarkIds.length,
            confidence: suggestion.confidence,
            createdAt: suggestion.createdAt.toISOString(),
            expiresAt: suggestion.expiresAt.toISOString(),
            actions: [
              { label: "立即整理", action: "accept", primary: true },
              { label: "稍后处理", action: "dismiss" },
            ],
          },
        ],
      },
      "json",
      {
        metadata: {
          subType: "batch_classification_suggestion",
          suggestionId: suggestion.id,
        },
      },
    );

    yield* this.emitDeliverable(deliverable);

    yield* this.emitText(
      `🌱 **园丁建议**\n\n` +
        `${suggestion.description}\n\n` +
        `置信度: ${Math.round(suggestion.confidence * 100)}%\n` +
        `有效期至: ${suggestion.expiresAt.toLocaleDateString()}\n\n` +
        `点击「立即整理」开始 AI 智能分类，或选择「稍后处理」跳过此建议。`,
    );

    yield* this.reportProgress("prepare", 100, "建议已就绪");
    yield* this.emitDone(true, "发现批量分类建议", true);
  }

  /**
   * 触发批量分类检查
   * 由外部调用，检查是否需要推送批量分类建议
   */
  async checkAndTriggerBatchClassification(userId: string): Promise<{
    triggered: boolean;
    reason: string;
    suggestionId?: string;
  }> {
    const supabase = await createClient();
    const gardenerService = new GardenerTriggerService(supabase);

    const checkResult =
      await gardenerService.shouldTriggerBatchClassification(userId);

    if (!checkResult.shouldTrigger) {
      return {
        triggered: false,
        reason: checkResult.reason,
      };
    }

    // 获取待分类书签 ID
    const { data: bookmarks } = await supabase
      .from("bookmarks")
      .select("id")
      .eq("user_id", userId)
      .is("folder_id", null)
      .eq("is_in_trash", false)
      .limit(200);

    if (!bookmarks || bookmarks.length < 10) {
      return {
        triggered: false,
        reason: "insufficient_bookmarks",
      };
    }

    // 创建建议
    const suggestion =
      await gardenerService.createBatchClassificationSuggestion(
        userId,
        bookmarks.map((b) => b.id),
      );

    return {
      triggered: true,
      reason: "suggestion_created",
      suggestionId: suggestion.id,
    };
  }
}

// 单例导出
export const inboxTriageSkill = new InboxTriageSkill();
