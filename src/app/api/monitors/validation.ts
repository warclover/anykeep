/**
 * 监控 API 验证 Schema
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

import { z } from "zod";
import type { CheckInterval } from "@/lib/monitor/constants";

/**
 * 创建监控请求验证
 */
export const createMonitorSchema = z.object({
  bookmarkId: z.number().int().positive("书签 ID 必须为正整数"),
  checkInterval: z
    .enum(["every_6h", "twice_daily", "daily", "weekly", "custom"])
    .default("daily"),
  customIntervalHours: z
    .number()
    .int()
    .min(1, "自定义间隔至少 1 小时")
    .max(720, "自定义间隔最多 30 天")
    .optional(),
  notificationEnabled: z.boolean().default(true),
});

export type CreateMonitorRequest = z.infer<typeof createMonitorSchema>;

/**
 * 更新监控请求验证
 */
export const updateMonitorSchema = z.object({
  checkInterval: z
    .enum(["every_6h", "twice_daily", "daily", "weekly", "custom"])
    .optional(),
  customIntervalHours: z.number().int().min(1).max(720).optional(),
  notificationEnabled: z.boolean().optional(),
});

export type UpdateMonitorRequest = z.infer<typeof updateMonitorSchema>;

/**
 * 监控列表查询参数
 */
export const listMonitorsQuerySchema = z.object({
  status: z
    .enum(["active", "paused", "failed", "all"])
    .optional()
    .default("all"),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

export type ListMonitorsQuery = z.infer<typeof listMonitorsQuerySchema>;

/**
 * 监控响应数据
 */
export interface MonitorResponse {
  id: number;
  bookmarkId: number;
  bookmarkTitle: string;
  bookmarkUrl: string;
  checkInterval: CheckInterval;
  customIntervalHours: number | null;
  status: "active" | "paused" | "failed" | "deleted";
  changeCount: number;
  lastCheckedAt: string | null;
  nextCheckAt: string | null;
  consecutiveFailures: number;
  lastErrorMessage: string | null;
  notificationEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * 监控统计响应
 */
export interface MonitorStatsResponse {
  total: number;
  active: number;
  paused: number;
  failed: number;
  quotaUsed: number;
  quotaMax: number;
}

/**
 * 监控日志响应
 */
export interface MonitorLogResponse {
  id: number;
  checkResult: "no_change" | "changed" | "failed" | "skipped";
  checkedAt: string;
  similarityScore: number | null;
  changeSummary: string | null;
  errorMessage: string | null;
  durationMs: number | null;
}

/**
 * 检查记录简化响应（用于详情页）
 */
export interface CheckRecordResponse {
  id: number;
  result: string;
  checkedAt: string;
  similarityScore: number | null;
  changeSummary: string | null;
  errorMessage: string | null;
  durationMs: number | null;
}

/**
 * 监控详情响应（包含检查记录）
 */
export interface MonitorDetailResponse extends MonitorResponse {
  baselineSnapshotId: number | null;
  recentChecks: CheckRecordResponse[];
}
