/**
 * 统一意图→Skill 路由器
 *
 * 整合意图分类和 Skill 映射为单一入口，提供：
 * - 基于配置的意图识别
 * - O(1) 映射查找
 * - 显式工具直连
 * - 用户偏好覆盖
 *
 * @version 2.0.0
 * @since 2025-12-27
 */

import {
  SORTED_PATTERNS,
  getCompiledPattern,
  getMappingIndex,
  findMapping,
  findExplicitTool,
  isIntentKeyAvailable,
  isSkillEnabledByFeatureFlag,
  getSkillFeatureFlagSync,
  type IntentType,
  type ComplexityLevel,
  type ExecutionMode,
  type IntentPattern,
  type SkillMapping,
  type MappingIndex,
  type UserMappingPreference,
} from "../config";
import {
  getRouteLogger,
  createRouteDecisionLog,
  type RouteLogger,
} from "./route-logger";

// ============================================
// 类型定义
// ============================================

/**
 * 路由结果
 */
export interface RouteResult {
  /** 意图类型 */
  intentType: IntentType;
  /** 子类型 */
  subType: string;
  /** 目标 Skill ID */
  skillId: string;
  /** 执行模式 */
  mode: ExecutionMode;
  /** 置信度 0-1 */
  confidence: number;
  /** 复杂度 */
  complexity: ComplexityLevel;
  /** 路由原因（调试用） */
  reason: string;
  /** 是否为显式工具调用 */
  explicit?: boolean;
}

/**
 * 路由上下文
 */
export interface RouteContext {
  /** 用户 ID */
  userId?: string;
  /** 用户偏好覆盖 */
  userPreferences?: UserMappingPreference;
  /** 是否启用调试日志 */
  debug?: boolean;
}

/**
 * 路由器配置
 */
export interface IntentSkillRouterConfig {
  /** 最低置信度阈值（低于此值使用 LLM 兜底） */
  minConfidenceThreshold?: number;
  /** 用户偏好覆盖 */
  userPreferences?: UserMappingPreference;
  /** 是否启用调试模式 */
  debug?: boolean;
}

// ============================================
// 默认配置
// ============================================

const DEFAULT_CONFIG: Required<IntentSkillRouterConfig> = {
  minConfidenceThreshold: 0.4,
  userPreferences: {},
  debug: false,
};

// ============================================
// 路由器实现
// ============================================

/**
 * 统一意图→Skill 路由器
 *
 * 使用示例：
 * ```typescript
 * const router = new IntentSkillRouter();
 *
 * // 自动路由
 * const result = router.route("帮我复习一下收藏");
 * // → { skillId: 'knowledge_review', mode: 'orchestration', ... }
 *
 * // 显式工具
 * const explicitResult = router.routeExplicit("organize");
 * // → { skillId: 'batch_organize', mode: 'orchestration', ... }
 * ```
 */
export class IntentSkillRouter {
  private config: Required<IntentSkillRouterConfig>;
  private mappingIndex: MappingIndex;
  private routeLogger: RouteLogger;

  constructor(config?: IntentSkillRouterConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.mappingIndex = this.buildIndex();
    this.routeLogger = getRouteLogger();
  }

  // ============================================
  // 公共 API
  // ============================================

  /**
   * 路由用户输入
   *
   * @param input 用户输入文本
   * @param context 路由上下文
   * @returns 路由结果
   */
  route(input: string, context?: RouteContext): RouteResult {
    const startTime = Date.now();
    const routeId = this.routeLogger.generateRouteId();

    // 0. 初始化 Feature Flag 同步器（仅首次）
    getSkillFeatureFlagSync().initialize();

    // 1. 意图分类
    const classificationStartTime = Date.now();
    const intentMatch = this.classifyIntent(input);
    const classificationMs = Date.now() - classificationStartTime;

    // 2. 检查意图键是否因 Feature Flag 被禁用
    const intentKey = `${intentMatch.type}:${intentMatch.subType}`;
    const intentAvailable = isIntentKeyAvailable(intentKey);

    // 3. 合并用户偏好（config 优先，context 覆盖）
    const mergedPrefs: UserMappingPreference = {
      ...this.config.userPreferences,
      ...context?.userPreferences,
    };

    // 4. 查找映射（考虑 Feature Flag 状态）
    const mappingStartTime = Date.now();
    let mapping = this.findSkillMapping(
      intentMatch.type,
      intentMatch.subType,
      mergedPrefs,
    );
    const mappingMs = Date.now() - mappingStartTime;

    // 5. 如果意图被禁用或 Skill 被禁用，回退到通用原子模式
    let skillDisabledReason: string | undefined;
    let intentDisabled = false;
    let skillDisabled = false;

    if (!intentAvailable) {
      skillDisabledReason = `意图 ${intentKey} 已被 Feature Flag 禁用`;
      intentDisabled = true;
      mapping = null;
    } else if (mapping && !isSkillEnabledByFeatureFlag(mapping.skillId)) {
      skillDisabledReason = `Skill ${mapping.skillId} 已被 Feature Flag 禁用`;
      skillDisabled = true;
      mapping = null;
    }

    // 6. 构建结果
    const result: RouteResult = {
      intentType: intentMatch.type,
      subType: intentMatch.subType,
      skillId: mapping?.skillId ?? "search",
      mode: mapping?.mode ?? "atomic",
      confidence: intentMatch.confidence,
      complexity: intentMatch.complexity,
      reason: skillDisabledReason || this.buildReason(intentMatch, mapping),
    };

    // 7. 记录路由决策日志
    const totalMs = Date.now() - startTime;
    const logEntry = createRouteDecisionLog({
      routeId,
      input,
      intentType: result.intentType,
      subType: result.subType,
      confidence: result.confidence,
      complexity: result.complexity,
      skillId: result.skillId,
      mode: result.mode,
      isExplicit: false,
      reason: result.reason,
      matchedPattern: intentMatch.matchedPattern,
      matchScore: intentMatch.matchScore,
      intentDisabled,
      skillDisabled,
      disabledReason: skillDisabledReason,
      classificationMs,
      mappingMs,
      totalMs,
      userId: context?.userId,
      hasPreferences: Object.keys(mergedPrefs).length > 0,
    });

    this.routeLogger.logRouteDecision(logEntry);

    // 8. 低置信度警告
    if (result.confidence < this.config.minConfidenceThreshold) {
      this.routeLogger.logLowConfidence(
        routeId,
        input,
        result.confidence,
        this.config.minConfidenceThreshold,
      );
    }

    // 9. Feature Flag 影响日志
    if (intentDisabled) {
      this.routeLogger.logFeatureFlagImpact(
        routeId,
        intentKey,
        null,
        "intent_disabled",
      );
    } else if (skillDisabled) {
      this.routeLogger.logFeatureFlagImpact(
        routeId,
        intentKey,
        mapping?.skillId ?? null,
        "skill_disabled",
      );
    }

    return result;
  }

  /**
   * 显式工具路由（跳过意图分类）
   *
   * @param toolId 工具 ID
   * @returns 路由结果，未找到或被禁用时返回 null
   */
  routeExplicit(toolId: string): RouteResult | null {
    const startTime = Date.now();
    const routeId = this.routeLogger.generateRouteId();

    const tool = findExplicitTool(toolId);
    if (!tool) {
      this.routeLogger.logExplicitRoute(
        routeId,
        toolId,
        null,
        "Tool not found",
        Date.now() - startTime,
      );
      return null;
    }

    // 检查 Skill 是否被 Feature Flag 禁用
    if (!isSkillEnabledByFeatureFlag(tool.skillId)) {
      this.routeLogger.logExplicitRoute(
        routeId,
        toolId,
        tool.skillId,
        "Skill disabled by Feature Flag",
        Date.now() - startTime,
      );
      return null;
    }

    const result: RouteResult = {
      intentType: "action",
      subType: toolId,
      skillId: tool.skillId,
      mode: tool.mode,
      confidence: 1.0,
      complexity: tool.mode === "orchestration" ? "medium" : "simple",
      reason: "显式工具选择",
      explicit: true,
    };

    // 记录成功的显式路由
    this.routeLogger.logExplicitRoute(
      routeId,
      toolId,
      tool.skillId,
      "Success",
      Date.now() - startTime,
    );

    return result;
  }

  /**
   * 获取当前配置（调试用）
   */
  getConfig(): Required<IntentSkillRouterConfig> {
    return { ...this.config };
  }

  /**
   * 更新用户偏好
   */
  updateUserPreferences(prefs: UserMappingPreference): void {
    this.config.userPreferences = {
      ...this.config.userPreferences,
      ...prefs,
    };
    this.mappingIndex = this.buildIndex();
  }

  // ============================================
  // 意图分类
  // ============================================

  /**
   * 分类用户意图
   */
  private classifyIntent(input: string): {
    type: IntentType;
    subType: string;
    confidence: number;
    complexity: ComplexityLevel;
    matchedPattern?: string;
    matchScore?: number;
  } {
    let bestMatch: IntentPattern | null = null;
    let bestScore = 0;

    // 遍历排序后的模式（高权重优先）
    for (const pattern of SORTED_PATTERNS) {
      const regex = getCompiledPattern(pattern.pattern);
      if (regex.test(input)) {
        // 计算分数：基础匹配 + 权重加成
        const score = this.calculateScore(input, pattern);
        if (score > bestScore) {
          bestScore = score;
          bestMatch = pattern;
        }
      }
    }

    // 无匹配时返回默认
    if (!bestMatch) {
      return {
        type: "chitchat",
        subType: "unknown",
        confidence: 0.3,
        complexity: "simple",
        matchScore: 0,
      };
    }

    // 计算置信度
    const confidence = this.calculateConfidence(bestScore, input.length);

    return {
      type: bestMatch.type,
      subType: bestMatch.subType,
      confidence,
      complexity: bestMatch.complexity,
      matchedPattern: bestMatch.pattern,
      matchScore: bestScore,
    };
  }

  /**
   * 计算匹配分数
   */
  private calculateScore(input: string, pattern: IntentPattern): number {
    // 基础分数：权重 / 100
    let score = pattern.weight / 100;

    // 输入长度加成（短输入更确定）
    if (input.length < 10) {
      score += 0.1;
    }

    // 完全匹配加成
    const regex = getCompiledPattern(pattern.pattern);
    const match = input.match(regex);
    if (match && match[0].length > input.length * 0.3) {
      score += 0.15;
    }

    return Math.min(1.0, score);
  }

  /**
   * 计算置信度
   */
  private calculateConfidence(score: number, inputLength: number): number {
    // 基础置信度
    let confidence = score;

    // 短输入惩罚（太短可能不确定）
    if (inputLength < 5) {
      confidence *= 0.8;
    }

    // 长输入加成（更多上下文）
    if (inputLength > 20) {
      confidence = Math.min(0.95, confidence + 0.05);
    }

    return Math.max(0.1, Math.min(0.95, confidence));
  }

  // ============================================
  // 映射查找
  // ============================================

  /**
   * 查找 Skill 映射
   */
  private findSkillMapping(
    intentType: IntentType,
    subType: string,
    userPrefs?: UserMappingPreference,
  ): SkillMapping | null {
    // 1. 检查用户自定义映射
    const customKey = `${intentType}:${subType}`;
    if (userPrefs?.customMappings?.[customKey]) {
      const customSkillId = userPrefs.customMappings[customKey];
      // 查找对应的映射配置
      const baseMapping = findMapping(this.mappingIndex, intentType, subType);
      if (baseMapping) {
        return { ...baseMapping, skillId: customSkillId };
      }
    }

    // 2. 检查 Skill 是否被禁用
    const mapping = findMapping(this.mappingIndex, intentType, subType);
    if (mapping && userPrefs?.disabledSkills?.includes(mapping.skillId)) {
      // Skill 被禁用，尝试查找通配符映射
      return findMapping(this.mappingIndex, intentType, "*");
    }

    return mapping;
  }

  /**
   * 构建映射索引（包含用户偏好）
   */
  private buildIndex(): MappingIndex {
    return getMappingIndex();
  }

  // ============================================
  // 辅助方法
  // ============================================

  /**
   * 构建路由原因
   */
  private buildReason(
    intent: { type: IntentType; subType: string; matchedPattern?: string },
    mapping: SkillMapping | null,
  ): string {
    if (!mapping) {
      return `无匹配映射，使用默认搜索`;
    }

    const matchInfo = intent.matchedPattern
      ? `匹配模式: /${intent.matchedPattern}/`
      : "";

    return `${intent.type}:${intent.subType} → ${mapping.name} (${mapping.mode}) ${matchInfo}`.trim();
  }
}

// ============================================
// 工厂函数
// ============================================

/**
 * 创建路由器实例
 */
export function createIntentSkillRouter(
  config?: IntentSkillRouterConfig,
): IntentSkillRouter {
  return new IntentSkillRouter(config);
}

// ============================================
// 单例支持
// ============================================

let _defaultRouter: IntentSkillRouter | null = null;

/**
 * 获取默认路由器（单例）
 */
export function getDefaultRouter(): IntentSkillRouter {
  if (!_defaultRouter) {
    _defaultRouter = new IntentSkillRouter();
  }
  return _defaultRouter;
}

/**
 * 重置默认路由器
 */
export function resetDefaultRouter(): void {
  _defaultRouter = null;
}
