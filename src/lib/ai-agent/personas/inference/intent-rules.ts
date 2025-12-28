/**
 * 画像特定意图规则 v3.1
 *
 * 结合用户画像增强意图推断能力
 *
 * @version 3.1.0
 * @since 2025-12-28
 */

import type { PersonaType } from "../types";

// =============================================================================
// 画像意图规则类型
// =============================================================================

/**
 * 画像意图规则
 */
export interface PersonaIntentRule {
  /** 规则 ID */
  id: string;
  /** 适用画像 */
  personas: PersonaType[];
  /** 触发模式 */
  pattern: RegExp;
  /** 推断意图类型 */
  intentType: string;
  /** 意图子类型 */
  intentSubtype?: string;
  /** 置信度提升因子 */
  confidenceBoost: number;
  /** 上下文提示 */
  contextHint: string;
  /** 推荐响应风格 */
  responseStyle?: "concise" | "detailed" | "structured";
  /** 优先级 */
  priority: number;
}

// =============================================================================
// Phase 1 画像意图规则
// =============================================================================

/**
 * 产品经理意图规则
 */
export const PM_INTENT_RULES: PersonaIntentRule[] = [
  {
    id: "pm-competitive",
    personas: ["pm"],
    pattern: /竞品|竞对|对手|同类产品/,
    intentType: "analyze",
    intentSubtype: "competitive_analysis",
    confidenceBoost: 1.5,
    contextHint: "用户可能需要竞品功能对比表格",
    responseStyle: "structured",
    priority: 90,
  },
  {
    id: "pm-prd",
    personas: ["pm"],
    pattern: /PRD|需求|产品文档|规划/,
    intentType: "search",
    intentSubtype: "prd_material",
    confidenceBoost: 1.4,
    contextHint: "优先检索产品相关素材",
    responseStyle: "detailed",
    priority: 85,
  },
  {
    id: "pm-feedback",
    personas: ["pm"],
    pattern: /反馈|用户说|用户要|吐槽|建议/,
    intentType: "analyze",
    intentSubtype: "feedback_cluster",
    confidenceBoost: 1.4,
    contextHint: "对反馈进行聚类分析",
    responseStyle: "structured",
    priority: 80,
  },
];

/**
 * 咨询顾问意图规则
 */
export const CONSULTANT_INTENT_RULES: PersonaIntentRule[] = [
  {
    id: "consultant-case",
    personas: ["consultant"],
    pattern: /案例|case|最佳实践|成功经验/,
    intentType: "search",
    intentSubtype: "case_library",
    confidenceBoost: 1.6,
    contextHint: "按行业和问题类型组织案例",
    responseStyle: "structured",
    priority: 90,
  },
  {
    id: "consultant-methodology",
    personas: ["consultant"],
    pattern: /方法论|框架|模型|工具/,
    intentType: "search",
    intentSubtype: "methodology",
    confidenceBoost: 1.5,
    contextHint: "整理可复用的方法论",
    responseStyle: "detailed",
    priority: 85,
  },
  {
    id: "consultant-industry",
    personas: ["consultant"],
    pattern: /行业|市场|趋势|洞察/,
    intentType: "analyze",
    intentSubtype: "industry_research",
    confidenceBoost: 1.4,
    contextHint: "突出市场规模、竞争格局、趋势",
    responseStyle: "detailed",
    priority: 80,
  },
];

/**
 * 大学教师意图规则
 */
export const TEACHER_INTENT_RULES: PersonaIntentRule[] = [
  {
    id: "teacher-course",
    personas: ["teacher"],
    pattern: /课程|教学|课件|教案/,
    intentType: "organize",
    intentSubtype: "course_organize",
    confidenceBoost: 1.5,
    contextHint: "按课程章节结构组织",
    responseStyle: "structured",
    priority: 90,
  },
  {
    id: "teacher-paper",
    personas: ["teacher"],
    pattern: /论文|文献|研究|Paper/,
    intentType: "search",
    intentSubtype: "paper_tracking",
    confidenceBoost: 1.4,
    contextHint: "按学术价值和教学相关性排序",
    responseStyle: "detailed",
    priority: 85,
  },
  {
    id: "teacher-case",
    personas: ["teacher"],
    pattern: /教学案例|案例|实例|例子/,
    intentType: "search",
    intentSubtype: "teaching_case",
    confidenceBoost: 1.4,
    contextHint: "标注适用课程和教学目标",
    responseStyle: "structured",
    priority: 80,
  },
];

// =============================================================================
// Phase 2 画像意图规则
// =============================================================================

/**
 * 行业分析师意图规则
 */
export const ANALYST_INTENT_RULES: PersonaIntentRule[] = [
  {
    id: "analyst-report",
    personas: ["analyst"],
    pattern: /研报|券商|分析报告|研究报告/,
    intentType: "search",
    intentSubtype: "research_report",
    confidenceBoost: 1.6,
    contextHint: "按领域、时间、机构分类",
    responseStyle: "structured",
    priority: 90,
  },
  {
    id: "analyst-data",
    personas: ["analyst"],
    pattern: /数据|指标|财报|年报|季报/,
    intentType: "analyze",
    intentSubtype: "data_tracking",
    confidenceBoost: 1.5,
    contextHint: "突出变化、原因、影响",
    responseStyle: "detailed",
    priority: 88,
  },
  {
    id: "analyst-company",
    personas: ["analyst"],
    pattern: /公司|企业|上市|竞品/,
    intentType: "analyze",
    intentSubtype: "company_analysis",
    confidenceBoost: 1.4,
    contextHint: "按业务、财务、战略维度分析",
    responseStyle: "structured",
    priority: 85,
  },
  {
    id: "analyst-trend",
    personas: ["analyst"],
    pattern: /趋势|赛道|机会|投资/,
    intentType: "analyze",
    intentSubtype: "trend_tracking",
    confidenceBoost: 1.4,
    contextHint: "标注数据时效性",
    responseStyle: "detailed",
    priority: 80,
  },
];

/**
 * 考证备考者意图规则
 */
export const CERT_SEEKER_INTENT_RULES: PersonaIntentRule[] = [
  {
    id: "cert-exam",
    personas: ["cert_seeker"],
    pattern: /考试|考证|认证|备考/,
    intentType: "organize",
    intentSubtype: "exam_organize",
    confidenceBoost: 1.6,
    contextHint: "按科目、章节、知识点组织",
    responseStyle: "structured",
    priority: 90,
  },
  {
    id: "cert-error",
    personas: ["cert_seeker"],
    pattern: /错题|易错|难点|不会/,
    intentType: "analyze",
    intentSubtype: "error_analysis",
    confidenceBoost: 1.5,
    contextHint: "按题型、考点、原因分类",
    responseStyle: "structured",
    priority: 88,
  },
  {
    id: "cert-review",
    personas: ["cert_seeker"],
    pattern: /复习|重点|考点|背诵/,
    intentType: "organize",
    intentSubtype: "review_remind",
    confidenceBoost: 1.4,
    contextHint: "提供记忆技巧和口诀",
    responseStyle: "concise",
    priority: 85,
  },
  {
    id: "cert-progress",
    personas: ["cert_seeker"],
    pattern: /进度|完成|还有|剩下/,
    intentType: "query",
    intentSubtype: "progress_track",
    confidenceBoost: 1.3,
    contextHint: "展示已掌握、待强化、未学习",
    responseStyle: "structured",
    priority: 80,
  },
  {
    id: "cert-real-exam",
    personas: ["cert_seeker"],
    pattern: /真题|模拟题|历年|押题/,
    intentType: "search",
    intentSubtype: "exam_material",
    confidenceBoost: 1.5,
    contextHint: "区分真题和模拟题",
    responseStyle: "detailed",
    priority: 82,
  },
];

/**
 * UX 研究员意图规则
 */
export const UX_RESEARCHER_INTENT_RULES: PersonaIntentRule[] = [
  {
    id: "ux-insight",
    personas: ["ux_researcher"],
    pattern: /洞察|用研|研究发现|用户反馈/,
    intentType: "organize",
    intentSubtype: "insight_organize",
    confidenceBoost: 1.6,
    contextHint: "按用户群、场景、洞察组织",
    responseStyle: "structured",
    priority: 90,
  },
  {
    id: "ux-pattern",
    personas: ["ux_researcher"],
    pattern: /设计模式|交互模式|组件|规范/,
    intentType: "search",
    intentSubtype: "pattern_library",
    confidenceBoost: 1.5,
    contextHint: "标注适用场景、优缺点、案例",
    responseStyle: "detailed",
    priority: 88,
  },
  {
    id: "ux-case",
    personas: ["ux_researcher"],
    pattern: /交互案例|设计案例|竞品体验/,
    intentType: "search",
    intentSubtype: "case_search",
    confidenceBoost: 1.4,
    contextHint: "按交互类型、平台、效果分类",
    responseStyle: "structured",
    priority: 85,
  },
  {
    id: "ux-usability",
    personas: ["ux_researcher"],
    pattern: /可用性|易用性|问题|体验问题/,
    intentType: "analyze",
    intentSubtype: "usability_track",
    confidenceBoost: 1.4,
    contextHint: "按严重程度和频次优先级",
    responseStyle: "structured",
    priority: 82,
  },
  {
    id: "ux-prototype",
    personas: ["ux_researcher"],
    pattern: /原型|Figma|Sketch|设计稿/,
    intentType: "search",
    intentSubtype: "prototype_search",
    confidenceBoost: 1.3,
    contextHint: "检索设计资产和参考",
    responseStyle: "concise",
    priority: 78,
  },
];

// =============================================================================
// 跨画像通用规则
// =============================================================================

/**
 * 跨画像通用规则
 */
export const COMMON_PERSONA_RULES: PersonaIntentRule[] = [
  {
    id: "common-summarize",
    personas: ["pm", "consultant", "teacher", "analyst"],
    pattern: /总结|归纳|概括|摘要/,
    intentType: "analyze",
    intentSubtype: "batch_summarize",
    confidenceBoost: 1.3,
    contextHint: "根据画像风格生成摘要",
    responseStyle: "detailed",
    priority: 70,
  },
  {
    id: "common-compare",
    personas: ["pm", "consultant", "analyst", "ux_researcher"],
    pattern: /对比|比较|差异|区别/,
    intentType: "analyze",
    intentSubtype: "comparison",
    confidenceBoost: 1.3,
    contextHint: "生成对比表格",
    responseStyle: "structured",
    priority: 70,
  },
  {
    id: "common-export",
    personas: ["pm", "consultant", "teacher", "analyst"],
    pattern: /导出|输出|下载|生成报告/,
    intentType: "export",
    intentSubtype: "data_export",
    confidenceBoost: 1.2,
    contextHint: "根据画像选择导出格式",
    responseStyle: "concise",
    priority: 65,
  },
];

// =============================================================================
// 规则集合与工具函数
// =============================================================================

/**
 * Phase 1 意图规则
 */
export const PHASE1_INTENT_RULES: PersonaIntentRule[] = [
  ...PM_INTENT_RULES,
  ...CONSULTANT_INTENT_RULES,
  ...TEACHER_INTENT_RULES,
];

/**
 * Phase 2 意图规则
 */
export const PHASE2_INTENT_RULES: PersonaIntentRule[] = [
  ...ANALYST_INTENT_RULES,
  ...CERT_SEEKER_INTENT_RULES,
  ...UX_RESEARCHER_INTENT_RULES,
];

/**
 * 所有画像意图规则
 */
export const ALL_PERSONA_INTENT_RULES: PersonaIntentRule[] = [
  ...PHASE1_INTENT_RULES,
  ...PHASE2_INTENT_RULES,
  ...COMMON_PERSONA_RULES,
];

/**
 * 按画像分组的规则
 */
export const INTENT_RULES_BY_PERSONA: Partial<
  Record<PersonaType, PersonaIntentRule[]>
> = {
  pm: [
    ...PM_INTENT_RULES,
    ...COMMON_PERSONA_RULES.filter((r) => r.personas.includes("pm")),
  ],
  consultant: [
    ...CONSULTANT_INTENT_RULES,
    ...COMMON_PERSONA_RULES.filter((r) => r.personas.includes("consultant")),
  ],
  teacher: [
    ...TEACHER_INTENT_RULES,
    ...COMMON_PERSONA_RULES.filter((r) => r.personas.includes("teacher")),
  ],
  analyst: [
    ...ANALYST_INTENT_RULES,
    ...COMMON_PERSONA_RULES.filter((r) => r.personas.includes("analyst")),
  ],
  cert_seeker: CERT_SEEKER_INTENT_RULES,
  ux_researcher: [
    ...UX_RESEARCHER_INTENT_RULES,
    ...COMMON_PERSONA_RULES.filter((r) => r.personas.includes("ux_researcher")),
  ],
};

/**
 * 匹配画像意图规则
 */
export function matchPersonaIntentRules(
  message: string,
  persona: PersonaType,
): PersonaIntentRule[] {
  const personaRules = INTENT_RULES_BY_PERSONA[persona] || [];

  return personaRules
    .filter((rule) => rule.pattern.test(message))
    .sort((a, b) => b.priority - a.priority);
}

/**
 * 获取最佳匹配规则
 */
export function getBestPersonaIntentRule(
  message: string,
  persona: PersonaType,
): PersonaIntentRule | null {
  const matches = matchPersonaIntentRules(message, persona);
  return matches.length > 0 ? matches[0] : null;
}

/**
 * 生成画像意图规则 Prompt
 */
export function generatePersonaIntentPrompt(persona: PersonaType): string {
  const rules = INTENT_RULES_BY_PERSONA[persona];
  if (!rules || rules.length === 0) {
    return "";
  }

  const rows = rules.map(
    (r) =>
      `| ${r.pattern.source} | ${r.intentSubtype || r.intentType} | ${r.contextHint} |`,
  );

  return `
### ${persona} 专属意图规则

| 触发模式 | 意图类型 | 上下文提示 |
|----------|----------|------------|
${rows.join("\n")}
`;
}
