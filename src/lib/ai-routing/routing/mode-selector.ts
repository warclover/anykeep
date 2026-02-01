/**
 * 模式选择器
 *
 * 根据意图分类和复杂度评估结果，选择合适的执行模式
 *
 * @version 1.0.0
 * @since 2026-02-01
 */

import type {
  ExecutionMode,
  IntentClassification,
  ComplexityEvaluation,
  ModeSelection,
  ComplexityLevel,
} from "../types";

// ============================================
// 配置
// ============================================

/**
 * 模式选择器配置
 */
export interface ModeSelectorConfig {
  /** 是否强制原子模式 */
  forceAtomicMode?: boolean;
  /** 调试模式 */
  debug?: boolean;
}

// ============================================
// Skill 映射
// ============================================

/**
 * 意图到 Skill 的映射
 */
interface SkillMapping {
  /** Skill ID */
  skillId: string;
  /** 映射名称 */
  name: string;
  /** 执行模式 */
  mode: ExecutionMode;
  /** 最低复杂度要求 */
  minComplexity?: ComplexityLevel;
  /** 是否启用 */
  enabled: boolean;
}

/**
 * 意图映射索引
 * key: `${intentType}:${subType}` 或 `${intentType}:*`
 */
const SKILL_MAPPINGS: Record<string, SkillMapping> = {
  // 学习类
  "learn:review": {
    skillId: "knowledge_review",
    name: "知识回顾",
    mode: "orchestration",
    minComplexity: "medium",
    enabled: true,
  },
  "learn:active_recall_start": {
    skillId: "active_recall",
    name: "主动复习",
    mode: "orchestration",
    minComplexity: "medium",
    enabled: true,
  },
  // 整理类
  "organize:cleanup": {
    skillId: "organize_cleanup",
    name: "智能整理",
    mode: "orchestration",
    minComplexity: "medium",
    enabled: true,
  },
  "organize:dedupe": {
    skillId: "dedupe",
    name: "去重",
    mode: "orchestration",
    minComplexity: "medium",
    enabled: true,
  },
  // 分析类
  "analyze:report": {
    skillId: "report_generator",
    name: "报告生成",
    mode: "orchestration",
    minComplexity: "medium",
    enabled: true,
  },
  "analyze:insight": {
    skillId: "insight_analyzer",
    name: "洞察分析",
    mode: "orchestration",
    minComplexity: "medium",
    enabled: true,
  },
  // 创建类
  "create:synthesis": {
    skillId: "synthesis",
    name: "主题合成",
    mode: "orchestration",
    minComplexity: "medium",
    enabled: true,
  },
  "create:digest": {
    skillId: "content_digest",
    name: "内容摘要",
    mode: "orchestration",
    minComplexity: "simple",
    enabled: true,
  },
  "create:tts": {
    skillId: "tts_reader",
    name: "语音朗读",
    mode: "atomic",
    enabled: true,
  },
  // 查询类（大部分走原子模式）
  "query:search": {
    skillId: "knowledge_search",
    name: "知识搜索",
    mode: "atomic",
    enabled: true,
  },
  // 通配符映射
  "analyze:*": {
    skillId: "general_analyzer",
    name: "通用分析",
    mode: "orchestration",
    minComplexity: "medium",
    enabled: true,
  },
  "create:*": {
    skillId: "general_creator",
    name: "通用创建",
    mode: "orchestration",
    minComplexity: "medium",
    enabled: true,
  },
};

// ============================================
// ModeSelector 类
// ============================================

/**
 * 模式选择器
 *
 * 职责：根据意图和复杂度选择执行模式
 */
export class ModeSelector {
  private config: ModeSelectorConfig;

  constructor(config: ModeSelectorConfig = {}) {
    this.config = config;
  }

  /**
   * 选择执行模式
   */
  select(
    intent: IntentClassification,
    complexity: ComplexityEvaluation,
  ): ModeSelection {
    // 调试模式强制原子
    if (this.config.forceAtomicMode) {
      return {
        mode: "atomic",
        reason: "调试：强制原子模式",
      };
    }

    // 简单任务 → 原子
    if (complexity.level === "simple") {
      return {
        mode: "atomic",
        reason: "简单任务，原子模式",
      };
    }

    // 查找匹配的 Skill 映射
    const mapping = this.findMapping(intent.type, intent.subType);

    if (mapping?.enabled) {
      // 检查复杂度要求
      if (this.meetsMinComplexity(complexity.level, mapping.minComplexity)) {
        return {
          mode: mapping.mode,
          reason: `使用 ${mapping.name}`,
        };
      }
    }

    // 复杂但无 Skill → 原子多轮
    if (complexity.level === "complex") {
      return {
        mode: "atomic",
        reason: "复杂任务但无专用 Skill",
      };
    }

    // 期望交付物 → 尝试通配符匹配
    if (intent.hasDeliverableExpectation) {
      const wildcardMapping = this.findMapping(intent.type, "*");
      if (
        wildcardMapping?.enabled &&
        wildcardMapping.mode === "orchestration"
      ) {
        return {
          mode: "orchestration",
          reason: `期望交付物，使用 ${wildcardMapping.name}`,
        };
      }
    }

    return {
      mode: "atomic",
      reason: "默认原子模式",
    };
  }

  /**
   * 查找映射
   */
  private findMapping(
    intentType: string,
    subType?: string,
  ): SkillMapping | null {
    // 精确匹配
    const exactKey = `${intentType}:${subType ?? "general"}`;
    if (SKILL_MAPPINGS[exactKey]) {
      return SKILL_MAPPINGS[exactKey];
    }

    // 通配符匹配
    const wildcardKey = `${intentType}:*`;
    if (SKILL_MAPPINGS[wildcardKey]) {
      return SKILL_MAPPINGS[wildcardKey];
    }

    return null;
  }

  /**
   * 检查是否满足最低复杂度要求
   */
  private meetsMinComplexity(
    current: ComplexityLevel,
    required?: ComplexityLevel,
  ): boolean {
    if (!required || required === "simple") return true;
    const levels: Record<ComplexityLevel, number> = {
      simple: 1,
      medium: 2,
      complex: 3,
    };
    return levels[current] >= levels[required];
  }
}

// ============================================
// 工厂函数
// ============================================

/**
 * 创建模式选择器实例
 */
export function createModeSelector(config?: ModeSelectorConfig): ModeSelector {
  return new ModeSelector(config);
}
