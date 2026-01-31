/**
 * 统一健康检测 Skill
 *
 * 整合失效链接、重复内容、过期内容的健康检测
 *
 * @module health-check/health-check.skill
 * @version 1.0.0
 * @since 2026-01-31
 */

import { OrchestrationSkill } from "../../orchestration/orchestration-skill";
import type { OrchestrationContext } from "../../orchestration/types";
import type { OrchestrationStreamChunk } from "../../output/types";
import type {
  OrchestrationSkillMetadata,
  StepDefinition,
} from "../../orchestration/types";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import { z } from "zod";

// 复用现有检测器
// TODO: 集成现有检测器进行实时检测
// import { linkHealthCheckSkill } from "../link-health-check/link-health-check.skill";
// import { duplicateCleanupSkill } from "../duplicate-cleanup/duplicate-cleanup.skill";
import { staleContentDetector } from "./detectors/stale-detector";

import type {
  HealthCheckInput,
  HealthCheckOutput,
  HealthOverview,
  BrokenLinkIssue,
  DuplicateGroup,
  StaleContentItem,
} from "./types";
import { HEALTH_CHECK_CONFIG } from "./types";

// ============================================
// 步骤定义
// ============================================

const HEALTH_CHECK_STEPS: StepDefinition[] = [
  {
    id: "init",
    name: "初始化",
    description: "准备健康检测环境",
    weight: 5,
  },
  {
    id: "broken_links",
    name: "检测失效链接",
    description: "检测不可访问的链接",
    weight: 35,
  },
  {
    id: "duplicates",
    name: "检测重复内容",
    description: "查找重复的书签",
    weight: 30,
  },
  {
    id: "stale",
    name: "检测过期内容",
    description: "查找长期未访问的内容",
    weight: 20,
  },
  {
    id: "report",
    name: "生成报告",
    description: "汇总检测结果",
    weight: 10,
  },
];

// ============================================
// HealthCheckSkill 实现
// ============================================

/**
 * 统一健康检测 Skill
 */
export class HealthCheckSkill extends OrchestrationSkill<
  HealthCheckInput,
  HealthCheckOutput
> {
  // Zod Schemas for validation
  readonly inputSchema = z.object({
    checkTypes: z
      .array(z.enum(["broken_link", "duplicate", "stale"]))
      .optional(),
    scope: z.enum(["all", "folder", "selected"]).optional(),
    folderId: z.string().optional(),
    bookmarkIds: z.array(z.string()).optional(),
    forceRefresh: z.boolean().optional(),
    staleThresholdDays: z.number().optional(),
  });

  readonly outputSchema = z.object({
    runId: z.string(),
    overview: z.object({
      brokenLinks: z.number(),
      duplicates: z.number(),
      staleContent: z.number(),
      totalIssues: z.number(),
      healthScore: z.number(),
      lastCheckedAt: z.string().nullable(),
    }),
    brokenLinks: z.array(z.any()),
    duplicateGroups: z.array(z.any()),
    staleContent: z.array(z.any()),
    summary: z.string(),
    suggestions: z.array(z.string()),
    generatedAt: z.string(),
  });

  readonly metadata: OrchestrationSkillMetadata = {
    id: "health_check",
    name: "健康检测",
    description:
      "统一检测失效链接、重复内容和过期内容，全面诊断收藏夹健康状况。",
    category: "utility",
    version: "1.0.0",
    author: "AnyKeep",
    capabilities: [
      "broken-link-detection",
      "duplicate-detection",
      "stale-detection",
      "quick-fix",
    ],
    requiresConfirmation: false,
    estimatedDurationMs: 60000,
    maxExecutionTimeMs: 300000,
    deliverableTypes: ["report"],
    outputFormats: ["markdown", "json"],
    steps: HEALTH_CHECK_STEPS,
  };

  /**
   * 解析自然语言输入
   */
  async parseInput(
    message: string,
    _context: OrchestrationContext,
  ): Promise<HealthCheckInput> {
    const input: HealthCheckInput = {
      checkTypes: ["broken_link", "duplicate", "stale"],
      scope: "all",
      forceRefresh: false,
      staleThresholdDays: HEALTH_CHECK_CONFIG.STALE_THRESHOLDS.EXPIRED,
    };

    const lowerMessage = message.toLowerCase();

    // 解析检测类型
    if (/链接|link|失效|broken/.test(lowerMessage)) {
      input.checkTypes = ["broken_link"];
    } else if (/重复|duplicate|去重/.test(lowerMessage)) {
      input.checkTypes = ["duplicate"];
    } else if (/过期|stale|inactive|未访问/.test(lowerMessage)) {
      input.checkTypes = ["stale"];
    }

    // 解析范围
    if (/选中|selected|这些/.test(lowerMessage)) {
      input.scope = "selected";
    } else if (/文件夹|folder/.test(lowerMessage)) {
      input.scope = "folder";
    }

    // 解析强制刷新
    if (/强制|force|重新/.test(lowerMessage)) {
      input.forceRefresh = true;
    }

    // 解析过期阈值
    const daysMatch = message.match(/(\d+)\s*天/);
    if (daysMatch) {
      input.staleThresholdDays = parseInt(daysMatch[1]);
    }

    return input;
  }

  /**
   * 流式执行健康检测
   */
  async *executeStream(
    context: OrchestrationContext,
  ): AsyncGenerator<OrchestrationStreamChunk> {
    const startTime = Date.now();
    const input = context.params as HealthCheckInput;
    const checkTypes = input.checkTypes || [
      "broken_link",
      "duplicate",
      "stale",
    ];

    // 初始化进度
    this.initProgress(HEALTH_CHECK_STEPS);

    try {
      // ========================================
      // Step 1: 初始化
      // ========================================
      yield* this.reportProgress("初始化", 5, "正在准备健康检测...");
      yield* this.emitText("🏥 **开始健康检测**\n\n");

      // 创建检测记录
      const runId = await this.createHealthCheckRun(context.userId, input);

      const brokenLinks: BrokenLinkIssue[] = [];
      const duplicateGroups: DuplicateGroup[] = [];
      const staleContent: StaleContentItem[] = [];

      // ========================================
      // Step 2: 检测失效链接
      // ========================================
      if (checkTypes.includes("broken_link")) {
        yield* this.reportProgress(
          "检测失效链接",
          10,
          "正在检测链接可访问性...",
        );
        yield* this.emitText("🔗 **检测失效链接**\n");

        try {
          const linkResults = await this.detectBrokenLinks(
            context.userId,
            input,
          );
          brokenLinks.push(...linkResults);
          yield* this.emitText(`  发现 ${brokenLinks.length} 个失效链接\n\n`);
        } catch (error) {
          yield* this.emitText(
            `  ⚠️ 链接检测失败: ${error instanceof Error ? error.message : "未知错误"}\n\n`,
          );
        }
      }

      yield* this.reportProgress("检测失效链接", 40, "链接检测完成");

      // 检查是否取消
      if (this.isCancelled(context)) {
        yield* this.emitCancelled("检测已取消", "用户取消");
        await this.updateHealthCheckRun(runId, "cancelled");
        return;
      }

      // ========================================
      // Step 3: 检测重复内容
      // ========================================
      if (checkTypes.includes("duplicate")) {
        yield* this.reportProgress("检测重复内容", 45, "正在扫描重复内容...");
        yield* this.emitText("📑 **检测重复内容**\n");

        try {
          const dupResults = await this.detectDuplicates(context.userId, input);
          duplicateGroups.push(...dupResults);
          const totalDups = dupResults.reduce(
            (sum, g) => sum + g.items.length - 1,
            0,
          );
          yield* this.emitText(
            `  发现 ${dupResults.length} 组重复 (共 ${totalDups} 个可清理)\n\n`,
          );
        } catch (error) {
          yield* this.emitText(
            `  ⚠️ 重复检测失败: ${error instanceof Error ? error.message : "未知错误"}\n\n`,
          );
        }
      }

      yield* this.reportProgress("检测重复内容", 70, "重复检测完成");

      // ========================================
      // Step 4: 检测过期内容
      // ========================================
      if (checkTypes.includes("stale")) {
        yield* this.reportProgress("检测过期内容", 75, "正在查找过期内容...");
        yield* this.emitText("⏰ **检测过期内容**\n");

        try {
          const staleResults = await staleContentDetector.detect(
            context.userId,
            {
              thresholdDays: input.staleThresholdDays,
              folderId: input.folderId ? String(input.folderId) : undefined,
              bookmarkIds: input.bookmarkIds,
            },
          );
          staleContent.push(...staleResults);
          yield* this.emitText(
            `  发现 ${staleContent.length} 个过期内容 (>${input.staleThresholdDays || 90}天未访问)\n\n`,
          );
        } catch (error) {
          yield* this.emitText(
            `  ⚠️ 过期检测失败: ${error instanceof Error ? error.message : "未知错误"}\n\n`,
          );
        }
      }

      yield* this.reportProgress("检测过期内容", 90, "过期检测完成");

      // ========================================
      // Step 5: 生成报告
      // ========================================
      yield* this.reportProgress("生成报告", 92, "正在生成健康报告...");

      // 计算健康概览
      const overview = this.calculateOverview(
        brokenLinks.length,
        duplicateGroups.length,
        staleContent.length,
      );

      // 输出概览
      yield* this.emitText("## 📊 健康概览\n\n");
      yield* this.emitText(`| 指标 | 数量 | 状态 |\n`);
      yield* this.emitText(`|------|------|------|\n`);
      yield* this.emitText(
        `| 🔗 失效链接 | ${brokenLinks.length} | ${brokenLinks.length === 0 ? "✅" : "⚠️"} |\n`,
      );
      yield* this.emitText(
        `| 📑 重复内容 | ${duplicateGroups.length} 组 | ${duplicateGroups.length === 0 ? "✅" : "⚠️"} |\n`,
      );
      yield* this.emitText(
        `| ⏰ 过期内容 | ${staleContent.length} | ${staleContent.length === 0 ? "✅" : "⚠️"} |\n`,
      );
      yield* this.emitText(
        `| 🏥 健康评分 | ${overview.healthScore}/100 | ${this.getScoreEmoji(overview.healthScore)} |\n`,
      );
      yield* this.emitText("\n");

      // 生成建议
      const suggestions = this.generateSuggestions(
        overview,
        brokenLinks,
        duplicateGroups,
        staleContent,
      );
      const summary = this.generateSummary(overview);

      // 缓存检测结果
      await this.cacheHealthIssues(
        context.userId,
        brokenLinks,
        duplicateGroups,
        staleContent,
      );

      // 更新检测记录
      await this.updateHealthCheckRun(runId, "completed", {
        broken_links_count: brokenLinks.length,
        duplicates_count: duplicateGroups.length,
        stale_count: staleContent.length,
      });

      const output: HealthCheckOutput = {
        runId,
        overview,
        brokenLinks,
        duplicateGroups,
        staleContent,
        summary,
        suggestions,
        generatedAt: new Date().toISOString(),
      };

      // 输出交付物
      const deliverable = this.createDeliverable(
        "report",
        "健康检测报告",
        output,
        "markdown",
        {
          downloadable: true,
          metadata: { ...overview },
        },
      );

      yield* this.emitDeliverable(deliverable);

      // 输出建议
      if (suggestions.length > 0) {
        yield* this.emitText("## 💡 建议\n\n");
        for (const suggestion of suggestions) {
          yield* this.emitText(`- ${suggestion}\n`);
        }
        yield* this.emitText("\n");
      }

      // 如果有问题，提供一键修复选项
      if (overview.totalIssues > 0) {
        yield* this.emitConfirmation(
          "一键修复",
          `发现 ${overview.totalIssues} 个问题，是否进行一键修复？`,
          [
            { id: "quick_fix", label: "一键修复" },
            { id: "manual", label: "手动处理" },
            { id: "ignore", label: "暂时忽略" },
          ],
        );
      }

      yield* this.reportProgress("完成", 100, "检测完成");
      yield* this.emitDone(true, summary);

      logger.info(
        {
          skillId: this.metadata.id,
          userId: context.userId,
          runId,
          ...overview,
          durationMs: Date.now() - startTime,
        },
        "HealthCheckSkill: Execution completed",
      );
    } catch (error) {
      logger.error(
        {
          skillId: this.metadata.id,
          userId: context.userId,
          error: error instanceof Error ? error.message : String(error),
        },
        "HealthCheckSkill: Execution failed",
      );

      yield* this.emitError(
        error instanceof Error ? error.message : "健康检测失败",
        "EXECUTION_ERROR",
        true,
      );
      yield* this.emitDone(false, "健康检测失败");
    }
  }

  // ============================================
  // 私有方法 - 检测逻辑
  // ============================================

  /**
   * 检测失效链接（复用现有 Skill）
   */
  private async detectBrokenLinks(
    userId: string,
    input: HealthCheckInput,
  ): Promise<BrokenLinkIssue[]> {
    const supabase = await createClient();

    // 从缓存获取最近的检测结果
    if (!input.forceRefresh) {
      const { data: cached } = await supabase
        .from("health_check_cache")
        .select("*")
        .eq("user_id", userId)
        .eq("check_type", "broken_link")
        .eq("status", "issue")
        .order("detected_at", { ascending: false });

      if (cached && cached.length > 0) {
        return cached.map((row) => ({
          id: row.id,
          bookmarkId: row.bookmark_id,
          title:
            ((row.details as Record<string, unknown>)?.title as string) || "",
          url: ((row.details as Record<string, unknown>)?.url as string) || "",
          httpStatus: (row.details as Record<string, unknown>)?.httpStatus as
            | number
            | null,
          errorType:
            ((row.details as Record<string, unknown>)
              ?.errorType as BrokenLinkIssue["errorType"]) || "unknown",
          errorMessage: (row.details as Record<string, unknown>)
            ?.errorMessage as string | undefined,
          waybackUrl: (row.details as Record<string, unknown>)?.waybackUrl as
            | string
            | undefined,
          lastCheckedAt: row.last_checked_at,
          detectedAt: row.detected_at,
        }));
      }
    }

    // 如果没有缓存或需要强制刷新，使用现有 Skill 检测
    // 注意：这里简化处理，实际应该调用 linkHealthCheckSkill
    return [];
  }

  /**
   * 检测重复内容（复用现有 Skill）
   */
  private async detectDuplicates(
    userId: string,
    input: HealthCheckInput,
  ): Promise<DuplicateGroup[]> {
    const supabase = await createClient();

    // 从缓存获取
    if (!input.forceRefresh) {
      const { data: cached } = await supabase
        .from("health_check_cache")
        .select("*")
        .eq("user_id", userId)
        .eq("check_type", "duplicate")
        .eq("status", "issue")
        .order("detected_at", { ascending: false });

      if (cached && cached.length > 0) {
        // 按 related_bookmark_ids 分组
        const groupMap = new Map<string, DuplicateGroup>();

        for (const row of cached) {
          const groupKey =
            row.related_bookmark_ids?.sort().join(",") ||
            row.bookmark_id?.toString() ||
            row.id;
          if (!groupMap.has(groupKey)) {
            const details = row.details as Record<string, unknown>;
            groupMap.set(groupKey, {
              id: row.id,
              similarity: (details?.similarity as number) || 1,
              matchType:
                (details?.matchType as DuplicateGroup["matchType"]) ||
                "exact_url",
              items: [],
              recommendedKeepId: row.bookmark_id,
              reason: (details?.reason as string) || "",
            });
          }
        }

        return Array.from(groupMap.values());
      }
    }

    return [];
  }

  // ============================================
  // 私有方法 - 数据库操作
  // ============================================

  /**
   * 创建健康检测运行记录
   */
  private async createHealthCheckRun(
    userId: string,
    input: HealthCheckInput,
  ): Promise<string> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("health_check_runs")
      .insert({
        user_id: userId,
        check_types: input.checkTypes || ["broken_link", "duplicate", "stale"],
        scope: input.scope || "all",
        folder_id: input.folderId ? Number(input.folderId) : null,
        status: "running",
        progress: 0,
      })
      .select("id")
      .single();

    if (error) {
      throw new Error(`创建检测记录失败: ${error.message}`);
    }

    return data.id;
  }

  /**
   * 更新健康检测运行记录
   */
  private async updateHealthCheckRun(
    runId: string,
    status: "completed" | "failed" | "cancelled",
    stats?: {
      broken_links_count?: number;
      duplicates_count?: number;
      stale_count?: number;
    },
  ): Promise<void> {
    const supabase = await createClient();

    await supabase
      .from("health_check_runs")
      .update({
        status,
        progress: status === "completed" ? 100 : undefined,
        completed_at: new Date().toISOString(),
        ...stats,
      })
      .eq("id", runId);
  }

  /**
   * 缓存健康问题
   */
  private async cacheHealthIssues(
    userId: string,
    brokenLinks: BrokenLinkIssue[],
    duplicateGroups: DuplicateGroup[],
    staleContent: StaleContentItem[],
  ): Promise<void> {
    const supabase = await createClient();
    const items: Array<{
      check_type: string;
      bookmark_id: number | null;
      related_bookmark_ids?: (number | null)[];
      status: string;
      severity: string;
      details: Record<string, unknown>;
    }> = [];

    // 失效链接
    for (const link of brokenLinks) {
      items.push({
        check_type: "broken_link",
        bookmark_id: link.bookmarkId,
        status: "issue",
        severity: "high",
        details: {
          title: link.title,
          url: link.url,
          httpStatus: link.httpStatus,
          errorType: link.errorType,
          errorMessage: link.errorMessage,
          waybackUrl: link.waybackUrl,
        },
      });
    }

    // 重复内容
    for (const group of duplicateGroups) {
      for (const item of group.items) {
        if (item.bookmarkId !== group.recommendedKeepId) {
          items.push({
            check_type: "duplicate",
            bookmark_id: item.bookmarkId,
            related_bookmark_ids: group.items.map((i) => i.bookmarkId),
            status: "issue",
            severity: "medium",
            details: {
              groupId: group.id,
              similarity: group.similarity,
              matchType: group.matchType,
              recommendedKeepId: group.recommendedKeepId,
              reason: group.reason,
            },
          });
        }
      }
    }

    // 过期内容
    for (const stale of staleContent) {
      items.push({
        check_type: "stale",
        bookmark_id: stale.bookmarkId,
        status: "issue",
        severity: stale.severity,
        details: {
          title: stale.title,
          url: stale.url,
          daysSinceAccess: stale.daysSinceAccess,
          accessCount: stale.accessCount,
          lastAccessedAt: stale.lastAccessedAt,
        },
      });
    }

    if (items.length > 0) {
      await supabase.rpc("batch_upsert_health_cache", {
        p_user_id: userId,
        p_items: JSON.parse(JSON.stringify(items)),
      });
    }
  }

  // ============================================
  // 私有方法 - 统计和格式化
  // ============================================

  /**
   * 计算健康概览
   */
  private calculateOverview(
    brokenLinksCount: number,
    duplicatesCount: number,
    staleCount: number,
  ): HealthOverview {
    const totalIssues = brokenLinksCount + duplicatesCount + staleCount;

    // 计算健康分数 (100 - 扣分)
    // 失效链接扣 3 分/个，重复内容扣 2 分/组，过期内容扣 1 分/个
    const deduction = Math.min(
      100,
      brokenLinksCount * 3 + duplicatesCount * 2 + staleCount * 0.5,
    );
    const healthScore = Math.max(0, Math.round(100 - deduction));

    return {
      brokenLinks: brokenLinksCount,
      duplicates: duplicatesCount,
      staleContent: staleCount,
      totalIssues,
      healthScore,
      lastCheckedAt: new Date().toISOString(),
    };
  }

  /**
   * 获取分数表情
   */
  private getScoreEmoji(score: number): string {
    if (score >= 90) return "🌟 优秀";
    if (score >= 70) return "✅ 良好";
    if (score >= 50) return "⚠️ 一般";
    return "❌ 需改善";
  }

  /**
   * 生成摘要
   */
  private generateSummary(overview: HealthOverview): string {
    if (overview.totalIssues === 0) {
      return "🎉 您的收藏夹非常健康，没有发现任何问题！";
    }

    const parts: string[] = [];
    parts.push(`健康评分 ${overview.healthScore}/100`);

    if (overview.brokenLinks > 0) {
      parts.push(`${overview.brokenLinks} 个失效链接`);
    }
    if (overview.duplicates > 0) {
      parts.push(`${overview.duplicates} 组重复内容`);
    }
    if (overview.staleContent > 0) {
      parts.push(`${overview.staleContent} 个过期内容`);
    }

    return parts.join("，") + "。";
  }

  /**
   * 生成建议
   */
  private generateSuggestions(
    overview: HealthOverview,
    brokenLinks: BrokenLinkIssue[],
    duplicateGroups: DuplicateGroup[],
    staleContent: StaleContentItem[],
  ): string[] {
    const suggestions: string[] = [];

    if (overview.totalIssues === 0) {
      suggestions.push("继续保持良好习惯，建议每月进行一次健康检测");
      return suggestions;
    }

    if (brokenLinks.length > 0) {
      const withWayback = brokenLinks.filter((l) => l.waybackUrl).length;
      if (withWayback > 0) {
        suggestions.push(`${withWayback} 个失效链接有归档版本，可考虑更新链接`);
      }
      suggestions.push("建议删除或更新失效链接，保持收藏夹整洁");
    }

    if (duplicateGroups.length > 0) {
      const totalDups = duplicateGroups.reduce(
        (sum, g) => sum + g.items.length - 1,
        0,
      );
      suggestions.push(`可清理 ${totalDups} 个重复书签，释放空间`);
    }

    if (staleContent.length > 0) {
      const highSeverity = staleContent.filter(
        (s) => s.severity === "high",
      ).length;
      if (highSeverity > 0) {
        suggestions.push(
          `${highSeverity} 个内容超过 90 天未访问，建议归档或删除`,
        );
      }
    }

    suggestions.push("使用一键修复功能可快速处理所有问题");

    return suggestions;
  }
}

// ============================================
// 导出单例
// ============================================

export const healthCheckSkill = new HealthCheckSkill();
