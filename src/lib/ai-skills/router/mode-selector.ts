/**
 * ModeSelector - 模式选择器
 *
 * 职责：
 * - 根据意图分类和复杂度评估选择执行模式
 * - 管理编排 Skill 的映射关系
 * - 提供模式选择的决策理由
 *
 * @version 1.0.0
 * @since 2025-12-24
 */

import { logger } from "@/lib/logger";
import type {
  IntentClassification,
  ComplexityEvaluation,
  ModeSelection,
} from "./types";

/**
 * 编排 Skill 映射配置
 *
 * 格式：intentType:subType -> skillId
 */
interface OrchestrationSkillMapping {
  /** Skill ID */
  skillId: string;
  /** Skill 名称（用于日志） */
  name: string;
  /** 最低复杂度要求 */
  minComplexity?: "simple" | "medium" | "complex";
  /** 是否已启用 */
  enabled: boolean;
}

/**
 * 默认编排 Skill 映射
 */
const DEFAULT_SKILL_MAPPINGS: Record<string, OrchestrationSkillMapping> = {
  // 学习类
  "learn:interview": {
    skillId: "interview_prep",
    name: "面试准备助手",
    minComplexity: "complex",
    enabled: false, // P3: 面试准备 Skill 待实现
  },
  "learn:plan": {
    skillId: "reading_planner",
    name: "阅读计划助手",
    minComplexity: "medium",
    enabled: true,
  },

  // 整理类
  "organize:cleanup": {
    skillId: "batch_organize",
    name: "智能整理助手",
    minComplexity: "medium",
    enabled: true, // 已实现
  },
  "organize:merge": {
    // Phase 1 新增：合并/组合操作
    skillId: "batch_organize",
    name: "合并整理助手",
    minComplexity: "medium",
    enabled: true,
  },
  "organize:dedupe": {
    skillId: "duplicate_cleanup",
    name: "重复清理助手",
    minComplexity: "medium",
    enabled: true,
  },
  "organize:classify": {
    skillId: "smart_tagging",
    name: "智能标签助手",
    minComplexity: "medium",
    enabled: true,
  },
  "organize:expire": {
    skillId: "link_health_check",
    name: "链接健康检测",
    minComplexity: "medium",
    enabled: true, // 已实现
  },

  // 分析类
  "analyze:report": {
    skillId: "periodic_report",
    name: "周期报告生成",
    minComplexity: "complex",
    enabled: true, // 已实现
  },
  "analyze:insight": {
    skillId: "insight_report",
    name: "收藏洞察分析",
    minComplexity: "medium",
    enabled: true, // 已实现
  },
  "analyze:discover": {
    skillId: "related_discovery",
    name: "相关发现助手",
    minComplexity: "medium",
    enabled: true,
  },

  // 创建类
  "create:tts": {
    skillId: "tts_synthesis",
    name: "语音朗读助手",
    minComplexity: "simple",
    enabled: true, // 已实现
  },
  "create:wechat_digest": {
    skillId: "wechat_digest",
    name: "微信阅读摘要",
    minComplexity: "medium",
    enabled: true, // 已实现
  },
  "analyze:wechat": {
    skillId: "wechat_digest",
    name: "微信阅读摘要",
    minComplexity: "medium",
    enabled: true, // 已实现
  },
  "analyze:inbox_digest": {
    skillId: "inbox_digest",
    name: "收件箱摘要",
    minComplexity: "medium",
    enabled: true, // 已实现
  },

  // 综述类（v2.8.0 新增 - 主题合成器）
  "create:synthesis": {
    skillId: "thematic_synthesis",
    name: "主题合成器",
    minComplexity: "medium",
    enabled: true, // 已实现
  },
  "create:synthesis_folder": {
    skillId: "thematic_synthesis",
    name: "主题合成器（文件夹）",
    minComplexity: "medium",
    enabled: true,
  },
  "create:synthesis_tag": {
    skillId: "thematic_synthesis",
    name: "主题合成器（标签）",
    minComplexity: "medium",
    enabled: true,
  },
  "create:synthesis_recent": {
    skillId: "thematic_synthesis",
    name: "主题合成器（最近）",
    minComplexity: "medium",
    enabled: true,
  },
  "create:synthesis_topic": {
    skillId: "thematic_synthesis",
    name: "主题合成器（主题）",
    minComplexity: "medium",
    enabled: true,
  },

  // ============================================
  // Skills v1.1.0 新增（2025-01-08）
  // ============================================

  // P0: 收件箱智能分拣（编排类型）
  "action:inbox_triage": {
    skillId: "inbox_triage",
    name: "收件箱智能分拣",
    minComplexity: "medium",
    enabled: true,
  },

  // P0: 文件夹智能推荐（原子类型 - 但需要路由支持）
  "query:folder_recommend": {
    skillId: "folder_recommend",
    name: "文件夹智能推荐",
    enabled: true,
  },

  // Phase 1 新增：链接状态检查（query 类型）
  "query:link_status": {
    skillId: "link_health_check",
    name: "链接状态检查",
    enabled: true,
  },

  // P1: 文件夹健康检查（编排类型）
  "analyze:folder_health_check": {
    skillId: "folder_health_check",
    name: "文件夹健康检查",
    minComplexity: "medium",
    enabled: true,
  },
};

/**
 * 模式选择器配置
 */
interface ModeSelectorConfig {
  /** 自定义 Skill 映射 */
  customMappings?: Record<string, OrchestrationSkillMapping>;
  /** 是否强制使用原子模式（调试用） */
  forceAtomicMode?: boolean;
  /** 是否启用调试日志 */
  debug?: boolean;
  /** 是否强制禁用 ReAct（调试用）[P2-9 新增] */
  forceDisableReact?: boolean;
}

/**
 * ReAct 触发阈值配置 [P2-9 新增]
 *
 * ReAct 循环适用于需要多步推理的场景：
 * - 复杂度较高的任务
 * - 意图置信度较低需要更多思考的场景
 * - 预计需要多个工具调用的任务
 */
const REACT_THRESHOLDS = {
  /** 复杂度评分阈值 - 高于此值建议 ReAct */
  complexityScore: 50,
  /** 预计步骤阈值 - 高于此值建议 ReAct */
  estimatedSteps: 3,
  /** 意图置信度阈值 - 低于此值建议 ReAct（需要更多思考） */
  confidenceThreshold: 0.7,
} as const;

/**
 * 适合使用 ReAct 的意图类型 [P2-9 新增]
 */
const REACT_PREFERRED_INTENTS: Set<string> = new Set([
  "analyze", // 分析类任务通常需要多步推理
  "organize", // 整理类任务可能需要多轮操作
  "learn", // 学习类任务需要深度理解
]);

/**
 * 模式选择器
 */
export class ModeSelector {
  private mappings: Record<string, OrchestrationSkillMapping>;
  private config: ModeSelectorConfig;

  constructor(config: ModeSelectorConfig = {}) {
    this.config = config;
    this.mappings = {
      ...DEFAULT_SKILL_MAPPINGS,
      ...config.customMappings,
    };
  }

  /**
   * 选择执行模式
   *
   * @param intent - 意图分类结果
   * @param complexity - 复杂度评估结果
   * @returns 模式选择结果（包含 ReAct 决策）
   */
  select(
    intent: IntentClassification,
    complexity: ComplexityEvaluation,
  ): ModeSelection {
    // 调试模式强制使用原子模式
    if (this.config.forceAtomicMode) {
      return {
        mode: "atomic",
        reason: "调试模式：强制使用原子模式",
        useReact: false,
        reactReason: "调试模式禁用 ReAct",
      };
    }

    // 规则 1: 简单任务 → 原子模式
    if (complexity.level === "simple") {
      return {
        mode: "atomic",
        reason: "简单任务，使用原子模式快速响应",
        useReact: false,
        reactReason: "简单任务无需 ReAct 循环",
      };
    }

    // 规则 2: 查找匹配的编排 Skill
    const skillKey = this.buildSkillKey(intent);
    const mapping = this.findSkillMapping(skillKey, intent, complexity);

    if (mapping && mapping.enabled) {
      // 检查复杂度是否满足最低要求
      if (this.meetsComplexityRequirement(complexity, mapping.minComplexity)) {
        logger.debug(
          {
            skillKey,
            skillId: mapping.skillId,
            complexityLevel: complexity.level,
          },
          "ModeSelector: Found matching orchestration skill",
        );

        return {
          mode: "orchestration",
          reason: `复杂任务，使用 ${mapping.name} 端到端完成`,
          fallbackMode: "atomic",
          useReact: false,
          reactReason: "编排模式有独立的执行流程",
        };
      }
    }

    // 规则 3: 复杂但无对应编排 Skill → 原子模式（考虑 ReAct）
    if (complexity.level === "complex") {
      const reactDecision = this.shouldUseReact(intent, complexity);
      return {
        mode: "atomic",
        reason: "复杂任务但暂无专用 Skill，使用原子模式多轮处理",
        useReact: reactDecision.useReact,
        reactReason: reactDecision.reason,
      };
    }

    // 规则 4: 中等复杂度 + 期望交付物 + 有部分匹配的 Skill → 考虑编排模式
    if (intent.hasDeliverableExpectation) {
      const partialMapping = this.findPartialMapping(intent);
      if (partialMapping && partialMapping.enabled) {
        return {
          mode: "orchestration",
          reason: `用户期望交付物，使用 ${partialMapping.name} 处理`,
          fallbackMode: "atomic",
          useReact: false,
          reactReason: "编排模式有独立的执行流程",
        };
      }
    }

    // 默认: 原子模式（考虑 ReAct）
    const reactDecision = this.shouldUseReact(intent, complexity);
    return {
      mode: "atomic",
      reason: "默认使用原子模式",
      useReact: reactDecision.useReact,
      reactReason: reactDecision.reason,
    };
  }

  /**
   * 决定是否使用 ReAct 循环 [P2-9 新增]
   *
   * ReAct (Reason + Act) 适用于需要多步推理的场景
   *
   * @param intent - 意图分类结果
   * @param complexity - 复杂度评估结果
   * @returns ReAct 决策结果
   */
  shouldUseReact(
    intent: IntentClassification,
    complexity: ComplexityEvaluation,
  ): { useReact: boolean; reason: string } {
    // 配置强制禁用
    if (this.config.forceDisableReact) {
      return {
        useReact: false,
        reason: "配置禁用 ReAct",
      };
    }

    const reasons: string[] = [];
    let score = 0;

    // 因素 1: 复杂度评分
    if (complexity.score >= REACT_THRESHOLDS.complexityScore) {
      score += 30;
      reasons.push(
        `复杂度评分 ${complexity.score} >= ${REACT_THRESHOLDS.complexityScore}`,
      );
    }

    // 因素 2: 预计步骤数
    if (complexity.estimatedSteps >= REACT_THRESHOLDS.estimatedSteps) {
      score += 30;
      reasons.push(
        `预计步骤 ${complexity.estimatedSteps} >= ${REACT_THRESHOLDS.estimatedSteps}`,
      );
    }

    // 因素 3: 意图置信度（低置信度需要更多思考）
    if (intent.confidence < REACT_THRESHOLDS.confidenceThreshold) {
      score += 20;
      reasons.push(
        `意图置信度 ${intent.confidence.toFixed(2)} < ${REACT_THRESHOLDS.confidenceThreshold}`,
      );
    }

    // 因素 4: 意图类型偏好
    if (REACT_PREFERRED_INTENTS.has(intent.type)) {
      score += 20;
      reasons.push(`意图类型 "${intent.type}" 适合 ReAct`);
    }

    // 决策：评分 >= 50 时使用 ReAct
    const useReact = score >= 50;

    logger.debug(
      {
        intentType: intent.type,
        complexityScore: complexity.score,
        estimatedSteps: complexity.estimatedSteps,
        intentConfidence: intent.confidence,
        reactScore: score,
        useReact,
        factors: reasons,
      },
      "ModeSelector: ReAct decision",
    );

    if (useReact) {
      return {
        useReact: true,
        reason: `建议使用 ReAct (评分=${score}): ${reasons.join("; ")}`,
      };
    }

    return {
      useReact: false,
      reason:
        reasons.length > 0
          ? `ReAct 评分不足 (${score}<50): ${reasons.join("; ")}`
          : "不满足 ReAct 触发条件",
    };
  }

  /**
   * 获取建议的 Skill ID
   */
  getSuggestedSkill(
    intent: IntentClassification,
    complexity: ComplexityEvaluation,
  ): string | null {
    const selection = this.select(intent, complexity);

    if (selection.mode === "orchestration") {
      const skillKey = this.buildSkillKey(intent);
      const mapping =
        this.findSkillMapping(skillKey, intent, complexity) ||
        this.findPartialMapping(intent);

      return mapping?.skillId || null;
    }

    return null;
  }

  /**
   * 构建 Skill 查找键
   */
  private buildSkillKey(intent: IntentClassification): string {
    return intent.subType
      ? `${intent.type}:${intent.subType}`
      : `${intent.type}:general`;
  }

  /**
   * 查找 Skill 映射
   */
  private findSkillMapping(
    skillKey: string,
    intent: IntentClassification,
    _complexity: ComplexityEvaluation,
  ): OrchestrationSkillMapping | null {
    // 精确匹配
    if (this.mappings[skillKey]) {
      return this.mappings[skillKey];
    }

    // 模糊匹配（仅类型）
    const typeKey = `${intent.type}:general`;
    if (this.mappings[typeKey]) {
      return this.mappings[typeKey];
    }

    return null;
  }

  /**
   * 查找部分匹配的映射
   */
  private findPartialMapping(
    intent: IntentClassification,
  ): OrchestrationSkillMapping | null {
    // 根据意图类型找到第一个可用的 Skill
    const prefix = `${intent.type}:`;

    for (const [key, mapping] of Object.entries(this.mappings)) {
      if (key.startsWith(prefix) && mapping.enabled) {
        return mapping;
      }
    }

    return null;
  }

  /**
   * 检查复杂度是否满足最低要求
   */
  private meetsComplexityRequirement(
    evaluation: ComplexityEvaluation,
    minRequired?: "simple" | "medium" | "complex",
  ): boolean {
    if (!minRequired || minRequired === "simple") {
      return true;
    }

    const levels = { simple: 1, medium: 2, complex: 3 };
    return levels[evaluation.level] >= levels[minRequired];
  }

  /**
   * 注册新的 Skill 映射
   */
  registerSkill(
    key: string,
    mapping: Omit<OrchestrationSkillMapping, "enabled"> & { enabled?: boolean },
  ): void {
    this.mappings[key] = {
      ...mapping,
      enabled: mapping.enabled ?? true,
    };
  }

  /**
   * 启用/禁用 Skill
   */
  setSkillEnabled(skillId: string, enabled: boolean): void {
    for (const mapping of Object.values(this.mappings)) {
      if (mapping.skillId === skillId) {
        mapping.enabled = enabled;
      }
    }
  }

  /**
   * 获取所有已启用的编排 Skills
   */
  getEnabledSkills(): Array<{ key: string; skillId: string; name: string }> {
    return Object.entries(this.mappings)
      .filter(([, mapping]) => mapping.enabled)
      .map(([key, mapping]) => ({
        key,
        skillId: mapping.skillId,
        name: mapping.name,
      }));
  }

  /**
   * 获取所有映射（用于调试）
   */
  getAllMappings(): Record<string, OrchestrationSkillMapping> {
    return { ...this.mappings };
  }
}

/**
 * 创建模式选择器实例
 */
export function createModeSelector(config?: ModeSelectorConfig): ModeSelector {
  return new ModeSelector(config);
}

/**
 * 默认模式选择器实例
 */
export const modeSelector = new ModeSelector();
