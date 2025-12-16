/**
 * 自动快照配置常量
 * P2-010: 用途标签触发自动快照功能
 */

import type { SnapshotType } from "@/lib/snapshot/snapshot.types";

/**
 * 自动快照设置接口
 */
export interface AutoSnapshotSettings {
  /** 功能总开关 (默认: true) */
  enabled: boolean;

  /** 触发标签列表 (默认: ["优质经验"]) */
  triggerTags: string[];

  /** 快照类型 (默认: "basic") */
  snapshotType: SnapshotType;

  /** 创建前显示确认 Toast (默认: true) */
  showConfirmToast: boolean;

  /** 确认延迟时间(毫秒) (默认: 3000) */
  confirmDelayMs: number;

  /** 配额不足时静默跳过 (默认: false) */
  silentOnQuotaExceeded: boolean;
}

/**
 * 默认自动快照设置
 * - 「优质经验」预设为已配置
 * - 使用 basic 类型节省配额
 * - 3秒取消窗口
 */
export const DEFAULT_AUTO_SNAPSHOT_SETTINGS: AutoSnapshotSettings = {
  enabled: true,
  triggerTags: ["优质经验"], // 预设「优质经验」已配置
  snapshotType: "basic",
  showConfirmToast: true,
  confirmDelayMs: 3000, // 3秒取消窗口
  silentOnQuotaExceeded: false, // 配额不足时显示升级提示
};

/**
 * 推荐的触发标签配置
 * 用于设置页面展示，帮助用户了解每个标签的用途
 */
export const RECOMMENDED_TRIGGER_TAGS = [
  {
    value: "优质经验",
    description: "高质量经验内容，值得永久保存",
    recommended: true,
  },
  {
    value: "值得复读",
    description: "需要反复学习的内容",
    recommended: false,
  },
  {
    value: "值得关注",
    description: "需要持续关注的内容",
    recommended: false,
  },
  {
    value: "下次分享用",
    description: "准备分享给他人的内容",
    recommended: false,
  },
] as const;

/**
 * 确认延迟选项（毫秒）
 */
export const CONFIRM_DELAY_OPTIONS = [
  { value: 2000, label: "2 秒" },
  { value: 3000, label: "3 秒" },
  { value: 5000, label: "5 秒" },
] as const;

/**
 * 快照触发来源类型
 */
export type SnapshotTriggerSource =
  | "manual" // 手动创建
  | "auto-tag" // 标签自动触发
  | "batch" // 批量创建
  | "scheduled" // 定时任务
  | "api"; // API 调用

/**
 * 检查标签是否为触发标签
 * @param tag 标签值
 * @param settings 自动快照设置
 */
export function isTriggerTag(
  tag: string,
  settings: AutoSnapshotSettings,
): boolean {
  return settings.enabled && settings.triggerTags.includes(tag);
}

/**
 * 获取新增的触发标签
 * @param prevTags 之前的标签列表
 * @param newTags 新的标签列表
 * @param settings 自动快照设置
 * @returns 新增的触发标签（第一个匹配的）
 */
export function getAddedTriggerTag(
  prevTags: string[],
  newTags: string[],
  settings: AutoSnapshotSettings,
): string | null {
  if (!settings.enabled) return null;

  const addedTags = newTags.filter((t) => !prevTags.includes(t));
  const triggerTag = addedTags.find((t) => settings.triggerTags.includes(t));

  return triggerTag || null;
}
