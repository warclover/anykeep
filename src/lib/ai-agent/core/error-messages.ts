/**
 * AI Agent 错误消息映射
 *
 * 将技术错误转换为用户友好的提示信息
 *
 * @version 1.0.0
 * @since 2025-12-23
 */

// ============================================
// 错误消息映射表
// ============================================

/**
 * 已知错误码 -> 用户友好消息
 */
const ERROR_CODE_MESSAGES: Record<string, string> = {
  // Supabase/PostgreSQL 错误
  PGRST301: "数据库连接超时，请稍后重试",
  PGRST204: "没有找到符合条件的内容",
  PGRST116: "查询结果为空",
  "42501": "权限不足，请刷新页面后重试",
  "23505": "数据重复，操作已取消",

  // 认证错误
  AUTH_ERROR: "登录已过期，请刷新页面重新登录",
  UNAUTHORIZED: "没有权限执行此操作",
  SESSION_EXPIRED: "会话已过期，请刷新页面",

  // API 限流
  RATE_LIMIT: "请求太频繁，请稍后重试",
  TOO_MANY_REQUESTS: "AI 服务繁忙，请稍等片刻",

  // 工具执行错误
  TOOL_TIMEOUT: "操作超时，请重试",
  EXECUTION_ERROR: "执行失败，请稍后重试",
  VALIDATION_ERROR: "参数有误，请换个说法试试",

  // 数据库错误
  DB_ERROR: "数据库操作失败，请稍后重试",
  CONNECTION_ERROR: "数据库连接失败，请刷新页面",
};

/**
 * 错误消息模式匹配
 * [正则模式, 用户友好消息]
 */
const ERROR_PATTERNS: Array<[RegExp, string]> = [
  // 网络错误
  [
    /fetch|network|ECONNREFUSED|ETIMEDOUT/i,
    "网络连接出现问题，请检查网络后重试",
  ],
  [/timeout|timed out/i, "请求超时，请稍后重试"],

  // API 错误
  [/rate limit|429/i, "请求太频繁，请稍等片刻"],
  [/401|unauthorized/i, "登录已过期，请刷新页面"],
  [/403|forbidden/i, "没有权限执行此操作"],
  [/404|not found/i, "未找到相关内容"],
  [/500|internal server/i, "服务器出错了，请稍后重试"],
  [/502|503|504/i, "服务暂时不可用，请稍后重试"],

  // AI 服务错误
  [/openai|anthropic|ai.*api/i, "AI 服务暂时不可用，请稍后重试"],
  [/embedding|vector/i, "智能搜索服务出错，请稍后重试"],

  // 数据验证
  [/invalid|validation/i, "输入内容有误，请检查后重试"],
  [/required|missing/i, "缺少必要信息，请补充后重试"],
];

// ============================================
// 工具函数
// ============================================

/**
 * 将错误转换为用户友好的消息
 *
 * @param error 原始错误
 * @returns 用户友好的错误消息
 */
export function getUserFriendlyError(error: unknown): string {
  // 提取错误信息
  const errorMessage =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "Unknown error";

  // 1. 检查已知错误码
  for (const [code, message] of Object.entries(ERROR_CODE_MESSAGES)) {
    if (errorMessage.includes(code)) {
      return message;
    }
  }

  // 2. 检查错误模式
  for (const [pattern, message] of ERROR_PATTERNS) {
    if (pattern.test(errorMessage)) {
      return message;
    }
  }

  // 3. 开发环境返回原始错误，便于调试
  if (process.env.NODE_ENV === "development") {
    return `调试信息: ${errorMessage}`;
  }

  // 4. 生产环境返回默认错误消息
  return "操作遇到问题，请稍后重试";
}

/**
 * 创建带错误码的错误对象
 *
 * @param code 错误码
 * @param originalError 原始错误
 * @returns 包含用户友好消息的错误对象
 */
export function createFriendlyError(
  code: string,
  originalError?: unknown,
): { code: string; message: string; originalMessage?: string } {
  const friendlyMessage =
    ERROR_CODE_MESSAGES[code] || getUserFriendlyError(originalError);
  const originalMessage =
    originalError instanceof Error ? originalError.message : undefined;

  return {
    code,
    message: friendlyMessage,
    originalMessage,
  };
}

/**
 * 判断错误是否为可重试的错误
 *
 * @param error 错误信息
 * @returns 是否可重试
 */
export function isRetryableError(error: unknown): boolean {
  const errorMessage =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";

  const retryablePatterns = [
    /timeout|timed out/i,
    /network|ECONNREFUSED|ETIMEDOUT/i,
    /rate limit|429|too many/i,
    /502|503|504/i,
    /temporarily unavailable/i,
  ];

  return retryablePatterns.some((pattern) => pattern.test(errorMessage));
}
