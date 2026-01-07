/**
 * Briefing 问题模板库 (Story 1.5)
 * @module knowledge-studio/blueprint
 *
 * 提供常用的 Briefing 问题模板，蓝图开发者可以直接使用或自定义。
 */

import type { BriefingQuestion, BriefingQuestionCategory } from "./types";

// ============================================================
// 预定义问题模板
// ============================================================

/**
 * 目标受众问题模板
 */
export const AUDIENCE_QUESTIONS: Record<string, BriefingQuestion> = {
  /**
   * 技术水平
   */
  technicalLevel: {
    id: "audience_technical_level",
    type: "single_choice",
    category: "audience",
    question: "目标读者的技术水平是？",
    options: [
      { value: "beginner", label: "初学者", description: "刚接触该领域" },
      { value: "intermediate", label: "中级", description: "有一定基础" },
      { value: "advanced", label: "高级", description: "经验丰富" },
      { value: "expert", label: "专家", description: "领域专家" },
    ],
    required: true,
    priority: "quick", // P1-2: 快速模式核心问题
    defaultValue: "intermediate",
  },

  /**
   * 读者角色
   */
  readerRole: {
    id: "audience_reader_role",
    type: "single_choice",
    category: "audience",
    question: "主要读者群体是？",
    options: [
      { value: "developer", label: "开发者" },
      { value: "product_manager", label: "产品经理" },
      { value: "designer", label: "设计师" },
      { value: "business", label: "商务人员" },
      { value: "general", label: "通用受众" },
    ],
    required: true,
  },

  /**
   * 行业背景
   */
  industryBackground: {
    id: "audience_industry",
    type: "text",
    category: "audience",
    question: "读者主要来自哪个行业？",
    placeholder: "如：互联网、金融、医疗等",
    required: false,
  },
};

/**
 * 生成目标问题模板
 */
export const OBJECTIVE_QUESTIONS: Record<string, BriefingQuestion> = {
  /**
   * 内容目标
   */
  contentGoal: {
    id: "objective_content_goal",
    type: "single_choice",
    category: "objective",
    question: "这份内容的主要目标是？",
    options: [
      { value: "educate", label: "教育/科普", description: "帮助读者理解概念" },
      { value: "convince", label: "说服/论证", description: "改变读者观点" },
      { value: "inform", label: "告知/更新", description: "传递最新信息" },
      { value: "entertain", label: "娱乐/启发", description: "引发兴趣和思考" },
      { value: "guide", label: "指导/实操", description: "提供操作步骤" },
    ],
    required: true,
    priority: "quick", // P1-2: 快速模式核心问题
  },

  /**
   * 关键要点
   */
  keyTakeaways: {
    id: "objective_key_takeaways",
    type: "text",
    category: "objective",
    question: "希望读者获得的核心要点是什么？",
    placeholder: "列出 2-3 个关键信息点",
    required: false,
    helpText: "明确的要点帮助 AI 更好地组织内容结构",
  },

  /**
   * 预期行动
   */
  expectedAction: {
    id: "objective_expected_action",
    type: "text",
    category: "objective",
    question: "希望读者阅读后采取什么行动？",
    placeholder: "如：尝试新工具、报名课程、分享给同事等",
    required: false,
  },
};

/**
 * 语气风格问题模板
 */
export const TONE_QUESTIONS: Record<string, BriefingQuestion> = {
  /**
   * 写作风格
   */
  writingStyle: {
    id: "tone_writing_style",
    type: "single_choice",
    category: "tone",
    question: "期望的写作风格是？",
    options: [
      { value: "formal", label: "正式/学术", description: "严谨、客观" },
      { value: "casual", label: "轻松/口语", description: "亲切、易读" },
      { value: "professional", label: "专业/商务", description: "简洁、高效" },
      { value: "storytelling", label: "叙事/故事", description: "引人入胜" },
    ],
    required: true,
    priority: "quick", // P1-2: 快速模式核心问题
    defaultValue: "professional",
  },

  /**
   * 语气倾向
   */
  toneBias: {
    id: "tone_bias",
    type: "single_choice",
    category: "tone",
    question: "内容的语气倾向是？",
    options: [
      { value: "neutral", label: "中立客观" },
      { value: "positive", label: "积极正面" },
      { value: "critical", label: "批判分析" },
      { value: "inspirational", label: "激励鼓舞" },
    ],
    required: false,
    defaultValue: "neutral",
  },

  /**
   * 幽默程度
   */
  humorLevel: {
    id: "tone_humor",
    type: "scale",
    category: "tone",
    question: "内容的幽默程度？",
    scaleConfig: {
      min: 1,
      max: 5,
      step: 1,
      labels: {
        1: "严肃",
        3: "适度",
        5: "幽默",
      },
    },
    required: false,
    defaultValue: 2,
  },
};

/**
 * 约束条件问题模板
 */
export const CONSTRAINT_QUESTIONS: Record<string, BriefingQuestion> = {
  /**
   * 长度限制
   */
  lengthPreference: {
    id: "constraint_length",
    type: "single_choice",
    category: "constraint",
    question: "期望的内容长度是？",
    options: [
      { value: "short", label: "简短 (500-1000字)", description: "快速阅读" },
      { value: "medium", label: "中等 (1500-2500字)", description: "完整覆盖" },
      { value: "long", label: "详尽 (3000+字)", description: "深度探讨" },
    ],
    required: true,
    defaultValue: "medium",
  },

  /**
   * 必须包含的内容
   */
  mustInclude: {
    id: "constraint_must_include",
    type: "text",
    category: "constraint",
    question: "必须包含的内容或关键词？",
    placeholder: "如：案例研究、数据支撑、代码示例等",
    required: false,
  },

  /**
   * 避免的内容
   */
  mustAvoid: {
    id: "constraint_must_avoid",
    type: "text",
    category: "constraint",
    question: "需要避免的内容或表达？",
    placeholder: "如：过于技术化的术语、特定竞品名称等",
    required: false,
  },

  /**
   * 引用要求
   */
  citationRequirement: {
    id: "constraint_citation",
    type: "single_choice",
    category: "constraint",
    question: "引用和来源标注要求？",
    options: [
      { value: "none", label: "无需标注" },
      { value: "inline", label: "行内引用" },
      { value: "footnote", label: "脚注形式" },
      { value: "academic", label: "学术格式" },
    ],
    required: false,
    defaultValue: "inline",
  },
};

/**
 * 背景信息问题模板
 */
export const CONTEXT_QUESTIONS: Record<string, BriefingQuestion> = {
  /**
   * 发布平台
   */
  publishPlatform: {
    id: "context_platform",
    type: "single_choice",
    category: "context",
    question: "内容将发布在哪个平台？",
    options: [
      { value: "wechat", label: "微信公众号" },
      { value: "zhihu", label: "知乎" },
      { value: "juejin", label: "掘金" },
      { value: "blog", label: "个人博客" },
      { value: "newsletter", label: "Newsletter" },
      { value: "other", label: "其他" },
    ],
    required: false,
  },

  /**
   * 时效性
   */
  timeRelevance: {
    id: "context_time_relevance",
    type: "single_choice",
    category: "context",
    question: "内容的时效性要求？",
    options: [
      { value: "evergreen", label: "长青内容", description: "不受时间影响" },
      { value: "current", label: "时事相关", description: "当前热点" },
      { value: "dated", label: "时间敏感", description: "有明确时间节点" },
    ],
    required: false,
    defaultValue: "evergreen",
  },

  /**
   * 系列内容
   */
  seriesContext: {
    id: "context_series",
    type: "text",
    category: "context",
    question: "这是系列内容的一部分吗？如果是，请简述系列主题",
    placeholder: "如：「AI 入门」系列第 3 篇",
    required: false,
  },

  /**
   * 额外背景
   */
  additionalContext: {
    id: "context_additional",
    type: "text",
    category: "context",
    question: "还有什么背景信息需要 AI 了解？",
    placeholder: "任何对生成有帮助的补充信息",
    required: false,
  },
};

// ============================================================
// 问题模板工厂函数
// ============================================================

/**
 * 按类别获取所有预定义问题
 */
export function getQuestionsByCategory(
  category: BriefingQuestionCategory,
): BriefingQuestion[] {
  switch (category) {
    case "audience":
      return Object.values(AUDIENCE_QUESTIONS);
    case "objective":
      return Object.values(OBJECTIVE_QUESTIONS);
    case "tone":
      return Object.values(TONE_QUESTIONS);
    case "constraint":
      return Object.values(CONSTRAINT_QUESTIONS);
    case "context":
      return Object.values(CONTEXT_QUESTIONS);
    default:
      return [];
  }
}

/**
 * 获取问题模板（按 ID）
 */
export function getQuestionTemplate(id: string): BriefingQuestion | undefined {
  const allQuestions = {
    ...AUDIENCE_QUESTIONS,
    ...OBJECTIVE_QUESTIONS,
    ...TONE_QUESTIONS,
    ...CONSTRAINT_QUESTIONS,
    ...CONTEXT_QUESTIONS,
  };

  return Object.values(allQuestions).find((q) => q.id === id);
}

/**
 * 创建自定义问题
 */
export function createCustomQuestion(
  config: Omit<BriefingQuestion, "category"> & {
    category?: BriefingQuestionCategory;
  },
): BriefingQuestion {
  return {
    ...config,
    category: config.category ?? "custom",
  };
}

/**
 * 验证 Briefing 配置
 *
 * @param questions - 问题列表
 * @param maxQuestions - 最大问题数量限制
 * @throws 如果验证失败
 */
export function validateBriefingQuestions(
  questions: BriefingQuestion[],
  maxQuestions: 1 | 2 | 3 = 3,
): void {
  if (questions.length > maxQuestions) {
    throw new Error(
      `Briefing 问题数量超过限制：最多 ${maxQuestions} 个，当前 ${questions.length} 个`,
    );
  }

  // 检查问题 ID 唯一性
  const ids = questions.map((q) => q.id);
  const uniqueIds = new Set(ids);
  if (ids.length !== uniqueIds.size) {
    throw new Error("Briefing 问题 ID 必须唯一");
  }

  // 检查必填问题的选项
  questions.forEach((q) => {
    if (q.type === "single_choice" || q.type === "multi_choice") {
      if (!q.options || q.options.length === 0) {
        throw new Error(`问题 "${q.id}" 是选择题类型但没有定义选项`);
      }
    }

    if (q.type === "scale" && !q.scaleConfig) {
      throw new Error(`问题 "${q.id}" 是刻度类型但没有定义 scaleConfig`);
    }
  });
}

// ============================================================
// 常用问题组合
// ============================================================

/**
 * 技术博客常用问题组合
 */
export const TECH_BLOG_QUESTIONS: BriefingQuestion[] = [
  AUDIENCE_QUESTIONS.technicalLevel,
  OBJECTIVE_QUESTIONS.contentGoal,
  TONE_QUESTIONS.writingStyle,
];

/**
 * 教程内容常用问题组合
 */
export const TUTORIAL_QUESTIONS: BriefingQuestion[] = [
  AUDIENCE_QUESTIONS.technicalLevel,
  CONSTRAINT_QUESTIONS.lengthPreference,
  CONTEXT_QUESTIONS.publishPlatform,
];

/**
 * 商业文档常用问题组合
 */
export const BUSINESS_DOC_QUESTIONS: BriefingQuestion[] = [
  AUDIENCE_QUESTIONS.readerRole,
  OBJECTIVE_QUESTIONS.contentGoal,
  TONE_QUESTIONS.writingStyle,
];
