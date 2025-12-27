/**
 * 链接健康检测 Skill
 *
 * 智能检测收藏链接的可访问性，发现失效链接并提供修复建议。
 *
 * 功能：
 * - 批量检测 URL 可访问性
 * - 分类问题类型（404/超时/SSL 错误等）
 * - 查找 Wayback Machine 归档版本
 * - 生成健康报告和修复建议
 *
 * @version 1.0.0
 * @since 2025-12-27
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
import { UrlChecker } from "./services/url-checker";
import { WaybackFinder } from "./services/wayback-finder";
import type {
  LinkHealthCheckInput,
  LinkHealthCheckOutput,
  LinkCheckResult,
  HealthStatus,
  BookmarkForCheck,
  HealthCheckStats,
} from "./types";
import { LINK_HEALTH_CONFIG } from "./types";
import {
  LinkHealthCheckInputSchema,
  LinkHealthCheckOutputSchema,
} from "./schema";

// ============================================
// 步骤定义
// ============================================

const HEALTH_CHECK_STEPS: StepDefinition[] = [
  {
    id: "collect",
    name: "收集数据",
    description: "获取待检测的书签",
    weight: 10,
  },
  {
    id: "check",
    name: "检测链接",
    description: "批量检测 URL 可访问性",
    weight: 60,
  },
  {
    id: "classify",
    name: "分类问题",
    description: "对检测结果进行分类",
    weight: 10,
  },
  {
    id: "wayback",
    name: "查找归档",
    description: "为失效链接查找归档版本",
    weight: 10,
  },
  {
    id: "report",
    name: "生成报告",
    description: "生成健康检测报告",
    weight: 10,
  },
];

// ============================================
// LinkHealthCheckSkill 实现
// ============================================

/**
 * 链接健康检测 Skill
 */
export class LinkHealthCheckSkill extends OrchestrationSkill<
  LinkHealthCheckInput,
  LinkHealthCheckOutput
> {
  readonly metadata: OrchestrationSkillMetadata = {
    id: "link_health_check",
    name: "链接健康检测",
    description:
      "智能检测收藏链接的可访问性，发现失效链接并提供修复建议，保持收藏夹健康。",
    category: "utility",
    version: "1.0.0",
    author: "AnyKeep",
    capabilities: [
      "batch-check",
      "error-classification",
      "wayback-lookup",
      "fix-suggestions",
    ],
    requiresConfirmation: false,
    estimatedDurationMs: 30000,
    maxExecutionTimeMs: 120000,
    deliverableTypes: ["report", "list"],
    outputFormats: ["markdown", "json"],
    steps: HEALTH_CHECK_STEPS,
  };

  readonly inputSchema = LinkHealthCheckInputSchema;
  readonly outputSchema = LinkHealthCheckOutputSchema;

  private urlChecker: UrlChecker;
  private waybackFinder: WaybackFinder;

  constructor() {
    super();
    this.urlChecker = new UrlChecker();
    this.waybackFinder = new WaybackFinder();
  }

  /**
   * 解析自然语言输入
   */
  async parseInput(
    message: string,
    _context: OrchestrationContext,
  ): Promise<LinkHealthCheckInput> {
    const input: LinkHealthCheckInput = {
      scope: "all",
      includeWayback: true,
      timeout: LINK_HEALTH_CONFIG.DEFAULT_TIMEOUT_MS,
      concurrency: LINK_HEALTH_CONFIG.DEFAULT_CONCURRENCY,
    };

    const lowerMessage = message.toLowerCase();

    // 解析范围
    if (/选中|selected|这些|当前/.test(lowerMessage)) {
      input.scope = "selected";
    } else if (/文件夹|folder|目录/.test(lowerMessage)) {
      input.scope = "folder";
    }

    // 解析是否查找归档
    if (/不.*归档|no.*wayback|跳过归档|skip.*archive/.test(lowerMessage)) {
      input.includeWayback = false;
    }

    // 解析超时时间
    const timeoutMatch = message.match(/(\d+)\s*秒?超时|timeout\s*(\d+)/i);
    if (timeoutMatch) {
      const seconds = parseInt(timeoutMatch[1] || timeoutMatch[2]);
      input.timeout = Math.min(
        seconds * 1000,
        LINK_HEALTH_CONFIG.MAX_TIMEOUT_MS,
      );
    }

    // 解析并发数
    const concurrencyMatch = message.match(/并发\s*(\d+)|concurrency\s*(\d+)/i);
    if (concurrencyMatch) {
      const num = parseInt(concurrencyMatch[1] || concurrencyMatch[2]);
      input.concurrency = Math.min(num, LINK_HEALTH_CONFIG.MAX_CONCURRENCY);
    }

    return input;
  }

  /**
   * 流式执行链接健康检测
   */
  async *executeStream(
    context: OrchestrationContext,
  ): AsyncGenerator<OrchestrationStreamChunk> {
    const startTime = Date.now();
    const input = context.params as LinkHealthCheckInput;

    // 初始化进度
    this.initProgress(HEALTH_CHECK_STEPS);

    try {
      // ========================================
      // Step 1: 收集数据
      // ========================================
      yield* this.reportProgress("收集数据", 5, "正在获取书签列表...");
      yield* this.emitText("🔍 **开始链接健康检测**\n\n");

      const bookmarks = await this.fetchBookmarks(context.userId, input);

      if (bookmarks.length === 0) {
        yield* this.emitText("📭 没有找到需要检测的书签。\n");
        yield* this.emitDone(true, "没有需要检测的书签");
        return;
      }

      yield* this.reportProgress(
        "收集数据",
        10,
        `获取到 ${bookmarks.length} 条书签`,
      );
      yield* this.emitText(`📚 共 **${bookmarks.length}** 条书签待检测\n\n`);

      // 创建检测记录
      const checkId = await this.createCheckRecord(
        context.userId,
        input,
        bookmarks.length,
      );

      // ========================================
      // Step 2: 批量检测链接
      // ========================================
      yield* this.reportProgress("检测链接", 15, "开始检测链接可访问性...");

      const results: LinkCheckResult[] = [];
      const batchSize = LINK_HEALTH_CONFIG.BATCH_SIZE;
      const totalBatches = Math.ceil(bookmarks.length / batchSize);

      for (let i = 0; i < totalBatches; i++) {
        // 检查是否取消
        if (this.isCancelled(context)) {
          yield* this.emitCancelled("检测已取消", "用户取消");
          await this.updateCheckStatus(checkId, "cancelled");
          return;
        }

        const batch = bookmarks.slice(i * batchSize, (i + 1) * batchSize);
        const batchResults = await this.urlChecker.checkBatch(batch, {
          timeout: input.timeout ?? LINK_HEALTH_CONFIG.DEFAULT_TIMEOUT_MS,
          concurrency:
            input.concurrency ?? LINK_HEALTH_CONFIG.DEFAULT_CONCURRENCY,
        });

        results.push(...batchResults);

        // 更新进度
        const progress = 15 + Math.round(((i + 1) / totalBatches) * 45);
        yield* this.reportProgress(
          "检测链接",
          progress,
          `已检测 ${results.length}/${bookmarks.length} 条`,
        );

        // 实时输出问题
        const newProblems = batchResults.filter((r) => r.status !== "healthy");
        if (newProblems.length > 0) {
          yield* this.emitText(`⚠️ 发现 ${newProblems.length} 条问题链接\n`);
        }
      }

      // ========================================
      // Step 3: 分类问题
      // ========================================
      yield* this.reportProgress("分类问题", 65, "正在分析检测结果...");

      const stats = this.calculateStats(results);
      const problems = results.filter((r) => r.status !== "healthy");

      yield* this.emitText(`\n## 📊 检测结果\n\n`);
      yield* this.emitText(`| 状态 | 数量 | 占比 |\n`);
      yield* this.emitText(`|------|------|------|\n`);
      yield* this.emitText(
        `| ✅ 正常 | ${stats.healthyCount} | ${this.percent(stats.healthyCount, stats.totalChecked)} |\n`,
      );
      yield* this.emitText(
        `| ❌ 失效 | ${stats.failedCount} | ${this.percent(stats.failedCount, stats.totalChecked)} |\n`,
      );
      yield* this.emitText(
        `| 🐢 缓慢 | ${stats.slowCount} | ${this.percent(stats.slowCount, stats.totalChecked)} |\n`,
      );
      yield* this.emitText(
        `| 🔀 重定向 | ${stats.redirectCount} | ${this.percent(stats.redirectCount, stats.totalChecked)} |\n\n`,
      );

      // ========================================
      // Step 4: 查找 Wayback 归档
      // ========================================
      if (input.includeWayback && stats.failedCount > 0) {
        yield* this.reportProgress("查找归档", 70, "正在查找归档版本...");

        const failedResults = problems.filter((p) => p.status === "failed");
        const waybackResults =
          await this.waybackFinder.findArchives(failedResults);

        // 更新归档链接
        for (const result of problems) {
          const wayback = waybackResults.find(
            (w) => w.bookmarkId === result.bookmarkId,
          );
          if (wayback?.waybackUrl) {
            result.waybackUrl = wayback.waybackUrl;
          }
        }

        const foundCount = waybackResults.filter((w) => w.waybackUrl).length;
        if (foundCount > 0) {
          yield* this.emitText(`🗄️ 找到 **${foundCount}** 个归档版本\n\n`);
        }
      }

      yield* this.reportProgress("查找归档", 80, "归档查找完成");

      // ========================================
      // Step 5: 生成报告
      // ========================================
      yield* this.reportProgress("生成报告", 85, "正在生成健康报告...");

      // 输出问题详情（最多显示 10 条）
      if (problems.length > 0) {
        yield* this.emitText(`## ⚠️ 问题链接详情\n\n`);

        for (const [index, problem] of problems.slice(0, 10).entries()) {
          const statusIcon = this.getStatusIcon(problem.status);
          const errorInfo = problem.errorType
            ? ` (${this.getErrorTypeName(problem.errorType)})`
            : "";

          yield* this.emitText(
            `### ${index + 1}. ${this.truncateUrl(problem.url)}\n`,
          );
          yield* this.emitText(
            `- **状态**: ${statusIcon} ${this.getStatusName(problem.status)}${errorInfo}\n`,
          );

          if (problem.httpStatus) {
            yield* this.emitText(`- **HTTP状态码**: ${problem.httpStatus}\n`);
          }

          if (problem.waybackUrl) {
            yield* this.emitText(
              `- **归档版本**: [查看归档](${problem.waybackUrl})\n`,
            );
          }

          yield* this.emitText(`\n`);
        }

        if (problems.length > 10) {
          yield* this.emitText(
            `*...还有 ${problems.length - 10} 条问题链接*\n\n`,
          );
        }
      }

      // 更新书签健康状态
      await this.updateBookmarkHealthStatus(context.userId, results);

      // 更新检测记录
      await this.updateCheckRecord(checkId, stats, problems);

      // 生成建议
      const suggestions = this.generateSuggestions(stats, problems);
      const summary = this.generateSummary(stats);

      const output: LinkHealthCheckOutput = {
        checkId,
        stats,
        problems,
        summary,
        suggestions,
        generatedAt: new Date().toISOString(),
      };

      // 输出交付物
      const deliverable = this.createDeliverable(
        "report",
        "链接健康检测报告",
        output,
        "markdown",
        {
          downloadable: true,
          metadata: { ...stats },
        },
      );

      yield* this.emitDeliverable(deliverable);

      // 输出建议
      yield* this.emitSuggestions(
        suggestions.map((s, i) => ({
          text: s,
          action: "fix",
          params: { suggestionIndex: i },
          icon: "💡",
        })),
      );

      // 如果有问题，提供修复确认
      if (stats.failedCount > 0) {
        yield* this.emitConfirmation(
          "处理失效链接",
          `发现 ${stats.failedCount} 条失效链接，您希望如何处理？`,
          [
            { id: "delete_all", label: "全部删除", danger: true },
            { id: "archive_all", label: "全部归档" },
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
          checkId,
          ...stats,
          durationMs: Date.now() - startTime,
        },
        "LinkHealthCheckSkill: Execution completed",
      );
    } catch (error) {
      logger.error(
        {
          skillId: this.metadata.id,
          userId: context.userId,
          error: error instanceof Error ? error.message : String(error),
        },
        "LinkHealthCheckSkill: Execution failed",
      );

      yield* this.emitError(
        error instanceof Error ? error.message : "链接检测失败",
        "EXECUTION_ERROR",
        true,
      );
      yield* this.emitDone(false, "链接检测失败");
    }
  }

  // ============================================
  // 私有方法 - 数据获取
  // ============================================

  /**
   * 获取待检测的书签
   */
  private async fetchBookmarks(
    userId: string,
    input: LinkHealthCheckInput,
  ): Promise<BookmarkForCheck[]> {
    const supabase = await createClient();

    let query = supabase
      .from("bookmarks")
      .select("id, url, title")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

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
      LINK_HEALTH_CONFIG.MAX_CHECK_LIMIT,
    );

    if (error) {
      throw new Error(`获取书签失败: ${error.message}`);
    }

    // 过滤无效 URL
    return (data || []).filter((b) => {
      try {
        const url = new URL(b.url);
        return !LINK_HEALTH_CONFIG.SKIP_PROTOCOLS.some(
          (p) => url.protocol === p,
        );
      } catch {
        return false;
      }
    });
  }

  // ============================================
  // 私有方法 - 数据库操作
  // ============================================

  /**
   * 创建检测记录
   *
   * 注意：需要先执行数据库迁移 20251227000001_add_link_health.sql
   */
  private async createCheckRecord(
    userId: string,
    input: LinkHealthCheckInput,
    totalCount: number,
  ): Promise<string> {
    const supabase = await createClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("link_health_checks")
      .insert({
        user_id: userId,
        scope: input.scope,
        folder_id: input.folderId,
        bookmark_ids: input.bookmarkIds,
        total_checked: totalCount,
        status: "running",
        started_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (error) {
      throw new Error(`创建检测记录失败: ${error.message}`);
    }

    return data.id as string;
  }

  /**
   * 更新检测记录
   */
  private async updateCheckRecord(
    checkId: string,
    stats: HealthCheckStats,
    problems: LinkCheckResult[],
  ): Promise<void> {
    const supabase = await createClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from("link_health_checks")
      .update({
        healthy_count: stats.healthyCount,
        failed_count: stats.failedCount,
        slow_count: stats.slowCount,
        redirect_count: stats.redirectCount,
        problems: JSON.stringify(problems),
        status: "completed",
        progress: 100,
        completed_at: new Date().toISOString(),
      })
      .eq("id", checkId);
  }

  /**
   * 更新检测状态
   */
  private async updateCheckStatus(
    checkId: string,
    status: string,
  ): Promise<void> {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from("link_health_checks")
      .update({ status, completed_at: new Date().toISOString() })
      .eq("id", checkId);
  }

  /**
   * 批量更新书签健康状态
   */
  private async updateBookmarkHealthStatus(
    userId: string,
    results: LinkCheckResult[],
  ): Promise<void> {
    const supabase = await createClient();

    // 使用批量更新函数
    const updates = results.map((r) => ({
      bookmarkId: r.bookmarkId,
      status: r.status,
      errorType: r.errorType,
      responseTimeMs: r.responseTimeMs,
    }));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).rpc("batch_update_health_status", {
      p_user_id: userId,
      p_updates: updates,
    });
  }

  // ============================================
  // 私有方法 - 统计和格式化
  // ============================================

  /**
   * 计算统计结果
   */
  private calculateStats(results: LinkCheckResult[]): HealthCheckStats {
    return {
      totalChecked: results.length,
      healthyCount: results.filter((r) => r.status === "healthy").length,
      failedCount: results.filter((r) => r.status === "failed").length,
      slowCount: results.filter((r) => r.status === "slow").length,
      redirectCount: results.filter((r) => r.status === "redirect").length,
    };
  }

  /**
   * 计算百分比
   */
  private percent(count: number, total: number): string {
    if (total === 0) return "0%";
    return `${Math.round((count / total) * 100)}%`;
  }

  /**
   * 截断 URL
   */
  private truncateUrl(url: string, maxLength = 60): string {
    if (url.length <= maxLength) return url;
    return url.slice(0, maxLength) + "...";
  }

  /**
   * 获取状态图标
   */
  private getStatusIcon(status: HealthStatus): string {
    switch (status) {
      case "healthy":
        return "✅";
      case "failed":
        return "❌";
      case "slow":
        return "🐢";
      case "redirect":
        return "🔀";
      case "ignored":
        return "🙈";
      default:
        return "❓";
    }
  }

  /**
   * 获取状态名称
   */
  private getStatusName(status: HealthStatus): string {
    switch (status) {
      case "healthy":
        return "正常";
      case "failed":
        return "失效";
      case "slow":
        return "响应缓慢";
      case "redirect":
        return "已重定向";
      case "ignored":
        return "已忽略";
      default:
        return "未知";
    }
  }

  /**
   * 获取错误类型名称
   */
  private getErrorTypeName(errorType: string): string {
    const names: Record<string, string> = {
      not_found: "404 未找到",
      timeout: "请求超时",
      ssl_error: "SSL 证书错误",
      dns_error: "DNS 解析失败",
      connection_refused: "连接被拒绝",
      content_changed: "内容已变更",
      paywall: "付费墙",
      login_required: "需要登录",
    };
    return names[errorType] || errorType;
  }

  /**
   * 生成摘要
   */
  private generateSummary(stats: HealthCheckStats): string {
    const parts: string[] = [];
    parts.push(`检测了 **${stats.totalChecked}** 条链接`);

    if (stats.failedCount === 0) {
      parts.push("全部正常，无失效链接！");
    } else {
      parts.push(`发现 **${stats.failedCount}** 条失效`);
    }

    if (stats.slowCount > 0) {
      parts.push(`**${stats.slowCount}** 条响应缓慢`);
    }

    return parts.join("，") + "。";
  }

  /**
   * 生成建议
   */
  private generateSuggestions(
    stats: HealthCheckStats,
    problems: LinkCheckResult[],
  ): string[] {
    const suggestions: string[] = [];

    if (stats.failedCount === 0) {
      suggestions.push("您的收藏链接全部健康，继续保持！");
      suggestions.push("建议每月检测一次，及时发现失效链接");
      return suggestions;
    }

    if (stats.failedCount > 10) {
      suggestions.push("失效链接较多，建议分批处理");
    }

    const withWayback = problems.filter((p) => p.waybackUrl);
    if (withWayback.length > 0) {
      suggestions.push(
        `${withWayback.length} 条链接有归档版本，可考虑更新链接`,
      );
    }

    const timeouts = problems.filter((p) => p.errorType === "timeout");
    if (timeouts.length > 0) {
      suggestions.push(
        `${timeouts.length} 条链接超时，可能是网络问题，建议稍后重试`,
      );
    }

    suggestions.push("可以选择删除、归档或更新失效链接");
    suggestions.push("定期检测可以保持收藏夹健康");

    return suggestions;
  }
}

// ============================================
// 导出单例
// ============================================

export const linkHealthCheckSkill = new LinkHealthCheckSkill();
