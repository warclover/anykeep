/**
 * 智能分类 v5.0 - LLM Service 类型定义
 */

import type { FolderId } from "@/lib/shared/types";

/**
 * LLM 配置
 */
export interface LLMConfig {
  /** API Key */
  apiKey: string;
  /** 模型名称 */
  model: string;
  /** API Base URL */
  baseURL: string;
  /** 温度参数 */
  temperature: number;
  /** 最大重试次数 */
  maxRetries: number;
  /** 超时时间（毫秒） */
  timeout: number;
}

/**
 * LLM 分类请求
 */
export interface LLMClassificationRequest {
  /** 书签标题 */
  title: string;
  /** 书签描述 */
  description?: string;
  /** 书签URL */
  url: string;
  /** 书签摘要 */
  summary?: string;
  /** 书签标签 */
  tags?: string[];
  /** 候选文件夹列表 */
  candidates: Array<{
    id: string;
    name: string;
    description?: string;
    /** v6: 示例书签标题（用于帮助 LLM 理解文件夹内容） */
    sampleBookmarks?: string[];
    /** v6: 关键词标签 */
    keywordTags?: string[];
    /** v6: 匹配分数 */
    score?: number;
  }>;
}

/**
 * LLM 分类响应
 */
export interface LLMClassificationResponse {
  /** 选择的文件夹ID */
  folderId: FolderId;
  /** 置信度 (0.0-1.0) */
  confidence: number;
  /** 选择理由 */
  reasoning: string;
  /** Token 使用量 */
  tokens: {
    prompt: number;
    completion: number;
    total: number;
  };
}

/**
 * LLM 错误类型
 */
export class LLMError extends Error {
  constructor(
    message: string,
    public readonly cause?: Error,
    public readonly retryable: boolean = false,
  ) {
    super(message);
    this.name = "LLMError";
  }
}
