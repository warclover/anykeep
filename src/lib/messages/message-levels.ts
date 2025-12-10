/**
 * 消息分级系统
 * @description 定义消息等级配置和类型到等级的映射
 */

import type { MessageLevel, MessageType } from "./types";

// ============================================
// 等级配置
// ============================================

export interface LevelConfig {
  /** 优先级范围 [min, max] */
  priorityRange: [number, number];
  /** 是否显示 Toast */
  showToast: boolean;
  /** 是否显示 Modal 弹窗 */
  showModal: boolean;
  /** 文字颜色 class */
  color: string;
  /** 背景色 class */
  bgColor: string;
  /** 未读背景色 class */
  unreadBgColor: string;
  /** 指示条颜色 class */
  indicatorColor: string;
  /** 图标名称 */
  icon: string;
}

export const MESSAGE_LEVEL_CONFIG: Record<MessageLevel, LevelConfig> = {
  silent: {
    priorityRange: [1, 3],
    showToast: false,
    showModal: false,
    color: "text-muted-foreground",
    bgColor: "bg-background",
    unreadBgColor: "bg-muted/30",
    indicatorColor: "bg-gray-300",
    icon: "Info",
  },
  normal: {
    priorityRange: [4, 6],
    showToast: true,
    showModal: false,
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-background",
    unreadBgColor: "bg-blue-50/50 dark:bg-blue-950/20",
    indicatorColor: "bg-blue-500",
    icon: "Bell",
  },
  important: {
    priorityRange: [7, 10],
    showToast: true,
    showModal: true,
    color: "text-orange-600 dark:text-orange-400",
    bgColor: "bg-background",
    unreadBgColor: "bg-orange-50/50 dark:bg-orange-950/20",
    indicatorColor: "bg-orange-500",
    icon: "AlertTriangle",
  },
};

// ============================================
// 消息类型到等级的映射
// ============================================

export const MESSAGE_TYPE_LEVELS: Record<MessageType, MessageLevel> = {
  // 静默级别 (L1) - 仅记录，不打扰
  classification_auto: "silent",
  classification_batch: "silent",
  batch_move: "silent",
  batch_delete: "silent",
  batch_tag: "silent",
  batch_restore: "silent",
  bookmark_saved: "silent",
  folder_created: "silent",
  feedback_received: "silent",
  ai_summary_complete: "silent",
  ai_tags_complete: "silent",

  // 普通级别 (L2) - Toast + 记录
  classification_suggest: "normal",
  classification_failed: "normal",
  import_complete: "normal",
  import_partial: "normal",
  bookmark_invalid: "normal",
  bookmark_expired: "normal",
  folder_merged: "normal",
  system_update: "normal",
  feedback_response: "normal",
  ai_processing_failed: "normal",
  // V4.2 新增：AI 文件夹进化相关消息
  folder_auto_created: "normal",
  folder_auto_split: "normal",
  folder_auto_merged: "normal",
  folder_auto_renamed: "normal",
  folder_operation_undone: "normal",
  ai_evolution_report: "normal",

  // 重要级别 (L3) - Modal + Toast + 记录
  import_failed: "important",
  system_announcement: "important",
  system_maintenance: "important",
  quota_warning: "important",
  quota_critical: "important",
  quota_exceeded: "important",
  // V4.2 新增：成本监控
  cost_warning: "important",
  cost_critical: "important",
  cost_daily_exceeded: "important",
};

// ============================================
// 视觉样式配置
// ============================================

export interface VisualStyle {
  /** 左侧指示条颜色 */
  indicator: string;
  /** 图标颜色 */
  icon: string;
  /** 标题颜色 */
  title: string;
  /** 已读背景色 */
  background: string;
  /** 未读背景色 */
  unreadBg: string;
}

export const MESSAGE_VISUAL_STYLES: Record<
  MessageLevel | "critical",
  VisualStyle
> = {
  silent: {
    indicator: "bg-gray-300 dark:bg-gray-600",
    icon: "text-gray-400 dark:text-gray-500",
    title: "text-gray-600 dark:text-gray-400",
    background: "bg-background",
    unreadBg: "bg-muted/30",
  },
  normal: {
    indicator: "bg-blue-500",
    icon: "text-blue-500 dark:text-blue-400",
    title: "text-foreground",
    background: "bg-background",
    unreadBg: "bg-blue-50/50 dark:bg-blue-950/20",
  },
  important: {
    indicator: "bg-orange-500",
    icon: "text-orange-500 dark:text-orange-400",
    title: "text-foreground font-medium",
    background: "bg-background",
    unreadBg: "bg-orange-50/50 dark:bg-orange-950/20",
  },
  // 紧急消息（quota_critical, quota_exceeded）
  critical: {
    indicator: "bg-red-500",
    icon: "text-red-500 dark:text-red-400",
    title: "text-red-700 dark:text-red-400 font-semibold",
    background: "bg-red-50/30 dark:bg-red-950/20",
    unreadBg: "bg-red-50 dark:bg-red-950/30",
  },
};

// ============================================
// 工具函数
// ============================================

/**
 * 获取消息类型对应的等级
 */
export function getMessageLevel(type: MessageType): MessageLevel {
  return MESSAGE_TYPE_LEVELS[type] || "silent";
}

/**
 * 获取消息等级配置
 */
export function getLevelConfig(level: MessageLevel): LevelConfig {
  return MESSAGE_LEVEL_CONFIG[level];
}

/**
 * 获取消息视觉样式
 */
export function getVisualStyle(
  level: MessageLevel,
  type?: MessageType,
): VisualStyle {
  // 对于 quota_critical 和 quota_exceeded 使用 critical 样式
  if (type === "quota_critical" || type === "quota_exceeded") {
    return MESSAGE_VISUAL_STYLES.critical;
  }
  return MESSAGE_VISUAL_STYLES[level];
}

/**
 * 判断消息是否需要显示 Toast
 */
export function shouldShowToast(level: MessageLevel): boolean {
  return MESSAGE_LEVEL_CONFIG[level].showToast;
}

/**
 * 判断消息是否需要显示 Modal
 */
export function shouldShowModal(level: MessageLevel): boolean {
  return MESSAGE_LEVEL_CONFIG[level].showModal;
}

/**
 * 获取默认优先级
 */
export function getDefaultPriority(level: MessageLevel): number {
  const [min] = MESSAGE_LEVEL_CONFIG[level].priorityRange;
  return min;
}
