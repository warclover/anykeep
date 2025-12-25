/**
 * ExplicitToolRouter - 显式工具路由器
 *
 * 职责：
 * - 处理用户显式选择的工具（跳过意图分类）
 * - 将 UI 工具类型映射到意图和 Skill
 * - 返回与 IntentRouter 兼容的 RouteResult
 *
 * @version 1.0.0
 * @since 2025-12-25
 */

import { logger } from "@/lib/logger";
import type {
  RouteResult,
  IntentClassification,
  ComplexityEvaluation,
  IntentType,
} from "./types";
import type { ToolType } from "@/components/ai/phase4/types";

// =============================================================================
// 类型定义
// =============================================================================

/**
 * 工具到意图的映射配置
 */
interface ToolMapping {
  /** 对应的意图类型 */
  intentType: IntentType;
  /** 对应的子类型 */
  subType?: string;
  /** 建议的编排 Skill（null 表示使用原子模式） */
  suggestedSkill: string | null;
  /** 执行模式 */
  mode: "atomic" | "orchestration";
  /** 默认复杂度 */
  complexity: "simple" | "medium" | "complex";
  /** 描述 */
  description: string;
}

/**
 * 显式工具请求
 */
export interface ExplicitToolRequest {
  /** 用户选择的工具类型 */
  tool: ToolType;
  /** 用户输入的消息 */
  message: string;
  /** 用户 ID */
  userId: string;
  /** 会话 ID */
  conversationId?: string;
  /** 上下文引用 */
  contextReferences?: {
    bookmarkIds?: number[];
    folderIds?: number[];
    previousOutputId?: string;
  };
}

// =============================================================================
// 工具映射配置
// =============================================================================

/**
 * 工具类型到意图/Skill 的映射
 */
const TOOL_MAPPINGS: Record<Exclude<ToolType, "auto">, ToolMapping> = {
  // 搜索类
  search: {
    intentType: "query",
    subType: "search",
    suggestedSkill: null,
    mode: "atomic",
    complexity: "simple",
    description: "搜索收藏内容",
  },
  stats: {
    intentType: "analyze",
    subType: "stats",
    suggestedSkill: "insight_report",
    mode: "orchestration",
    complexity: "medium",
    description: "查看收藏统计",
  },

  // 管理类
  organize: {
    intentType: "organize",
    subType: "cleanup",
    suggestedSkill: "batch_organize",
    mode: "orchestration",
    complexity: "complex",
    description: "整理和分类收藏",
  },
  tag: {
    intentType: "action",
    subType: "batch_tag",
    suggestedSkill: "batch_organize",
    mode: "orchestration",
    complexity: "medium",
    description: "批量添加标签",
  },
  dedupe: {
    intentType: "organize",
    subType: "dedupe",
    suggestedSkill: "duplicate_cleanup",
    mode: "orchestration",
    complexity: "complex",
    description: "清理重复内容",
  },

  // 创作类
  summarize: {
    intentType: "create",
    subType: "summarize",
    suggestedSkill: null,
    mode: "atomic",
    complexity: "medium",
    description: "生成摘要",
  },
  extract: {
    intentType: "create",
    subType: "extract",
    suggestedSkill: null,
    mode: "atomic",
    complexity: "medium",
    description: "知识萃取",
  },
  review: {
    intentType: "learn",
    subType: "review",
    suggestedSkill: "knowledge_review",
    mode: "orchestration",
    complexity: "medium",
    description: "知识回顾",
  },

  // 导出类
  export: {
    intentType: "create",
    subType: "export",
    suggestedSkill: "data_export",
    mode: "orchestration",
    complexity: "medium",
    description: "导出数据",
  },

  // 创作类（通用）
  create: {
    intentType: "create",
    subType: "general",
    suggestedSkill: null,
    mode: "atomic",
    complexity: "medium",
    description: "创作内容",
  },
};

// =============================================================================
// 显式工具路由器
// =============================================================================

/**
 * 显式工具路由器
 *
 * 当用户通过 ToolPicker 选择特定工具时，使用此路由器
 * 跳过意图分类，直接返回对应的路由结果
 *
 * @example
 * ```typescript
 * const router = new ExplicitToolRouter();
 *
 * // 用户选择了"整理"工具
 * const result = router.route({
 *   tool: "organize",
 *   message: "帮我整理一下",
 *   userId: "user-123"
 * });
 *
 * // result.mode === "orchestration"
 * // result.suggestedSkill === "batch_organize"
 * ```
 */
export class ExplicitToolRouter {
  private debug: boolean;

  constructor(config: { debug?: boolean } = {}) {
    this.debug = config.debug ?? false;
  }

  /**
   * 路由显式工具请求
   *
   * @param request - 显式工具请求
   * @returns 路由结果
   */
  route(request: ExplicitToolRequest): RouteResult {
    const startTime = performance.now();

    // 自动模式不应该使用显式路由
    if (request.tool === "auto") {
      logger.warn(
        { tool: request.tool },
        "ExplicitToolRouter: Auto mode should use IntentRouter instead",
      );
      return this.createFallbackResult(request, startTime);
    }

    const mapping = TOOL_MAPPINGS[request.tool];

    if (!mapping) {
      logger.error(
        { tool: request.tool },
        "ExplicitToolRouter: Unknown tool type",
      );
      return this.createFallbackResult(request, startTime);
    }

    // 构建意图分类结果
    const intent: IntentClassification = {
      type: mapping.intentType,
      subType: mapping.subType,
      confidence: 1.0, // 显式选择 = 100% 置信度
      entities: this.extractEntities(request),
      requiresMultiStep: mapping.mode === "orchestration",
      hasDeliverableExpectation: this.hasDeliverableExpectation(mapping),
      source: "rule", // 标记为规则（显式选择）
    };

    // 构建复杂度评估结果
    const complexity: ComplexityEvaluation = {
      level: mapping.complexity,
      score: this.getComplexityScore(mapping.complexity),
      factors: [
        {
          name: "explicit_tool_selection",
          weight: 1.0,
          value: this.getComplexityScore(mapping.complexity),
          reason: `用户显式选择了"${mapping.description}"工具`,
        },
      ],
      estimatedSteps: this.estimateSteps(mapping),
      estimatedDurationMs: this.estimateDuration(mapping),
    };

    const routingDurationMs = Math.round(performance.now() - startTime);

    const result: RouteResult = {
      intent,
      complexity,
      mode: mapping.mode,
      suggestedSkill: mapping.suggestedSkill,
      reason: `用户显式选择了"${mapping.description}"工具`,
      routingDurationMs,
    };

    // 记录日志
    if (this.debug) {
      logger.debug(
        {
          tool: request.tool,
          intentType: intent.type,
          mode: mapping.mode,
          skill: mapping.suggestedSkill,
          durationMs: routingDurationMs,
        },
        "ExplicitToolRouter: Route completed",
      );
    } else {
      logger.info(
        {
          tool: request.tool,
          mode: mapping.mode,
          skill: mapping.suggestedSkill,
          durationMs: routingDurationMs,
        },
        "ExplicitToolRouter: Explicit tool route",
      );
    }

    return result;
  }

  /**
   * 检查工具是否支持显式路由
   */
  isExplicitTool(tool: ToolType): boolean {
    return tool !== "auto" && tool in TOOL_MAPPINGS;
  }

  /**
   * 获取工具的建议 Skill
   */
  getSuggestedSkill(tool: ToolType): string | null {
    if (tool === "auto") return null;
    return TOOL_MAPPINGS[tool]?.suggestedSkill ?? null;
  }

  /**
   * 获取工具的执行模式
   */
  getExecutionMode(tool: ToolType): "atomic" | "orchestration" {
    if (tool === "auto") return "atomic";
    return TOOL_MAPPINGS[tool]?.mode ?? "atomic";
  }

  /**
   * 提取实体（简化版，主要从上下文引用中提取）
   */
  private extractEntities(
    request: ExplicitToolRequest,
  ): IntentClassification["entities"] {
    const entities: IntentClassification["entities"] = [];

    // 从上下文引用中提取书签 ID
    if (request.contextReferences?.bookmarkIds?.length) {
      entities.push({
        type: "other",
        value: request.contextReferences.bookmarkIds.join(","),
        raw: `${request.contextReferences.bookmarkIds.length} 个书签`,
        confidence: 1.0,
      });
    }

    // 从上下文引用中提取文件夹 ID
    if (request.contextReferences?.folderIds?.length) {
      entities.push({
        type: "folder",
        value: request.contextReferences.folderIds.join(","),
        raw: `${request.contextReferences.folderIds.length} 个文件夹`,
        confidence: 1.0,
      });
    }

    return entities;
  }

  /**
   * 判断是否期望交付物
   */
  private hasDeliverableExpectation(mapping: ToolMapping): boolean {
    // 这些工具通常会产生交付物
    const deliverableTools = [
      "stats",
      "summarize",
      "extract",
      "export",
      "review",
    ];
    return deliverableTools.includes(mapping.subType || "");
  }

  /**
   * 获取复杂度分数
   */
  private getComplexityScore(level: "simple" | "medium" | "complex"): number {
    switch (level) {
      case "simple":
        return 20;
      case "medium":
        return 50;
      case "complex":
        return 80;
    }
  }

  /**
   * 估算步骤数
   */
  private estimateSteps(mapping: ToolMapping): number {
    if (mapping.mode === "atomic") return 1;

    // 编排模式根据 Skill 估算
    switch (mapping.suggestedSkill) {
      case "batch_organize":
        return 6;
      case "knowledge_review":
        return 5;
      case "data_export":
        return 4;
      case "insight_report":
        return 5;
      case "duplicate_cleanup":
        return 4;
      default:
        return 3;
    }
  }

  /**
   * 估算执行时间
   */
  private estimateDuration(mapping: ToolMapping): number {
    if (mapping.mode === "atomic") return 3000;

    // 编排模式根据复杂度估算
    switch (mapping.complexity) {
      case "simple":
        return 5000;
      case "medium":
        return 15000;
      case "complex":
        return 30000;
    }
  }

  /**
   * 创建回退结果
   */
  private createFallbackResult(
    request: ExplicitToolRequest,
    startTime: number,
  ): RouteResult {
    const routingDurationMs = Math.round(performance.now() - startTime);

    return {
      intent: {
        type: "chitchat",
        subType: "fallback",
        confidence: 0.3,
        entities: [],
        requiresMultiStep: false,
        hasDeliverableExpectation: false,
        source: "rule",
      },
      complexity: {
        level: "simple",
        score: 10,
        factors: [],
        estimatedSteps: 1,
        estimatedDurationMs: 2000,
      },
      mode: "atomic",
      suggestedSkill: null,
      reason: "未知工具类型，回退到原子模式",
      routingDurationMs,
    };
  }
}

// =============================================================================
// 工厂函数和默认实例
// =============================================================================

/**
 * 创建显式工具路由器实例
 */
export function createExplicitToolRouter(config?: {
  debug?: boolean;
}): ExplicitToolRouter {
  return new ExplicitToolRouter(config);
}

/**
 * 默认显式工具路由器实例
 */
export const explicitToolRouter = new ExplicitToolRouter();

// =============================================================================
// 导出
// =============================================================================

export { TOOL_MAPPINGS };
export type { ToolMapping };
