/**
 * 通知快捷方法 - 业务场景封装
 * @module notifications/helpers
 */

import { NotificationService } from "./notification.service";
import type { Notification, NotificationPriority } from "./notification.types";

/**
 * 业务场景快捷通知
 * 使用方式: await Notify.classificationAuto(userId, bookmarkId, folderName)
 */
export const Notify = {
  // ==========================================================================
  // AI 处理类
  // ==========================================================================

  /** 自动分类完成 */
  classificationAuto: (
    userId: string,
    bookmarkId: string,
    folderName: string,
  ): Promise<Notification> =>
    NotificationService.send({
      userId,
      type: "ai.classification.auto",
      title: "自动分类完成",
      body: `已归类到「${folderName}」`,
      entityType: "bookmark",
      entityId: bookmarkId,
      actionUrl: `/bookmarks/${bookmarkId}`,
    }),

  /** 批量分类完成 */
  classificationBatch: (
    userId: string,
    count: number,
    folderName: string,
    folderId?: string,
  ): Promise<Notification> =>
    NotificationService.send({
      userId,
      type: "ai.classification.batch",
      title: "批量分类完成",
      body: `${count} 条内容已归类到「${folderName}」`,
      entityType: "folder",
      entityId: folderId,
      actionUrl: folderId ? `/folders/${folderId}` : "/home",
    }),

  /** 分类失败 */
  classificationFailed: (
    userId: string,
    bookmarkId: string,
    reason: string,
  ): Promise<Notification> =>
    NotificationService.send({
      userId,
      type: "ai.classification.failed",
      title: "分类失败",
      body: reason,
      entityType: "bookmark",
      entityId: bookmarkId,
    }),

  /** AI 摘要生成完成 */
  summaryComplete: (
    userId: string,
    bookmarkId: string,
    title: string,
  ): Promise<Notification> =>
    NotificationService.send({
      userId,
      type: "ai.summary.complete",
      title: "AI 摘要已生成",
      body: title,
      entityType: "bookmark",
      entityId: bookmarkId,
      actionUrl: `/bookmarks/${bookmarkId}`,
    }),

  /** AI 标签生成完成 */
  tagsComplete: (
    userId: string,
    bookmarkId: string,
    tags: string[],
  ): Promise<Notification> =>
    NotificationService.send({
      userId,
      type: "ai.tags.complete",
      title: "AI 标签已生成",
      body: tags.join("、"),
      entityType: "bookmark",
      entityId: bookmarkId,
    }),

  /** AI 处理失败 */
  processingFailed: (
    userId: string,
    bookmarkId: string,
    reason: string,
  ): Promise<Notification> =>
    NotificationService.send({
      userId,
      type: "ai.processing.failed",
      title: "AI 处理失败",
      body: reason,
      entityType: "bookmark",
      entityId: bookmarkId,
    }),

  // ==========================================================================
  // 导入类
  // ==========================================================================

  /** 导入完成 */
  importComplete: (
    userId: string,
    total: number,
    success: number,
    importId?: string,
  ): Promise<Notification> =>
    NotificationService.send({
      userId,
      type: "import.complete",
      title: "导入完成",
      body: `成功导入 ${success}/${total} 条内容`,
      entityType: "import",
      entityId: importId,
      actionUrl: "/home?filter=recent",
      actionLabel: "查看导入",
    }),

  /** 部分导入成功 */
  importPartial: (
    userId: string,
    total: number,
    success: number,
    failed: number,
    importId?: string,
  ): Promise<Notification> =>
    NotificationService.send({
      userId,
      type: "import.partial",
      title: "部分导入成��",
      body: `成功 ${success} 条，失败 ${failed} 条（共 ${total} 条）`,
      entityType: "import",
      entityId: importId,
      actionUrl: "/home?filter=recent",
    }),

  /** 导入失败 */
  importFailed: (userId: string, reason: string): Promise<Notification> =>
    NotificationService.send({
      userId,
      type: "import.failed",
      title: "导入失败",
      body: reason,
      priority: "important",
    }),

  // ==========================================================================
  // 文件夹操作类
  // ==========================================================================

  /** 文件夹已创建 */
  folderCreated: (
    userId: string,
    folderName: string,
    folderId: string,
  ): Promise<Notification> =>
    NotificationService.send({
      userId,
      type: "folder.created",
      title: "文件夹已创建",
      body: `「${folderName}」已创建成功`,
      entityType: "folder",
      entityId: folderId,
      channels: ["toast"],
    }),

  /** AI 创建文件夹 */
  folderAutoCreated: (
    userId: string,
    folderName: string,
    folderId: string,
    reason?: string,
  ): Promise<Notification> =>
    NotificationService.send({
      userId,
      type: "folder.auto_created",
      title: "AI 创建了新文件夹",
      body: reason ?? `「${folderName}���已自动创建`,
      entityType: "folder",
      entityId: folderId,
      actionUrl: `/folders/${folderId}`,
    }),

  /** AI 拆分文件夹 */
  folderAutoSplit: (
    userId: string,
    originalName: string,
    newFolders: string[],
  ): Promise<Notification> =>
    NotificationService.send({
      userId,
      type: "folder.auto_split",
      title: "AI 拆分了文件夹",
      body: `「${originalName}」已拆分为 ${newFolders.length} 个文件夹`,
      metadata: { originalName, newFolders },
    }),

  /** AI 合并文件夹 */
  folderAutoMerged: (
    userId: string,
    mergedFolders: string[],
    targetName: string,
    targetId: string,
  ): Promise<Notification> =>
    NotificationService.send({
      userId,
      type: "folder.auto_merged",
      title: "AI 合并了文件夹",
      body: `${mergedFolders.length} 个文件夹已合并为「${targetName}」`,
      entityType: "folder",
      entityId: targetId,
      actionUrl: `/folders/${targetId}`,
    }),

  /** 文件夹操作已撤销 */
  folderOperationUndone: (
    userId: string,
    operationType: string,
  ): Promise<Notification> =>
    NotificationService.send({
      userId,
      type: "folder.operation_undone",
      title: "操作已撤销",
      body: `${operationType}操作已撤销`,
      channels: ["toast"],
    }),

  // ==========================================================================
  // 配额类
  // ==========================================================================

  /** 配额预警 */
  quotaWarning: (userId: string, percentage: number): Promise<Notification> =>
    NotificationService.send({
      userId,
      type: "quota.warning",
      title: "AI 配额预警",
      body: `当前已使用 ${percentage}%，请及时续费`,
      actionUrl: "/settings/billing",
      actionLabel: "查看配额",
    }),

  /** 配额紧急 */
  quotaCritical: (userId: string, percentage: number): Promise<Notification> =>
    NotificationService.send({
      userId,
      type: "quota.critical",
      title: "AI 配额即将用尽",
      body: `已使用 ${percentage}%，部分功能可能受限`,
      priority: "critical",
      actionUrl: "/settings/billing",
      actionLabel: "立即续费",
    }),

  /** 配额已用尽 */
  quotaExceeded: (userId: string): Promise<Notification> =>
    NotificationService.send({
      userId,
      type: "quota.exceeded",
      title: "AI 配额已用尽",
      body: "AI 功能已暂停，请续费后继续使用",
      priority: "critical",
      actionUrl: "/settings/billing",
      actionLabel: "立即续费",
    }),

  /** 日费用超限 */
  costDailyExceeded: (
    userId: string,
    cost: number,
    limit: number,
  ): Promise<Notification> =>
    NotificationService.send({
      userId,
      type: "cost.daily_exceeded",
      title: "日费用超限",
      body: `今日 AI 费用 ¥${cost.toFixed(2)} 已超过限额 ¥${limit.toFixed(2)}`,
      actionUrl: "/settings/billing",
    }),

  // ==========================================================================
  // 批量操作类
  // ==========================================================================

  /** 批量移动完成 */
  batchMove: (
    userId: string,
    count: number,
    folderName: string,
  ): Promise<Notification> =>
    NotificationService.send({
      userId,
      type: "batch.move",
      title: "批量移动完成",
      body: `${count} 条内容已移动到「${folderName}」`,
    }),

  /** 批量删除完成 */
  batchDelete: (userId: string, count: number): Promise<Notification> =>
    NotificationService.send({
      userId,
      type: "batch.delete",
      title: "批量删除完成",
      body: `${count} 条内容已移至回收站`,
      channels: ["toast"],
    }),

  /** 批量标签完成 */
  batchTag: (
    userId: string,
    count: number,
    tags: string[],
  ): Promise<Notification> =>
    NotificationService.send({
      userId,
      type: "batch.tag",
      title: "批量标签完成",
      body: `${count} 条内容已添加标签：${tags.join("、")}`,
      channels: ["toast"],
    }),

  /** 批量恢复完成 */
  batchRestore: (userId: string, count: number): Promise<Notification> =>
    NotificationService.send({
      userId,
      type: "batch.restore",
      title: "批量恢复完成",
      body: `${count} 条内容已恢复`,
      channels: ["toast"],
    }),

  // ==========================================================================
  // 复习类
  // ==========================================================================

  /** 复习提醒 */
  reviewReminder: (userId: string, count: number): Promise<Notification> =>
    NotificationService.send({
      userId,
      type: "review.reminder",
      title: "今日复习提醒",
      body: `有 ${count} 条内容等待复习`,
      actionUrl: "/brain-sync",
      actionLabel: "开始复习",
    }),

  /** 复习完成 */
  reviewComplete: (
    userId: string,
    count: number,
    streak?: number,
  ): Promise<Notification> =>
    NotificationService.send({
      userId,
      type: "review.complete",
      title: "复习完成",
      body: streak
        ? `今日复习 ${count} 条，已连续 ${streak} 天`
        : `今日复习 ${count} 条`,
    }),

  // ==========================================================================
  // 主题合成类
  // ==========================================================================

  /** 主题合成完成 */
  synthesisComplete: (
    userId: string,
    title: string,
    synthesisId: string,
  ): Promise<Notification> =>
    NotificationService.send({
      userId,
      type: "synthesis.complete",
      title: "主题合成完成",
      body: `「${title}」已生成`,
      entityType: "synthesis",
      entityId: synthesisId,
      actionUrl: `/synthesis/${synthesisId}`,
      actionLabel: "查看合成",
    }),

  /** 主题合成失败 */
  synthesisFailed: (userId: string, reason: string): Promise<Notification> =>
    NotificationService.send({
      userId,
      type: "synthesis.failed",
      title: "主题合成失败",
      body: reason,
    }),

  // ==========================================================================
  // 系统类
  // ==========================================================================

  /** 系统公告 */
  systemAnnouncement: (
    userId: string,
    title: string,
    content: string,
    actionUrl?: string,
  ): Promise<Notification> =>
    NotificationService.send({
      userId,
      type: "system.announcement",
      title,
      body: content,
      actionUrl,
      actionLabel: actionUrl ? "查看详情" : undefined,
    }),

  /** 系统维护通知 */
  systemMaintenance: (
    userId: string,
    startTime: string,
    duration: string,
  ): Promise<Notification> =>
    NotificationService.send({
      userId,
      type: "system.maintenance",
      title: "系统维护通知",
      body: `计划于 ${startTime} 进行系统维护，预计时长 ${duration}`,
    }),

  // ==========================================================================
  // 通用方法
  // ==========================================================================

  /**
   * 发送自定义通知
   */
  custom: (
    userId: string,
    type: string,
    title: string,
    body?: string,
    options?: {
      priority?: NotificationPriority;
      actionUrl?: string;
      actionLabel?: string;
      metadata?: Record<string, unknown>;
    },
  ): Promise<Notification> =>
    NotificationService.send({
      userId,
      type,
      title,
      body,
      ...options,
    }),
};
