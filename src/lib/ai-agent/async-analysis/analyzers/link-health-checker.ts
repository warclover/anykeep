/**
 * 链接健康检查分析器
 *
 * 检查书签链接的可访问性和健康状态
 *
 * @module ai-agent/async-analysis/analyzers
 * @version 1.0.0
 * @since 2025-12-30
 */

import { logger } from "@/lib/logger";
import { BaseAnalyzer } from "./base-analyzer";
import { LINK_HEALTH_THRESHOLDS } from "../constants";
import type {
  AsyncAnalysisTask,
  AnalyzerOutput,
  AnalysisTaskType,
  LinkHealthCheckResult,
  LinkHealthIssue,
  LinkIssueType,
} from "../types";
import type {
  ProactiveInsight,
  SuggestedAction,
} from "../../proactive-briefing";

/**
 * 链接健康检查分析器
 *
 * 功能：
 * 1. 检测失效链接（404、5xx）
 * 2. 检测超时链接
 * 3. 检测 SSL 错误
 * 4. 检测重定向问题
 */
export class LinkHealthCheckAnalyzer extends BaseAnalyzer {
  readonly type: AnalysisTaskType = "link_health_check";

  protected async doAnalyze(task: AsyncAnalysisTask): Promise<AnalyzerOutput> {
    const { userId } = task;
    const config = task.input as LinkHealthCheckInput | undefined;

    // 获取待检查的书签
    const bookmarks = await this.fetchBookmarksToCheck(userId, config);

    if (bookmarks.length === 0) {
      return this.createEmptyResult({
        totalChecked: 0,
        healthyCount: 0,
        issues: [],
      });
    }

    // 执行健康检查
    const result = await this.performHealthCheck(bookmarks);

    return {
      data: result,
      insights: this.generateInsights(result),
      suggestedActions: this.generateSuggestedActions(result),
    };
  }

  /**
   * 获取待检查的书签
   */
  private async fetchBookmarksToCheck(
    userId: string,
    config?: LinkHealthCheckInput,
  ): Promise<BookmarkForHealthCheck[]> {
    logger.debug(
      { module: "AsyncAnalysis", userId, config },
      "Fetching bookmarks for health check",
    );

    // 模拟数据，实际实现从数据库获取
    // 优先检查：
    // 1. 最近收藏的
    // 2. 长时间未检查的
    // 3. 指定的书签
    return [];
  }

  /**
   * 执行健康检查
   */
  private async performHealthCheck(
    bookmarks: BookmarkForHealthCheck[],
  ): Promise<LinkHealthCheckResult> {
    const issues: LinkHealthIssue[] = [];
    let healthyCount = 0;

    // 批量检查
    const batches = this.createBatches(
      bookmarks,
      LINK_HEALTH_THRESHOLDS.BATCH_SIZE,
    );

    for (const batch of batches) {
      // 使用 Promise.allSettled 确保单个检查失败不影响整个批次
      const batchResults = await Promise.allSettled(
        batch.map((bookmark) => this.checkSingleLink(bookmark)),
      );

      for (let i = 0; i < batchResults.length; i++) {
        const settledResult = batchResults[i];

        if (settledResult.status === "fulfilled") {
          const result = settledResult.value;
          if (result.healthy) {
            healthyCount++;
          } else if (result.issue) {
            issues.push(result.issue);
          }
        } else {
          // Promise rejected - 将其视为超时问题
          const bookmark = batch[i];
          issues.push({
            bookmarkId: bookmark.id,
            url: bookmark.url,
            issueType: "timeout",
            errorMessage:
              settledResult.reason instanceof Error
                ? settledResult.reason.message
                : String(settledResult.reason),
            suggestedAction: "retry",
          });
        }
      }

      // 批次间隔，避免请求过快
      await this.sleep(LINK_HEALTH_THRESHOLDS.CHECK_INTERVAL_MS);
    }

    return {
      totalChecked: bookmarks.length,
      healthyCount,
      issues,
      checkedAt: new Date().toISOString(),
    };
  }

  /**
   * 检查单个链接
   */
  private async checkSingleLink(
    bookmark: BookmarkForHealthCheck,
  ): Promise<{ healthy: boolean; issue?: LinkHealthIssue }> {
    // 使用 HEAD 请求检查链接
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      LINK_HEALTH_THRESHOLDS.RETRY_INTERVAL_MS * 3,
    );

    try {
      const response = await fetch(bookmark.url, {
        method: "HEAD",
        signal: controller.signal,
        redirect: "follow",
      });

      if (response.ok) {
        return { healthy: true };
      }

      // 处理错误状态码
      const issueType = this.getIssueType(response.status);
      return {
        healthy: false,
        issue: {
          bookmarkId: bookmark.id,
          url: bookmark.url,
          issueType,
          statusCode: response.status,
          suggestedAction: this.getSuggestedAction(issueType),
        },
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      let issueType: LinkIssueType = "timeout";
      if (
        errorMessage.includes("SSL") ||
        errorMessage.includes("certificate")
      ) {
        issueType = "ssl_error";
      } else if (errorMessage.includes("redirect")) {
        issueType = "redirect_loop";
      }

      return {
        healthy: false,
        issue: {
          bookmarkId: bookmark.id,
          url: bookmark.url,
          issueType,
          errorMessage,
          suggestedAction: this.getSuggestedAction(issueType),
        },
      };
    } finally {
      // 确保在任何情况下都清理 timeout，防止内存泄漏
      clearTimeout(timeoutId);
    }
  }

  /**
   * 根据状态码获取问题类型
   */
  private getIssueType(statusCode: number): LinkIssueType {
    if (statusCode === 404) {
      return "not_found";
    }
    if (statusCode >= 500) {
      return "server_error";
    }
    if (statusCode === 402 || statusCode === 403) {
      return "paywall";
    }
    return "server_error";
  }

  /**
   * 根据问题类型获取建议操作
   */
  private getSuggestedAction(
    issueType: LinkIssueType,
  ): LinkHealthIssue["suggestedAction"] {
    switch (issueType) {
      case "not_found":
        return "archive";
      case "server_error":
        return "retry";
      case "timeout":
        return "retry";
      case "ssl_error":
        return "update";
      case "redirect_loop":
        return "update";
      case "paywall":
        return "archive";
      case "content_changed":
        return "update";
      default:
        return "retry";
    }
  }

  /**
   * 创建批次
   */
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * 休眠
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * 生成洞察
   */
  private generateInsights(result: LinkHealthCheckResult): ProactiveInsight[] {
    const insights: ProactiveInsight[] = [];
    const now = new Date().toISOString();

    if (result.issues.length === 0) {
      return insights;
    }

    // 失效链接洞察
    const notFoundIssues = result.issues.filter(
      (i) => i.issueType === "not_found",
    );
    if (notFoundIssues.length > 0) {
      insights.push({
        id: `insight_broken_links_${Date.now()}`,
        type: "link_health",
        title: "发现失效链接",
        summary: `${notFoundIssues.length} 条收藏的链接已失效，建议清理或归档`,
        priority: notFoundIssues.length > 5 ? 8 : 6,
        relatedBookmarkIds: notFoundIssues.map((i) => i.bookmarkId),
        createdAt: now,
        isRead: false,
      });
    }

    // 服务器错误洞察
    const serverErrors = result.issues.filter(
      (i) => i.issueType === "server_error" || i.issueType === "timeout",
    );
    if (serverErrors.length > 3) {
      insights.push({
        id: `insight_server_issues_${Date.now()}`,
        type: "link_health",
        title: "部分链接暂时不可访问",
        summary: `${serverErrors.length} 条链接可能是临时问题，建议稍后重试`,
        priority: 4,
        relatedBookmarkIds: serverErrors.map((i) => i.bookmarkId),
        createdAt: now,
        isRead: false,
      });
    }

    return insights;
  }

  /**
   * 生成建议操作
   */
  private generateSuggestedActions(
    result: LinkHealthCheckResult,
  ): SuggestedAction[] {
    const actions: SuggestedAction[] = [];

    if (result.issues.length === 0) {
      return actions;
    }

    // 归档失效链接
    const archiveCandidates = result.issues.filter(
      (i) => i.suggestedAction === "archive",
    );
    if (archiveCandidates.length > 0) {
      actions.push({
        id: `action_archive_broken_${Date.now()}`,
        type: "archive_old",
        label: "归档失效链接",
        description: `将 ${archiveCandidates.length} 条失效链接移至归档`,
        affectedCount: archiveCandidates.length,
        executeParams: {
          skillId: "batch_organize",
          action: "archive",
          bookmarkIds: archiveCandidates.map((i) => i.bookmarkId),
        },
      });
    }

    // 重试检查
    const retryCandidates = result.issues.filter(
      (i) => i.suggestedAction === "retry",
    );
    if (retryCandidates.length > 0) {
      actions.push({
        id: `action_retry_check_${Date.now()}`,
        type: "review_unread",
        label: "稍后重新检查",
        description: `${retryCandidates.length} 条链接可能是临时问题`,
        affectedCount: retryCandidates.length,
        executeParams: {
          skillId: "link_health_check",
          bookmarkIds: retryCandidates.map((i) => i.bookmarkId),
        },
      });
    }

    return actions;
  }
}

/**
 * 健康检查输入配置
 */
interface LinkHealthCheckInput {
  bookmarkIds?: number[];
  maxLinks?: number;
  priority?: "recent" | "old" | "unchecked";
}

/**
 * 健康检查用书签数据
 */
interface BookmarkForHealthCheck {
  id: number;
  url: string;
  lastCheckedAt?: string;
}
