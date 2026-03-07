/**
 * 类型安全的环境变量访问层
 *
 * 提供统一的环境变量访问接口，避免 process.env! 非空断言
 * 在访问时进行验证，确保必需的环境变量存在
 *
 * @module lib/env
 * @version 1.0.0
 * @since 2025-12-30
 */

// ============================================
// 类型定义
// ============================================

/**
 * 环境变量访问选项
 */
interface EnvOptions {
  /** 是否为必需变量（默认 true） */
  required?: boolean;
  /** 默认值（仅当 required=false 时有效） */
  defaultValue?: string;
}

/**
 * 环境变量验证错误
 */
class EnvValidationError extends Error {
  constructor(public readonly missingVars: string[]) {
    super(`Missing required environment variables: ${missingVars.join(", ")}`);
    this.name = "EnvValidationError";
  }
}

// ============================================
// 核心工具函数
// ============================================

/**
 * 获取环境变量值
 *
 * @param key - 环境变量名称
 * @param options - 访问选项
 * @returns 环境变量值
 * @throws Error 当必需变量缺失时
 */
function getEnvVar(key: string, options: EnvOptions = {}): string {
  const { required = true, defaultValue = "" } = options;
  const value = process.env[key];

  if (value !== undefined && value !== "") {
    return value;
  }

  if (required) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return defaultValue;
}

/**
 * 获取可选环境变量值
 *
 * @param key - 环境变量名称
 * @param defaultValue - 默认值
 * @returns 环境变量值或默认值
 */
function getOptionalEnvVar(key: string, defaultValue = ""): string {
  return getEnvVar(key, { required: false, defaultValue });
}

/**
 * 检查环境变量是否存在
 *
 * @param key - 环境变量名称
 * @returns 是否存在且非空
 */
function hasEnvVar(key: string): boolean {
  const value = process.env[key];
  return value !== undefined && value !== "";
}

// ============================================
// Supabase 环境变量
// ============================================

// 警告标志，避免重复输出警告
let hasWarnedAboutSupabaseEnv = false;

/**
 * Supabase 相关环境变量
 * 用于数据库连接和认证
 */
export const supabaseEnv = {
  /** Supabase 项目 URL（公开） */
  get url(): string {
    const value = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!value || value === "") {
      // 在开发环境中提供默认值并输出警告
      if (
        process.env.NODE_ENV === "development" ||
        process.env.NODE_ENV === "test"
      ) {
        if (!hasWarnedAboutSupabaseEnv) {
          console.info(
            "⚠️  Missing NEXT_PUBLIC_SUPABASE_URL. Using placeholder value.",
            "\nPlease create .env.local with your Supabase configuration.",
            "\nSee README.md for setup instructions.",
          );
          hasWarnedAboutSupabaseEnv = true;
        }
        return "https://placeholder.supabase.co";
      }
      throw new Error(
        "Missing required environment variable: NEXT_PUBLIC_SUPABASE_URL",
      );
    }
    return value;
  },

  /** Supabase 匿名密钥（公开，用于客户端） */
  get anonKey(): string {
    const value = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!value || value === "") {
      // 在开发环境中提供默认值并输出警告
      if (
        process.env.NODE_ENV === "development" ||
        process.env.NODE_ENV === "test"
      ) {
        if (!hasWarnedAboutSupabaseEnv) {
          console.info(
            "⚠️  Missing NEXT_PUBLIC_SUPABASE_ANON_KEY. Using placeholder value.",
            "\nPlease create .env.local with your Supabase configuration.",
            "\nSee README.md for setup instructions.",
          );
          hasWarnedAboutSupabaseEnv = true;
        }
        return "placeholder-anon-key";
      }
      throw new Error(
        "Missing required environment variable: NEXT_PUBLIC_SUPABASE_ANON_KEY",
      );
    }
    return value;
  },

  /** Supabase 服务角色密钥（私密，仅服务端） */
  get serviceRoleKey(): string {
    const value = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!value || value === "") {
      // 在开发环境中提供默认值并输出警告
      if (
        process.env.NODE_ENV === "development" ||
        process.env.NODE_ENV === "test"
      ) {
        if (!hasWarnedAboutSupabaseEnv) {
          console.info(
            "⚠️  Missing SUPABASE_SERVICE_ROLE_KEY. Using placeholder value.",
            "\nPlease create .env.local with your Supabase configuration.",
            "\nSee README.md for setup instructions.",
          );
          hasWarnedAboutSupabaseEnv = true;
        }
        return "placeholder-service-role-key";
      }
      throw new Error(
        "Missing required environment variable: SUPABASE_SERVICE_ROLE_KEY",
      );
    }
    return value;
  },

  /** 检查服务角色密钥是否可用 */
  get hasServiceRoleKey(): boolean {
    return hasEnvVar("SUPABASE_SERVICE_ROLE_KEY");
  },

  /** Supabase JWT 密钥（用于本地 JWT 验证） */
  get jwtSecret(): string {
    return getEnvVar("SUPABASE_JWT_SECRET");
  },

  /** JWT 密钥版本号（用于密钥轮换） */
  get jwtSecretVersion(): string {
    return getOptionalEnvVar("SUPABASE_JWT_SECRET_VERSION", "1");
  },

  /** 插件 JWT 密钥（fallback 到 Supabase JWT 密钥） */
  get pluginJwtSecret(): string {
    const pluginSecret = getOptionalEnvVar("PLUGIN_JWT_SECRET", "");
    if (pluginSecret) return pluginSecret;
    return this.jwtSecret;
  },
} as const;

// ============================================
// AI 服务环境变量
// ============================================

/**
 * AI 服务相关环境变量
 */
export const aiEnv = {
  /** DashScope API 密钥（阿里云通义） */
  get dashscopeApiKey(): string {
    return getEnvVar("DASHSCOPE_API_KEY");
  },

  /** DashScope API 密钥是否可用 */
  get hasDashscopeApiKey(): boolean {
    return hasEnvVar("DASHSCOPE_API_KEY");
  },

  /** DeepSeek API 密钥 */
  get deepseekApiKey(): string {
    return getEnvVar("DEEPSEEK_API_KEY");
  },

  /** DeepSeek API 密钥是否可用 */
  get hasDeepseekApiKey(): boolean {
    return hasEnvVar("DEEPSEEK_API_KEY");
  },

  /** OpenAI API 密钥 */
  get openaiApiKey(): string {
    return getEnvVar("OPENAI_API_KEY");
  },

  /** OpenAI API 密钥是否可用 */
  get hasOpenaiApiKey(): boolean {
    return hasEnvVar("OPENAI_API_KEY");
  },

  /** Anthropic API 密钥 */
  get anthropicApiKey(): string {
    return getEnvVar("ANTHROPIC_API_KEY");
  },

  /** Anthropic API 密钥是否可用 */
  get hasAnthropicApiKey(): boolean {
    return hasEnvVar("ANTHROPIC_API_KEY");
  },

  /** Embedding API 密钥（优先 EMBEDDING_API_KEY，fallback 到 DASHSCOPE_API_KEY） */
  get embeddingApiKey(): string {
    const embeddingKey = getOptionalEnvVar("EMBEDDING_API_KEY", "");
    if (embeddingKey) return embeddingKey;
    return getOptionalEnvVar("DASHSCOPE_API_KEY", "");
  },

  /** Embedding API 密钥是否可用 */
  get hasEmbeddingApiKey(): boolean {
    return hasEnvVar("EMBEDDING_API_KEY") || hasEnvVar("DASHSCOPE_API_KEY");
  },

  /** Embedding API Base URL */
  get embeddingApiBaseUrl(): string {
    return getOptionalEnvVar(
      "EMBEDDING_API_BASE_URL",
      "https://dashscope.aliyuncs.com/compatible-mode/v1",
    );
  },

  /** Embedding 模型名称 */
  get embeddingModel(): string {
    return getOptionalEnvVar("EMBEDDING_MODEL", "text-embedding-v4");
  },

  /** OpenAI API Base URL（支持代理） */
  get openaiApiBaseUrl(): string {
    return getOptionalEnvVar("OPENAI_API_BASE_URL", "");
  },

  /** OpenAI 模型名称 */
  get openaiModel(): string {
    return getOptionalEnvVar("OPENAI_MODEL", "");
  },
} as const;

// ============================================
// 应用环境变量
// ============================================

/**
 * 应用相关环境变量
 */
export const appEnv = {
  /** 当前运行环境 */
  get nodeEnv(): string {
    return getOptionalEnvVar("NODE_ENV", "development");
  },

  /** 是否为生产环境 */
  get isProduction(): boolean {
    return this.nodeEnv === "production";
  },

  /** 是否为开发环境 */
  get isDevelopment(): boolean {
    return this.nodeEnv === "development";
  },

  /** 是否为测试环境 */
  get isTest(): boolean {
    return this.nodeEnv === "test";
  },

  /** 应用 URL */
  get appUrl(): string {
    return getOptionalEnvVar("NEXT_PUBLIC_APP_URL", "http://localhost:3000");
  },

  /** Cron 密钥（用于内部定时任务验证） */
  get cronSecret(): string {
    return getOptionalEnvVar("CRON_SECRET", "");
  },

  /** 是否有 Cron 密钥 */
  get hasCronSecret(): boolean {
    return hasEnvVar("CRON_SECRET");
  },
} as const;

// ============================================
// Sentry 环境变量
// ============================================

/**
 * Sentry 监控相关环境变量
 */
export const sentryEnv = {
  /** Sentry DSN */
  get dsn(): string {
    return getOptionalEnvVar("SENTRY_DSN", "");
  },

  /** Sentry Auth Token */
  get authToken(): string {
    return getOptionalEnvVar("SENTRY_AUTH_TOKEN", "");
  },

  /** 是否启用 Sentry */
  get isEnabled(): boolean {
    return hasEnvVar("SENTRY_DSN");
  },
} as const;

// ============================================
// 验证函数
// ============================================

/**
 * 验证所有必需的环境变量
 * 应在应用启动时调用
 *
 * @throws EnvValidationError 当有必需变量缺失时
 */
export function validateRequiredEnvVars(): void {
  const requiredVars = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  ];

  const missingVars = requiredVars.filter((key) => !hasEnvVar(key));

  if (missingVars.length > 0) {
    throw new EnvValidationError(missingVars);
  }
}

/**
 * 验证服务端必需的环境变量
 * 应在服务端代码初始化时调用
 *
 * @throws EnvValidationError 当有必需变量缺失时
 */
export function validateServerEnvVars(): void {
  validateRequiredEnvVars();

  const serverVars = ["SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_JWT_SECRET"];
  const missingVars = serverVars.filter((key) => !hasEnvVar(key));

  if (missingVars.length > 0) {
    throw new EnvValidationError(missingVars);
  }
}

// ============================================
// 导出
// ============================================

export { getEnvVar, getOptionalEnvVar, hasEnvVar, EnvValidationError };

/**
 * 统一环境变量访问对象
 */
export const env = {
  supabase: supabaseEnv,
  ai: aiEnv,
  app: appEnv,
  sentry: sentryEnv,
  validate: validateRequiredEnvVars,
  validateServer: validateServerEnvVars,
} as const;

export default env;
