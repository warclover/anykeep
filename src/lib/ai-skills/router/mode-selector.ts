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
  "learn:review": {
    skillId: "knowledge_review",
    name: "知识回顾助手",
    minComplexity: "medium",
    enabled: true,
  },
  "learn:interview": {
    skillId: "interview_prep",
    name: "面试准备助手",
    minComplexity: "complex",
    enabled: false, // TODO: 待实现
  },
  "learn:path": {
    skillId: "learning_path",
    name: "学习路径规划",
    minComplexity: "complex",
    enabled: false, // TODO: 待实现
  },
  "learn:plan": {
    skillId: "reading_planner",
    name: "阅读计划助手",
    minComplexity: "medium",
    enabled: true,
  },

  // 整理类
  "organize:cleanup": {
    skillId: "smart_organize",
    name: "智能整理助手",
    minComplexity: "medium",
    enabled: false, // TODO: 待实现
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

  // 分析类
  "analyze:report": {
    skillId: "periodic_report",
    name: "周期报告生成",
    minComplexity: "complex",
    enabled: false, // TODO: 待实现
  },
  "analyze:insight": {
    skillId: "collection_insight",
    name: "收藏洞察分析",
    minComplexity: "medium",
    enabled: false, // TODO: 待实现
  },
  "analyze:discover": {
    skillId: "related_discovery",
    name: "相关发现助手",
    minComplexity: "medium",
    enabled: true,
  },

  // 创建类
  "create:digest": {
    skillId: "quick_digest",
    name: "快速摘要生成",
    minComplexity: "simple",
    enabled: true,
  },
  "create:share": {
    skillId: "share_bundle",
    name: "分享包生成",
    minComplexity: "medium",
    enabled: false, // TODO: 待实现
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
}

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
   * @returns 模式选择结果
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
      };
    }

    // 规则 1: 简单任务 → 原子模式
    if (complexity.level === "simple") {
      return {
        mode: "atomic",
        reason: "简单任务，使用原子模式快速响应",
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
        };
      }
    }

    // 规则 3: 复杂但无对应编排 Skill → 原子模式（LLM 多轮）
    if (complexity.level === "complex") {
      return {
        mode: "atomic",
        reason: "复杂任务但暂无专用 Skill，使用原子模式多轮处理",
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
        };
      }
    }

    // 默认: 原子模式
    return {
      mode: "atomic",
      reason: "默认使用原子模式",
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
