/**
 * AI Skills 核心类型定义
 *
 * Phase 0: 基础设施层
 *
 * @version 1.0.0
 * @since 2025-12-22
 */

import type { z } from "zod";

// ============================================
// Skill 元数据类型
// ============================================

/**
 * Skill 分类
 */
export type SkillCategory =
  | "understanding" // 理解类：摘要、分类、实体提取
  | "organizing" // 整理类：归档、标签、关联
  | "learning" // 学习类：复盘、问答、笔记
  | "utility"; // 工具类：搜索、导出、统计

/**
 * Skill 元数据
 */
export interface SkillMetadata {
  /** Skill 唯一标识 */
  id: string;
  /** Skill 显示名称 */
  name: string;
  /** Skill 描述（用于 LLM 理解） */
  description: string;
  /** Skill 分类 */
  category: SkillCategory;
  /** 版本号 */
  version: string;
  /** 作者 */
  author: string;
  /** 能力标签 */
  capabilities: string[];
  /** 是否需要确认才能执行 */
  requiresConfirmation?: boolean;
  /** 预估执行时间（毫秒） */
  estimatedDurationMs?: number;
  /** 最大执行时间（毫秒） */
  maxExecutionTimeMs?: number;
}

// ============================================
// Skill 执行上下文
// ============================================

/**
 * 用户偏好设置
 */
export interface UserPreferences {
  /** 语言偏好 */
  language: "zh-CN" | "en-US";
  /** 摘要风格 */
  summaryStyle?: "concise" | "detailed" | "bullet";
  /** 是否启用自动分类 */
  autoClassify?: boolean;
  /** 分类置信度阈值 */
  classifyThreshold?: number;
}

/**
 * Skill 执行上下文
 */
export interface SkillContext {
  /** 用户 ID */
  userId: string;
  /** 会话 ID（可选） */
  conversationId?: string;
  /** 关联的书签 ID 列表 */
  bookmarkIds?: number[];
  /** 关联的文件夹 ID */
  folderId?: number;
  /** 用户偏好 */
  userPreferences?: UserPreferences;
  /** 最大执行时间（毫秒） */
  maxExecutionTime?: number;
  /** 是否为调试模式 */
  debug?: boolean;
  /** 追踪 ID（用于日志关联） */
  traceId?: string;
  /** 额外的元数据 */
  metadata?: Record<string, unknown>;

  // ============================================
  // 附件上下文（v2.0 新增）
  // ============================================

  /** 附件书签 ID 数组（用于 Skill 直接操作附件） */
  attachmentBookmarkIds?: number[];
  /** 附件元数据 */
  attachmentMetadata?: {
    /** 书签附件数量 */
    bookmarkCount: number;
    /** 文件附件数量 */
    fileCount: number;
    /** 总内容长度 */
    totalContentLength: number;
    /** 是否所有附件内容都就绪 */
    allReady: boolean;
  };
}

// ============================================
// Skill 执行结果
// ============================================

/**
 * Skill 执行指标
 */
export interface SkillExecutionMetrics {
  /** 执行时间（毫秒） */
  executionTimeMs: number;
  /** Token 使用量 */
  tokensUsed?: number;
  /** 是否命中缓存 */
  cacheHit?: boolean;
  /** LLM 调用次数 */
  llmCallCount?: number;
  /** 重试次数 */
  retryCount?: number;
}

/**
 * Skill 执行成功结果
 */
export interface SkillSuccessOutput<T> {
  success: true;
  data: T;
  metrics: SkillExecutionMetrics;
}

/**
 * Skill 执行失败结果
 */
export interface SkillErrorOutput {
  success: false;
  error: string;
  errorCode?: string;
  metrics: SkillExecutionMetrics;
}

/**
 * Skill 执行结果（联合类型）
 */
export type SkillOutput<T> = SkillSuccessOutput<T> | SkillErrorOutput;

// ============================================
// Skill 执行状态
// ============================================

/**
 * Skill 执行状态枚举
 */
export type SkillExecutionStatus =
  | "pending"
  | "running"
  | "success"
  | "error"
  | "timeout"
  | "cancelled";

/**
 * Skill 执行记录（对应数据库 ai_skill_executions 表）
 */
export interface SkillExecutionRecord {
  id: string;
  userId: string;
  conversationId?: string;
  messageId?: string;
  skillId: string;
  skillVersion: string;
  input: unknown;
  output?: unknown;
  status: SkillExecutionStatus;
  latencyMs?: number;
  tokensUsed?: number;
  errorMessage?: string;
  errorCode?: string;
  retryCount: number;
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
}

// ============================================
// Tool 相关类型（用于 Vercel AI SDK）
// ============================================

/**
 * Tool 定义（简化版，用于导出给 AI SDK）
 */
export interface ToolDefinition {
  /** Tool 名称 */
  name: string;
  /** Tool 描述 */
  description: string;
  /** 参数 Schema（JSON Schema 格式） */
  parameters: Record<string, unknown>;
}

/**
 * Tool 调用请求
 */
export interface ToolCallRequest {
  /** Tool 调用 ID */
  toolCallId: string;
  /** Tool 名称 */
  toolName: string;
  /** 输入参数 */
  input: unknown;
}

/**
 * Tool 调用结果
 */
export interface ToolCallResult {
  /** Tool 调用 ID */
  toolCallId: string;
  /** Tool 名称 */
  toolName: string;
  /** 执行结果 */
  output: unknown;
  /** 是否成功 */
  success: boolean;
  /** 错误信息 */
  error?: string;
}

// ============================================
// 会话和消息类型
// ============================================

/**
 * Agent 类型
 */
export type AgentType =
  | "knowledge" // 知识助手
  | "organize" // 整理助手
  | "learn"; // 学习助手

/**
 * 消息角色
 */
export type MessageRole = "user" | "assistant" | "system" | "tool";

/**
 * AI 会话（对应数据库 ai_conversations 表）
 */
export interface AIConversation {
  id: string;
  userId: string;
  title?: string;
  agentType: AgentType;
  contextBookmarkIds: number[];
  contextFolderId?: number;
  metadata: Record<string, unknown>;
  status: "active" | "archived" | "deleted";
  messageCount: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * AI 消息（对应数据库 ai_messages 表）
 */
export interface AIMessage {
  id: string;
  conversationId: string;
  role: MessageRole;
  content?: string;
  toolCalls?: ToolCallRequest[];
  toolResults?: ToolCallResult[];
  toolCallId?: string;
  metadata: Record<string, unknown>;
  tokensPrompt: number;
  tokensCompletion: number;
  createdAt: Date;
}

// ============================================
// BaseSkill 接口
// ============================================

/**
 * BaseSkill 接口定义
 * 所有 Skill 都必须实现此接口
 */
export interface ISkill<TInput = unknown, TOutput = unknown> {
  /** Skill 元数据 */
  readonly metadata: SkillMetadata;
  /** 输入 Schema（Zod） */
  readonly inputSchema: z.ZodSchema<TInput>;
  /** 输出 Schema（Zod） */
  readonly outputSchema: z.ZodSchema<TOutput>;

  /**
   * 执行 Skill
   */
  execute(input: TInput, context: SkillContext): Promise<SkillOutput<TOutput>>;

  /**
   * 验证输入
   */
  validateInput(input: unknown): TInput;

  /**
   * 验证输出
   */
  validateOutput(output: unknown): TOutput;
}

// ============================================
// 辅助类型
// ============================================

/**
 * 从 Skill 提取输入类型
 */
export type SkillInput<T extends ISkill> =
  T extends ISkill<infer I, unknown> ? I : never;

/**
 * 从 Skill 提取输出类型
 */
export type SkillOutputType<T extends ISkill> =
  T extends ISkill<unknown, infer O> ? O : never;

/**
 * Skill 构造器类型
 */
export type SkillConstructor<T extends ISkill = ISkill> = new () => T;

/**
 * Skill 注册信息
 */
export interface SkillRegistration {
  skill: ISkill;
  registeredAt: Date;
  enabled: boolean;
}
