/**
 * ContentChangeMonitorSkill 类型定义
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

import type { CheckInterval } from "@/lib/monitor/constants";

// ============================================
// 操作类型
// ============================================

/**
 * 监控操作类型
 */
export type MonitorAction =
  | "create" // 创建监控
  | "list" // 列出监控
  | "status" // 查看状态
  | "pause" // 暂停监控
  | "resume" // 恢复监控
  | "delete"; // 删除监控

/**
 * 监控状态
 */
export type MonitorStatus =
  | "active" // 运行中
  | "paused" // 已暂停
  | "failed" // 失败（连续失败超限）
  | "deleted"; // 已删除（软删除）

// ============================================
// 输入/输出类型
// ============================================

/**
 * Skill 输入参数
 */
export interface ContentMonitorInput {
  /** 操作类型 */
  action: MonitorAction;
  /** 书签 ID（创建/状态查询时使用） */
  bookmarkId?: number;
  /** 监控 ID（状态/暂停/恢复/删除时使用） */
  monitorId?: number;
  /** 检查频率 */
  checkInterval?: CheckInterval;
  /** 自定义间隔小时数（仅 custom 模式） */
  customIntervalHours?: number;
  /** 是否启用通知 */
  notificationEnabled?: boolean;
}

/**
 * Skill 输出结果
 */
export interface ContentMonitorOutput {
  /** 执行的操作类型 */
  action: string;
  /** 操作是否成功 */
  success: boolean;
  /** 监控列表（list 操作） */
  monitors?: MonitorInfo[];
  /** 单个监控信息（create/status 操作） */
  monitor?: MonitorInfo;
  /** 统计信息 */
  stats?: MonitorStats;
  /** 检查日志（status 操作） */
  logs?: CheckLog[];
  /** 用户可读的结果消息 */
  message: string;
  /** 后续操作建议 */
  suggestions?: string[];
}

// ============================================
// 监控信息类型
// ============================================

/**
 * 监控基本信息
 */
export interface MonitorInfo {
  /** 监控 ID */
  id: number;
  /** 关联的书签 ID */
  bookmarkId: number;
  /** 书签标题 */
  bookmarkTitle: string;
  /** 书签 URL */
  bookmarkUrl?: string;
  /** 检查频率 */
  checkInterval: CheckInterval;
  /** 监控状态 */
  status: MonitorStatus;
  /** 内容变更次数 */
  changeCount: number;
  /** 上次检查时间 */
  lastCheckedAt?: string;
  /** 下次检查时间 */
  nextCheckAt?: string;
  /** 连续失败次数 */
  consecutiveFailures?: number;
  /** 最后一次错误消息 */
  lastErrorMessage?: string;
  /** 创建时间 */
  createdAt?: string;
}

/**
 * 监控统计信息
 */
export interface MonitorStats {
  /** 总监控数 */
  total: number;
  /** 活跃监控数 */
  active: number;
  /** 已暂停数 */
  paused: number;
  /** 失败数 */
  failed: number;
  /** 已用配额 */
  quotaUsed: number;
  /** 配额上限 */
  quotaMax: number;
}

/**
 * 检查日志条目
 */
export interface CheckLog {
  /** 日志 ID */
  id: number;
  /** 检查结果 */
  result: CheckResult;
  /** 检查时间 */
  checkedAt: string;
  /** 相似度分数（0-100） */
  similarityScore?: number;
  /** 变更摘要 */
  changeSummary?: string;
}

/**
 * 检查结果类型
 */
export type CheckResult =
  | "no_change" // 无变化
  | "changed" // 有变化
  | "error" // 检查失败
  | "timeout"; // 超时

// ============================================
// 配额相关类型
// ============================================

/**
 * 用户配额信息
 */
export interface MonitorQuota {
  /** 已使用数量 */
  used: number;
  /** 最大配额 */
  max: number;
  /** 是否可以创建新监控 */
  canCreate: boolean;
  /** 会员类型 */
  membershipType: "FREE" | "PRO";
}

// ============================================
// 数据库实体类型（与 Supabase 表结构对应）
// ============================================

/**
 * page_monitors 表记录
 */
export interface PageMonitorRow {
  id: number;
  user_id: string;
  bookmark_id: number;
  check_interval: string;
  custom_interval_hours: number | null;
  status: string;
  change_count: number;
  last_checked_at: string | null;
  next_check_at: string | null;
  consecutive_failures: number;
  last_error_message: string | null;
  notification_enabled: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * monitor_check_logs 表记录
 */
export interface MonitorCheckLogRow {
  id: number;
  monitor_id: number;
  check_result: string;
  checked_at: string;
  similarity_score: number | null;
  change_summary: string | null;
  snapshot_id: number | null;
  error_message: string | null;
  created_at: string;
}
