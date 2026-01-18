/**
 * 智能分类 v5.0 - LLM Service 类型定义
 */

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
  /** 候选文件夹列表 */
  candidates: Array<{
    id: string;
    name: string;
    description?: string;
  }>;
}

/**
 * LLM 分类响应
 */
export interface LLMClassificationResponse {
  /** 选择的文件夹ID */
  folderId: string;
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
    public readonly retryable: boolean = false
  ) {
    super(message);
    this.name = 'LLMError';
  }
}
