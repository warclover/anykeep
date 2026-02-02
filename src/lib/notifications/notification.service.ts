/**
 * 通知服务 - 核心 CRUD 操作
 * @module notifications/service
 */

import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import type { Json } from "@/types/supabase";
import type {
  Notification,
  NotificationPayload,
  NotificationRow,
  NotificationType,
  NotificationTypeRow,
  NotificationCounts,
  NotificationChannel,
  NotificationPriority,
} from "./notification.types";

// ============================================================================
// 错误处理工具
// ============================================================================

/**
 * 🔒 安全修复：将数据库错误转换为用户友好的错误消息
 * 避免暴露数据库结构（表名、列名）等敏感信息
 */
function wrapDatabaseError(error: unknown, operation: string): Error {
  const dbError = error as { code?: string; message?: string };

  // 外键约束违反
  if (dbError.code === "23503") {
    return new Error("通知类型不存在，请联系管理员");
  }

  // 唯一约束违反
  if (dbError.code === "23505") {
    return new Error("操作冲突，请刷新后重试");
  }

  // 连接超时
  if (
    dbError.message?.includes("timeout") ||
    dbError.message?.includes("ETIMEDOUT")
  ) {
    return new Error("网络超时，请稍后重试");
  }

  // 表不存在
  if (dbError.code === "42P01") {
    return new Error("系统配置错误，请联系技术支持");
  }

  // 权限不足
  if (dbError.code === "42501") {
    return new Error("权限不足，请重新登录");
  }

  // 通用错误
  return new Error(`${operation}失败，请稍后重试`);
}

// ============================================================================
// 类型转换工具
// ============================================================================

/** 将数据库行转换为 Notification 对象 */
function mapRowToNotification(row: NotificationRow): Notification {
  return {
    id: row.id,
    userId: row.user_id,
    typeCode: row.type_code,
    channels: row.channels as NotificationChannel[],
    priority: row.priority as NotificationPriority,
    title: row.title,
    body: row.body ?? undefined,
    entityType: row.entity_type as Notification["entityType"],
    entityId: row.entity_id ?? undefined,
    actionUrl: row.action_url ?? undefined,
    actionLabel: row.action_label ?? undefined,
    metadata: row.metadata,
    status: row.status as Notification["status"],
    readAt: row.read_at ?? undefined,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    type: row.notification_types
      ? mapTypeRowToType(row.notification_types)
      : undefined,
  };
}

/** 将数据库行转换为 NotificationType 对象 */
function mapTypeRowToType(row: NotificationTypeRow): NotificationType {
  return {
    code: row.code,
    category: row.category as NotificationType["category"],
    label: row.label,
    icon: row.icon ?? "Bell",
    color: row.color ?? "blue",
    defaultChannels: row.default_channels as NotificationChannel[],
    defaultPriority: row.default_priority as NotificationPriority,
    deprecated: row.deprecated,
  };
}

// ============================================================================
// 通知服务
// ============================================================================

export const NotificationService = {
  // ==========================================================================
  // 发送通知
  // ==========================================================================

  /**
   * 发送单条通知
   */
  async send(payload: NotificationPayload): Promise<Notification> {
    const supabase = await createClient();

    // 1. 获取类型默认配置
    const typeConfig = await this.getTypeConfig(payload.type);

    // 2. 合并默认值
    const channels = payload.channels ??
      typeConfig?.defaultChannels ?? ["inbox"];
    const priority =
      payload.priority ?? typeConfig?.defaultPriority ?? "normal";

    // 3. 插入数据库
    const { data, error } = await supabase
      .from("user_notifications")
      .insert({
        user_id: payload.userId,
        type_code: payload.type,
        title: payload.title,
        body: payload.body,
        channels,
        priority,
        entity_type: payload.entityType,
        entity_id: payload.entityId,
        action_url: payload.actionUrl,
        action_label: payload.actionLabel,
        metadata: (payload.metadata ?? {}) as Json,
      })
      .select("*, notification_types(*)")
      .single();

    if (error) {
      logger.error(
        { error, typeCode: payload.type },
        "[NotificationService] send error",
      );
      throw wrapDatabaseError(error, "发送通知");
    }

    return mapRowToNotification(data as NotificationRow);
  },

  /**
   * 批量发送通知
   * 🔒 性能修复：使用批量查询替代循环查询，解决 N+1 问题
   */
  async sendBatch(payloads: NotificationPayload[]): Promise<Notification[]> {
    if (payloads.length === 0) return [];

    const supabase = await createClient();

    // 🚀 性能优化：一次性查询所有类型配置，避免 N+1 查询
    const typeConfigs = new Map<string, NotificationType>();
    const uniqueTypes = [...new Set(payloads.map((p) => p.type))];

    if (uniqueTypes.length > 0) {
      const { data: typeData, error: typeError } = await supabase
        .from("notification_types")
        .select("*")
        .in("code", uniqueTypes);

      if (!typeError && typeData) {
        for (const row of typeData as NotificationTypeRow[]) {
          typeConfigs.set(row.code, mapTypeRowToType(row));
        }
      }
    }

    // 构建插入数据
    const rows = payloads.map((p) => {
      const typeConfig = typeConfigs.get(p.type);
      return {
        user_id: p.userId,
        type_code: p.type,
        title: p.title,
        body: p.body,
        channels: p.channels ?? typeConfig?.defaultChannels ?? ["inbox"],
        priority: p.priority ?? typeConfig?.defaultPriority ?? "normal",
        entity_type: p.entityType,
        entity_id: p.entityId,
        action_url: p.actionUrl,
        action_label: p.actionLabel,
        metadata: (p.metadata ?? {}) as Json,
      };
    });

    const { data, error } = await supabase
      .from("user_notifications")
      .insert(rows)
      .select("*, notification_types(*)");

    if (error) {
      logger.error(
        { error, count: payloads.length },
        "[NotificationService] sendBatch error",
      );
      throw wrapDatabaseError(error, "批量发送通知");
    }

    return (data as NotificationRow[]).map(mapRowToNotification);
  },

  // ==========================================================================
  // 查询通知
  // ==========================================================================

  /**
   * 获取通知列表
   */
  async list(
    userId: string,
    options: {
      status?: string;
      priority?: string[];
      limit?: number;
      offset?: number;
    } = {},
  ): Promise<Notification[]> {
    const supabase = await createClient();
    const { status, priority, limit = 50, offset = 0 } = options;

    let query = supabase
      .from("user_notifications")
      .select("*, notification_types(*)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (status && status !== "all") {
      query = query.eq("status", status);
    }

    if (priority && priority.length > 0) {
      query = query.in("priority", priority);
    }

    const { data, error } = await query;

    if (error) {
      logger.error({ error, userId }, "[NotificationService] list error");
      throw wrapDatabaseError(error, "获取通知列表");
    }

    return (data as NotificationRow[]).map(mapRowToNotification);
  },

  /**
   * 获取单条通知
   */
  async get(userId: string, id: string): Promise<Notification | null> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("user_notifications")
      .select("*, notification_types(*)")
      .eq("user_id", userId)
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") return null; // Not found
      logger.error({ error, userId, id }, "[NotificationService] get error");
      throw wrapDatabaseError(error, "获取通知详情");
    }

    return mapRowToNotification(data as NotificationRow);
  },

  // ==========================================================================
  // 状态管理
  // ==========================================================================

  /**
   * 标记已读
   */
  async markAsRead(userId: string, ids: string[]): Promise<number> {
    if (ids.length === 0) return 0;

    const supabase = await createClient();

    const { data, error } = await supabase.rpc("mark_notifications_read", {
      p_user_id: userId,
      p_ids: ids,
    });

    if (error) {
      logger.error(
        { error, userId, ids },
        "[NotificationService] markAsRead error",
      );
      throw wrapDatabaseError(error, "标记已读");
    }

    return data as number;
  },

  /**
   * 全部标记已读
   */
  async markAllAsRead(userId: string): Promise<number> {
    const supabase = await createClient();

    const { data, error } = await supabase.rpc("mark_all_notifications_read", {
      p_user_id: userId,
    });

    if (error) {
      logger.error(
        { error, userId },
        "[NotificationService] markAllAsRead error",
      );
      throw wrapDatabaseError(error, "全部标记已读");
    }

    return data as number;
  },

  /**
   * 归档通知
   */
  async archive(userId: string, id: string): Promise<void> {
    const supabase = await createClient();

    const { error } = await supabase
      .from("user_notifications")
      .update({ status: "archived" })
      .eq("user_id", userId)
      .eq("id", id);

    if (error) {
      logger.error(
        { error, userId, id },
        "[NotificationService] archive error",
      );
      throw wrapDatabaseError(error, "归档通知");
    }
  },

  /**
   * 删除通知
   */
  async delete(userId: string, id: string): Promise<void> {
    const supabase = await createClient();

    const { error } = await supabase
      .from("user_notifications")
      .delete()
      .eq("user_id", userId)
      .eq("id", id);

    if (error) {
      logger.error({ error, userId, id }, "[NotificationService] delete error");
      throw wrapDatabaseError(error, "删除通知");
    }
  },

  /**
   * 批量删除通知
   */
  async deleteBatch(userId: string, ids: string[]): Promise<void> {
    if (ids.length === 0) return;

    const supabase = await createClient();

    const { error } = await supabase
      .from("user_notifications")
      .delete()
      .eq("user_id", userId)
      .in("id", ids);

    if (error) {
      logger.error(
        { error, userId, ids },
        "[NotificationService] deleteBatch error",
      );
      throw wrapDatabaseError(error, "批量删除通知");
    }
  },

  // ==========================================================================
  // 统计
  // ==========================================================================

  /**
   * 获取未读计数
   */
  async getUnreadCounts(userId: string): Promise<NotificationCounts> {
    const supabase = await createClient();

    const { data, error } = await supabase.rpc("get_notification_counts", {
      p_user_id: userId,
    });

    if (error) {
      logger.error(
        { error, userId },
        "[NotificationService] getUnreadCounts error",
      );
      throw wrapDatabaseError(error, "获取未读计数");
    }

    const counts: NotificationCounts = {
      total: 0,
      silent: 0,
      normal: 0,
      important: 0,
      critical: 0,
    };

    for (const row of data as { priority: string; count: number }[]) {
      const key = row.priority as keyof NotificationCounts;
      if (key in counts) {
        counts[key] = row.count;
        counts.total += row.count;
      }
    }

    return counts;
  },

  /**
   * 获取未读总数
   */
  async getUnreadCount(userId: string): Promise<number> {
    const supabase = await createClient();

    const { data, error } = await supabase.rpc(
      "get_unread_notification_count",
      {
        p_user_id: userId,
      },
    );

    if (error) {
      logger.error(
        { error, userId },
        "[NotificationService] getUnreadCount error",
      );
      throw wrapDatabaseError(error, "获取未读总数");
    }

    return (data as number) ?? 0;
  },

  // ==========================================================================
  // 类型配置
  // ==========================================================================

  /**
   * 获取类型配置
   */
  async getTypeConfig(code: string): Promise<NotificationType | null> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("notification_types")
      .select("*")
      .eq("code", code)
      .single();

    if (error) {
      if (error.code === "PGRST116") return null; // Not found
      logger.warn({ error, code }, "[NotificationService] getTypeConfig error");
      return null; // 类型不存在时返回 null，不抛错
    }

    return mapTypeRowToType(data as NotificationTypeRow);
  },

  /**
   * 获取所有类型配置
   */
  async getAllTypeConfigs(): Promise<NotificationType[]> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("notification_types")
      .select("*")
      .eq("deprecated", false)
      .order("category", { ascending: true })
      .order("code", { ascending: true });

    if (error) {
      logger.error({ error }, "[NotificationService] getAllTypeConfigs error");
      throw wrapDatabaseError(error, "获取类型配置列表");
    }

    return (data as NotificationTypeRow[]).map(mapTypeRowToType);
  },
};
