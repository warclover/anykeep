/**
 * 自动快照配置常量
 * P2-010: 用途标签触发自动快照功能
 */

// 从规范位置导入/重导出类型，避免重复定义
import type { AutoSnapshotSettings } from "@/types/user-settings";

export type { AutoSnapshotSettings } from "@/types/user-settings";
export { DEFAULT_AUTO_SNAPSHOT_SETTINGS } from "@/types/user-settings";
export type { SnapshotTriggerSource } from "@/lib/snapshot/snapshot.types";

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
