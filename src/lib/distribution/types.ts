/**
 * 知识分发中心 - 类型定义
 *
 * @module distribution
 * @description 定义分发系统的核心类型，包括目标配置、分发记录、事件等
 */

// ==================== 基础类型 ====================

/**
 * 分发目标类型
 */
export type DistributionTargetType =
  | "obsidian"
  | "notion"
  | "webhook"
  | "rss"
  | "manual_export";

/**
 * 触发模式
 */
export type TriggerMode = "realtime" | "scheduled" | "manual";

/**
 * 分发目标状态
 */
export type DistributionStatus = "idle" | "syncing" | "error";

/**
 * 分发记录状态
 */
export type DistributionRecordStatus = "pending" | "success" | "failed";

/**
 * 支持的平台
 */
export type SupportedPlatform = "web" | "mobile" | "desktop";

// ==================== 筛选条件 ====================

/**
 * 分发筛选条件
 */
export interface DistributionFilters {
  /** 平台筛选（如 wechat, bilibili） */
  platforms?: string[];
  /** 文件夹 ID 筛选 */
  folders?: string[];
  /** 标签筛选 */
  tags?: string[];
  /** 是否包含 AI 摘要 */
  includeAiSummary?: boolean;
}

// ==================== 触发配置 ====================

/**
 * 触发配置
 */
export interface TriggerConfig {
  /** 触发模式 */
  mode: TriggerMode;
  /** 定时触发间隔（分钟），仅 scheduled 模式有效 */
  scheduleIntervalMinutes?: number;
}

// ==================== 分发目标 ====================

/**
 * 分发目标配置
 */
export interface DistributionTarget {
  /** 目标 ID */
  id: string;
  /** 用户 ID */
  userId: string;
  /** 目标类型 */
  targetType: DistributionTargetType;
  /** 目标名称（用户自定义） */
  name: string;
  /** 是否启用 */
  enabled: boolean;
  /** 触发配置 */
  trigger: TriggerConfig;
  /** 筛选条件 */
  filters?: DistributionFilters;
  /** 目标特定配置（JSONB） */
  targetConfig: Record<string, unknown>;
  /** 状态 */
  status: DistributionStatus;
  /** 最后同步时间 */
  lastSyncAt?: Date;
  /** 最后错误信息 */
  lastError?: string;
  /** 已同步数量 */
  syncedCount: number;
  /** 创建时间 */
  createdAt: Date;
  /** 更新时间 */
  updatedAt: Date;
}

// ==================== 分发记录 ====================

/**
 * 分发记录
 */
export interface DistributionRecord {
  /** 记录 ID */
  id: string;
  /** 目标 ID */
  targetId: string;
  /** 书签 ID */
  bookmarkId: string;
  /** 分发状态 */
  status: DistributionRecordStatus;
  /** 分发时间 */
  distributedAt?: Date;
  /** 外部系统 ID（如 Notion page ID） */
  externalId?: string;
  /** 错误信息 */
  errorMessage?: string;
  /** 重试次数 */
  retryCount: number;
  /** 创建时间 */
  createdAt: Date;
}

// ==================== 分发结果 ====================

/**
 * 分发错误信息（用于记录分发过程中的错误）
 */
export interface DistributionErrorInfo {
  /** 书签 ID */
  bookmarkId: string;
  /** 错误代码 */
  code: string;
  /** 错误信息 */
  message: string;
}

/**
 * 分发交付物（如导出文件）
 */
export interface DistributionDeliverable {
  /** 交付物类型 */
  type: "download" | "url" | "content";
  /** 下载 URL */
  url?: string;
  /** 文件名 */
  filename?: string;
  /** MIME 类型 */
  mimeType?: string;
  /** 内容（小数据量直接返回） */
  content?: string;
}

/**
 * 分发结果
 */
export interface DistributionResult {
  /** 是否成功（全部成功） */
  success: boolean;
  /** 成功分发数量 */
  distributedCount: number;
  /** 失败数量 */
  failedCount: number;
  /** 分发记录列表 */
  records: DistributionRecord[];
  /** 错误列表 */
  errors?: DistributionErrorInfo[];
  /** 交付物（如导出文件） */
  deliverable?: DistributionDeliverable;
}

// ==================== 验证结果 ====================

/**
 * 配置验证结果
 */
export interface ValidationResult {
  /** 是否有效 */
  valid: boolean;
  /** 错误列表 */
  errors: string[];
  /** 警告列表 */
  warnings?: string[];
}

/**
 * 连接测试结果
 */
export interface TestConnectionResult {
  /** 是否成功 */
  success: boolean;
  /** 错误信息 */
  error?: string;
  /** 额外信息（如 workspace 名称） */
  details?: Record<string, unknown>;
}

// ==================== 事件类型 ====================

/**
 * 分发事件
 */
export type DistributionEvent =
  | {
      type: "bookmark_created";
      bookmarkId: string;
      userId: string;
      platform?: string;
      tags?: string[];
    }
  | { type: "bookmark_updated"; bookmarkId: string; userId: string }
  | { type: "bookmark_deleted"; bookmarkId: string; userId: string }
  | {
      type: "manual_trigger";
      targetId: string;
      userId: string;
      bookmarkIds?: string[];
    }
  | { type: "scheduled_trigger"; targetId: string; userId: string };

/**
 * 事件处理器
 */
export type EventHandler = (event: DistributionEvent) => Promise<void>;

// ==================== 目标特定配置 ====================

/**
 * Obsidian 目标配置
 */
export interface ObsidianTargetConfig {
  /** Vault 路径 */
  vaultPath: string;
  /** 保存目录名 */
  folderName: string;
  /** 文件名模式，如 "{{title}}-{{date}}" */
  filenamePattern: string;
  /** 模板内容 */
  template?: string;
  /** 是否使用 YAML frontmatter */
  useYamlFrontmatter: boolean;
}

/**
 * Notion 目标配置
 */
export interface NotionTargetConfig {
  /** Database ID */
  databaseId: string;
  /** 属性映射 */
  propertyMapping: Record<string, string>;
  /** Workspace 名称（只读） */
  workspaceName?: string;
}

/**
 * Webhook 目标配置
 */
export interface WebhookTargetConfig {
  /** 目标 URL */
  url: string;
  /** 请求方法 */
  method: "POST" | "PUT";
  /** 自定义 Headers */
  headers?: Record<string, string>;
  /** 密钥（用于签名） */
  secretKey?: string;
  /** 重试次数 */
  retryCount: number;
}

/**
 * RSS 目标配置
 */
export interface RssTargetConfig {
  /** Feed 格式 */
  feedFormat: "rss2" | "atom";
  /** Feed 中最大条目数 */
  itemCount: number;
  /** 是否包含摘要内容 */
  includeContent: boolean;
  /** 唯一 Token（用于 URL 访问） */
  feedToken: string;
}

/**
 * 手动导出目标配置
 */
export interface ManualExportTargetConfig {
  /** 导出格式 */
  format: "csv" | "json" | "markdown" | "obsidian" | "html";
  /** 导出字段 */
  fields?: string[];
  /** 导出选项 */
  options?: {
    includeAiSummary?: boolean;
    zipMultipleFiles?: boolean;
  };
}

// ==================== 类型守卫 ====================

/**
 * 判断是否为有效的分发目标类型
 */
export function isDistributionTargetType(
  value: unknown,
): value is DistributionTargetType {
  return (
    typeof value === "string" &&
    ["obsidian", "notion", "webhook", "rss", "manual_export"].includes(value)
  );
}

/**
 * 判断是否为有效的触发模式
 */
export function isTriggerMode(value: unknown): value is TriggerMode {
  return (
    typeof value === "string" &&
    ["realtime", "scheduled", "manual"].includes(value)
  );
}

/**
 * 判断是否为有效的分发状态
 */
export function isDistributionStatus(
  value: unknown,
): value is DistributionStatus {
  return (
    typeof value === "string" && ["idle", "syncing", "error"].includes(value)
  );
}

// ==================== 书签类型（简化版，用于分发） ====================

/**
 * 书签数据（分发使用的简化版）
 */
export interface DistributionBookmark {
  id: string;
  title: string;
  url: string;
  platform?: string;
  description?: string;
  aiSummary?: string;
  tags?: string[];
  folderId?: string;
  createdAt: Date;
  updatedAt: Date;
}
