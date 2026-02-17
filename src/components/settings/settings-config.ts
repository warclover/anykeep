/**
 * 设置页面分组配置
 * 将 18 个设置模块归类为 6 大分组，提升用户体验
 *
 * label/description 使用翻译键（如 "settings.groups.account.label"），
 * 由消费方通过 getNestedValue() 解析为实际文本。
 */

import {
  User,
  Palette,
  Sparkles,
  Package,
  Link,
  Bell,
  Shield,
  MessageSquare,
  type LucideIcon,
} from "lucide-react";

/**
 * 设置分组项定义
 */
export interface SettingsGroupItem {
  id: string;
  /** 翻译键（如 "settings.groups.account.items.accountInfo"） */
  label: string;
}

/**
 * 设置分组定义
 */
export interface SettingsGroup {
  id: string;
  /** 翻译键（如 "settings.groups.account.label"） */
  label: string;
  /** 翻译键（如 "settings.groups.account.description"） */
  description: string;
  icon: LucideIcon;
  iconColor: string;
  items: SettingsGroupItem[];
}

/**
 * 设置分组配置
 * 按使用频率和功能相关性排序
 */
export const SETTINGS_GROUPS: SettingsGroup[] = [
  {
    id: "account",
    label: "settings.groups.account.label",
    description: "settings.groups.account.description",
    icon: User,
    iconColor: "text-purple-600 dark:text-purple-400",
    items: [
      {
        id: "account-info",
        label: "settings.groups.account.items.accountInfo",
      },
      { id: "profile", label: "settings.groups.account.items.profile" },
      { id: "interests", label: "settings.groups.account.items.interests" },
    ],
  },
  {
    id: "appearance",
    label: "settings.groups.appearance.label",
    description: "settings.groups.appearance.description",
    icon: Palette,
    iconColor: "text-pink-600 dark:text-pink-400",
    items: [{ id: "theme", label: "settings.groups.appearance.items.theme" }],
  },
  {
    id: "ai",
    label: "settings.groups.ai.label",
    description: "settings.groups.ai.description",
    icon: Sparkles,
    iconColor: "text-violet-600 dark:text-violet-400",
    items: [
      { id: "ai-features", label: "settings.groups.ai.items.features" },
      {
        id: "classification",
        label: "settings.groups.ai.items.classification",
      },
      { id: "summary-mode", label: "settings.groups.ai.items.summaryMode" },
      { id: "trust-mode", label: "settings.groups.ai.items.trustMode" },
      { id: "ai-provider", label: "settings.groups.ai.items.provider" },
    ],
  },
  {
    id: "content",
    label: "settings.groups.content.label",
    description: "settings.groups.content.description",
    icon: Package,
    iconColor: "text-cyan-600 dark:text-cyan-400",
    items: [
      {
        id: "snapshot-quota",
        label: "settings.groups.content.items.snapshotQuota",
      },
      {
        id: "auto-snapshot",
        label: "settings.groups.content.items.autoSnapshot",
      },
      {
        id: "knowledge-studio",
        label: "settings.groups.content.items.knowledgeStudio",
      },
    ],
  },
  {
    id: "platforms",
    label: "settings.groups.platforms.label",
    description: "settings.groups.platforms.description",
    icon: Link,
    iconColor: "text-blue-600 dark:text-blue-400",
    items: [
      {
        id: "platform-auth",
        label: "settings.groups.platforms.items.socialAccounts",
      },
    ],
  },
  {
    id: "notifications",
    label: "settings.groups.notifications.label",
    description: "settings.groups.notifications.description",
    icon: Bell,
    iconColor: "text-orange-600 dark:text-orange-400",
    items: [
      {
        id: "notification-prefs",
        label: "settings.groups.notifications.items.preferences",
      },
      {
        id: "notification-levels",
        label: "settings.groups.notifications.items.levels",
      },
    ],
  },
  {
    id: "privacy",
    label: "settings.groups.privacy.label",
    description: "settings.groups.privacy.description",
    icon: Shield,
    iconColor: "text-green-600 dark:text-green-400",
    items: [
      {
        id: "data-security",
        label: "settings.groups.privacy.items.dataSecurity",
      },
      {
        id: "account-actions",
        label: "settings.groups.privacy.items.accountActions",
      },
      {
        id: "developer-mode",
        label: "settings.groups.privacy.items.developerMode",
      },
    ],
  },
  {
    id: "support",
    label: "settings.groups.support.label",
    description: "settings.groups.support.description",
    icon: MessageSquare,
    iconColor: "text-indigo-600 dark:text-indigo-400",
    items: [
      { id: "ai-history", label: "settings.groups.support.items.aiHistory" },
      { id: "feedback", label: "settings.groups.support.items.feedback" },
    ],
  },
];

/**
 * 获取分组的锚点 ID
 */
export function getGroupAnchorId(groupId: string): string {
  return `settings-group-${groupId}`;
}

/**
 * 获取子项的锚点 ID
 */
export function getItemAnchorId(groupId: string, itemId: string): string {
  return `settings-item-${groupId}-${itemId}`;
}
