/**
 * ContentChangeMonitorSkill - 内容变更监控 Skill
 *
 * 功能：
 * - 设置页面变更监控
 * - 查看监控状态和历史
 * - 管理监控配置
 *
 * 执行流程：
 * 1. 解析用户监控需求
 * 2. 检查配额和权限
 * 3. 配置监控参数
 * 4. 创建/更新监控
 * 5. 输出配置结果
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

import { z } from "zod";
import { OrchestrationSkill } from "../../orchestration/orchestration-skill";
import type { OrchestrationContext } from "../../orchestration/types";
import type { OrchestrationStreamChunk } from "../../output/types";
import type { SkillContext } from "../../core/types";
import type { OrchestrationSkillMetadata } from "../../orchestration/types";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import {
  MONITOR_QUOTA,
  CHECK_INTERVAL_LABELS,
  CHECK_INTERVAL_HOURS,
  type CheckInterval,
} from "@/lib/monitor/constants";
import type {
  ContentMonitorInput,
  ContentMonitorOutput,
  MonitorAction,
  MonitorStatus,
  MonitorInfo,
  MonitorStats,
  CheckLog,
} from "./types";

// ============================================
// Schema 定义
// ============================================

const ContentMonitorInputSchema = z.object({
  action: z
    .enum(["create", "list", "status", "pause", "resume", "delete"])
    .default("list")
    .describe("操作类型"),
  bookmarkId: z.number().int().positive().optional().describe("书签 ID"),
  monitorId: z.number().int().positive().optional().describe("监控 ID"),
  checkInterval: z
    .enum(["every_6h", "twice_daily", "daily", "weekly", "custom"])
    .optional()
    .describe("检查频率"),
  customIntervalHours: z
    .number()
    .int()
    .min(1)
    .max(168)
    .optional()
    .describe("自定义间隔小时数"),
  notificationEnabled: z.boolean().optional().describe("是否启用通知"),
});

const ContentMonitorOutputSchema = z.object({
  action: z.string(),
  success: z.boolean(),
  monitors: z.array(z.any()).optional(),
  monitor: z.any().optional(),
  stats: z.any().optional(),
  logs: z.array(z.any()).optional(),
  message: z.string(),
  suggestions: z.array(z.string()).optional(),
});

// ============================================
// 步骤定义
// ============================================

const MONITOR_STEPS = [
  {
    id: "parse",
    name: "解析请求",
    description: "解析监控操作请求",
    weight: 10,
  },
  {
    id: "check",
    name: "检查配额",
    description: "检查用户配额和权限",
    weight: 20,
  },
  {
    id: "execute",
    name: "执行操作",
    description: "执行监控操作",
    weight: 50,
  },
  {
    id: "report",
    name: "生成报告",
    description: "生成操作结果报告",
    weight: 15,
  },
  {
    id: "deliver",
    name: "输出结果",
    description: "输出监控状态",
    weight: 5,
  },
];

// ============================================
// ContentChangeMonitorSkill 实现
// ============================================

export class ContentChangeMonitorSkill extends OrchestrationSkill<
  ContentMonitorInput,
  ContentMonitorOutput
> {
  readonly metadata: OrchestrationSkillMetadata = {
    id: "content_change_monitor",
    name: "内容变更监控",
    description:
      "监控重要页面的内容变化，自动对比并通知您。支持设置检查频率、查看变更历史、管理监控列表。",
    category: "utility",
    version: "1.0.0",
    author: "AnyKeep",
    capabilities: [
      "page-monitoring",
      "change-detection",
      "notification",
      "history-tracking",
    ],
    requiresConfirmation: false,
    estimatedDurationMs: 5000,
    maxExecutionTimeMs: 30000,
    deliverableTypes: ["report", "list"],
    outputFormats: ["markdown", "json"],
    steps: MONITOR_STEPS,
  };

  readonly inputSchema = ContentMonitorInputSchema;
  readonly outputSchema = ContentMonitorOutputSchema;

  /**
   * 解析自然语言输入
   */
  async parseInput(
    message: string,
    context: OrchestrationContext,
  ): Promise<ContentMonitorInput> {
    // 解析操作类型
    let action: MonitorAction = "list";

    if (/监控(这个|这篇|该)|添加监控|设置监控|开始监控/.test(message)) {
      action = "create";
    } else if (/监控(状态|详情|信息)/.test(message)) {
      action = "status";
    } else if (/暂停监控|停止监控/.test(message)) {
      action = "pause";
    } else if (/恢复监控|继续监控|重新监控/.test(message)) {
      action = "resume";
    } else if (/取消监控|删除监控|移除监控/.test(message)) {
      action = "delete";
    } else if (/监控列表|有哪些监控|我的监控/.test(message)) {
      action = "list";
    }

    // 解析检查频率
    let checkInterval: CheckInterval | undefined;
    if (/每天|日检|daily/.test(message)) {
      checkInterval = "daily";
    } else if (/每周|周检|weekly/.test(message)) {
      checkInterval = "weekly";
    } else if (/6小时|六小时|every_6h/.test(message)) {
      checkInterval = "every_6h";
    } else if (/每天两次|twice_daily/.test(message)) {
      checkInterval = "twice_daily";
    }

    // 获取当前选中的书签 ID（如果有）
    const selectedBookmarkId = context.bookmarkIds?.[0];

    return {
      action,
      bookmarkId: selectedBookmarkId,
      checkInterval: checkInterval || "daily",
      notificationEnabled: true,
    };
  }

  /**
   * 流式执行监控操作
   */
  async *executeStream(
    context: OrchestrationContext,
  ): AsyncGenerator<OrchestrationStreamChunk> {
    const startTime = Date.now();
    const input = context.params as ContentMonitorInput;

    this.initProgress(MONITOR_STEPS);

    try {
      // Step 1: 解析请求
      yield* this.reportProgress("解析请求", 10, "正在解析您的请求...");

      const actionLabels: Record<MonitorAction, string> = {
        create: "创建监控",
        list: "查看监控列表",
        status: "查看监控状态",
        pause: "暂停监控",
        resume: "恢复监控",
        delete: "删除监控",
      };

      yield* this.emitText(`📡 ${actionLabels[input.action]}...\n\n`);

      // Step 2: 检查配额
      yield* this.reportProgress("检查配额", 20, "正在检查用户配额...");

      const quota = await this.checkQuota(context.userId);

      yield* this.reportProgress(
        "检查配额",
        30,
        `配额：${quota.used}/${quota.max}`,
      );

      // Step 3: 执行操作
      yield* this.reportProgress("执行操作", 40, "正在执行操作...");

      let output: ContentMonitorOutput;

      switch (input.action) {
        case "create":
          output = await this.createMonitor(context.userId, input, quota);
          break;
        case "list":
          output = await this.listMonitors(context.userId);
          break;
        case "status":
          output = await this.getMonitorStatus(context.userId, input);
          break;
        case "pause":
          output = await this.pauseMonitor(context.userId, input);
          break;
        case "resume":
          output = await this.resumeMonitor(context.userId, input);
          break;
        case "delete":
          output = await this.deleteMonitor(context.userId, input);
          break;
        default:
          output = await this.listMonitors(context.userId);
      }

      yield* this.reportProgress("执行操作", 80, "操作完成");

      // Step 4: 生成报告
      yield* this.reportProgress("生成报告", 90, "正在生成报告...");

      // 输出结果文本
      yield* this.emitText(output.message + "\n\n");

      if (output.monitors && output.monitors.length > 0) {
        yield* this.emitText("### 📋 监控列表\n\n");
        for (const monitor of output.monitors) {
          const statusEmoji = this.getStatusEmoji(monitor.status);
          yield* this.emitText(
            `${statusEmoji} **${monitor.bookmarkTitle}**\n` +
              `  - 检查频率：${CHECK_INTERVAL_LABELS[monitor.checkInterval as CheckInterval]}\n` +
              `  - 状态：${this.getStatusLabel(monitor.status)}\n` +
              `  - 变更次数：${monitor.changeCount}\n\n`,
          );
        }
      }

      if (output.stats) {
        yield* this.emitText("### 📊 统计信息\n\n");
        yield* this.emitText(
          `- 总监控数：${output.stats.total}\n` +
            `- 活跃监控：${output.stats.active}\n` +
            `- 已暂停：${output.stats.paused}\n` +
            `- 配额使用：${output.stats.quotaUsed}/${output.stats.quotaMax}\n\n`,
        );
      }

      // Step 5: 输出交付物
      yield* this.reportProgress("输出结果", 95, "正在输出结果...");

      const deliverable = this.createDeliverable(
        "report",
        "监控状态报告",
        output,
        "markdown",
        {
          downloadable: false,
          shareable: false,
          metadata: {
            action: input.action,
            generatedAt: new Date().toISOString(),
          },
        },
      );

      yield* this.emitDeliverable(deliverable);

      // 输出建议
      if (output.suggestions && output.suggestions.length > 0) {
        yield* this.emitSuggestions(
          output.suggestions.map((s, i) => ({
            text: s,
            action: "monitor",
            params: { suggestion: i },
            icon: "💡",
          })),
        );
      }

      yield* this.reportProgress("完成", 100, "操作完成");
      yield* this.emitDone(output.success, output.message);

      logger.info(
        {
          skillId: this.metadata.id,
          userId: context.userId,
          action: input.action,
          success: output.success,
          durationMs: Date.now() - startTime,
        },
        "ContentChangeMonitorSkill: Execution completed",
      );
    } catch (error) {
      logger.error(
        {
          skillId: this.metadata.id,
          userId: context.userId,
          error: error instanceof Error ? error.message : String(error),
        },
        "ContentChangeMonitorSkill: Execution failed",
      );

      yield* this.emitError(
        error instanceof Error ? error.message : "监控操作失败",
        "EXECUTION_ERROR",
        true,
      );
      yield* this.emitDone(false, "监控操作失败");
    }
  }

  /**
   * 检查用户配额
   */
  private async checkQuota(
    userId: string,
  ): Promise<{
    used: number;
    max: number;
    canCreate: boolean;
    membershipType: string;
  }> {
    const supabase = await createClient();

    // 获取用户会员类型
    const { data: profile } = await supabase
      .from("profiles")
      .select("membership_type")
      .eq("id", userId)
      .single();

    const membershipType = profile?.membership_type || "FREE";
    const quotaConfig =
      membershipType === "PRO" ? MONITOR_QUOTA.PRO : MONITOR_QUOTA.FREE;

    // 获取当前监控数量（表类型尚未生成，使用类型断言）
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count } = await (supabase as any)
      .from("page_monitors")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .neq("status", "deleted");

    const used = count || 0;
    const max = quotaConfig.maxCount;

    return {
      used,
      max,
      canCreate: used < max,
      membershipType,
    };
  }

  /**
   * 创建监控
   */
  private async createMonitor(
    userId: string,
    input: ContentMonitorInput,
    quota: {
      used: number;
      max: number;
      canCreate: boolean;
      membershipType: string;
    },
  ): Promise<ContentMonitorOutput> {
    if (!input.bookmarkId) {
      return {
        action: "create",
        success: false,
        message: "请指定要监控的书签",
        suggestions: ["选择一个书签后再设置监控"],
      };
    }

    if (!quota.canCreate) {
      return {
        action: "create",
        success: false,
        message: `监控配额已达上限（${quota.used}/${quota.max}）`,
        suggestions:
          quota.membershipType === "FREE"
            ? ["升级到 Pro 会员可监控更多页面", "删除不需要的监控腾出配额"]
            : ["删除不需要的监控腾出配额"],
      };
    }

    // 检查检查频率权限
    const quotaConfig =
      quota.membershipType === "PRO" ? MONITOR_QUOTA.PRO : MONITOR_QUOTA.FREE;

    const interval = input.checkInterval || "daily";
    if (!quotaConfig.allowedIntervals.includes(interval)) {
      return {
        action: "create",
        success: false,
        message: `当前会员等级不支持"${CHECK_INTERVAL_LABELS[interval]}"检查频率`,
        suggestions: ["升级到 Pro 会员解锁更高频率", "使用每天或每周检查频率"],
      };
    }

    const supabase = await createClient();

    // 检查书签是否存在
    const { data: bookmark } = await supabase
      .from("bookmarks")
      .select("id, title, url")
      .eq("id", input.bookmarkId)
      .eq("user_id", userId)
      .single();

    if (!bookmark) {
      return {
        action: "create",
        success: false,
        message: "书签不存在或无权访问",
      };
    }

    // 检查是否已有监控（表类型尚未生成）
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existingMonitor } = await (supabase as any)
      .from("page_monitors")
      .select("id, status")
      .eq("bookmark_id", input.bookmarkId)
      .eq("user_id", userId)
      .single();

    if (existingMonitor) {
      return {
        action: "create",
        success: false,
        message: `该书签已有监控配置（状态：${this.getStatusLabel(existingMonitor.status as MonitorStatus)}）`,
        suggestions:
          existingMonitor.status === "paused"
            ? ["恢复已暂停的监控"]
            : ["查看现有监控状态"],
      };
    }

    // 计算下次检查时间
    const intervalHours =
      input.checkInterval === "custom" && input.customIntervalHours
        ? input.customIntervalHours
        : CHECK_INTERVAL_HOURS[interval];
    const nextCheckAt = new Date(Date.now() + intervalHours * 60 * 60 * 1000);

    // 创建监控（表类型尚未生成）
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: newMonitor, error } = await (supabase as any)
      .from("page_monitors")
      .insert({
        user_id: userId,
        bookmark_id: input.bookmarkId,
        check_interval: interval,
        custom_interval_hours:
          input.checkInterval === "custom" ? input.customIntervalHours : null,
        next_check_at: nextCheckAt.toISOString(),
        notification_enabled: input.notificationEnabled ?? true,
        status: "active",
      })
      .select()
      .single();

    if (error) {
      logger.error({ error }, "Failed to create monitor");
      return {
        action: "create",
        success: false,
        message: `创建监控失败：${error.message}`,
      };
    }

    return {
      action: "create",
      success: true,
      monitor: {
        id: newMonitor.id,
        bookmarkId: bookmark.id,
        bookmarkTitle: bookmark.title,
        checkInterval: interval,
        status: "active" as MonitorStatus,
        changeCount: 0,
        nextCheckAt: nextCheckAt.toISOString(),
      },
      message: `✅ 已开始监控「${bookmark.title}」\n检查频率：${CHECK_INTERVAL_LABELS[interval]}`,
      suggestions: ["查看监控列表", "设置其他页面的监控"],
    };
  }

  /**
   * 列出所有监控
   */
  private async listMonitors(userId: string): Promise<ContentMonitorOutput> {
    const supabase = await createClient();

    // 表类型尚未生成，使用类型断言
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: monitors, error } = await (supabase as any)
      .from("page_monitors")
      .select(
        `
        id,
        bookmark_id,
        check_interval,
        status,
        change_count,
        last_checked_at,
        next_check_at,
        created_at,
        bookmarks!inner (
          id,
          title,
          url
        )
      `,
      )
      .eq("user_id", userId)
      .neq("status", "deleted")
      .order("created_at", { ascending: false });

    if (error) {
      logger.error({ error }, "Failed to list monitors");
      return {
        action: "list",
        success: false,
        message: `获取监控列表失败：${error.message}`,
      };
    }

    const quota = await this.checkQuota(userId);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const monitorList: MonitorInfo[] = (monitors || []).map((m: any) => {
      const bookmark = m.bookmarks as {
        id: number;
        title: string;
        url: string;
      };
      return {
        id: m.id,
        bookmarkId: bookmark.id,
        bookmarkTitle: bookmark.title || "未命名",
        bookmarkUrl: bookmark.url,
        checkInterval: m.check_interval as CheckInterval,
        status: m.status as MonitorStatus,
        changeCount: m.change_count,
        lastCheckedAt: m.last_checked_at,
        nextCheckAt: m.next_check_at,
        createdAt: m.created_at,
      };
    });

    const stats: MonitorStats = {
      total: monitorList.length,
      active: monitorList.filter((m) => m.status === "active").length,
      paused: monitorList.filter((m) => m.status === "paused").length,
      failed: monitorList.filter((m) => m.status === "failed").length,
      quotaUsed: quota.used,
      quotaMax: quota.max,
    };

    return {
      action: "list",
      success: true,
      monitors: monitorList,
      stats,
      message:
        monitorList.length > 0
          ? `您有 ${monitorList.length} 个页面监控`
          : "您还没有设置任何页面监控",
      suggestions:
        monitorList.length === 0
          ? ["选择一个书签并设置监控"]
          : ["查看监控详情", "调整监控设置"],
    };
  }

  /**
   * 获取监控状态
   */
  private async getMonitorStatus(
    userId: string,
    input: ContentMonitorInput,
  ): Promise<ContentMonitorOutput> {
    const supabase = await createClient();

    const monitorId = input.monitorId || input.bookmarkId;
    if (!monitorId) {
      return {
        action: "status",
        success: false,
        message: "请指定要查看的监控",
      };
    }

    // 表类型尚未生成，使用类型断言
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase as any)
      .from("page_monitors")
      .select(
        `
        id,
        bookmark_id,
        check_interval,
        status,
        change_count,
        last_checked_at,
        next_check_at,
        consecutive_failures,
        last_error_message,
        created_at,
        bookmarks!inner (
          id,
          title,
          url
        )
      `,
      )
      .eq("user_id", userId);

    if (input.monitorId) {
      query = query.eq("id", input.monitorId);
    } else {
      query = query.eq("bookmark_id", input.bookmarkId);
    }

    const { data: monitor, error } = await query.single();

    if (error || !monitor) {
      return {
        action: "status",
        success: false,
        message: "监控不存在或无权访问",
      };
    }

    // 获取最近的检查日志（表类型尚未生成）
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: logs } = await (supabase as any)
      .from("monitor_check_logs")
      .select("id, check_result, checked_at, similarity_score, change_summary")
      .eq("monitor_id", monitor.id)
      .order("checked_at", { ascending: false })
      .limit(10);

    const bookmark = monitor.bookmarks as {
      id: number;
      title: string;
      url: string;
    };

    const monitorInfo: MonitorInfo = {
      id: monitor.id,
      bookmarkId: bookmark.id,
      bookmarkTitle: bookmark.title || "未命名",
      bookmarkUrl: bookmark.url,
      checkInterval: monitor.check_interval as CheckInterval,
      status: monitor.status as MonitorStatus,
      changeCount: monitor.change_count,
      lastCheckedAt: monitor.last_checked_at,
      nextCheckAt: monitor.next_check_at,
      consecutiveFailures: monitor.consecutive_failures,
      lastErrorMessage: monitor.last_error_message,
      createdAt: monitor.created_at,
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const checkLogs: CheckLog[] = (logs || []).map((l: any) => ({
      id: l.id,
      result: l.check_result,
      checkedAt: l.checked_at,
      similarityScore: l.similarity_score,
      changeSummary: l.change_summary,
    }));

    return {
      action: "status",
      success: true,
      monitor: monitorInfo,
      logs: checkLogs,
      message:
        `📡 「${bookmark.title}」监控状态\n` +
        `状态：${this.getStatusLabel(monitorInfo.status)}\n` +
        `检查频率：${CHECK_INTERVAL_LABELS[monitorInfo.checkInterval]}\n` +
        `内容变更：${monitorInfo.changeCount} 次`,
      suggestions:
        monitorInfo.status === "failed"
          ? ["恢复监控", "删除监控"]
          : ["调整检查频率", "暂停监控"],
    };
  }

  /**
   * 暂停监控
   */
  private async pauseMonitor(
    userId: string,
    input: ContentMonitorInput,
  ): Promise<ContentMonitorOutput> {
    const supabase = await createClient();

    const monitorId = input.monitorId || input.bookmarkId;
    if (!monitorId) {
      return {
        action: "pause",
        success: false,
        message: "请指定要暂停的监控",
      };
    }

    // 表类型尚未生成，使用类型断言
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase as any)
      .from("page_monitors")
      .update({ status: "paused" })
      .eq("user_id", userId);

    if (input.monitorId) {
      query = query.eq("id", input.monitorId);
    } else {
      query = query.eq("bookmark_id", input.bookmarkId);
    }

    const { error } = await query;

    if (error) {
      return {
        action: "pause",
        success: false,
        message: `暂停监控失败：${error.message}`,
      };
    }

    return {
      action: "pause",
      success: true,
      message: "✅ 监控已暂停",
      suggestions: ["恢复监控", "删除监控"],
    };
  }

  /**
   * 恢复监控
   */
  private async resumeMonitor(
    userId: string,
    input: ContentMonitorInput,
  ): Promise<ContentMonitorOutput> {
    const supabase = await createClient();

    const monitorId = input.monitorId || input.bookmarkId;
    if (!monitorId) {
      return {
        action: "resume",
        success: false,
        message: "请指定要恢复的监控",
      };
    }

    // 表类型尚未生成，使用类型断言
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase as any)
      .from("page_monitors")
      .update({
        status: "active",
        consecutive_failures: 0,
        last_error_message: null,
      })
      .eq("user_id", userId);

    if (input.monitorId) {
      query = query.eq("id", input.monitorId);
    } else {
      query = query.eq("bookmark_id", input.bookmarkId);
    }

    const { error } = await query;

    if (error) {
      return {
        action: "resume",
        success: false,
        message: `恢复监控失败：${error.message}`,
      };
    }

    return {
      action: "resume",
      success: true,
      message: "✅ 监控已恢复",
      suggestions: ["查看监控状态", "调整检查频率"],
    };
  }

  /**
   * 删除监控
   */
  private async deleteMonitor(
    userId: string,
    input: ContentMonitorInput,
  ): Promise<ContentMonitorOutput> {
    const supabase = await createClient();

    const monitorId = input.monitorId || input.bookmarkId;
    if (!monitorId) {
      return {
        action: "delete",
        success: false,
        message: "请指定要删除的监控",
      };
    }

    // 表类型尚未生成，使用类型断言
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase as any)
      .from("page_monitors")
      .update({ status: "deleted" })
      .eq("user_id", userId);

    if (input.monitorId) {
      query = query.eq("id", input.monitorId);
    } else {
      query = query.eq("bookmark_id", input.bookmarkId);
    }

    const { error } = await query;

    if (error) {
      return {
        action: "delete",
        success: false,
        message: `删除监控失败：${error.message}`,
      };
    }

    return {
      action: "delete",
      success: true,
      message: "✅ 监控已删除",
      suggestions: ["查看监控列表", "设置新的监控"],
    };
  }

  /**
   * 获取状态表情
   */
  private getStatusEmoji(status: MonitorStatus): string {
    switch (status) {
      case "active":
        return "🟢";
      case "paused":
        return "🟡";
      case "failed":
        return "🔴";
      default:
        return "⚪";
    }
  }

  /**
   * 获取状态标签
   */
  private getStatusLabel(status: MonitorStatus): string {
    switch (status) {
      case "active":
        return "运行中";
      case "paused":
        return "已暂停";
      case "failed":
        return "已失败";
      case "deleted":
        return "已删除";
      default:
        return "未知";
    }
  }

  /**
   * 非流式执行（兼容原子模式）
   */
  protected async executeInternal(
    input: ContentMonitorInput,
    context: SkillContext,
  ): Promise<ContentMonitorOutput> {
    const orchestrationContext: OrchestrationContext = {
      ...context,
      params: input,
    };

    let output: ContentMonitorOutput | undefined;

    for await (const chunk of this.executeStream(orchestrationContext)) {
      if (chunk.type === "deliverable") {
        output = chunk.data.content as ContentMonitorOutput;
      }
    }

    if (!output) {
      throw new Error("监控操作失败");
    }

    return output;
  }
}

// ============================================
// 导出
// ============================================

export const contentChangeMonitorSkill = new ContentChangeMonitorSkill();
