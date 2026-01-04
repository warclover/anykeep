/**
 * 动态问题生成器 (Story 1.6)
 * @module knowledge-studio/blueprint
 *
 * 根据素材内容分析，动态生成 Briefing 问题。
 * 实现 AC：
 * - 分析素材内容判断是否满足条件
 * - 满足条件时动态添加问题
 * - 动态问题 + 静态问题总数不超过 maxQuestions
 * - 动态问题标记为 isConditional: true
 */

import type {
  BriefingQuestion,
  BriefingConfig,
  ConditionalQuestionRule,
  MaterialAnalysisResult,
  MaterialInput,
} from "./types";

// ============================================================
// 素材分析器
// ============================================================

/**
 * 分析素材内容，提取关键信息
 *
 * @param materials - 素材列表
 * @returns 素材分析结果
 */
export function analyzeMaterials(
  materials: MaterialInput[],
): MaterialAnalysisResult {
  const allContent = materials.map((m) => m.content).join(" ");
  const allTitles = materials.map((m) => m.title).join(" ");
  const combined = `${allTitles} ${allContent}`;

  // 代码检测（支持多种编程语言模式）
  const codePatterns = [
    /```[\s\S]*?```/g, // Markdown 代码块
    /function\s+\w+\s*\(/g, // JavaScript 函数
    /def\s+\w+\s*\(/g, // Python 函数
    /class\s+\w+/g, // 类定义
    /import\s+{?\s*\w+/g, // 导入语句
    /const\s+\w+\s*=/g, // 常量定义
    /=>\s*{/g, // 箭头函数
  ];
  const hasCode = codePatterns.some((pattern) => pattern.test(combined));

  // 数据检测（数字、百分比、统计）
  const dataPatterns = [
    /\d+%/g, // 百分比
    /\d+\.\d+/g, // 小数
    /\$\d+/g, // 金额
    /\d{4}年/g, // 年份
    /数据|统计|增长|下降|比例/g, // 数据相关词汇
  ];
  const hasData = dataPatterns.some((pattern) => pattern.test(combined));

  // 引用检测
  const citationPatterns = [
    /\[\d+\]/g, // [1] 格式引用
    /来源[：:]/g, // 来源标注
    /引用[：:]/g, // 引用标注
    /参考文献/g, // 参考文献
    /https?:\/\/[^\s]+/g, // URL
  ];
  const hasCitations = citationPatterns.some((pattern) =>
    pattern.test(combined),
  );

  // 时间上下文检测
  const timePatterns = [
    /\d{4}年/g, // 年份
    /\d{1,2}月/g, // 月份
    /今年|去年|明年/g, // 相对时间
    /最近|近期|目前/g, // 时效性词汇
    /Q[1-4]\s*\d{4}/g, // 季度
  ];
  const hasTimeContext = timePatterns.some((pattern) => pattern.test(combined));

  // 语言检测
  const chineseChars = (combined.match(/[\u4e00-\u9fa5]/g) || []).length;
  const englishChars = (combined.match(/[a-zA-Z]/g) || []).length;
  let primaryLanguage: "zh" | "en" | "mixed" | undefined;
  if (chineseChars > 0 && englishChars > 0) {
    const ratio = chineseChars / (chineseChars + englishChars);
    primaryLanguage = ratio > 0.7 ? "zh" : ratio < 0.3 ? "en" : "mixed";
  } else if (chineseChars > 0) {
    primaryLanguage = "zh";
  } else if (englishChars > 0) {
    primaryLanguage = "en";
  }

  // 领域检测（基于关键词）
  const domainKeywords: Record<string, string[]> = {
    tech: [
      "代码",
      "编程",
      "API",
      "框架",
      "开发",
      "技术",
      "software",
      "code",
      "programming",
    ],
    business: [
      "商业",
      "市场",
      "营销",
      "投资",
      "创业",
      "融资",
      "business",
      "market",
    ],
    academic: [
      "研究",
      "论文",
      "学术",
      "实验",
      "研究",
      "research",
      "paper",
      "study",
    ],
    design: ["设计", "UI", "UX", "交互", "视觉", "design", "interface"],
    product: ["产品", "需求", "用户", "功能", "迭代", "product", "feature"],
  };

  let primaryDomain: string | undefined;
  let maxCount = 0;
  for (const [domain, keywords] of Object.entries(domainKeywords)) {
    const count = keywords.filter((kw) =>
      combined.toLowerCase().includes(kw.toLowerCase()),
    ).length;
    if (count > maxCount) {
      maxCount = count;
      primaryDomain = domain;
    }
  }

  // 字数统计
  const totalWordCount = combined.length;

  // 关键词提取（简单实现：提取高频词）
  const words = combined
    .replace(/[^\u4e00-\u9fa5a-zA-Z\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);
  const wordFreq: Record<string, number> = {};
  words.forEach((w) => {
    const lower = w.toLowerCase();
    wordFreq[lower] = (wordFreq[lower] || 0) + 1;
  });
  const detectedKeywords = Object.entries(wordFreq)
    .filter(([, count]) => count >= 2)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([word]) => word);

  return {
    missingCode: !hasCode,
    missingData: !hasData,
    missingCitations: !hasCitations,
    missingTimeContext: !hasTimeContext,
    primaryLanguage,
    primaryDomain,
    totalWordCount,
    detectedKeywords,
  };
}

// ============================================================
// 动态问题生成器
// ============================================================

/**
 * 动态问题生成结果
 */
export interface DynamicQuestionResult {
  /** 最终问题列表（静态 + 动态，已排序） */
  questions: BriefingQuestion[];
  /** 动态生成的问题（子集） */
  dynamicQuestions: BriefingQuestion[];
  /** 素材分析结果 */
  analysis: MaterialAnalysisResult;
  /** 应用的规则ID列表 */
  appliedRuleIds: string[];
}

/**
 * 生成动态问题
 *
 * 根据素材分析结果和条件规则，生成动态 Briefing 问题。
 * 确保总问题数不超过 maxQuestions。
 *
 * @param materials - 素材列表
 * @param config - Briefing 配置
 * @returns 动态问题生成结果
 */
export function generateDynamicQuestions(
  materials: MaterialInput[],
  config: BriefingConfig,
): DynamicQuestionResult {
  const analysis = analyzeMaterials(materials);
  const staticQuestions = [...config.questions];
  const dynamicQuestions: BriefingQuestion[] = [];
  const appliedRuleIds: string[] = [];

  // 如果没有条件规则，直接返回静态问题
  if (!config.conditionalRules || config.conditionalRules.length === 0) {
    return {
      questions: staticQuestions,
      dynamicQuestions: [],
      analysis,
      appliedRuleIds: [],
    };
  }

  // 计算可添加的动态问题数量
  const availableSlots = config.maxQuestions - staticQuestions.length;

  if (availableSlots <= 0) {
    // 静态问题已达上限，不添加动态问题
    return {
      questions: staticQuestions,
      dynamicQuestions: [],
      analysis,
      appliedRuleIds: [],
    };
  }

  // 按优先级排序规则
  const sortedRules = [...config.conditionalRules].sort(
    (a, b) => a.priority - b.priority,
  );

  // 使用递增计数器确保 ID 唯一
  let idCounter = 0;

  // 评估每个规则
  for (const rule of sortedRules) {
    // 检查是否还有空位
    if (dynamicQuestions.length >= availableSlots) {
      break;
    }

    // 评估条件
    if (rule.condition(analysis)) {
      // 生成动态问题（使用组合策略确保唯一性）
      const uniqueId = `dynamic_${rule.id}_${Date.now()}_${idCounter++}_${Math.random().toString(36).slice(2, 8)}`;
      const dynamicQuestion: BriefingQuestion = {
        ...rule.questionTemplate,
        id: uniqueId,
        isConditional: true,
      };

      dynamicQuestions.push(dynamicQuestion);
      appliedRuleIds.push(rule.id);
    }
  }

  // 合并静态和动态问题
  const allQuestions = [...staticQuestions, ...dynamicQuestions];

  return {
    questions: allQuestions,
    dynamicQuestions,
    analysis,
    appliedRuleIds,
  };
}

// ============================================================
// 预定义条件规则
// ============================================================

/**
 * 素材缺少代码时的补充问题
 */
export const RULE_MISSING_CODE: ConditionalQuestionRule = {
  id: "missing_code",
  name: "缺少代码示例",
  condition: (analysis) =>
    analysis.missingCode && analysis.primaryDomain === "tech",
  questionTemplate: {
    type: "single_choice",
    category: "context",
    question: "素材中没有代码示例，需要我补充代码演示吗？",
    options: [
      { value: "yes", label: "是，请补充代码示例" },
      { value: "no", label: "否，保持纯文字" },
      { value: "pseudo", label: "用伪代码说明即可" },
    ],
    required: false,
  },
  priority: 10,
};

/**
 * 素材缺少数据时的补充问题
 */
export const RULE_MISSING_DATA: ConditionalQuestionRule = {
  id: "missing_data",
  name: "缺少数据支撑",
  condition: (analysis) =>
    analysis.missingData &&
    (analysis.primaryDomain === "business" ||
      analysis.primaryDomain === "academic"),
  questionTemplate: {
    type: "single_choice",
    category: "constraint",
    question: "素材中缺少具体数据，希望如何处理？",
    options: [
      { value: "placeholder", label: "标注[需补充数据]占位" },
      { value: "estimate", label: "基于内容做合理估算" },
      { value: "skip", label: "不需要数据支撑" },
    ],
    required: false,
  },
  priority: 20,
};

/**
 * 素材缺少时间上下文时的补充问题
 */
export const RULE_MISSING_TIME_CONTEXT: ConditionalQuestionRule = {
  id: "missing_time",
  name: "缺少时间上下文",
  condition: (analysis) =>
    analysis.missingTimeContext && analysis.totalWordCount > 1000,
  questionTemplate: {
    type: "text",
    category: "context",
    question: "素材未标注时间，请补充时效信息（如：2024年Q4）",
    placeholder: "如：2024年Q4、最新研究、历史回顾等",
    required: false,
  },
  priority: 30,
};

/**
 * 中英文混合素材的语言选择
 */
export const RULE_LANGUAGE_MIXED: ConditionalQuestionRule = {
  id: "language_mixed",
  name: "语言混合",
  condition: (analysis) => analysis.primaryLanguage === "mixed",
  questionTemplate: {
    type: "single_choice",
    category: "constraint",
    question: "素材包含中英文混合内容，期望的输出语言是？",
    options: [
      { value: "zh", label: "全中文输出" },
      { value: "en", label: "全英文输出" },
      { value: "mixed", label: "保持中英混合" },
    ],
    required: true,
    defaultValue: "zh",
  },
  priority: 5,
};

/**
 * 素材内容较短时的扩展问题
 */
export const RULE_SHORT_CONTENT: ConditionalQuestionRule = {
  id: "short_content",
  name: "内容较短",
  condition: (analysis) => analysis.totalWordCount < 500,
  questionTemplate: {
    type: "single_choice",
    category: "objective",
    question: "素材内容较短，需要扩展生成吗？",
    options: [
      { value: "expand", label: "是，请扩展补充" },
      { value: "concise", label: "否，保持简洁" },
    ],
    required: false,
    defaultValue: "concise",
  },
  priority: 40,
};

/**
 * 所有预定义规则
 */
export const PREDEFINED_CONDITIONAL_RULES: ConditionalQuestionRule[] = [
  RULE_LANGUAGE_MIXED,
  RULE_MISSING_CODE,
  RULE_MISSING_DATA,
  RULE_MISSING_TIME_CONTEXT,
  RULE_SHORT_CONTENT,
];

/**
 * 创建自定义条件规则
 */
export function createConditionalRule(
  config: Omit<ConditionalQuestionRule, "id"> & { id?: string },
): ConditionalQuestionRule {
  return {
    ...config,
    id: config.id ?? `custom_rule_${Date.now()}`,
  };
}

/**
 * 验证条件规则
 */
export function validateConditionalRule(rule: ConditionalQuestionRule): void {
  if (!rule.id || rule.id.trim().length === 0) {
    throw new Error("条件规则 ID 不能为空");
  }

  if (!rule.name || rule.name.trim().length === 0) {
    throw new Error("条件规则名称不能为空");
  }

  if (typeof rule.condition !== "function") {
    throw new Error("条件规则必须包含 condition 函数");
  }

  if (!rule.questionTemplate) {
    throw new Error("条件规则必须包含 questionTemplate");
  }

  if (typeof rule.priority !== "number" || rule.priority < 0) {
    throw new Error("条件规则优先级必须是非负数");
  }
}
