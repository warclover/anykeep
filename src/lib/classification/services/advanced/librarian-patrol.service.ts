/**
 * V4.0 整理大师主动巡检服务
 *
 * 扩展 AI Librarian，增加主动巡检能力：
 * 1. 失效链接检测（404 检查）
 * 2. 长期未访问书签检测
 * 3. 周期性报告生成
 * 4. 用户通知推送
 *
 * 设计原则：
 * - 仅对活跃用户启用（控制成本）
 * - 后台异步执行（不阻塞用户操作）
 * - 报告可视化友好
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json, TypedSupabaseClient } from "@/types/supabase";
import { logger } from "@/lib/logger";
import {
  AILibrarianService,
  type LibrarianAnalysis,
} from "./ai-librarian.service";

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 失效链接检测结果
 */
export interface BrokenLink {
  bookmarkId: number;
  title: string;
  url: string;
  statusCode: number;
  errorMessage?: string;
  lastCheckedAt: Date;
}

/**
 * 长期未访问书签
 */
export interface StaleBookmark {
  bookmarkId: number;
  title: string;
  url: string;
  folderName: string | null;
  lastAccessedAt: Date | null;
  createdAt: Date;
  daysSinceAccess: number;
}

/**
 * 巡检报告
 */
export interface PatrolReport {
  /** 报告 ID */
  reportId: string;

  /** 用户 ID */
  userId: string;

  /** 基础分析（继承自 AI Librarian） */
  baseAnalysis: LibrarianAnalysis;

  /** 失效链接 */
  brokenLinks: BrokenLink[];

  /** 长期未访问书签 */
  staleBookmarks: StaleBookmark[];

  /** 报告生成时间 */
  generatedAt: Date;

  /** 报告周期 */
  reportPeriod: "weekly" | "biweekly" | "monthly";

  /** 总问题数 */
  totalIssues: number;

  /** 综合评分 (0-100) */
  overallScore: number;

  /** 重点建议 (Top 5) */
  topRecommendations: PatrolRecommendation[];

  /** 与上次报告对比 */
  comparison?: {
    healthScoreChange: number;
    newIssuesCount: number;
    resolvedIssuesCount: number;
  };
}

/**
 * 巡检建议
 */
export interface PatrolRecommendation {
  type: "merge" | "delete" | "rename" | "fix_link" | "archive" | "organize";
  priority: "high" | "medium" | "low";
  title: string;
  description: string;
  actionUrl?: string;
  affectedItems: number;
}

/**
 * 活跃用户判断条件
 */
export interface ActiveUserCriteria {
  /** 最近 N 天内有活动 */
  lastActivityDays: number;
  /** 最少书签数 */
  minBookmarks: number;
  /** 最少文件夹数 */
  minFolders: number;
}

/**
 * 巡检配置
 */
export interface PatrolConfig {
  /** 链接检测并发数 */
  linkCheckConcurrency: number;
  /** 链接检测超时 (ms) */
  linkCheckTimeoutMs: number;
  /** 链接检测批次大小 */
  linkCheckBatchSize: number;
  /** 长期未访问天数阈值 */
  staleDaysThreshold: number;
  /** 活跃用户条件 */
  activeUserCriteria: ActiveUserCriteria;
  /** 每次巡检最大用户数 */
  maxUsersPerPatrol: number;
}

const DEFAULT_CONFIG: PatrolConfig = {
  linkCheckConcurrency: 5,
  linkCheckTimeoutMs: 5000,
  linkCheckBatchSize: 20,
  staleDaysThreshold: 90, // 90 天未访问
  activeUserCriteria: {
    lastActivityDays: 30,
    minBookmarks: 10,
    minFolders: 2,
  },
  maxUsersPerPatrol: 50,
};

// ============================================================================
// 服务实现
// ============================================================================

/**
 * 整理大师主动巡检服务
 */
export class LibrarianPatrolService {
  private supabase: TypedSupabaseClient;
  private config: PatrolConfig;
  private librarianService: AILibrarianService;

  constructor(
    supabase: SupabaseClient<Database>,
    config?: Partial<PatrolConfig>,
  ) {
    this.supabase = supabase;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.librarianService = new AILibrarianService(supabase);
  }

  /**
   * 执行用户巡检
   */
  async patrolUser(userId: string): Promise<PatrolReport> {
    const startTime = Date.now();
    logger.info({ userId }, "PatrolService: Starting user patrol");

    try {
      // 1. 执行基础分析
      const baseAnalysis = await this.librarianService.analyze(userId);

      // 2. 检测失效链接（采样检测，控制成本）
      const brokenLinks = await this.detectBrokenLinks(userId);

      // 3. 检测长期未访问书签
      const staleBookmarks = await this.detectStaleBookmarks(userId);

      // 4. 获取上次报告（用于对比）
      const lastReport = await this.getLastReport(userId);

      // 5. 生成建议
      const recommendations = this.generateRecommendations(
        baseAnalysis,
        brokenLinks,
        staleBookmarks,
      );

      // 6. 计算综合评分
      const overallScore = this.calculateOverallScore(
        baseAnalysis,
        brokenLinks,
        staleBookmarks,
      );

      // 7. 构建报告
      const report: PatrolReport = {
        reportId: `patrol-${userId}-${Date.now()}`,
        userId,
        baseAnalysis,
        brokenLinks,
        staleBookmarks,
        generatedAt: new Date(),
        reportPeriod: "biweekly",
        totalIssues:
          baseAnalysis.totalSuggestions +
          brokenLinks.length +
          staleBookmarks.length,
        overallScore,
        topRecommendations: recommendations.slice(0, 5),
        comparison: lastReport
          ? {
              healthScoreChange: overallScore - lastReport.overallScore,
              newIssuesCount: Math.max(
                0,
                baseAnalysis.totalSuggestions +
                  brokenLinks.length +
                  staleBookmarks.length -
                  lastReport.totalIssues,
              ),
              resolvedIssuesCount: Math.max(
                0,
                lastReport.totalIssues -
                  (baseAnalysis.totalSuggestions +
                    brokenLinks.length +
                    staleBookmarks.length),
              ),
            }
          : undefined,
      };

      // 8. 保存报告
      await this.saveReport(report);

      logger.info(
        {
          userId,
          reportId: report.reportId,
          overallScore,
          totalIssues: report.totalIssues,
          brokenLinksCount: brokenLinks.length,
          staleBookmarksCount: staleBookmarks.length,
          durationMs: Date.now() - startTime,
        },
        "PatrolService: User patrol completed",
      );

      return report;
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          userId,
        },
        "PatrolService: Patrol failed",
      );
      throw error;
    }
  }

  /**
   * 批量巡检活跃用户
   */
  async patrolActiveUsers(): Promise<{
    processedCount: number;
    successCount: number;
    failedCount: number;
    reports: PatrolReport[];
  }> {
    logger.info("PatrolService: Starting batch patrol for active users");

    // 1. 获取活跃用户列表
    const activeUsers = await this.getActiveUsers();

    logger.info(
      { activeUserCount: activeUsers.length },
      "PatrolService: Found active users",
    );

    const reports: PatrolReport[] = [];
    let successCount = 0;
    let failedCount = 0;

    // 2. 逐个巡检（可优化为并行）
    for (const userId of activeUsers) {
      try {
        const report = await this.patrolUser(userId);
        reports.push(report);
        successCount++;
      } catch (error) {
        logger.warn(
          {
            userId,
            error: error instanceof Error ? error.message : String(error),
          },
          "PatrolService: Individual patrol failed",
        );
        failedCount++;
      }
    }

    logger.info(
      {
        processedCount: activeUsers.length,
        successCount,
        failedCount,
      },
      "PatrolService: Batch patrol completed",
    );

    return {
      processedCount: activeUsers.length,
      successCount,
      failedCount,
      reports,
    };
  }

  /**
   * 获取活跃用户列表
   */
  private async getActiveUsers(): Promise<string[]> {
    const { lastActivityDays, minBookmarks, minFolders } =
      this.config.activeUserCriteria;

    const cutoffDate = new Date(
      Date.now() - lastActivityDays * 24 * 60 * 60 * 1000,
    ).toISOString();

    // 查询最近有活动的用户
    const { data: recentUsers, error } = await this.supabase
      .from("bookmarks")
      .select("user_id")
      .gte("created_at", cutoffDate)
      .is("deleted_at", null);

    if (error) {
      logger.error({ error: error.message }, "Failed to fetch active users");
      return [];
    }

    // 去重
    const uniqueUserIds = [
      ...new Set((recentUsers || []).map((u) => u.user_id)),
    ];

    // 过滤：检查书签和文件夹数量
    const qualifiedUsers: string[] = [];

    for (const userId of uniqueUserIds.slice(
      0,
      this.config.maxUsersPerPatrol,
    )) {
      const [bookmarkCount, folderCount] = await Promise.all([
        this.supabase
          .from("bookmarks")
          .select("*", { count: "exact", head: true })
          .eq("user_id", userId)
          .is("deleted_at", null),
        this.supabase
          .from("folders")
          .select("*", { count: "exact", head: true })
          .eq("user_id", userId)
          .is("deleted_at", null)
          .eq("is_system", false),
      ]);

      if (
        (bookmarkCount.count || 0) >= minBookmarks &&
        (folderCount.count || 0) >= minFolders
      ) {
        qualifiedUsers.push(userId);
      }
    }

    return qualifiedUsers;
  }

  /**
   * 检测失效链接
   */
  private async detectBrokenLinks(userId: string): Promise<BrokenLink[]> {
    // 获取需要检测的书签（随机采样）
    const { data: bookmarks, error } = await this.supabase
      .from("bookmarks")
      .select("id, title, url")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .not("url", "is", null)
      .limit(this.config.linkCheckBatchSize);

    if (error || !bookmarks) {
      return [];
    }

    const brokenLinks: BrokenLink[] = [];

    // 并发检测
    const checkPromises = bookmarks.map(async (bookmark) => {
      try {
        const result = await this.checkLink(bookmark.url);
        if (!result.isValid) {
          return {
            bookmarkId: bookmark.id,
            title: bookmark.title,
            url: bookmark.url,
            statusCode: result.statusCode,
            errorMessage: result.errorMessage,
            lastCheckedAt: new Date(),
          };
        }
        return null;
      } catch {
        return null;
      }
    });

    // 使用 Promise.allSettled 避免单个失败影响整体
    const results = await Promise.allSettled(checkPromises);

    for (const result of results) {
      if (result.status === "fulfilled" && result.value) {
        brokenLinks.push(result.value);
      }
    }

    return brokenLinks;
  }

  /**
   * 检测单个链接
   */
  private async checkLink(
    url: string,
  ): Promise<{ isValid: boolean; statusCode: number; errorMessage?: string }> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        this.config.linkCheckTimeoutMs,
      );

      const response = await fetch(url, {
        method: "HEAD", // 只获取头部，减少带宽
        signal: controller.signal,
        redirect: "follow",
      });

      clearTimeout(timeoutId);

      const isValid = response.status >= 200 && response.status < 400;

      return {
        isValid,
        statusCode: response.status,
        errorMessage: isValid ? undefined : `HTTP ${response.status}`,
      };
    } catch (error) {
      return {
        isValid: false,
        statusCode: 0,
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * 检测长期未访问书签
   */
  private async detectStaleBookmarks(userId: string): Promise<StaleBookmark[]> {
    const cutoffDate = new Date(
      Date.now() - this.config.staleDaysThreshold * 24 * 60 * 60 * 1000,
    ).toISOString();

    // 查询长期未访问的书签
    // 注意：bookmarks 表使用 last_read_at 而非 last_accessed_at
    const { data, error } = await this.supabase
      .from("bookmarks")
      .select(
        `
        id,
        title,
        url,
        created_at,
        last_read_at,
        folders (name)
      `,
      )
      .eq("user_id", userId)
      .is("deleted_at", null)
      .or(`last_read_at.is.null,last_read_at.lt.${cutoffDate}`)
      .lt("created_at", cutoffDate) // 只检查老书签
      .limit(20);

    if (error || !data) {
      return [];
    }

    const now = new Date();

    return data.map((bookmark) => {
      const lastAccessed = bookmark.last_read_at
        ? new Date(bookmark.last_read_at)
        : null;
      const created = new Date(bookmark.created_at || new Date().toISOString());

      const daysSinceAccess = lastAccessed
        ? Math.floor(
            (now.getTime() - lastAccessed.getTime()) / (1000 * 60 * 60 * 24),
          )
        : Math.floor(
            (now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24),
          );

      // 处理 folders 可能是对象或数组的情况
      const folders = bookmark.folders as unknown as
        | { name: string }
        | { name: string }[]
        | null;
      const folderName = folders
        ? Array.isArray(folders)
          ? folders[0]?.name || null
          : folders.name
        : null;

      return {
        bookmarkId: bookmark.id,
        title: bookmark.title,
        url: bookmark.url,
        folderName,
        lastAccessedAt: lastAccessed,
        createdAt: created,
        daysSinceAccess,
      };
    });
  }

  /**
   * 生成巡检建议
   */
  private generateRecommendations(
    baseAnalysis: LibrarianAnalysis,
    brokenLinks: BrokenLink[],
    staleBookmarks: StaleBookmark[],
  ): PatrolRecommendation[] {
    const recommendations: PatrolRecommendation[] = [];

    // 重复文件夹建议
    for (const group of baseAnalysis.duplicateFolders) {
      recommendations.push({
        type: "merge",
        priority: "high",
        title: `合并相似文件夹`,
        description: `「${group.folders.map((f) => f.name).join("」和「")}」内容高度相似，建议合并为「${group.suggestedMerge}」`,
        affectedItems: group.folders.length,
      });
    }

    // 空文件夹建议
    if (baseAnalysis.emptyFolders.length > 0) {
      recommendations.push({
        type: "delete",
        priority: "medium",
        title: `清理空文件夹`,
        description: `有 ${baseAnalysis.emptyFolders.length} 个空文件夹可以删除`,
        affectedItems: baseAnalysis.emptyFolders.length,
      });
    }

    // 失效链接建议
    if (brokenLinks.length > 0) {
      recommendations.push({
        type: "fix_link",
        priority: "high",
        title: `修复失效链接`,
        description: `发现 ${brokenLinks.length} 个失效链接，建议删除或更新`,
        affectedItems: brokenLinks.length,
      });
    }

    // 长期未访问建议
    if (staleBookmarks.length > 0) {
      recommendations.push({
        type: "archive",
        priority: "low",
        title: `整理陈旧书签`,
        description: `有 ${staleBookmarks.length} 个书签超过 ${this.config.staleDaysThreshold} 天未访问，建议归档或删除`,
        affectedItems: staleBookmarks.length,
      });
    }

    // 缺失分类建议
    for (const missing of baseAnalysis.missingCategories) {
      recommendations.push({
        type: "organize",
        priority: "medium",
        title: `创建「${missing.category}」文件夹`,
        description: missing.reason,
        affectedItems: missing.bookmarkCount,
      });
    }

    // 按优先级排序
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return recommendations.sort(
      (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority],
    );
  }

  /**
   * 计算综合评分
   */
  private calculateOverallScore(
    baseAnalysis: LibrarianAnalysis,
    brokenLinks: BrokenLink[],
    staleBookmarks: StaleBookmark[],
  ): number {
    let score = baseAnalysis.healthScore;

    // 失效链接扣分（每个 -3）
    score -= brokenLinks.length * 3;

    // 长期未访问扣分（每个 -1）
    score -= staleBookmarks.length * 1;

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  /**
   * 保存报告
   */
  private async saveReport(report: PatrolReport): Promise<void> {
    try {
      await this.supabase.from("patrol_reports").insert({
        id: report.reportId,
        user_id: report.userId,
        overall_score: report.overallScore,
        total_issues: report.totalIssues,
        broken_links_count: report.brokenLinks.length,
        stale_bookmarks_count: report.staleBookmarks.length,
        report_data: {
          baseAnalysis: {
            healthScore: report.baseAnalysis.healthScore,
            totalSuggestions: report.baseAnalysis.totalSuggestions,
          },
          brokenLinks: report.brokenLinks,
          staleBookmarks: report.staleBookmarks,
          topRecommendations: report.topRecommendations,
          comparison: report.comparison,
        } as unknown as Json,
        report_period: report.reportPeriod,
        generated_at: report.generatedAt.toISOString(),
      });
    } catch (error) {
      logger.warn(
        { error: error instanceof Error ? error.message : String(error) },
        "Failed to save patrol report",
      );
    }
  }

  /**
   * 获取上次报告
   */
  private async getLastReport(userId: string): Promise<PatrolReport | null> {
    const { data, error } = await this.supabase
      .from("patrol_reports")
      .select("*")
      .eq("user_id", userId)
      .order("generated_at", { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      return null;
    }

    return {
      reportId: data.id,
      userId: data.user_id,
      overallScore: data.overall_score,
      totalIssues: data.total_issues,
      generatedAt: new Date(data.generated_at),
      reportPeriod: data.report_period as "weekly" | "biweekly" | "monthly",
      baseAnalysis: {
        healthScore: (data.report_data as Record<string, unknown>)?.baseAnalysis
          ? (
              (data.report_data as Record<string, unknown>).baseAnalysis as {
                healthScore: number;
              }
            ).healthScore
          : 0,
        totalSuggestions: (data.report_data as Record<string, unknown>)
          ?.baseAnalysis
          ? (
              (data.report_data as Record<string, unknown>).baseAnalysis as {
                totalSuggestions: number;
              }
            ).totalSuggestions
          : 0,
        duplicateFolders: [],
        emptyFolders: [],
        oversizedFolders: [],
        poorlyNamedFolders: [],
        missingCategories: [],
        analyzedAt: new Date(data.generated_at),
      },
      brokenLinks:
        ((data.report_data as Record<string, unknown>)
          ?.brokenLinks as BrokenLink[]) || [],
      staleBookmarks:
        ((data.report_data as Record<string, unknown>)
          ?.staleBookmarks as StaleBookmark[]) || [],
      topRecommendations:
        ((data.report_data as Record<string, unknown>)
          ?.topRecommendations as PatrolRecommendation[]) || [],
      comparison: (data.report_data as Record<string, unknown>)
        ?.comparison as PatrolReport["comparison"],
    };
  }

  /**
   * 获取用户最新报告
   */
  async getUserReport(userId: string): Promise<PatrolReport | null> {
    return this.getLastReport(userId);
  }
}

/**
 * 工厂函数
 */
export function createLibrarianPatrolService(
  supabase: SupabaseClient<Database>,
  config?: Partial<PatrolConfig>,
): LibrarianPatrolService {
  return new LibrarianPatrolService(supabase, config);
}
