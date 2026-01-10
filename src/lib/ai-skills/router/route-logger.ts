/**
 * 路由日志模块
 *
 * 提供意图→Skill 映射的完整日志记录，便于：
 * - 调试路由决策
 * - 分析用户意图分布
 * - 监控 Feature Flag 影响
 * - 追踪路由性能
 *
 * @version 1.0.0
 * @since 2026-01-10
 */

import { logger } from "@/lib/logger";
import type { IntentType, ComplexityLevel, ExecutionMode } from "../config";

// ============================================
// 工具函数
// ============================================

/**
 * 生成简单的随机 ID
 */
function generateSimpleId(length: number = 10): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// ============================================
// 类型定义
// ============================================

/**
 * 路由决策日志条目
 */
export interface RouteDecisionLog {
  /** 路由追踪 ID */
  routeId: string;
  /** 时间戳 */
  timestamp: number;
  /** 用户输入（截断） */
  input: string;
  /** 原始输入长度 */
  inputLength: number;
  /** 分类结果 */
  classification: {
    intentType: IntentType;
    subType: string;
    intentKey: string;
    confidence: number;
    complexity: ComplexityLevel;
    matchedPattern?: string;
    matchScore?: number;
  };
  /** 路由结果 */
  routing: {
    skillId: string;
    mode: ExecutionMode;
    isExplicit: boolean;
    reason: string;
  };
  /** Feature Flag 状态 */
  featureFlag?: {
    intentDisabled: boolean;
    skillDisabled: boolean;
    disabledReason?: string;
  };
  /** 性能指标 */
  performance: {
    classificationMs: number;
    mappingMs: number;
    totalMs: number;
  };
  /** 用户上下文（脱敏） */
  context?: {
    userId?: string;
    hasPreferences: boolean;
  };
}

/**
 * 日志级别
 */
export type RouteLogLevel = "debug" | "info" | "warn" | "error";

/**
 * 日志配置
 */
export interface RouteLoggerConfig {
  /** 是否启用详细日志 */
  verbose: boolean;
  /** 日志级别 */
  level: RouteLogLevel;
  /** 输入截断长度 */
  inputMaxLength: number;
  /** 是否记录模式匹配详情 */
  logPatternDetails: boolean;
  /** 是否记录性能指标 */
  logPerformance: boolean;
}

// ============================================
// 默认配置
// ============================================

const DEFAULT_CONFIG: RouteLoggerConfig = {
  verbose: false,
  level: "info",
  inputMaxLength: 100,
  logPatternDetails: true,
  logPerformance: true,
};

// ============================================
// 路由日志器
// ============================================

/**
 * 路由日志器
 *
 * 提供结构化的路由决策日志记录
 */
export class RouteLogger {
  private config: RouteLoggerConfig;

  constructor(config?: Partial<RouteLoggerConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 生成路由追踪 ID
   */
  generateRouteId(): string {
    return `route_${generateSimpleId(10)}`;
  }

  /**
   * 记录路由决策
   */
  logRouteDecision(log: RouteDecisionLog): void {
    const { classification, routing, featureFlag, performance } = log;

    // 构建基础日志数据
    const baseLogData = {
      routeId: log.routeId,
      input: log.input,
      inputLength: log.inputLength,
      intentKey: classification.intentKey,
      confidence: classification.confidence,
      complexity: classification.complexity,
      skillId: routing.skillId,
      mode: routing.mode,
    };

    // 根据配置添加详细信息
    const detailedLogData = this.config.verbose
      ? {
          ...baseLogData,
          matchedPattern: classification.matchedPattern,
          matchScore: classification.matchScore,
          isExplicit: routing.isExplicit,
          reason: routing.reason,
          ...(featureFlag && { featureFlag }),
          ...(this.config.logPerformance && { performance }),
        }
      : baseLogData;

    // 确定日志级别
    const logLevel = this.determineLogLevel(log);

    // 记录日志
    switch (logLevel) {
      case "error":
        logger.error(detailedLogData, this.buildLogMessage(log));
        break;
      case "warn":
        logger.warn(detailedLogData, this.buildLogMessage(log));
        break;
      case "info":
        logger.info(detailedLogData, this.buildLogMessage(log));
        break;
      default:
        logger.debug(detailedLogData, this.buildLogMessage(log));
    }
  }

  /**
   * 记录显式工具路由
   */
  logExplicitRoute(
    routeId: string,
    toolId: string,
    skillId: string | null,
    reason: string,
    durationMs: number,
  ): void {
    const logData = {
      routeId,
      toolId,
      skillId,
      durationMs,
      isExplicit: true,
    };

    if (skillId) {
      logger.info(logData, `Explicit tool route: ${toolId} → ${skillId}`);
    } else {
      logger.warn(logData, `Explicit tool route failed: ${reason}`);
    }
  }

  /**
   * 记录路由回退
   */
  logFallback(
    routeId: string,
    originalSkillId: string,
    fallbackSkillId: string,
    reason: string,
  ): void {
    logger.warn(
      {
        routeId,
        originalSkillId,
        fallbackSkillId,
        reason,
      },
      `Route fallback: ${originalSkillId} → ${fallbackSkillId} (${reason})`,
    );
  }

  /**
   * 记录低置信度警告
   */
  logLowConfidence(
    routeId: string,
    input: string,
    confidence: number,
    threshold: number,
  ): void {
    logger.warn(
      {
        routeId,
        input: this.truncateInput(input),
        confidence,
        threshold,
      },
      `Low confidence route: ${confidence.toFixed(2)} < ${threshold}`,
    );
  }

  /**
   * 记录 Feature Flag 影响
   */
  logFeatureFlagImpact(
    routeId: string,
    intentKey: string,
    skillId: string | null,
    impact: "intent_disabled" | "skill_disabled",
  ): void {
    logger.info(
      {
        routeId,
        intentKey,
        skillId,
        impact,
      },
      `Feature flag impact: ${impact} for ${intentKey}`,
    );
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<RouteLoggerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 获取当前配置
   */
  getConfig(): RouteLoggerConfig {
    return { ...this.config };
  }

  // ============================================
  // 私有方法
  // ============================================

  /**
   * 确定日志级别
   */
  private determineLogLevel(log: RouteDecisionLog): RouteLogLevel {
    // Feature Flag 禁用时使用 warn
    if (log.featureFlag?.intentDisabled || log.featureFlag?.skillDisabled) {
      return "warn";
    }

    // 低置信度使用 warn
    if (log.classification.confidence < 0.4) {
      return "warn";
    }

    // 无匹配映射使用 info
    if (
      log.routing.skillId === "search" &&
      log.routing.reason.includes("无匹配")
    ) {
      return "info";
    }

    // 默认使用配置的级别
    return this.config.level;
  }

  /**
   * 构建日志消息
   */
  private buildLogMessage(log: RouteDecisionLog): string {
    const { classification, routing, performance } = log;

    const parts = [
      `Route decision:`,
      `${classification.intentKey}`,
      `→`,
      routing.skillId,
      `(${routing.mode})`,
    ];

    if (this.config.logPerformance) {
      parts.push(`[${performance.totalMs}ms]`);
    }

    return parts.join(" ");
  }

  /**
   * 截断输入
   */
  private truncateInput(input: string): string {
    if (input.length <= this.config.inputMaxLength) {
      return input;
    }
    return input.slice(0, this.config.inputMaxLength) + "...";
  }
}

// ============================================
// 工厂函数与单例
// ============================================

let _defaultLogger: RouteLogger | null = null;

/**
 * 获取默认路由日志器（单例）
 */
export function getRouteLogger(): RouteLogger {
  if (!_defaultLogger) {
    _defaultLogger = new RouteLogger({
      verbose: process.env.NODE_ENV === "development",
      level: process.env.NODE_ENV === "development" ? "debug" : "info",
    });
  }
  return _defaultLogger;
}

/**
 * 创建路由日志器
 */
export function createRouteLogger(
  config?: Partial<RouteLoggerConfig>,
): RouteLogger {
  return new RouteLogger(config);
}

/**
 * 重置默认日志器
 */
export function resetRouteLogger(): void {
  _defaultLogger = null;
}

// ============================================
// 便捷函数
// ============================================

/**
 * 创建路由决策日志条目
 */
export function createRouteDecisionLog(params: {
  routeId: string;
  input: string;
  intentType: IntentType;
  subType: string;
  confidence: number;
  complexity: ComplexityLevel;
  skillId: string;
  mode: ExecutionMode;
  isExplicit?: boolean;
  reason: string;
  matchedPattern?: string;
  matchScore?: number;
  intentDisabled?: boolean;
  skillDisabled?: boolean;
  disabledReason?: string;
  classificationMs: number;
  mappingMs: number;
  totalMs: number;
  userId?: string;
  hasPreferences?: boolean;
}): RouteDecisionLog {
  return {
    routeId: params.routeId,
    timestamp: Date.now(),
    input: params.input.slice(0, 100),
    inputLength: params.input.length,
    classification: {
      intentType: params.intentType,
      subType: params.subType,
      intentKey: `${params.intentType}:${params.subType}`,
      confidence: params.confidence,
      complexity: params.complexity,
      matchedPattern: params.matchedPattern,
      matchScore: params.matchScore,
    },
    routing: {
      skillId: params.skillId,
      mode: params.mode,
      isExplicit: params.isExplicit ?? false,
      reason: params.reason,
    },
    featureFlag:
      params.intentDisabled || params.skillDisabled
        ? {
            intentDisabled: params.intentDisabled ?? false,
            skillDisabled: params.skillDisabled ?? false,
            disabledReason: params.disabledReason,
          }
        : undefined,
    performance: {
      classificationMs: params.classificationMs,
      mappingMs: params.mappingMs,
      totalMs: params.totalMs,
    },
    context:
      params.userId || params.hasPreferences !== undefined
        ? {
            userId: params.userId
              ? params.userId.slice(0, 8) + "..."
              : undefined,
            hasPreferences: params.hasPreferences ?? false,
          }
        : undefined,
  };
}
