/**
 * 画像权重矩阵
 *
 * 定义画像之间的相似度和信号权重
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

import type { PersonaType, PersonaGroup } from "../types";

// =============================================================================
// 画像相似度矩阵
// =============================================================================

/**
 * 画像相似度矩阵
 *
 * 值范围 0-1，表示两个画像之间的相似度
 * 用于当多个画像同时匹配时的消歧和候选推荐
 */
export const PERSONA_SIMILARITY_MATRIX: Partial<
  Record<PersonaType, Partial<Record<PersonaType, number>>>
> = {
  // 产品经理与其他画像的相似度
  pm: {
    pm: 1.0,
    consultant: 0.5, // 都需要分析能力
    analyst: 0.4, // 都关注数据
    ux_researcher: 0.7, // 都关注用户体验
    indie_dev: 0.4, // 都需要产品思维
    tech_blogger: 0.3, // 都需要输出内容
  },

  // 咨询顾问与其他画像的相似度
  consultant: {
    consultant: 1.0,
    pm: 0.5, // 都需要分析能力
    analyst: 0.6, // 都做行业研究
    teacher: 0.3, // 都需要结构化表达
  },

  // 大学教师与其他画像的相似度
  teacher: {
    teacher: 1.0,
    master: 0.6, // 学术相关
    phd: 0.7, // 学术相关
    consultant: 0.3, // 都需要结构化表达
  },

  // 行业分析师与其他画像的相似度
  analyst: {
    analyst: 1.0,
    consultant: 0.6, // 都做行业研究
    pm: 0.4, // 都关注数据
    tech_blogger: 0.3, // 都需要输出内容
  },

  // 考证备考者与其他画像的相似度
  cert_seeker: {
    cert_seeker: 1.0,
    student: 0.7, // 都是学习者
    master: 0.4, // 都需要学习
  },

  // UX 研究员与其他画像的相似度
  ux_researcher: {
    ux_researcher: 1.0,
    pm: 0.7, // 都关注用户体验
    creator: 0.4, // 都关注视觉
    indie_dev: 0.3, // 都需要产品思维
  },
};

/**
 * 获取两个画像之间的相似度
 */
export function getPersonaSimilarity(
  persona1: PersonaType,
  persona2: PersonaType,
): number {
  if (persona1 === persona2) return 1.0;

  const matrix1 = PERSONA_SIMILARITY_MATRIX[persona1];
  if (matrix1 && persona2 in matrix1) {
    return matrix1[persona2] ?? 0;
  }

  const matrix2 = PERSONA_SIMILARITY_MATRIX[persona2];
  if (matrix2 && persona1 in matrix2) {
    return matrix2[persona1] ?? 0;
  }

  return 0;
}

// =============================================================================
// 信号权重配置
// =============================================================================

/**
 * 信号类型权重
 *
 * 不同类型的行为信号对画像推断的贡献权重
 */
export const SIGNAL_TYPE_WEIGHTS: Record<string, number> = {
  tag_match: 0.3, // 标签匹配权重最高
  domain_match: 0.25, // 域名匹配次之
  platform_match: 0.2, // 平台匹配
  folder_match: 0.1, // 文件夹匹配
  content_type_match: 0.1, // 内容类型匹配
  frequency_check: 0.03, // 频次检查
  time_pattern: 0.02, // 时间模式
};

/**
 * 画像组权重
 *
 * 不同画像组的基础权重，用于平衡不同群体
 */
export const PERSONA_GROUP_WEIGHTS: Record<PersonaGroup, number> = {
  academic: 1.0, // 学术群体
  content: 1.0, // 内容创作群体
  tech: 1.0, // 技术群体
  professional: 1.1, // 专业人士群体（略微提升）
  design: 1.1, // 设计群体（略微提升）
  growth: 1.0, // 成长群体
  general: 0.9, // 通用（略微降低）
};

// =============================================================================
// 置信度计算权重
// =============================================================================

/**
 * 置信度计算因素权重
 */
export const CONFIDENCE_FACTOR_WEIGHTS = {
  /** 规则匹配置信度权重 */
  ruleMatch: 0.4,
  /** 信号强度权重 */
  signalStrength: 0.25,
  /** 信号覆盖度权重 */
  signalCoverage: 0.15,
  /** 画像组匹配权重 */
  groupMatch: 0.1,
  /** 历史行为一致性权重 */
  behaviorConsistency: 0.1,
};

/**
 * 计算加权置信度
 */
export function calculateWeightedConfidence(factors: {
  ruleMatchConfidence: number;
  signalStrength: number;
  signalCoverage: number;
  groupMatchScore: number;
  behaviorConsistency: number;
}): number {
  const {
    ruleMatchConfidence,
    signalStrength,
    signalCoverage,
    groupMatchScore,
    behaviorConsistency,
  } = factors;

  return (
    ruleMatchConfidence * CONFIDENCE_FACTOR_WEIGHTS.ruleMatch +
    signalStrength * CONFIDENCE_FACTOR_WEIGHTS.signalStrength +
    signalCoverage * CONFIDENCE_FACTOR_WEIGHTS.signalCoverage +
    groupMatchScore * CONFIDENCE_FACTOR_WEIGHTS.groupMatch +
    behaviorConsistency * CONFIDENCE_FACTOR_WEIGHTS.behaviorConsistency
  );
}

// =============================================================================
// 画像优先级矩阵
// =============================================================================

/**
 * 画像基础优先级
 *
 * 当多个画像置信度相近时，用于决定推荐顺序
 * 使用 Partial 因为不是所有画像都需要定义优先级
 */
export const PERSONA_BASE_PRIORITY: Partial<Record<PersonaType, number>> = {
  // 专业群体优先级较高
  pm: 85,
  consultant: 80,
  analyst: 80,
  ux_researcher: 75,

  // 学术群体
  teacher: 75,
  phd: 70,
  master: 65,
  student: 60,
  researcher: 70,

  // 内容创作群体
  tech_blogger: 65,
  knowledge_blogger: 65,
  dev_blogger: 65,
  online_teacher: 65,
  curator: 60,

  // 技术群体
  indie_dev: 70,
  ai_enthusiast: 65,
  creator: 60,
  security_researcher: 70,
  architect: 75,

  // 专业服务型
  lawyer: 75,
  medical: 75,
  journalist: 70,

  // 产品设计型
  game_planner: 70,
  trainer: 65,

  // 成长群体
  cert_seeker: 70,
  lifelong_learner: 60,
  career_changer: 65,
  language_learner: 60,

  // 通用
  general: 50,
};

/**
 * 获取画像优先级
 */
export function getPersonaPriority(persona: PersonaType): number {
  return PERSONA_BASE_PRIORITY[persona] ?? 50;
}

// =============================================================================
// 竞争画像消歧规则
// =============================================================================

/**
 * 竞争画像对及消歧策略
 */
export interface CompetingPersonaRule {
  personas: [PersonaType, PersonaType];
  disambiguationSignals: string[];
  description: string;
}

/**
 * 竞争画像消歧规则
 */
export const COMPETING_PERSONA_RULES: CompetingPersonaRule[] = [
  {
    personas: ["pm", "ux_researcher"],
    disambiguationSignals: [
      "竞品分析 → pm",
      "用研洞察 → ux_researcher",
      "PRD → pm",
      "设计规范 → ux_researcher",
    ],
    description: "产品经理 vs UX研究员：关注点差异",
  },
  {
    personas: ["consultant", "analyst"],
    disambiguationSignals: [
      "案例库 → consultant",
      "研报 → analyst",
      "方法论 → consultant",
      "财报 → analyst",
    ],
    description: "咨询顾问 vs 分析师：输出类型差异",
  },
  {
    personas: ["teacher", "phd"],
    disambiguationSignals: [
      "教学 → teacher",
      "研究 → phd",
      "课程 → teacher",
      "论文发表 → phd",
    ],
    description: "大学教师 vs 博士生：职业阶段差异",
  },
  {
    personas: ["cert_seeker", "student"],
    disambiguationSignals: [
      "考证 → cert_seeker",
      "课程 → student",
      "真题 → cert_seeker",
      "作业 → student",
    ],
    description: "考证备考 vs 学生：学习目标差异",
  },
];

/**
 * 查找竞争画像规则
 */
export function findCompetingRule(
  persona1: PersonaType,
  persona2: PersonaType,
): CompetingPersonaRule | null {
  return (
    COMPETING_PERSONA_RULES.find(
      (rule) =>
        (rule.personas[0] === persona1 && rule.personas[1] === persona2) ||
        (rule.personas[0] === persona2 && rule.personas[1] === persona1),
    ) ?? null
  );
}
