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
// Phase 3 画像意图规则
// =============================================================================

/**
 * 安全研究员意图规则
 */
export const SECURITY_RESEARCHER_INTENT_RULES: PersonaIntentRule[] = [
  {
    id: "security-vuln",
    personas: ["security_researcher"],
    pattern: /漏洞|CVE|exploit|安全事件|0day/,
    intentType: "search",
    intentSubtype: "vulnerability_tracking",
    confidenceBoost: 1.8,
    contextHint: "按严重程度、影响范围、时效性排序",
    responseStyle: "structured",
    priority: 95,
  },
  {
    id: "security-poc",
    personas: ["security_researcher"],
    pattern: /POC|PoC|利用|payload|shellcode/,
    intentType: "search",
    intentSubtype: "poc_search",
    confidenceBoost: 1.6,
    contextHint: "区分概念验证和实际利用代码",
    responseStyle: "detailed",
    priority: 90,
  },
  {
    id: "security-threat",
    personas: ["security_researcher"],
    pattern: /威胁|APT|攻击|入侵|情报/,
    intentType: "analyze",
    intentSubtype: "threat_analysis",
    confidenceBoost: 1.5,
    contextHint: "标注攻击向量和防御措施",
    responseStyle: "structured",
    priority: 85,
  },
];

/**
 * 技术架构师意图规则
 */
export const ARCHITECT_INTENT_RULES: PersonaIntentRule[] = [
  {
    id: "architect-practice",
    personas: ["architect"],
    pattern: /最佳实践|实践|规范|标准|原则/,
    intentType: "search",
    intentSubtype: "best_practice",
    confidenceBoost: 1.7,
    contextHint: "标注适用场景和权衡取舍",
    responseStyle: "detailed",
    priority: 90,
  },
  {
    id: "architect-compare",
    personas: ["architect"],
    pattern: /技术选型|对比|选择|评估|benchmark/,
    intentType: "analyze",
    intentSubtype: "tech_compare",
    confidenceBoost: 1.6,
    contextHint: "生成技术对比矩阵",
    responseStyle: "structured",
    priority: 88,
  },
  {
    id: "architect-pattern",
    personas: ["architect"],
    pattern: /架构模式|设计模式|pattern|微服务|分布式/,
    intentType: "search",
    intentSubtype: "pattern_search",
    confidenceBoost: 1.5,
    contextHint: "说明优缺点和适用场景",
    responseStyle: "detailed",
    priority: 85,
  },
];

/**
 * 医学从业者意图规则
 */
export const MEDICAL_INTENT_RULES: PersonaIntentRule[] = [
  {
    id: "medical-guideline",
    personas: ["medical"],
    pattern: /指南|guideline|共识|规范|诊疗/,
    intentType: "search",
    intentSubtype: "guideline_tracking",
    confidenceBoost: 1.8,
    contextHint: "标注发布时间和来源机构",
    responseStyle: "detailed",
    priority: 95,
  },
  {
    id: "medical-case",
    personas: ["medical"],
    pattern: /病例|case|症状|诊断|治疗方案/,
    intentType: "organize",
    intentSubtype: "case_organize",
    confidenceBoost: 1.5,
    contextHint: "按疾病类型和治疗方式分类",
    responseStyle: "structured",
    priority: 88,
  },
  {
    id: "medical-literature",
    personas: ["medical"],
    pattern: /文献|论文|研究|study|meta/,
    intentType: "search",
    intentSubtype: "literature_search",
    confidenceBoost: 1.4,
    contextHint: "优先高影响因子期刊",
    responseStyle: "detailed",
    priority: 85,
  },
];

/**
 * 记者意图规则
 */
export const JOURNALIST_INTENT_RULES: PersonaIntentRule[] = [
  {
    id: "journalist-source",
    personas: ["journalist"],
    pattern: /信源|来源|渠道|消息源|source/,
    intentType: "organize",
    intentSubtype: "source_manage",
    confidenceBoost: 1.7,
    contextHint: "按可信度和领域分类信源",
    responseStyle: "structured",
    priority: 90,
  },
  {
    id: "journalist-fact",
    personas: ["journalist"],
    pattern: /核查|核实|验证|fact-check|事实/,
    intentType: "analyze",
    intentSubtype: "fact_check",
    confidenceBoost: 1.6,
    contextHint: "提供多源交叉验证",
    responseStyle: "detailed",
    priority: 88,
  },
  {
    id: "journalist-timeline",
    personas: ["journalist"],
    pattern: /时间线|事件|进展|发展|脉络/,
    intentType: "organize",
    intentSubtype: "timeline_organize",
    confidenceBoost: 1.5,
    contextHint: "按时间顺序整理事件",
    responseStyle: "structured",
    priority: 85,
  },
];

/**
 * 游戏策划意图规则
 */
export const GAME_PLANNER_INTENT_RULES: PersonaIntentRule[] = [
  {
    id: "game-mechanic",
    personas: ["game_planner"],
    pattern: /机制|玩法|系统|loop|核心循环/,
    intentType: "analyze",
    intentSubtype: "mechanic_compare",
    confidenceBoost: 1.7,
    contextHint: "拆解核心循环和数值框架",
    responseStyle: "structured",
    priority: 90,
  },
  {
    id: "game-narrative",
    personas: ["game_planner"],
    pattern: /剧情|叙事|故事|narrative|世界观/,
    intentType: "organize",
    intentSubtype: "narrative_organize",
    confidenceBoost: 1.5,
    contextHint: "按时间线和角色组织叙事",
    responseStyle: "detailed",
    priority: 85,
  },
  {
    id: "game-analysis",
    personas: ["game_planner"],
    pattern: /竞品|拆解|分析|对比|游戏/,
    intentType: "analyze",
    intentSubtype: "game_analysis",
    confidenceBoost: 1.5,
    contextHint: "从机制、美术、体验角度分析",
    responseStyle: "structured",
    priority: 82,
  },
];

/**
 * 企业培训师意图规则
 */
export const TRAINER_INTENT_RULES: PersonaIntentRule[] = [
  {
    id: "trainer-design",
    personas: ["trainer"],
    pattern: /培训设计|课程设计|教案|教学设计/,
    intentType: "organize",
    intentSubtype: "training_design",
    confidenceBoost: 1.6,
    contextHint: "按学习目标和教学方法组织",
    responseStyle: "structured",
    priority: 90,
  },
  {
    id: "trainer-case",
    personas: ["trainer"],
    pattern: /案例|实战|演练|情景|workshop/,
    intentType: "search",
    intentSubtype: "case_search",
    confidenceBoost: 1.5,
    contextHint: "标注适用场景和学员层次",
    responseStyle: "detailed",
    priority: 85,
  },
  {
    id: "trainer-method",
    personas: ["trainer"],
    pattern: /方法|工具|模型|框架|技巧/,
    intentType: "search",
    intentSubtype: "methodology_search",
    confidenceBoost: 1.4,
    contextHint: "整理可落地的方法工具",
    responseStyle: "structured",
    priority: 80,
  },
];

/**
 * 科研人员意图规则
 */
export const RESEARCHER_INTENT_RULES: PersonaIntentRule[] = [
  {
    id: "researcher-literature",
    personas: ["researcher"],
    pattern: /文献|论文|paper|综述|review/,
    intentType: "search",
    intentSubtype: "literature_review",
    confidenceBoost: 1.7,
    contextHint: "按研究方向和时间线整理",
    responseStyle: "detailed",
    priority: 90,
  },
  {
    id: "researcher-citation",
    personas: ["researcher"],
    pattern: /引用|参考|citation|参考文献/,
    intentType: "organize",
    intentSubtype: "citation_manage",
    confidenceBoost: 1.5,
    contextHint: "生成标准格式引用",
    responseStyle: "structured",
    priority: 85,
  },
  {
    id: "researcher-data",
    personas: ["researcher"],
    pattern: /数据|实验|结果|统计|分析/,
    intentType: "organize",
    intentSubtype: "data_organize",
    confidenceBoost: 1.4,
    contextHint: "按实验类型和结论分类",
    responseStyle: "detailed",
    priority: 80,
  },
];

/**
 * 在线讲师意图规则
 */
export const ONLINE_TEACHER_INTENT_RULES: PersonaIntentRule[] = [
  {
    id: "online-teacher-course",
    personas: ["online_teacher"],
    pattern: /课程|系列|专栏|教程|chapter/,
    intentType: "organize",
    intentSubtype: "content_series",
    confidenceBoost: 1.6,
    contextHint: "按难度递进和知识关联组织",
    responseStyle: "structured",
    priority: 90,
  },
  {
    id: "online-teacher-material",
    personas: ["online_teacher"],
    pattern: /素材|案例|示例|演示|demo/,
    intentType: "search",
    intentSubtype: "material_search",
    confidenceBoost: 1.5,
    contextHint: "按课程章节关联素材",
    responseStyle: "detailed",
    priority: 85,
  },
];

/**
 * 策展人意图规则
 */
export const CURATOR_INTENT_RULES: PersonaIntentRule[] = [
  {
    id: "curator-curate",
    personas: ["curator"],
    pattern: /精选|推荐|策展|整理|周刊/,
    intentType: "organize",
    intentSubtype: "content_curation",
    confidenceBoost: 1.7,
    contextHint: "按主题和质量筛选内容",
    responseStyle: "structured",
    priority: 90,
  },
  {
    id: "curator-trend",
    personas: ["curator"],
    pattern: /趋势|热点|动态|新鲜事/,
    intentType: "analyze",
    intentSubtype: "trend_tracking",
    confidenceBoost: 1.5,
    contextHint: "标注时效性和热度",
    responseStyle: "concise",
    priority: 85,
  },
];

/**
 * 终身学习者意图规则
 */
export const LIFELONG_LEARNER_INTENT_RULES: PersonaIntentRule[] = [
  {
    id: "learner-knowledge-map",
    personas: ["lifelong_learner"],
    pattern: /知识图谱|知识体系|脉络|关联|体系/,
    intentType: "organize",
    intentSubtype: "knowledge_map",
    confidenceBoost: 1.7,
    contextHint: "构建知识点关联和学习路径",
    responseStyle: "structured",
    priority: 90,
  },
  {
    id: "learner-resource",
    personas: ["lifelong_learner", "career_changer"],
    pattern: /资源|学习资料|整合|汇总|推荐/,
    intentType: "organize",
    intentSubtype: "resource_integrate",
    confidenceBoost: 1.5,
    contextHint: "按难度和类型整理资源",
    responseStyle: "structured",
    priority: 85,
  },
  {
    id: "learner-reading",
    personas: ["lifelong_learner"],
    pattern: /读书|阅读|笔记|书单|摘要/,
    intentType: "organize",
    intentSubtype: "reading_manage",
    confidenceBoost: 1.4,
    contextHint: "整理阅读笔���和关键洞察",
    responseStyle: "detailed",
    priority: 80,
  },
];

/**
 * 职业转型者意图规则
 */
export const CAREER_CHANGER_INTENT_RULES: PersonaIntentRule[] = [
  {
    id: "changer-skill-gap",
    personas: ["career_changer"],
    pattern: /技能差距|能力|需要学|缺什么|要求/,
    intentType: "analyze",
    intentSubtype: "skill_gap",
    confidenceBoost: 1.7,
    contextHint: "对比现有技能与目标要求",
    responseStyle: "structured",
    priority: 90,
  },
  {
    id: "changer-industry",
    personas: ["career_changer"],
    pattern: /行业|领域|赛道|方向|前景/,
    intentType: "analyze",
    intentSubtype: "industry_analysis",
    confidenceBoost: 1.4,
    contextHint: "分析行业机会和门槛",
    responseStyle: "detailed",
    priority: 82,
  },
];

/**
 * 语言学习者意图规则
 */
export const LANGUAGE_LEARNER_INTENT_RULES: PersonaIntentRule[] = [
  {
    id: "lang-corpus",
    personas: ["language_learner"],
    pattern: /语料|词汇|单词|vocabulary|例句/,
    intentType: "organize",
    intentSubtype: "corpus_manage",
    confidenceBoost: 1.7,
    contextHint: "按主题和难度整理词汇",
    responseStyle: "structured",
    priority: 90,
  },
  {
    id: "lang-expression",
    personas: ["language_learner"],
    pattern: /表达|句型|pattern|用法|惯用语/,
    intentType: "analyze",
    intentSubtype: "expression_extract",
    confidenceBoost: 1.6,
    contextHint: "提炼高频表达模式",
    responseStyle: "detailed",
    priority: 88,
  },
  {
    id: "lang-practice",
    personas: ["language_learner"],
    pattern: /练习|听力|口语|阅读|写作/,
    intentType: "search",
    intentSubtype: "practice_material",
    confidenceBoost: 1.4,
    contextHint: "按技能类型推荐练习材料",
    responseStyle: "structured",
    priority: 82,
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
 * Phase 3 意图规则
 */
export const PHASE3_INTENT_RULES: PersonaIntentRule[] = [
  ...SECURITY_RESEARCHER_INTENT_RULES,
  ...ARCHITECT_INTENT_RULES,
  ...MEDICAL_INTENT_RULES,
  ...JOURNALIST_INTENT_RULES,
  ...GAME_PLANNER_INTENT_RULES,
  ...TRAINER_INTENT_RULES,
  ...RESEARCHER_INTENT_RULES,
  ...ONLINE_TEACHER_INTENT_RULES,
  ...CURATOR_INTENT_RULES,
  ...LIFELONG_LEARNER_INTENT_RULES,
  ...CAREER_CHANGER_INTENT_RULES,
  ...LANGUAGE_LEARNER_INTENT_RULES,
];

/**
 * 所有画像意图规则
 */
export const ALL_PERSONA_INTENT_RULES: PersonaIntentRule[] = [
  ...PHASE1_INTENT_RULES,
  ...PHASE2_INTENT_RULES,
  ...PHASE3_INTENT_RULES,
  ...COMMON_PERSONA_RULES,
];

// =============================================================================
// 综述意图规则 [S2]
// =============================================================================

/**
 * 综述意图规则
 *
 * 适用于触发主题综述生成的自然语言表达
 *
 * @since 2026-01-01
 */
export const SYNTHESIS_INTENT_RULES: PersonaIntentRule[] = [
  {
    id: "synthesis-create",
    personas: [
      "pm",
      "consultant",
      "teacher",
      "analyst",
      "researcher",
      "lifelong_learner",
      "curator",
    ],
    pattern:
      /综述|合成|整合|归纳|总结.*(收藏|文章|内容|书签)|把.*(综合|整理|汇总)|生成.*报告/,
    intentType: "create",
    intentSubtype: "synthesis",
    confidenceBoost: 1.6,
    contextHint: "用户希望生成多书签综述报告，需要识别目标书签范围",
    responseStyle: "structured",
    priority: 95,
  },
  {
    id: "synthesis-folder",
    personas: [
      "pm",
      "consultant",
      "teacher",
      "analyst",
      "researcher",
      "lifelong_learner",
    ],
    pattern: /(综述|总结|归纳).*(文件夹|目录)|(文件夹|目录).*(综述|总结|归纳)/,
    intentType: "create",
    intentSubtype: "synthesis_folder",
    confidenceBoost: 1.7,
    contextHint: "用户希望对指定文件夹内容生成综述",
    responseStyle: "structured",
    priority: 96,
  },
  {
    id: "synthesis-tag",
    personas: [
      "pm",
      "consultant",
      "teacher",
      "analyst",
      "researcher",
      "lifelong_learner",
    ],
    pattern: /(综述|总结|归纳).*(标签|主题)|(标签|主题).*(综述|总结|归纳)/,
    intentType: "create",
    intentSubtype: "synthesis_tag",
    confidenceBoost: 1.7,
    contextHint: "用户希望对指定标签内容生成综述",
    responseStyle: "structured",
    priority: 96,
  },
  {
    id: "synthesis-recent",
    personas: [
      "pm",
      "consultant",
      "teacher",
      "analyst",
      "researcher",
      "lifelong_learner",
    ],
    pattern: /(综述|总结|归纳).*(最近|近期|这周|今天|昨天)/,
    intentType: "create",
    intentSubtype: "synthesis_recent",
    confidenceBoost: 1.5,
    contextHint: "用户希望对最近收藏的内容生成综述",
    responseStyle: "structured",
    priority: 94,
  },
  {
    id: "synthesis-topic",
    personas: [
      "pm",
      "consultant",
      "teacher",
      "analyst",
      "researcher",
      "lifelong_learner",
    ],
    pattern: /(综述|总结|归纳).*(关于|有关)|关于.*(综述|总结|归纳)/,
    intentType: "create",
    intentSubtype: "synthesis_topic",
    confidenceBoost: 1.6,
    contextHint: "用户希望对特定主题内容生成综述",
    responseStyle: "structured",
    priority: 95,
  },
];

/**
 * 按画像分组的规则
 */
export const INTENT_RULES_BY_PERSONA: Partial<
  Record<PersonaType, PersonaIntentRule[]>
> = {
  // Phase 1
  pm: [
    ...PM_INTENT_RULES,
    ...COMMON_PERSONA_RULES.filter((r) => r.personas.includes("pm")),
    ...SYNTHESIS_INTENT_RULES.filter((r) => r.personas.includes("pm")),
  ],
  consultant: [
    ...CONSULTANT_INTENT_RULES,
    ...COMMON_PERSONA_RULES.filter((r) => r.personas.includes("consultant")),
    ...SYNTHESIS_INTENT_RULES.filter((r) => r.personas.includes("consultant")),
  ],
  teacher: [
    ...TEACHER_INTENT_RULES,
    ...COMMON_PERSONA_RULES.filter((r) => r.personas.includes("teacher")),
    ...SYNTHESIS_INTENT_RULES.filter((r) => r.personas.includes("teacher")),
  ],
  // Phase 2
  analyst: [
    ...ANALYST_INTENT_RULES,
    ...COMMON_PERSONA_RULES.filter((r) => r.personas.includes("analyst")),
    ...SYNTHESIS_INTENT_RULES.filter((r) => r.personas.includes("analyst")),
  ],
  cert_seeker: CERT_SEEKER_INTENT_RULES,
  ux_researcher: [
    ...UX_RESEARCHER_INTENT_RULES,
    ...COMMON_PERSONA_RULES.filter((r) => r.personas.includes("ux_researcher")),
  ],
  // Phase 3 - 技术实践型
  security_researcher: SECURITY_RESEARCHER_INTENT_RULES,
  architect: ARCHITECT_INTENT_RULES,
  // Phase 3 - 专业服务型
  medical: MEDICAL_INTENT_RULES,
  journalist: JOURNALIST_INTENT_RULES,
  // Phase 3 - 产品设计型
  game_planner: GAME_PLANNER_INTENT_RULES,
  trainer: TRAINER_INTENT_RULES,
  // Phase 3 - 学术研究型
  researcher: [
    ...RESEARCHER_INTENT_RULES,
    ...SYNTHESIS_INTENT_RULES.filter((r) => r.personas.includes("researcher")),
  ],
  // Phase 3 - 内容创作型
  online_teacher: ONLINE_TEACHER_INTENT_RULES,
  curator: [
    ...CURATOR_INTENT_RULES,
    ...SYNTHESIS_INTENT_RULES.filter((r) => r.personas.includes("curator")),
  ],
  // Phase 3 - 自我提升型
  lifelong_learner: [
    ...LIFELONG_LEARNER_INTENT_RULES,
    ...SYNTHESIS_INTENT_RULES.filter((r) =>
      r.personas.includes("lifelong_learner"),
    ),
  ],
  career_changer: [
    ...CAREER_CHANGER_INTENT_RULES,
    ...LIFELONG_LEARNER_INTENT_RULES.filter((r) =>
      r.personas.includes("career_changer"),
    ),
  ],
  language_learner: LANGUAGE_LEARNER_INTENT_RULES,
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
