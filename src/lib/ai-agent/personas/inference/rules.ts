/**
 * Phase 1 & Phase 2 画像推断规则定义
 *
 * 包含 6 类画像的推断规则：
 * - Phase 1: pm, consultant, teacher
 * - Phase 2: analyst, cert_seeker, ux_researcher
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

import type { InferenceRule } from "./types";

// =============================================================================
// 产品经理推断规则
// =============================================================================

/**
 * 产品经理画像推断规则
 */
export const PM_INFERENCE_RULES: InferenceRule[] = [
  {
    id: "pm-rule-1",
    name: "竞品分析行为",
    description: "识别竞品分析相关的收藏行为",
    targetPersona: "pm",
    targetGroup: "design",
    priority: 80,
    conditions: [
      {
        type: "tag_match",
        patterns: [
          /竞品|竞对|产品分析|功能对比/,
          /PRD|需求文档|产品规划/,
          /用户反馈|用户调研|NPS/,
        ],
        operator: "any",
        minMatchCount: 2,
        weight: 0.8,
      },
      {
        type: "platform_match",
        platforms: ["即刻", "人人都是产品经理", "ProductHunt", "36氪", "虎嗅"],
        operator: "any",
        weight: 0.6,
      },
    ],
    conditionLogic: "and",
    minConfidence: 0.5,
    enabled: true,
  },
  {
    id: "pm-rule-2",
    name: "产品工具域名偏好",
    description: "识别产品相关工具和平台的使用",
    targetPersona: "pm",
    targetGroup: "design",
    priority: 70,
    conditions: [
      {
        type: "domain_match",
        patterns: [
          /producthunt\.com/,
          /woshipm\.com/,
          /36kr\.com/,
          /huxiu\.com/,
          /jike\.info/,
        ],
        operator: "any",
        minMatchCount: 3,
        weight: 0.7,
      },
    ],
    conditionLogic: "and",
    minConfidence: 0.4,
    enabled: true,
  },
  {
    id: "pm-rule-3",
    name: "产品文件夹组织",
    description: "识别产品相关的文件夹命名",
    targetPersona: "pm",
    targetGroup: "design",
    priority: 60,
    conditions: [
      {
        type: "folder_match",
        patterns: [/竞品/, /需求/, /产品/, /PRD/, /调研/],
        operator: "any",
        weight: 0.5,
      },
    ],
    conditionLogic: "and",
    minConfidence: 0.3,
    enabled: true,
  },
];

// =============================================================================
// 咨询顾问推断规则
// =============================================================================

/**
 * 咨询顾问画像推断规则
 */
export const CONSULTANT_INFERENCE_RULES: InferenceRule[] = [
  {
    id: "consultant-rule-1",
    name: "案例研究行为",
    description: "识别案例研究和方法论相关的收藏行为",
    targetPersona: "consultant",
    targetGroup: "professional",
    priority: 80,
    conditions: [
      {
        type: "tag_match",
        patterns: [
          /案例|case|最佳实践/,
          /方法论|框架|模型/,
          /行业研究|市场分析/,
          /咨询|Consulting/,
        ],
        operator: "any",
        minMatchCount: 2,
        weight: 0.8,
      },
      {
        type: "content_type_match",
        contentTypes: ["研报", "白皮书", "案例分析", "行业报告"],
        operator: "any",
        weight: 0.7,
      },
    ],
    conditionLogic: "and",
    minConfidence: 0.5,
    enabled: true,
  },
  {
    id: "consultant-rule-2",
    name: "咨询平台偏好",
    description: "识别咨询和商业分析平台的使用",
    targetPersona: "consultant",
    targetGroup: "professional",
    priority: 70,
    conditions: [
      {
        type: "domain_match",
        patterns: [
          /mckinsey\.com/,
          /bcg\.com/,
          /bain\.com/,
          /hbr\.org/,
          /strategyand\.pwc\.com/,
        ],
        operator: "any",
        minMatchCount: 2,
        weight: 0.8,
      },
    ],
    conditionLogic: "and",
    minConfidence: 0.4,
    enabled: true,
  },
  {
    id: "consultant-rule-3",
    name: "咨询文件夹组织",
    description: "识别咨询相关的文件夹命名",
    targetPersona: "consultant",
    targetGroup: "professional",
    priority: 60,
    conditions: [
      {
        type: "folder_match",
        patterns: [/案例/, /方法论/, /行业/, /客户/, /项目/],
        operator: "any",
        weight: 0.5,
      },
    ],
    conditionLogic: "and",
    minConfidence: 0.3,
    enabled: true,
  },
];

// =============================================================================
// 大学教师推断规则
// =============================================================================

/**
 * 大学教师画像推断规则
 */
export const TEACHER_INFERENCE_RULES: InferenceRule[] = [
  {
    id: "teacher-rule-1",
    name: "教学资料行为",
    description: "识别教学和学术资料相关的收藏行为",
    targetPersona: "teacher",
    targetGroup: "academic",
    priority: 80,
    conditions: [
      {
        type: "tag_match",
        patterns: [
          /课程|教学|教案|课件/,
          /论文|Paper|研究/,
          /学术|科研|期刊/,
          /案例教学|教学案例/,
        ],
        operator: "any",
        minMatchCount: 2,
        weight: 0.8,
      },
      {
        type: "content_type_match",
        contentTypes: ["论文", "教材", "课件", "学术文章", "研究报告"],
        operator: "any",
        weight: 0.7,
      },
    ],
    conditionLogic: "and",
    minConfidence: 0.5,
    enabled: true,
  },
  {
    id: "teacher-rule-2",
    name: "学术平台偏好",
    description: "识别学术和教育平台的使用",
    targetPersona: "teacher",
    targetGroup: "academic",
    priority: 70,
    conditions: [
      {
        type: "domain_match",
        patterns: [
          /cnki\.net/,
          /scholar\.google/,
          /researchgate\.net/,
          /arxiv\.org/,
          /ssrn\.com/,
          /edu\.cn/,
        ],
        operator: "any",
        minMatchCount: 3,
        weight: 0.8,
      },
    ],
    conditionLogic: "and",
    minConfidence: 0.4,
    enabled: true,
  },
  {
    id: "teacher-rule-3",
    name: "教学文件夹组织",
    description: "识别教学相关的文件夹命名",
    targetPersona: "teacher",
    targetGroup: "academic",
    priority: 60,
    conditions: [
      {
        type: "folder_match",
        patterns: [/课程/, /教学/, /论文/, /科研/, /学生/],
        operator: "any",
        weight: 0.5,
      },
    ],
    conditionLogic: "and",
    minConfidence: 0.3,
    enabled: true,
  },
];

// =============================================================================
// 行业分析师推断规则 (Phase 2)
// =============================================================================

/**
 * 行业分析师画像推断规则
 */
export const ANALYST_INFERENCE_RULES: InferenceRule[] = [
  {
    id: "analyst-rule-1",
    name: "研报数据行为",
    description: "识别研报和数据分析相关的收藏行为",
    targetPersona: "analyst",
    targetGroup: "professional",
    priority: 85,
    conditions: [
      {
        type: "tag_match",
        patterns: [
          /研报|券商|分析报告|行业报告/,
          /财报|年报|季报|公告/,
          /数据|指标|KPI|增速/,
          /投资|估值|赛道|趋势/,
        ],
        operator: "any",
        minMatchCount: 2,
        weight: 0.9,
      },
      {
        type: "content_type_match",
        contentTypes: ["研报", "财报数据", "行业新闻", "竞品公告", "访谈记录"],
        operator: "any",
        weight: 0.7,
      },
    ],
    conditionLogic: "and",
    minConfidence: 0.5,
    enabled: true,
  },
  {
    id: "analyst-rule-2",
    name: "金融平台偏好",
    description: "识别金融和数据平台的使用",
    targetPersona: "analyst",
    targetGroup: "professional",
    priority: 75,
    conditions: [
      {
        type: "domain_match",
        patterns: [
          /eastmoney\.com/,
          /xueqiu\.com/,
          /wind\.com\.cn/,
          /bloomberg\.com/,
          /sina\.com\.cn.*finance/,
        ],
        operator: "any",
        minMatchCount: 2,
        weight: 0.8,
      },
      {
        type: "platform_match",
        platforms: ["Wind", "Bloomberg", "东方财富", "雪球", "新浪财经"],
        operator: "any",
        weight: 0.7,
      },
    ],
    conditionLogic: "or",
    minConfidence: 0.4,
    enabled: true,
  },
  {
    id: "analyst-rule-3",
    name: "分析师文件夹组织",
    description: "识别分析相关的文件夹命名",
    targetPersona: "analyst",
    targetGroup: "professional",
    priority: 65,
    conditions: [
      {
        type: "folder_match",
        patterns: [/研报/, /数据/, /公司/, /行业/, /投资/],
        operator: "any",
        weight: 0.5,
      },
    ],
    conditionLogic: "and",
    minConfidence: 0.3,
    enabled: true,
  },
];

// =============================================================================
// 考证备考者推断规则 (Phase 2)
// =============================================================================

/**
 * 考证备考者画像推断规则
 */
export const CERT_SEEKER_INFERENCE_RULES: InferenceRule[] = [
  {
    id: "cert-seeker-rule-1",
    name: "备考资料行为",
    description: "识别考试备考相关的收藏行为",
    targetPersona: "cert_seeker",
    targetGroup: "growth",
    priority: 85,
    conditions: [
      {
        type: "tag_match",
        patterns: [
          /考试|备考|考证|认证/,
          /CPA|CFA|司考|法考|注会/,
          /真题|模拟题|错题|练习/,
          /知识点|考点|重点|难点/,
          /复习|冲刺|押题|背诵/,
        ],
        operator: "any",
        minMatchCount: 2,
        weight: 0.9,
      },
      {
        type: "content_type_match",
        contentTypes: [
          "教材笔记",
          "错题记录",
          "真题解析",
          "备考经验",
          "考点总结",
        ],
        operator: "any",
        weight: 0.7,
      },
    ],
    conditionLogic: "and",
    minConfidence: 0.5,
    enabled: true,
  },
  {
    id: "cert-seeker-rule-2",
    name: "备考平台偏好",
    description: "识别考试培训平台的使用",
    targetPersona: "cert_seeker",
    targetGroup: "growth",
    priority: 75,
    conditions: [
      {
        type: "domain_match",
        patterns: [
          /gaodun\.com/,
          /examcoo\.com/,
          /zhihu\.com/,
          /bilibili\.com/,
          /cpa\.net\.cn/,
        ],
        operator: "any",
        minMatchCount: 2,
        weight: 0.7,
      },
      {
        type: "platform_match",
        platforms: ["知乎", "小红书", "B站", "考试吧", "高顿"],
        operator: "any",
        weight: 0.6,
      },
    ],
    conditionLogic: "or",
    minConfidence: 0.4,
    enabled: true,
  },
  {
    id: "cert-seeker-rule-3",
    name: "备考文件夹组织",
    description: "识别备考相关的文件夹命名",
    targetPersona: "cert_seeker",
    targetGroup: "growth",
    priority: 65,
    conditions: [
      {
        type: "folder_match",
        patterns: [/考试/, /备考/, /错题/, /笔记/, /真题/],
        operator: "any",
        weight: 0.5,
      },
    ],
    conditionLogic: "and",
    minConfidence: 0.3,
    enabled: true,
  },
  {
    id: "cert-seeker-rule-4",
    name: "高频学习行为",
    description: "识别持续学习的行为模式",
    targetPersona: "cert_seeker",
    targetGroup: "growth",
    priority: 60,
    conditions: [
      {
        type: "frequency_check",
        metric: "daily",
        operator: "greater_than",
        value: 3,
        weight: 0.6,
      },
      {
        type: "time_pattern",
        pattern: "evening",
        minRatio: 0.4,
        weight: 0.5,
      },
    ],
    conditionLogic: "and",
    minConfidence: 0.35,
    enabled: true,
  },
];

// =============================================================================
// UX 研究员推断规则 (Phase 2)
// =============================================================================

/**
 * UX 研究员画像推断规则
 */
export const UX_RESEARCHER_INFERENCE_RULES: InferenceRule[] = [
  {
    id: "ux-researcher-rule-1",
    name: "用研洞察行为",
    description: "识别用户研究相关的收藏行为",
    targetPersona: "ux_researcher",
    targetGroup: "design",
    priority: 85,
    conditions: [
      {
        type: "tag_match",
        patterns: [
          /用研|用户研究|用户洞察/,
          /设计模式|交互模式|设计规范/,
          /可用性|易用性|用户体验/,
          /原型|Figma|Sketch|设计稿/,
          /A\/B测试|用户测试|眼动/,
        ],
        operator: "any",
        minMatchCount: 2,
        weight: 0.9,
      },
      {
        type: "content_type_match",
        contentTypes: [
          "用研报告",
          "设计规范",
          "交互案例",
          "可用性报告",
          "竞品体验",
        ],
        operator: "any",
        weight: 0.7,
      },
    ],
    conditionLogic: "and",
    minConfidence: 0.5,
    enabled: true,
  },
  {
    id: "ux-researcher-rule-2",
    name: "设计平台偏好",
    description: "识别设计和用研平台的使用",
    targetPersona: "ux_researcher",
    targetGroup: "design",
    priority: 75,
    conditions: [
      {
        type: "domain_match",
        patterns: [
          /nngroup\.com/,
          /uxdesign\.cc/,
          /dribbble\.com/,
          /behance\.net/,
          /figma\.com/,
          /uxpin\.com/,
        ],
        operator: "any",
        minMatchCount: 2,
        weight: 0.8,
      },
      {
        type: "platform_match",
        platforms: ["Dribbble", "Behance", "站酷", "UI中国", "优设"],
        operator: "any",
        weight: 0.6,
      },
    ],
    conditionLogic: "or",
    minConfidence: 0.4,
    enabled: true,
  },
  {
    id: "ux-researcher-rule-3",
    name: "用研文件夹组织",
    description: "识别用研相关的文件夹命名",
    targetPersona: "ux_researcher",
    targetGroup: "design",
    priority: 65,
    conditions: [
      {
        type: "folder_match",
        patterns: [/用研/, /设计/, /交互/, /体验/, /原型/],
        operator: "any",
        weight: 0.5,
      },
    ],
    conditionLogic: "and",
    minConfidence: 0.3,
    enabled: true,
  },
];

// =============================================================================
// 规则集合导出
// =============================================================================

/**
 * Phase 1 推断规则集合
 */
export const PHASE1_INFERENCE_RULES: InferenceRule[] = [
  ...PM_INFERENCE_RULES,
  ...CONSULTANT_INFERENCE_RULES,
  ...TEACHER_INFERENCE_RULES,
];

/**
 * Phase 2 推断规则集合
 */
export const PHASE2_INFERENCE_RULES: InferenceRule[] = [
  ...ANALYST_INFERENCE_RULES,
  ...CERT_SEEKER_INFERENCE_RULES,
  ...UX_RESEARCHER_INFERENCE_RULES,
];

/**
 * 所有推断规则
 */
export const ALL_INFERENCE_RULES: InferenceRule[] = [
  ...PHASE1_INFERENCE_RULES,
  ...PHASE2_INFERENCE_RULES,
];

/**
 * 按画像类型分组的规则
 */
export const INFERENCE_RULES_BY_PERSONA: Record<string, InferenceRule[]> = {
  pm: PM_INFERENCE_RULES,
  consultant: CONSULTANT_INFERENCE_RULES,
  teacher: TEACHER_INFERENCE_RULES,
  analyst: ANALYST_INFERENCE_RULES,
  cert_seeker: CERT_SEEKER_INFERENCE_RULES,
  ux_researcher: UX_RESEARCHER_INFERENCE_RULES,
};
