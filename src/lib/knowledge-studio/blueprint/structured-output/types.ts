/**
 * 结构化输出类型定义 (Story 3.1)
 * @module knowledge-studio/blueprint/structured-output
 *
 * 定义各蓝图的 JSON Schema 输出格式，支持程序化解析和渲染。
 */

// ============================================================
// Base Types
// ============================================================

/**
 * 结构化输出类型
 */
export type StructuredOutputType =
  | "feature_matrix" // 功能对比矩阵
  | "swot" // SWOT 分析
  | "script_timeline" // 脚本时间线
  | "sections" // 章节列表
  | "checklist" // 检查清单
  | "comparison_table" // 对比表格
  | "markdown"; // 纯 Markdown（降级后）

/**
 * 结构化输出元数据
 */
export interface StructuredOutputMeta {
  /** 输出类型 */
  type: StructuredOutputType;
  /** 输出版本 */
  version: string;
  /** 生成时间戳 */
  generatedAt: string;
  /** 使用的蓝图 ID */
  blueprintId: string;
  /** 生成模式 */
  generationMode: "quick" | "guided";
  /** 是否为降级输出 */
  isFallback: boolean;
}

// ============================================================
// Feature Matrix (Story 3.4)
// ============================================================

/**
 * 功能对比项支持程度
 */
export type FeatureSupportLevel =
  | "full" // 完全支持 ✓
  | "partial" // 部分支持 △
  | "none" // 不支持 ✗
  | "unknown"; // 未知 ?

/**
 * 功能对比行
 */
export interface FeatureMatrixRow {
  /** 功能名称 */
  feature: string;
  /** 功能分类（可选） */
  category?: string;
  /** 各对比对象的支持情况 */
  support: Record<string, FeatureSupportLevel | string>;
  /** 备注 */
  notes?: string;
}

/**
 * 功能对比矩阵输出
 */
export interface FeatureMatrixOutput {
  /** 元数据 */
  meta: StructuredOutputMeta;
  /** 表格标题 */
  title: string;
  /** 对比对象列表 */
  subjects: Array<{
    id: string;
    name: string;
    description?: string;
  }>;
  /** 功能行列表 */
  rows: FeatureMatrixRow[];
  /** 总结 */
  summary?: string;
}

// ============================================================
// SWOT Analysis (Story 3.5)
// ============================================================

/**
 * SWOT 象限类型
 */
export type SwotQuadrant =
  | "strengths"
  | "weaknesses"
  | "opportunities"
  | "threats";

/**
 * SWOT 项目
 */
export interface SwotItem {
  /** 项目标题 */
  title: string;
  /** 项目描述 */
  description: string;
  /** 重要程度 (1-5) */
  importance?: number;
  /** 来源引用 */
  source?: string;
}

/**
 * SWOT 分析输出
 */
export interface SwotOutput {
  /** 元数据 */
  meta: StructuredOutputMeta;
  /** 分析对象 */
  subject: string;
  /** 分析概述 */
  overview?: string;
  /** 四象限内容 */
  quadrants: {
    strengths: SwotItem[];
    weaknesses: SwotItem[];
    opportunities: SwotItem[];
    threats: SwotItem[];
  };
  /** 策略建议 */
  recommendations?: string[];
}

// ============================================================
// Script Timeline (Story 3.6)
// ============================================================

/**
 * 脚本时间线镜头
 */
export interface ScriptTimelineShot {
  /** 镜头 ID */
  id: string;
  /** 镜头序号 */
  sequence: number;
  /** 开始时间（秒） */
  startTime: number;
  /** 时长（秒） */
  duration: number;
  /** 画面描述 */
  visual: string;
  /** 旁白/台词 */
  narration?: string;
  /** 镜头类型 */
  shotType?: "opening" | "content" | "transition" | "closing" | "b-roll";
  /** B-roll 建议 */
  bRollSuggestion?: string;
  /** 字幕 */
  subtitle?: string;
  /** 背景音乐提示 */
  musicCue?: string;
}

/**
 * 脚本时间线输出
 */
export interface ScriptTimelineOutput {
  /** 元数据 */
  meta: StructuredOutputMeta;
  /** 视频标题 */
  title: string;
  /** 视频类型 */
  videoType?: string;
  /** 目标时长（秒） */
  targetDuration: number;
  /** 镜头列表 */
  shots: ScriptTimelineShot[];
  /** 开场 Hook */
  openingHook?: string;
  /** 结尾 CTA */
  closingCta?: string;
  /** 总时长（秒） */
  totalDuration: number;
}

// ============================================================
// Sections Output (通用章节)
// ============================================================

/**
 * 章节内容
 */
export interface SectionContent {
  /** 章节 ID */
  id: string;
  /** 章节标题 */
  title: string;
  /** 章节级别 (1-3) */
  level: 1 | 2 | 3;
  /** 章节内容（Markdown） */
  content: string;
  /** 子章节 */
  children?: SectionContent[];
  /** 引用列表 */
  citations?: Array<{
    id: string;
    text: string;
    source: string;
  }>;
}

/**
 * 章节列表输出
 */
export interface SectionsOutput {
  /** 元数据 */
  meta: StructuredOutputMeta;
  /** 文档标题 */
  title: string;
  /** 文档摘要 */
  summary?: string;
  /** 章节列表 */
  sections: SectionContent[];
  /** 关键词 */
  keywords?: string[];
}

// ============================================================
// Checklist Output
// ============================================================

/**
 * 检查项状态
 */
export type ChecklistItemStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "blocked";

/**
 * 检查项
 */
export interface ChecklistItem {
  /** 项目 ID */
  id: string;
  /** 项目标题 */
  title: string;
  /** 项目描述 */
  description?: string;
  /** 状态 */
  status: ChecklistItemStatus;
  /** 优先级 */
  priority?: "high" | "medium" | "low";
  /** 负责人 */
  assignee?: string;
  /** 截止时间 */
  dueDate?: string;
  /** 子项 */
  children?: ChecklistItem[];
}

/**
 * 检查清单输出
 */
export interface ChecklistOutput {
  /** 元数据 */
  meta: StructuredOutputMeta;
  /** 清单标题 */
  title: string;
  /** 清单描述 */
  description?: string;
  /** 检查项列表 */
  items: ChecklistItem[];
  /** 完成率 */
  completionRate?: number;
}

// ============================================================
// Markdown Output (降级输出)
// ============================================================

/**
 * Markdown 降级输出
 */
export interface MarkdownOutput {
  /** 元数据 */
  meta: StructuredOutputMeta;
  /** Markdown 内容 */
  content: string;
  /** 降级原因 */
  fallbackReason?: string;
}

// ============================================================
// Union Type
// ============================================================

/**
 * 所有结构化输出类型的联合
 */
export type AnyStructuredOutput =
  | FeatureMatrixOutput
  | SwotOutput
  | ScriptTimelineOutput
  | SectionsOutput
  | ChecklistOutput
  | MarkdownOutput;

// ============================================================
// Validation Result
// ============================================================

/**
 * Schema 验证错误
 */
export interface SchemaValidationError {
  /** 错误路径 */
  path: string;
  /** 错误消息 */
  message: string;
  /** 期望的类型/值 */
  expected?: string;
  /** 实际的类型/值 */
  actual?: string;
}

/**
 * Schema 验证结果
 */
export interface SchemaValidationResult {
  /** 是否有效 */
  valid: boolean;
  /** 验证错误列表 */
  errors: SchemaValidationError[];
  /** 输出类型 */
  outputType?: StructuredOutputType;
  /** 解析后的数据 */
  data?: AnyStructuredOutput;
}
