/**
 * AI 摘要调试配置存储
 *
 * 提供热更新的配置管理，支持在开发环境中实时调整 AI 摘要参数
 *
 * 存储优先级：localStorage (调试配置) > 环境变量 > 默认配置
 *
 * @version 1.0.0
 * @since 2025-12-06
 */

import type { ContentType } from "../content-type-detector";
import { clientLogger } from "@/lib/client-logger";

// ==================== 类型定义 ====================

/**
 * 内容类型专用参数
 */
export interface ContentTypeParams {
  temperature: number;
  summaryMinLength: number;
  summaryMaxLength: number;
}

/**
 * AI 调试配置接口
 */
export interface AIDebugConfig {
  /** 配置版本，用于迁移 */
  version: number;

  /** 是否启用调试配置（关闭时使用默认配置） */
  enabled: boolean;

  /** 模型参数 */
  model: {
    /** API 超时时间（毫秒） */
    timeout: number;
    /** 最大生成 token 数 */
    maxTokens: number;
    /** 默认 temperature（当类型专用配置未设置时使用） */
    defaultTemperature: number;
  };

  /** 输出格式配置 */
  output: {
    /** 是否使用 JSON 格式（V2） */
    useJsonFormat: boolean;
    /** 摘要最小长度（字符） */
    summaryMinLength: number;
    /** 摘要最大长度（字符） */
    summaryMaxLength: number;
  };

  /** 内容类型检测权重 */
  detection: {
    /** URL 规则权重 (0-100) */
    urlWeight: number;
    /** 关键词权重 (0-100) */
    keywordWeight: number;
    /** 内容特征权重 (0-100) */
    contentWeight: number;
  };

  /** 按内容类型的参数覆盖 */
  contentTypeOverrides: Partial<Record<ContentType, ContentTypeParams>>;

  /** 特性开关 */
  features: {
    /** Jina Reader 内容提取 */
    jinaReader: boolean;
    /** 智能模型路由 */
    modelRouting: boolean;
    /** 详细调试日志 */
    debugLogging: boolean;
  };
}

// ==================== 常量定义 ====================

/** 配置存储 key */
const STORAGE_KEY = "ai-debug-config";

/** 配置变更事件名 */
export const CONFIG_CHANGED_EVENT = "ai-debug-config-changed";

/** 当前配置版本 */
const CURRENT_VERSION = 1;

/** 默认配置 */
const DEFAULT_DEBUG_CONFIG: AIDebugConfig = {
  version: CURRENT_VERSION,
  enabled: false,

  model: {
    timeout: 15000,
    maxTokens: 2000,
    defaultTemperature: 0.7,
  },

  output: {
    useJsonFormat: false,
    summaryMinLength: 100,
    summaryMaxLength: 700,
  },

  detection: {
    urlWeight: 40,
    keywordWeight: 35,
    contentWeight: 25,
  },

  contentTypeOverrides: {
    article: { temperature: 0.7, summaryMinLength: 100, summaryMaxLength: 700 },
    tutorial: {
      temperature: 0.3,
      summaryMinLength: 150,
      summaryMaxLength: 550,
    },
    video: { temperature: 0.5, summaryMinLength: 80, summaryMaxLength: 350 },
    tool: { temperature: 0.3, summaryMinLength: 100, summaryMaxLength: 400 },
  },

  features: {
    jinaReader: false,
    modelRouting: false,
    debugLogging: false,
  },
};

// ==================== 存储操作 ====================

/**
 * 检查是否在浏览器环境
 */
function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

/**
 * 检查是否为开发环境
 */
export function isDevEnvironment(): boolean {
  return process.env.NODE_ENV === "development";
}

/**
 * 从 localStorage 读取配置
 */
function loadFromStorage(): AIDebugConfig | null {
  if (!isBrowser()) return null;

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;

    const parsed = JSON.parse(stored) as AIDebugConfig;

    // 版本迁移（如果需要）
    if (parsed.version !== CURRENT_VERSION) {
      return migrateConfig(parsed);
    }

    return parsed;
  } catch {
    clientLogger.warn(
      "[AIDebugConfig] Failed to parse stored config, using default",
    );
    return null;
  }
}

/**
 * 配置迁移（预留）
 */
function migrateConfig(oldConfig: AIDebugConfig): AIDebugConfig {
  // 当前版本无需迁移，直接合并
  return {
    ...DEFAULT_DEBUG_CONFIG,
    ...oldConfig,
    version: CURRENT_VERSION,
  };
}

/**
 * 保存配置到 localStorage
 */
function saveToStorage(config: AIDebugConfig): void {
  if (!isBrowser()) return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch (error) {
    console.error("[AIDebugConfig] Failed to save config:", error);
  }
}

// ==================== 公共 API ====================

/**
 * 获取当前调试配置
 *
 * @returns 当前生效的调试配置
 */
export function getDebugConfig(): AIDebugConfig {
  // 非开发环境返回禁用状态的默认配置
  if (!isDevEnvironment()) {
    return { ...DEFAULT_DEBUG_CONFIG, enabled: false };
  }

  const stored = loadFromStorage();
  if (stored) {
    return { ...DEFAULT_DEBUG_CONFIG, ...stored };
  }

  return DEFAULT_DEBUG_CONFIG;
}

/**
 * 更新调试配置
 *
 * @param updates - 要更新的配置字段
 */
export function setDebugConfig(updates: Partial<AIDebugConfig>): void {
  if (!isDevEnvironment()) {
    clientLogger.warn(
      "[AIDebugConfig] Config updates are disabled in production",
    );
    return;
  }

  const current = getDebugConfig();
  const merged = deepMerge(current, updates);

  saveToStorage(merged);

  // 广播配置变更事件
  if (isBrowser()) {
    window.dispatchEvent(
      new CustomEvent(CONFIG_CHANGED_EVENT, { detail: merged }),
    );
  }
}

/**
 * 重置配置为默认值
 */
export function resetDebugConfig(): void {
  if (!isDevEnvironment()) return;

  if (isBrowser()) {
    localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(
      new CustomEvent(CONFIG_CHANGED_EVENT, { detail: DEFAULT_DEBUG_CONFIG }),
    );
  }
}

/**
 * 检查调试配置是否启用
 */
export function isDebugConfigEnabled(): boolean {
  if (!isDevEnvironment()) return false;
  return getDebugConfig().enabled;
}

/**
 * 导出配置为 JSON 字符串
 */
export function exportConfigAsJson(): string {
  return JSON.stringify(getDebugConfig(), null, 2);
}

/**
 * 从 JSON 字符串导入配置
 */
export function importConfigFromJson(json: string): boolean {
  try {
    const parsed = JSON.parse(json) as AIDebugConfig;

    // 验证基本结构
    if (
      typeof parsed.enabled !== "boolean" ||
      typeof parsed.model !== "object"
    ) {
      throw new Error("Invalid config structure");
    }

    setDebugConfig(parsed);
    return true;
  } catch (error) {
    console.error("[AIDebugConfig] Failed to import config:", error);
    return false;
  }
}

/**
 * 获取特定内容类型的参数
 */
export function getContentTypeParams(
  contentType: ContentType,
): ContentTypeParams {
  const config = getDebugConfig();
  const override = config.contentTypeOverrides[contentType];

  if (override) {
    return override;
  }

  // 返回默认值
  return {
    temperature: config.model.defaultTemperature,
    summaryMinLength: config.output.summaryMinLength,
    summaryMaxLength: config.output.summaryMaxLength,
  };
}

/**
 * 获取默认配置（用于 UI 显示重置值）
 */
export function getDefaultConfig(): AIDebugConfig {
  return { ...DEFAULT_DEBUG_CONFIG };
}

// ==================== 工具函数 ====================

/**
 * 深度合并 AIDebugConfig 对象
 */
function deepMerge(
  target: AIDebugConfig,
  source: Partial<AIDebugConfig>,
): AIDebugConfig {
  const result: AIDebugConfig = { ...target };

  // 合并 model
  if (source.model) {
    result.model = { ...target.model, ...source.model };
  }

  // 合并 output
  if (source.output) {
    result.output = { ...target.output, ...source.output };
  }

  // 合并 detection
  if (source.detection) {
    result.detection = { ...target.detection, ...source.detection };
  }

  // 合并 contentTypeOverrides
  if (source.contentTypeOverrides) {
    result.contentTypeOverrides = {
      ...target.contentTypeOverrides,
      ...source.contentTypeOverrides,
    };
  }

  // 合并 features
  if (source.features) {
    result.features = { ...target.features, ...source.features };
  }

  // 合并基本类型字段
  if (source.version !== undefined) result.version = source.version;
  if (source.enabled !== undefined) result.enabled = source.enabled;

  return result;
}
