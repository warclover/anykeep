/**
 * 统一导航配置
 *
 * 侧边栏和移动端底部导航 Sheet 共享同一份导航数据源，
 * 通过 `visibility` 字段控制各端显示。
 *
 * 消除 app-sidebar.tsx 和 mobile-bottom-nav.tsx 之间的配置不同步问题。
 */

import {
  BookOpen,
  Search,
  FolderOpen,
  Tags,
  FileText,
  Inbox,
  CheckSquare,
  Database,
  FlaskConical,
  BarChart3,
  Activity,
  Bell,
  Settings,
  Trash2,
  BrainCircuit,
  HeartPulse,
  Sparkles,
  Gauge,
  Zap,
  Volume2,
  Download,
  Share2,
  LinkIcon,
  GraduationCap,
} from "lucide-react";
import type { PageId } from "@/contexts/navigation-context";

// ==================== 类型定义 ====================

export type NavVisibility = "both" | "desktop" | "mobile";

export interface NavItemConfig {
  /** 翻译键（如 "nav.myBookmarks"） */
  name: string;
  /** 路由��径 */
  href: string;
  /** 图标组件 */
  icon: typeof BookOpen;
  /** Keep-Alive 页面 ID（仅桌面端客户端导航使用） */
  pageId?: PageId;
  /** 是否 Pro 功能 */
  isPro?: boolean;
  /** 徽章类型 */
  badge?: "unread";
  /** 移动端 Sheet 中的描述文案翻译键 */
  description?: string;
  /** 显示平台：both=两端 | desktop=仅桌面 | mobile=仅移动端 */
  visibility?: NavVisibility;
}

export interface NavGroupConfig {
  /** 分组 ID（用于配色映射） */
  id: string;
  /** 分组标题翻译键 */
  title: string;
  /** 导航项 */
  items: NavItemConfig[];
  /** 是否需要开发者模式 */
  requireDevMode?: boolean;
  /** 桌面端侧边栏分组默认是否折叠 */
  defaultCollapsed?: boolean;
}

// ==================== 导航分组配置 ====================

/**
 * 我的内容
 */
const myContentGroup: NavGroupConfig = {
  id: "myContent",
  title: "navGroup.myContent",
  defaultCollapsed: false,
  items: [
    {
      name: "nav.myBookmarks",
      href: "/home",
      icon: BookOpen,
      pageId: "home",
      description: "mobileMenu.viewAllBookmarks",
    },
    {
      name: "nav.mySearch",
      href: "/search",
      icon: Search,
      pageId: "search",
      description: "mobileMenu.aiSmartSearch",
    },
    {
      name: "nav.myFolders",
      href: "/folders",
      icon: FolderOpen,
      pageId: "folders",
      description: "mobileMenu.manageFolders",
    },
    {
      name: "nav.myTags",
      href: "/tags",
      icon: Tags,
      description: "mobileMenu.tagManagement",
    },
    {
      name: "nav.myNotes",
      href: "/md-collections",
      icon: FileText,
      isPro: true,
      description: "mobileMenu.markdownNotes",
    },
    {
      name: "nav.myAudio",
      href: "/audio-library",
      icon: Volume2,
    },
  ],
};

/**
 * 智能工具
 */
const smartToolsGroup: NavGroupConfig = {
  id: "smartTools",
  title: "navGroup.smartTools",
  defaultCollapsed: false,
  items: [
    {
      name: "nav.inbox",
      href: "/inbox",
      icon: Inbox,
      description: "mobileMenu.waitingClassification",
    },
    {
      name: "nav.organizeCenter",
      href: "/organize",
      icon: Sparkles,
      visibility: "desktop",
    },
    {
      name: "nav.contentAnalysis",
      href: "/content-analysis",
      icon: FlaskConical,
      description: "mobileMenu.contentAnalysis",
    },
    {
      name: "nav.draftStudio",
      href: "/knowledge-studio/v2",
      icon: Sparkles,
      isPro: true,
      description: "mobileMenu.aiReportGeneration",
    },
    {
      name: "nav.healthCheck",
      href: "/health",
      icon: HeartPulse,
      description: "mobileMenu.healthDiagnosis",
    },
    {
      name: "nav.learningHub",
      href: "/learning-hub",
      icon: GraduationCap,
      description: "mobileMenu.aiLearningHub",
    },
    {
      name: "nav.batch",
      href: "/batch",
      icon: CheckSquare,
      pageId: "batch",
      description: "mobileMenu.batchManagement",
    },
    {
      name: "nav.dataCenter",
      href: "/data",
      icon: Database,
      visibility: "desktop",
    },
    {
      name: "nav.export",
      href: "/export",
      icon: Download,
      description: "mobileMenu.exportData",
      visibility: "mobile",
    },
    {
      name: "mobileMenu.distributionCenter",
      href: "/distribution",
      icon: Share2,
      description: "mobileMenu.distributionCenter",
      visibility: "mobile",
    },
    {
      name: "mobileMenu.linkHealthCheck",
      href: "/link-health",
      icon: LinkIcon,
      description: "mobileMenu.linkHealthCheck",
      visibility: "mobile",
    },
  ],
};

/**
 * 洞察与通知
 */
const insightGroup: NavGroupConfig = {
  id: "insight",
  title: "navGroup.insightCenter",
  defaultCollapsed: true,
  items: [
    {
      name: "nav.aiHub",
      href: "/ai-hub",
      icon: Zap,
      visibility: "desktop",
    },
    {
      name: "nav.analytics",
      href: "/analytics",
      icon: BarChart3,
      pageId: "analytics",
      description: "mobileMenu.viewDataAnalysis",
    },
    {
      name: "nav.activityLog",
      href: "/activity",
      icon: Activity,
      description: "mobileMenu.operationHistory",
    },
    {
      name: "nav.notifications",
      href: "/messages",
      icon: Bell,
      pageId: "messages",
      badge: "unread",
      description: "mobileMenu.systemMessages",
    },
  ],
};

/**
 * 系统
 */
const systemGroup: NavGroupConfig = {
  id: "system",
  title: "mobileMenu.system",
  items: [
    {
      name: "nav.settings",
      href: "/settings",
      icon: Settings,
      pageId: "settings",
      description: "mobileMenu.appSettings",
    },
    {
      name: "nav.trash",
      href: "/home?folder=trash",
      icon: Trash2,
      description: "mobileMenu.deletedContent",
    },
  ],
};

/**
 * 开发者工具（需要开发者模式开启）
 */
const devToolsGroup: NavGroupConfig = {
  id: "devTools",
  title: "navGroup.devTools",
  requireDevMode: true,
  defaultCollapsed: true,
  items: [
    {
      name: "nav.classificationManager",
      href: "/classification-manager",
      icon: BrainCircuit,
    },
    {
      name: "nav.ragDashboard",
      href: "/settings/rag-dashboard",
      icon: Gauge,
    },
    {
      name: "nav.folderHealth",
      href: "/folder-health",
      icon: HeartPulse,
    },
    {
      name: "nav.aiDebug",
      href: "/dev/ai-debug",
      icon: Zap,
    },
  ],
};

// ==================== 导出 ====================

/** 全部导航分组 */
export const NAV_GROUPS: NavGroupConfig[] = [
  myContentGroup,
  smartToolsGroup,
  insightGroup,
  systemGroup,
  devToolsGroup,
];

// ==================== 过滤工具函数 ====================

/**
 * 获取桌面端可见的导航项
 */
export function getDesktopItems(group: NavGroupConfig): NavItemConfig[] {
  return group.items.filter(
    (item) =>
      !item.visibility ||
      item.visibility === "both" ||
      item.visibility === "desktop",
  );
}

/**
 * 获取移动端可见的导航项
 */
export function getMobileItems(group: NavGroupConfig): NavItemConfig[] {
  return group.items.filter(
    (item) =>
      !item.visibility ||
      item.visibility === "both" ||
      item.visibility === "mobile",
  );
}

/**
 * 获取移动端 "更多" Sheet 中的导航分组
 * 排除底部 Tab 已覆盖的页面（收藏、搜索、收件箱）
 */
export function getMobileMoreGroups(): NavGroupConfig[] {
  const bottomTabHrefs = new Set(["/home", "/search", "/inbox"]);

  return NAV_GROUPS.filter((g) => !g.requireDevMode) // 移动端不显示开发者工具
    .map((group) => ({
      ...group,
      items: getMobileItems(group).filter(
        (item) => !bottomTabHrefs.has(item.href),
      ),
    }))
    .filter((group) => group.items.length > 0);
}
