/**
 * 收藏夹组件常量配置
 * 包含分组配置、颜色系统、图标映射等
 */

import {
  Folder,
  Inbox,
  Pin,
  Archive,
  Briefcase,
  GraduationCap,
  Heart,
  Gamepad2,
  MoreHorizontal,
} from "lucide-react";

// ==================== 类型定义 ====================

/** UI 显示分组类型 */
export type UIFolderGroup =
  | "work"
  | "study"
  | "life"
  | "entertainment"
  | "other";

/** 所有分组类型（包含系统分组） */
export type FolderDisplayGroup =
  | UIFolderGroup
  | "default"
  | "pinned"
  | "archived";

/** 分组配置类型 */
export interface FolderGroupConfig {
  label: string;
  icon: typeof Folder;
  keywords: readonly string[];
  colors: {
    bg: string;
    bgHover: string;
    border: string;
    accent: string;
    iconBg: string;
    gradient: { from: string; to: string };
  };
}

// ==================== UI 分组列表 ====================

export const UI_GROUP_KEYS: UIFolderGroup[] = [
  "work",
  "study",
  "life",
  "entertainment",
  "other",
];

// ==================== 分组配置 ====================

export const FOLDER_GROUPS: Record<string, FolderGroupConfig> = {
  // 系统分组（通常不在 UI 中直接显示）
  default: {
    label: "默认",
    icon: Folder,
    keywords: [],
    colors: {
      bg: "bg-gray-50 dark:bg-gray-800/50",
      bgHover: "hover:bg-gray-100 dark:hover:bg-gray-700/50",
      border: "border-gray-200 dark:border-gray-700",
      accent: "text-gray-600 dark:text-gray-400",
      iconBg: "bg-gray-100 dark:bg-gray-700",
      gradient: { from: "from-gray-400", to: "to-gray-500" },
    },
  },
  pinned: {
    label: "已固定",
    icon: Pin,
    keywords: [],
    colors: {
      bg: "bg-amber-50 dark:bg-amber-900/20",
      bgHover: "hover:bg-amber-100 dark:hover:bg-amber-800/30",
      border: "border-amber-200 dark:border-amber-800",
      accent: "text-amber-600 dark:text-amber-400",
      iconBg: "bg-amber-100 dark:bg-amber-800",
      gradient: { from: "from-yellow-400", to: "to-amber-500" },
    },
  },
  archived: {
    label: "已归档",
    icon: Archive,
    keywords: [],
    colors: {
      bg: "bg-slate-50 dark:bg-slate-800/50",
      bgHover: "hover:bg-slate-100 dark:hover:bg-slate-700/50",
      border: "border-slate-200 dark:border-slate-700",
      accent: "text-slate-500 dark:text-slate-400",
      iconBg: "bg-slate-100 dark:bg-slate-700",
      gradient: { from: "from-slate-400", to: "to-slate-500" },
    },
  },

  // UI 显示分组 - 语义化颜色
  work: {
    label: "工作相关",
    icon: Briefcase,
    keywords: [
      "工作",
      "职场",
      "项目",
      "公司",
      "业务",
      "办公",
      "会议",
      "客户",
      "行业",
    ],
    colors: {
      bg: "bg-blue-50 dark:bg-blue-900/20",
      bgHover: "hover:bg-blue-100 dark:hover:bg-blue-800/30",
      border: "border-blue-200 dark:border-blue-800",
      accent: "text-blue-600 dark:text-blue-400",
      iconBg: "bg-blue-100 dark:bg-blue-800",
      gradient: { from: "from-blue-500", to: "to-indigo-500" },
    },
  },
  study: {
    label: "学习成长",
    icon: GraduationCap,
    keywords: [
      "学习",
      "技术",
      "产品",
      "教程",
      "课程",
      "知识",
      "笔记",
      "读书",
      "教育",
      "培训",
    ],
    colors: {
      bg: "bg-emerald-50 dark:bg-emerald-900/20",
      bgHover: "hover:bg-emerald-100 dark:hover:bg-emerald-800/30",
      border: "border-emerald-200 dark:border-emerald-800",
      accent: "text-emerald-600 dark:text-emerald-400",
      iconBg: "bg-emerald-100 dark:bg-emerald-800",
      gradient: { from: "from-emerald-500", to: "to-teal-500" },
    },
  },
  life: {
    label: "生活方式",
    icon: Heart,
    keywords: [
      "生活",
      "旅行",
      "美食",
      "健康",
      "运动",
      "家庭",
      "购物",
      "时尚",
      "美妆",
    ],
    colors: {
      bg: "bg-pink-50 dark:bg-pink-900/20",
      bgHover: "hover:bg-pink-100 dark:hover:bg-pink-800/30",
      border: "border-pink-200 dark:border-pink-800",
      accent: "text-pink-600 dark:text-pink-400",
      iconBg: "bg-pink-100 dark:bg-pink-800",
      gradient: { from: "from-pink-500", to: "to-rose-500" },
    },
  },
  entertainment: {
    label: "休闲娱乐",
    icon: Gamepad2,
    keywords: ["娱乐", "游戏", "电影", "音乐", "视频", "动漫", "小说", "综艺"],
    colors: {
      bg: "bg-purple-50 dark:bg-purple-900/20",
      bgHover: "hover:bg-purple-100 dark:hover:bg-purple-800/30",
      border: "border-purple-200 dark:border-purple-800",
      accent: "text-purple-600 dark:text-purple-400",
      iconBg: "bg-purple-100 dark:bg-purple-800",
      gradient: { from: "from-purple-500", to: "to-violet-500" },
    },
  },
  other: {
    label: "收藏分类文件夹",
    icon: MoreHorizontal,
    keywords: [],
    colors: {
      bg: "bg-pink-50 dark:bg-pink-900/20",
      bgHover: "hover:bg-pink-100 dark:hover:bg-pink-800/30",
      border: "border-pink-200 dark:border-pink-800",
      accent: "text-pink-600 dark:text-pink-400",
      iconBg: "bg-pink-100 dark:bg-pink-800",
      gradient: { from: "from-pink-400", to: "to-rose-500" },
    },
  },
};

// ==================== 系统文件夹配置 ====================

export const SYSTEM_FOLDER_CONFIG = {
  icon: Inbox,
  colors: {
    bg: "bg-slate-100 dark:bg-slate-800",
    bgHover: "hover:bg-slate-200 dark:hover:bg-slate-700",
    border: "border-slate-300 dark:border-slate-600",
    accent: "text-slate-700 dark:text-slate-300",
    iconBg: "bg-slate-200 dark:bg-slate-700",
    gradient: { from: "from-slate-400", to: "to-slate-500" },
  },
};

// ==================== Emoji 图标映射 ====================

export const FOLDER_EMOJIS: Record<string, string> = {
  // 具体文件夹名称映射
  产品学习: "📚",
  技术学习: "💻",
  生活方式: "☕",
  旅行计划: "✈️",
  职场技能: "💼",
  行业资讯: "📰",
  项目资料: "📋",
  读书笔记: "📖",
  在线课程: "🎓",
  美食探店: "🍜",
  健身运动: "💪",
  游戏攻略: "🎮",
  影视推荐: "🎬",
  音乐收藏: "🎵",

  // 通用关键词映射
  学习: "📖",
  工作: "💼",
  娱乐: "🎮",
  收藏: "⭐",
  笔记: "📝",
  资料: "📄",
  default: "📁",
};

/**
 * 获取文件夹的 Emoji 图标
 */
export function getFolderEmoji(folderName: string): string {
  // 精确匹配
  if (FOLDER_EMOJIS[folderName]) {
    return FOLDER_EMOJIS[folderName];
  }

  // 模糊匹配（包含关键词）
  for (const [key, emoji] of Object.entries(FOLDER_EMOJIS)) {
    if (key !== "default" && folderName.includes(key)) {
      return emoji;
    }
  }

  return FOLDER_EMOJIS.default;
}

/**
 * 根据分组获取颜色配置
 */
export function getGroupColors(groupKey: string) {
  return FOLDER_GROUPS[groupKey]?.colors || FOLDER_GROUPS.other.colors;
}

/**
 * 根据分组获取图标
 */
export function getGroupIcon(groupKey: string) {
  return FOLDER_GROUPS[groupKey]?.icon || Folder;
}

// ==================== 分组工具函数 ====================

// 导入类型（延迟导入避免循环依赖）
import type { FolderWithStats, GroupedFolders } from "./types";

/**
 * 将文件夹按分组分类
 * @deprecated 已被基于 category_id 的分组机制替代。
 * 保留以兼容 folder-action-menu 和 folder-bookmark-area 等旧组件。
 */
export function groupFolders(folders: FolderWithStats[]): GroupedFolders {
  const result: GroupedFolders = {
    system: [],
    groups: {
      work: [],
      study: [],
      life: [],
      entertainment: [],
      other: [],
    },
    archived: [],
  };

  for (const folder of folders) {
    if (folder.is_archived) {
      result.archived.push(folder);
    } else if (folder.is_system) {
      result.system.push(folder);
    } else {
      const rawGroup = folder.folder_group || "other";
      const group = UI_GROUP_KEYS.includes(rawGroup as UIFolderGroup)
        ? (rawGroup as UIFolderGroup)
        : "other";
      result.groups[group].push(folder);
    }
  }

  UI_GROUP_KEYS.forEach((groupKey) => {
    result.groups[groupKey].sort(
      (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
    );
  });

  return result;
}
