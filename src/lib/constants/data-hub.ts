/**
 * 数据中心常量配置
 * 统一管理导入、导出、分发功能的配置项
 */

import {
  Upload,
  Download,
  Share2,
  Globe,
  FileUp,
  Link,
  Clipboard,
  FileText,
  Braces,
  Table,
  BookOpen,
  Notebook,
  Mail,
  Rss,
  Webhook,
  CheckSquare,
  type LucideIcon,
} from "lucide-react";

// Tab 定义
export const DATA_HUB_TABS = [
  {
    id: "import",
    label: "导入",
    icon: Upload,
    description: "从浏览器、文件或平台导入数据",
  },
  {
    id: "export",
    label: "导出",
    icon: Download,
    description: "导出收藏到各种格式",
  },
  {
    id: "distribute",
    label: "分发",
    icon: Share2,
    description: "同步到外部平台",
  },
  {
    id: "batch",
    label: "批量管理",
    icon: CheckSquare,
    description: "批量选择、标签、移动、删除",
  },
] as const;

export type DataHubTabId = (typeof DATA_HUB_TABS)[number]["id"];

// 导入来源配置
export type ImportSourceStatus = "ready" | "planned" | "new";

export interface ImportSource {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  status: ImportSourceStatus;
}

export const IMPORT_SOURCES: ImportSource[] = [
  {
    id: "browser",
    label: "浏览器书签",
    description: "从 Chrome/Firefox/Edge/Safari 导入书签",
    icon: Globe,
    status: "ready",
  },
  {
    id: "file",
    label: "文件上传",
    description: "支持 HTML/JSON/CSV 格式文件",
    icon: FileUp,
    status: "ready",
  },
  {
    id: "platform",
    label: "平台授权",
    description: "微信读书、B站、小红书等平台",
    icon: Link,
    status: "planned",
  },
  {
    id: "clipboard",
    label: "剪贴板",
    description: "快速粘贴 URL 列表批量导入",
    icon: Clipboard,
    status: "planned",
  },
];

// 导出格式配置
export interface ExportFormat {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  ext: string;
}

export const EXPORT_FORMATS: ExportFormat[] = [
  {
    id: "markdown",
    label: "Markdown",
    description: "适合 Obsidian、Notion 等知识管理工具",
    icon: FileText,
    ext: ".md",
  },
  {
    id: "json",
    label: "JSON",
    description: "适合数据备份与程序处理",
    icon: Braces,
    ext: ".json",
  },
  {
    id: "csv",
    label: "CSV",
    description: "适合 Excel 数据分析",
    icon: Table,
    ext: ".csv",
  },
  {
    id: "html",
    label: "HTML",
    description: "生成静态网页书签",
    icon: Globe,
    ext: ".html",
  },
];

// 分发平台配置
export type DistributePlatformStatus = "ready" | "connected" | "planned";

export interface DistributePlatform {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  status: DistributePlatformStatus;
}

export const DISTRIBUTE_PLATFORMS: DistributePlatform[] = [
  {
    id: "obsidian",
    label: "Obsidian",
    description: "本地 Vault 文件同步",
    icon: BookOpen,
    status: "ready",
  },
  {
    id: "notion",
    label: "Notion",
    description: "云端数据库同步",
    icon: Notebook,
    status: "ready",
  },
  {
    id: "feishu",
    label: "飞书文档",
    description: "飞书云文档同步",
    icon: FileText,
    status: "planned",
  },
  {
    id: "email",
    label: "邮件推送",
    description: "定时邮件发送摘要",
    icon: Mail,
    status: "planned",
  },
  {
    id: "rss",
    label: "RSS",
    description: "生成个人订阅源",
    icon: Rss,
    status: "ready",
  },
  {
    id: "webhook",
    label: "Webhook",
    description: "自定义 API 推送",
    icon: Webhook,
    status: "ready",
  },
];

// 默认 Tab
export const DEFAULT_TAB: DataHubTabId = "import";
