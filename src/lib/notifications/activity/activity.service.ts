/**
 * 活动日志服务
 * @description L3 活动日志层 - 历史记录
 * @version 1.0.0
 * @since 2025-12-12
 */

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import type {
  ActivityType,
  ActivityLogItem,
  ActivityLogGroup,
  ActivityResponse,
  MonthlyAIReport,
} from "../types";
import type { Message } from "@/lib/messages";

// ============================================
// 活动日志服务
// ============================================

class ActivityService {
  // ============================================
  // 查询活动日志
  // ============================================

  /**
   * 获取用户活动日志（按日期分组）
   */
  async getActivityLogs(
    userId: string,
    options: {
      type?: ActivityType;
      page?: number;
      limit?: number;
      startDate?: string;
      endDate?: string;
    } = {},
  ): Promise<ActivityResponse> {
    const { type, page = 1, limit = 50, startDate, endDate } = options;
    const offset = (page - 1) * limit;

    try {
      const supabase = await createServerSupabaseClient();

      // 构建查询
      let query = supabase
        .from("user_notifications")
        .select("*", { count: "exact" })
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

      // 类型筛选（映射到旧类型）
      if (type) {
        const oldTypes = this.mapToOldTypes(type);
        query = query.in("type_code", oldTypes);
      }

      // 日期筛选
      if (startDate) {
        query = query.gte("created_at", startDate);
      }
      if (endDate) {
        query = query.lte("created_at", endDate);
      }

      const { data, error, count } = await query;

      if (error) {
        logger.error({ error }, "Failed to fetch activity logs");
        throw error;
      }

      // 转换并按日期分组
      const messages = (data || []) as unknown as Message[];
      const groups = this.groupByDate(messages);

      return {
        groups,
        pagination: {
          page,
          limit,
          total: count || 0,
          hasMore: (count || 0) > offset + limit,
        },
      };
    } catch (error) {
      logger.error({ error }, "ActivityService.getActivityLogs failed");
      throw error;
    }
  }

  /**
   * 获取月度 AI 报告
   */
  async getMonthlyReport(
    userId: string,
    month: string, // YYYY-MM
  ): Promise<MonthlyAIReport | null> {
    try {
      const supabase = await createServerSupabaseClient();

      const startDate = `${month}-01`;
      const endDate = new Date(
        parseInt(month.split("-")[0]),
        parseInt(month.split("-")[1]),
        0,
      )
        .toISOString()
        .split("T")[0];

      // 查询该月的分类统计
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: confirmations } = await (supabase as any)
        .from("pending_confirmations")
        .select("status, suggestion")
        .eq("user_id", userId)
        .gte("created_at", startDate)
        .lte("created_at", endDate);

      // 查询自动分类数量
      const { count: autoClassified } = await supabase
        .from("user_notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("type_code", "ai.classification.auto")
        .gte("created_at", startDate)
        .lte("created_at", endDate);

      // 统计各状态数量
      const stats = {
        confirmed: 0,
        modified: 0,
        rejected: 0,
        expired: 0,
      };

      const folderCounts = new Map<number, { name: string; count: number }>();

      (confirmations || []).forEach(
        (c: { status: string; suggestion: unknown }) => {
          if (c.status === "confirmed") stats.confirmed++;
          else if (c.status === "modified") stats.modified++;
          else if (c.status === "rejected") stats.rejected++;
          else if (c.status === "expired") stats.expired++;

          // 统计文件夹使用
          const suggestion = c.suggestion as {
            folderId?: number;
            folderName?: string;
          };
          if (suggestion?.folderId) {
            const existing = folderCounts.get(suggestion.folderId);
            if (existing) {
              existing.count++;
            } else {
              folderCounts.set(suggestion.folderId, {
                name: suggestion.folderName || "未知文件夹",
                count: 1,
              });
            }
          }
        },
      );

      // 查询新建文件夹数量
      const { count: newFolders } = await supabase
        .from("folders")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .gte("created_at", startDate)
        .lte("created_at", endDate);

      // 计算准确率
      const total = stats.confirmed + stats.modified + stats.rejected;
      const accuracyRate =
        total > 0 ? Math.round((stats.confirmed / total) * 100) : 0;

      // Top 5 文件夹
      const topFolders = Array.from(folderCounts.entries())
        .map(([folderId, data]) => ({
          folderId,
          folderName: data.name,
          count: data.count,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      return {
        month,
        autoClassifiedCount: autoClassified || 0,
        userConfirmedCount: stats.confirmed,
        userModifiedCount: stats.modified,
        userRejectedCount: stats.rejected,
        expiredAutoExecutedCount: stats.expired,
        newFoldersCount: newFolders || 0,
        accuracyRate,
        topFolders,
      };
    } catch (error) {
      logger.error({ error, month }, "Failed to get monthly report");
      return null;
    }
  }

  // ============================================
  // 创建活动日志
  // ============================================

  /**
   * 记录批量操作
   */
  async logBatchOperation(
    userId: string,
    data: {
      action: string;
      count: number;
      bookmarkIds?: number[];
      folderIds?: number[];
      details?: Record<string, unknown>;
    },
  ): Promise<void> {
    try {
      const supabase = await createServerSupabaseClient();

      await supabase.from("user_notifications").insert({
        user_id: userId,
        type_code: "batch.operation",
        priority: "silent",
        title: `${data.action} ${data.count} 条`,
        body: null,
        status: "read", // 活动日志默认已读
        channels: ["in_app"],
        metadata: JSON.parse(
          JSON.stringify({
            action: data.action,
            count: data.count,
            ...data.details,
          }),
        ),
        entity_id:
          data.bookmarkIds?.[0]?.toString() ||
          data.folderIds?.[0]?.toString() ||
          null,
        entity_type: data.bookmarkIds?.[0]
          ? "bookmark"
          : data.folderIds?.[0]
            ? "folder"
            : null,
      });
    } catch (error) {
      logger.error({ error, data }, "Failed to log batch operation");
    }
  }

  /**
   * 记录 AI 报告
   */
  async logAIReport(userId: string, report: MonthlyAIReport): Promise<void> {
    try {
      const supabase = await createServerSupabaseClient();

      const title = `${report.month} AI 整理报告`;
      const content = `本月自动分类 ${report.autoClassifiedCount} 条，准确率 ${report.accuracyRate}%`;

      await supabase.from("user_notifications").insert({
        user_id: userId,
        type_code: "ai.report",
        priority: "normal",
        title,
        body: content,
        status: "unread",
        channels: ["in_app"],
        metadata: JSON.parse(JSON.stringify(report)),
      });
    } catch (error) {
      logger.error({ error }, "Failed to log AI report");
    }
  }

  /**
   * 记录错误日志
   */
  async logError(
    userId: string,
    data: {
      title: string;
      error: string;
      context?: Record<string, unknown>;
    },
  ): Promise<void> {
    try {
      const supabase = await createServerSupabaseClient();

      await supabase.from("user_notifications").insert({
        user_id: userId,
        type_code: "error.log",
        priority: "normal",
        title: data.title,
        body: data.error,
        status: "unread",
        channels: ["in_app"],
        metadata: JSON.parse(JSON.stringify(data.context || {})),
      });
    } catch (error) {
      logger.error({ error, data }, "Failed to log error");
    }
  }

  // ============================================
  // 私有方法
  // ============================================

  /**
   * 将新类型映射到旧类型（用于查询）
   */
  private mapToOldTypes(newType: ActivityType): string[] {
    const mapping: Record<ActivityType, string[]> = {
      batch_operation: [
        "classification_batch",
        "import_complete",
        "import_partial",
        "batch_move",
        "batch_delete",
        "batch_tag",
        "batch_restore",
        "folder_merged",
        "folder_auto_created",
        "folder_auto_split",
        "folder_auto_merged",
        "folder_auto_renamed",
        "folder_operation_undone",
      ],
      ai_report: [
        "ai_summary_complete",
        "ai_tags_complete",
        "ai_evolution_report",
      ],
      system_announcement: [
        "system_announcement",
        "system_maintenance",
        "system_update",
      ],
      quota_alert: [
        "quota_warning",
        "quota_critical",
        "quota_exceeded",
        "cost_warning",
        "cost_critical",
        "cost_daily_exceeded",
      ],
      error_log: [
        "classification_failed",
        "import_failed",
        "bookmark_invalid",
        "bookmark_expired",
        "ai_processing_failed",
      ],
    };
    return mapping[newType] || [newType];
  }

  /**
   * 按日期分组
   */
  private groupByDate(messages: Message[]): ActivityLogGroup[] {
    const groupMap = new Map<string, ActivityLogItem[]>();

    messages.forEach((msg) => {
      const date = new Date(msg.created_at);
      const dateKey = date.toISOString().split("T")[0];

      // 转换 Message 为 ActivityLogItem
      const item: ActivityLogItem = {
        id: msg.id,
        user_id: msg.user_id,
        type: (msg.type as ActivityType) || "batch_operation",
        title: msg.title,
        content: msg.content,
        detail_url: msg.action_url,
        metadata: (msg.metadata as Record<string, unknown>) || {},
        created_at: msg.created_at,
        related_bookmark_ids: msg.related_bookmark_id
          ? [msg.related_bookmark_id]
          : null,
        related_folder_ids: msg.related_folder_id
          ? [msg.related_folder_id]
          : null,
      };

      const existingItems = groupMap.get(dateKey);
      if (existingItems) {
        existingItems.push(item);
      } else {
        groupMap.set(dateKey, [item]);
      }
    });

    // 转换为数组并添加标签
    const today = new Date().toISOString().split("T")[0];
    const yesterday = new Date(Date.now() - 86400000)
      .toISOString()
      .split("T")[0];

    return Array.from(groupMap.entries()).map(([date, items]) => {
      let label: string;
      if (date === today) {
        label = "今天";
      } else if (date === yesterday) {
        label = "昨天";
      } else {
        // 格式化为 "12月10日"
        const d = new Date(date);
        label = `${d.getMonth() + 1}月${d.getDate()}日`;
      }

      return { label, date, items };
    });
  }
}

// ============================================
// 单例导出
// ============================================

export const activityService = new ActivityService();
