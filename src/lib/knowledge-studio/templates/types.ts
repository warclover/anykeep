/**
 * Knowledge Studio - 模板自定义类型定义
 * @module knowledge-studio/templates
 * @description Phase 3 存根 - 用户自建蓝图 Prompt 模板
 * @version 0.1.0 (Stub)
 * @since 2025-01-02
 *
 * TODO Phase 3: 完整实现
 * - 模板 CRUD
 * - 模板变量系统
 * - 模板版本管理
 * - 模板分享
 */

import { z } from "zod";
import { logger } from "@/lib/logger";

// ============================================================================
// 模板基础类型
// ============================================================================

/**
 * 模板可见性
 */
export type TemplateVisibility =
  | "private" // 仅自己可见
  | "shared" // 指定用户可见
  | "public"; // 公开

/** TemplateVisibility 类型守卫 */
const TEMPLATE_VISIBILITIES: TemplateVisibility[] = [
  "private",
  "shared",
  "public",
];

export function isTemplateVisibility(
  value: unknown,
): value is TemplateVisibility {
  return (
    typeof value === "string" &&
    TEMPLATE_VISIBILITIES.includes(value as TemplateVisibility)
  );
}

/**
 * 模板状态
 */
export type TemplateStatus =
  | "draft" // 草稿
  | "active" // 启用
  | "archived"; // 归档

/** TemplateStatus 类型守卫 */
const TEMPLATE_STATUSES: TemplateStatus[] = ["draft", "active", "archived"];

export function isTemplateStatus(value: unknown): value is TemplateStatus {
  return (
    typeof value === "string" &&
    TEMPLATE_STATUSES.includes(value as TemplateStatus)
  );
}

/**
 * 模板变量类型
 */
export type TemplateVariableType =
  | "text" // 文本输入
  | "number" // 数字输入
  | "select" // 下拉选择
  | "multiselect" // 多选
  | "boolean"; // 开关

// ============================================================================
// 模板结构
// ============================================================================

/**
 * 模板变量定义
 */
export interface TemplateVariable {
  /** 变量名称 */
  name: string;
  /** 变量标签 */
  label: string;
  /** 变量类型 */
  type: TemplateVariableType;
  /** 默认值 */
  defaultValue?: string | number | boolean;
  /** 是否必填 */
  required: boolean;
  /** 占位符 */
  placeholder?: string;
  /** 选项 (select/multiselect 类型) */
  options?: Array<{
    value: string;
    label: string;
  }>;
  /** 验证规则 */
  validation?: {
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
    pattern?: string;
  };
}

/**
 * 模板 Prompt 部分
 */
export interface TemplatePromptSection {
  /** 部分 ID */
  id: string;
  /** 部分名称 */
  name: string;
  /** Prompt 内容 (支持变量插值) */
  content: string;
  /** 是否必需 */
  required: boolean;
  /** 顺序 */
  order: number;
}

/**
 * 自定义模板
 */
export interface CustomTemplate {
  /** 模板 ID */
  id: string;
  /** 创建者 ID */
  userId: string;
  /** 模板名称 */
  name: string;
  /** 模板描述 */
  description: string;
  /** 模板图标 */
  icon?: string;
  /** 基于的蓝图类型 */
  baseBlueprint?: string;
  /** 模板变量 */
  variables: TemplateVariable[];
  /** Prompt 部分 */
  promptSections: TemplatePromptSection[];
  /** 输出格式指引 */
  outputFormat?: string;
  /** 可见性 */
  visibility: TemplateVisibility;
  /** 状态 */
  status: TemplateStatus;
  /** 版本号 */
  version: number;
  /** 使用次数 */
  usageCount: number;
  /** 创建时间 */
  createdAt: Date;
  /** 更新时间 */
  updatedAt: Date;
  /** 标签 */
  tags?: string[];
}

/**
 * 模板使用记录
 */
export interface TemplateUsage {
  /** 记录 ID */
  id: string;
  /** 模板 ID */
  templateId: string;
  /** 用户 ID */
  userId: string;
  /** 使用时间 */
  timestamp: Date;
  /** 变量值 */
  variableValues: Record<string, unknown>;
  /** 生成的报告 ID */
  reportId?: string;
  /** 用户评分 */
  rating?: number;
  /** 用户反馈 */
  feedback?: string;
}

// ============================================================================
// 模板版本
// ============================================================================

/**
 * 模板版本记录
 */
export interface TemplateVersion {
  /** 版本 ID */
  id: string;
  /** 模板 ID */
  templateId: string;
  /** 版本号 */
  version: number;
  /** 变更说明 */
  changelog: string;
  /** 变量快照 */
  variables: TemplateVariable[];
  /** Prompt 部分快照 */
  promptSections: TemplatePromptSection[];
  /** 创建时间 */
  createdAt: Date;
  /** 创建者 ID */
  createdBy: string;
}

// ============================================================================
// 服务接口 (Phase 3 存根)
// ============================================================================

/**
 * 模板管理服务接口
 * @stub Phase 3 实现
 */
export interface ITemplateService {
  /** 创建模板 */
  createTemplate(
    template: Omit<
      CustomTemplate,
      "id" | "createdAt" | "updatedAt" | "version" | "usageCount"
    >,
  ): Promise<CustomTemplate>;
  /** 更新模板 */
  updateTemplate(
    templateId: string,
    updates: Partial<CustomTemplate>,
  ): Promise<CustomTemplate>;
  /** 删除模板 */
  deleteTemplate(templateId: string, userId: string): Promise<void>;
  /** 获取模板 */
  getTemplate(templateId: string): Promise<CustomTemplate | null>;
  /** 获取用户模板列表 */
  getUserTemplates(userId: string): Promise<CustomTemplate[]>;
  /** 搜索公开模板 */
  searchPublicTemplates(query: string): Promise<CustomTemplate[]>;
  /** 复制模板 */
  cloneTemplate(templateId: string, userId: string): Promise<CustomTemplate>;
  /** 获取模板版本历史 */
  getVersionHistory(templateId: string): Promise<TemplateVersion[]>;
  /** 回滚到指定版本 */
  rollbackToVersion(
    templateId: string,
    version: number,
  ): Promise<CustomTemplate>;
  /** 记录模板使用 */
  recordUsage(usage: Omit<TemplateUsage, "id">): Promise<void>;
}

/**
 * Prompt 编译器接口
 * @stub Phase 3 实现
 */
export interface IPromptCompiler {
  /** 编译模板为最终 Prompt */
  compile(
    template: CustomTemplate,
    variableValues: Record<string, unknown>,
  ): string;
  /** 验证变量值 */
  validateVariables(
    template: CustomTemplate,
    variableValues: Record<string, unknown>,
  ): { valid: boolean; errors: string[] };
  /** 预览编译结果 */
  preview(
    template: CustomTemplate,
    variableValues: Record<string, unknown>,
  ): { prompt: string; estimatedTokens: number };
}

// ============================================================================
// Zod Schemas for Runtime Validation (P1 类型安全修复)
// ============================================================================

/**
 * TemplateVariable 运行时验证 Schema
 */
export const TemplateVariableSchema = z.object({
  name: z.string(),
  label: z.string(),
  type: z.enum(["text", "number", "select", "multiselect", "boolean"]),
  defaultValue: z.union([z.string(), z.number(), z.boolean()]).optional(),
  required: z.boolean(),
  placeholder: z.string().optional(),
  options: z
    .array(
      z.object({
        value: z.string(),
        label: z.string(),
      }),
    )
    .optional(),
  validation: z
    .object({
      minLength: z.number().optional(),
      maxLength: z.number().optional(),
      min: z.number().optional(),
      max: z.number().optional(),
      pattern: z.string().optional(),
    })
    .optional(),
});

/**
 * TemplatePromptSection 运行时验证 Schema
 */
export const TemplatePromptSectionSchema = z.object({
  id: z.string(),
  name: z.string(),
  content: z.string(),
  required: z.boolean(),
  order: z.number(),
});

/**
 * 安全解析 JSON 列为 TemplateVariable[]
 * @param json - 数据库 JSON 列值
 * @param context - 调用上下文（用于日志）
 * @returns 解析后的变量数组，无效时返回空数组
 */
export function parseTemplateVariables(
  json: unknown,
  context?: string,
): TemplateVariable[] {
  if (!json) return [];

  const result = z.array(TemplateVariableSchema).safeParse(json);
  if (!result.success) {
    logger.warn(
      { context, error: result.error.message },
      "Invalid template variables JSON, returning empty array",
    );
    return [];
  }
  return result.data;
}

/**
 * 安全解析 JSON 列为 TemplatePromptSection[]
 * @param json - 数据库 JSON 列值
 * @param context - 调用上下文（用于日志）
 * @returns 解析后的 Prompt 部分数组，无效时返回空数组
 */
export function parsePromptSections(
  json: unknown,
  context?: string,
): TemplatePromptSection[] {
  if (!json) return [];

  const result = z.array(TemplatePromptSectionSchema).safeParse(json);
  if (!result.success) {
    logger.warn(
      { context, error: result.error.message },
      "Invalid prompt sections JSON, returning empty array",
    );
    return [];
  }
  return result.data;
}
