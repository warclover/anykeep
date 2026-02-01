/**
 * 设置页面分组配置
 * 将 18 个设置模块归类为 6 大分组，提升用户体验
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
  label: string;
}

/**
 * 设置分组定义
 */
export interface SettingsGroup {
  id: string;
  label: string;
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
    label: "账号与资料",
    description: "管理个人信息、画像和兴趣领域",
    icon: User,
    iconColor: "text-purple-600 dark:text-purple-400",
    items: [
      { id: "account-info", label: "基本信息" },
      { id: "profile", label: "用户画像" },
      { id: "interests", label: "兴趣领域" },
    ],
  },
  {
    id: "appearance",
    label: "外观显示",
    description: "自定义主题和界面风格",
    icon: Palette,
    iconColor: "text-pink-600 dark:text-pink-400",
    items: [{ id: "theme", label: "主题色" }],
  },
  {
    id: "ai",
    label: "AI 智能",
    description: "配置智能分类、摘要和自动化功能",
    icon: Sparkles,
    iconColor: "text-violet-600 dark:text-violet-400",
    items: [
      { id: "ai-features", label: "功能开关" },
      { id: "classification", label: "智能分类" },
      { id: "summary-mode", label: "摘要模式" },
      { id: "trust-mode", label: "托管模式" },
      { id: "ai-provider", label: "AI 服务商" },
    ],
  },
  {
    id: "content",
    label: "内容管理",
    description: "管理快照配额和自动保存规则",
    icon: Package,
    iconColor: "text-cyan-600 dark:text-cyan-400",
    items: [
      { id: "snapshot-quota", label: "快照配额" },
      { id: "auto-snapshot", label: "自动快照" },
    ],
  },
  {
    id: "platforms",
    label: "平台连接",
    description: "连接社交媒体账号同步内容",
    icon: Link,
    iconColor: "text-blue-600 dark:text-blue-400",
    items: [{ id: "platform-auth", label: "社交账号" }],
  },
  {
    id: "notifications",
    label: "通知设置",
    description: "管理邮件、应用内通知和消息分级",
    icon: Bell,
    iconColor: "text-orange-600 dark:text-orange-400",
    items: [
      { id: "notification-prefs", label: "通知偏好" },
      { id: "notification-levels", label: "消息分级" },
    ],
  },
  {
    id: "privacy",
    label: "隐私安全",
    description: "数据加密、导出和账号管理",
    icon: Shield,
    iconColor: "text-green-600 dark:text-green-400",
    items: [
      { id: "data-security", label: "数据安全" },
      { id: "account-actions", label: "账号管理" },
    ],
  },
  {
    id: "support",
    label: "历史与支持",
    description: "查看 AI 操作记录和反馈",
    icon: MessageSquare,
    iconColor: "text-indigo-600 dark:text-indigo-400",
    items: [
      { id: "ai-history", label: "AI 操作记录" },
      { id: "feedback", label: "帮助反馈" },
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
