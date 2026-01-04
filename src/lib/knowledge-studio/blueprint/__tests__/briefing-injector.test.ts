/**
 * Briefing 响应注入器单元测试 (Story 1.8 + 1.9)
 *
 * 测试 Story 1.8 的验收标准：
 * - AC1: 将 Briefing 响应格式化为结构化上下文
 * - AC2: 注入到 Prompt 的专用区域（<user_preferences> 标签内）
 * - AC3: 保存 Briefing 响应到 synthesis_reports.briefing_responses 字段
 * - AC4: Briefing 响应使用 JSON 格式存储
 *
 * 测试 Story 1.9 的验收标准：
 * - AC1: 使用默认/空值作为 Briefing 响应
 * - AC2: 直接进入生成流程
 * - AC3: 记录 generation_mode = 'quick' 到数据库
 * - AC4: 正常模式记录 generation_mode = 'guided'
 */

import {
  formatBriefingResponse,
  injectBriefingToPrompt,
  isBriefingContextEmpty,
  createEmptyBriefingContext,
  restoreBriefingContext,
  createQuickModeContext,
  createQuickModeStorageFormat,
  isQuickModeStorage,
  determineGenerationMode,
  createGenerationModeMetadata,
} from "../briefing-injector";
import type { BriefingContext, BriefingQuestion } from "../types";

// ============================================================
// 测试数据
// ============================================================

const sampleQuestions: BriefingQuestion[] = [
  {
    id: "q_audience",
    type: "single_choice",
    category: "audience",
    question: "目标读者的技术水平是？",
    options: [
      { value: "beginner", label: "初学者" },
      { value: "intermediate", label: "中级" },
      { value: "advanced", label: "高级" },
    ],
    required: true,
  },
  {
    id: "q_objective",
    type: "single_choice",
    category: "objective",
    question: "这份内容的主要目标是？",
    options: [
      { value: "educate", label: "教育/科普" },
      { value: "convince", label: "说服/论证" },
    ],
    required: true,
  },
  {
    id: "q_tone",
    type: "scale",
    category: "tone",
    question: "内容的幽默程度？",
    scaleConfig: {
      min: 1,
      max: 5,
      step: 1,
      labels: { 1: "严肃", 3: "适度", 5: "幽默" },
    },
    required: false,
  },
  {
    id: "q_constraint",
    type: "text",
    category: "constraint",
    question: "必须包含的内容或关键词？",
    required: false,
  },
  {
    id: "q_multi",
    type: "multi_choice",
    category: "context",
    question: "选择发布平台？",
    options: [
      { value: "wechat", label: "微信公众号" },
      { value: "zhihu", label: "知乎" },
      { value: "juejin", label: "掘金" },
    ],
    required: false,
  },
  {
    id: "q_dynamic",
    type: "single_choice",
    category: "context",
    question: "素材缺少代码，需要补充吗？",
    options: [
      { value: "yes", label: "是" },
      { value: "no", label: "否" },
    ],
    required: false,
    isConditional: true,
  },
];

const sampleContext: BriefingContext = {
  answers: {
    q_audience: "intermediate",
    q_objective: "educate",
    q_tone: 3,
    q_constraint: "包含代码示例和性能对比",
    q_multi: ["wechat", "zhihu"],
    q_dynamic: "yes",
  },
  answeredAt: new Date("2024-01-15T10:30:00Z"),
};

// ============================================================
// formatBriefingResponse() 测试
// ============================================================

describe("Story 1.8: formatBriefingResponse()", () => {
  describe("AC1: 将 Briefing 响应格式化为结构化上下文", () => {
    it("should format single_choice answer with label", () => {
      const result = formatBriefingResponse(sampleContext, sampleQuestions);

      expect(result.promptInjection).toContain("中级");
      expect(result.promptInjection).toContain("教育/科普");
    });

    it("should format multi_choice answer with labels joined", () => {
      const result = formatBriefingResponse(sampleContext, sampleQuestions);

      expect(result.promptInjection).toContain("微信公众号、知乎");
    });

    it("should format scale answer with value and label", () => {
      const result = formatBriefingResponse(sampleContext, sampleQuestions);

      expect(result.promptInjection).toContain("3 (适度)");
    });

    it("should format text answer as-is", () => {
      const result = formatBriefingResponse(sampleContext, sampleQuestions);

      expect(result.promptInjection).toContain("包含代码示例和性能对比");
    });
  });

  describe("AC2: 注入到 Prompt 的专用区域", () => {
    it("should wrap content in <user_preferences> tags", () => {
      const result = formatBriefingResponse(sampleContext, sampleQuestions);

      expect(result.promptInjection).toMatch(/^<user_preferences>/);
      expect(result.promptInjection).toMatch(/<\/user_preferences>$/);
    });

    it("should group questions by category", () => {
      const result = formatBriefingResponse(sampleContext, sampleQuestions);

      expect(result.promptInjection).toContain("### 目标受众");
      expect(result.promptInjection).toContain("### 生成目标");
      expect(result.promptInjection).toContain("### 语气风格");
      expect(result.promptInjection).toContain("### 约束条件");
      expect(result.promptInjection).toContain("### 背景信息");
    });

    it("should include question text and answer", () => {
      const result = formatBriefingResponse(sampleContext, sampleQuestions);

      expect(result.promptInjection).toContain("目标读者的技术水平是？");
      expect(result.promptInjection).toContain("答：中级");
    });
  });

  describe("AC3 & AC4: JSON 格式存储", () => {
    it("should generate valid storage format", () => {
      const result = formatBriefingResponse(sampleContext, sampleQuestions);

      expect(result.storageFormat.version).toBe("1.0");
      expect(result.storageFormat.answeredAt).toBe("2024-01-15T10:30:00.000Z");
      expect(result.storageFormat.responses.length).toBe(6);
    });

    it("should include all response details in storage format", () => {
      const result = formatBriefingResponse(sampleContext, sampleQuestions);

      const audienceResponse = result.storageFormat.responses.find(
        (r) => r.questionId === "q_audience",
      );
      expect(audienceResponse).toBeDefined();
      expect(audienceResponse?.questionText).toBe("目标读者的技术水平是？");
      expect(audienceResponse?.category).toBe("audience");
      expect(audienceResponse?.answer).toBe("intermediate");
      expect(audienceResponse?.answerLabel).toBe("中级");
      expect(audienceResponse?.isConditional).toBe(false);
    });

    it("should mark conditional questions in storage format", () => {
      const result = formatBriefingResponse(sampleContext, sampleQuestions);

      const dynamicResponse = result.storageFormat.responses.find(
        (r) => r.questionId === "q_dynamic",
      );
      expect(dynamicResponse?.isConditional).toBe(true);
    });
  });
});

// ============================================================
// injectBriefingToPrompt() 测试
// ============================================================

describe("Story 1.8: injectBriefingToPrompt()", () => {
  const basePrompt = `你是一个专业的写作助手。

<materials>
用户提供的素材内容...
</materials>

请根据素材生成内容。`;

  it("should inject after </materials> in auto mode", () => {
    const result = injectBriefingToPrompt(
      basePrompt,
      sampleContext,
      sampleQuestions,
      "auto",
    );

    expect(result).toContain("</materials>\n\n<user_preferences>");
    expect(result).toContain("</user_preferences>");
  });

  it("should prepend when specified", () => {
    const result = injectBriefingToPrompt(
      basePrompt,
      sampleContext,
      sampleQuestions,
      "prepend",
    );

    expect(result).toMatch(/^<user_preferences>/);
  });

  it("should append when specified", () => {
    const result = injectBriefingToPrompt(
      basePrompt,
      sampleContext,
      sampleQuestions,
      "append",
    );

    expect(result).toMatch(/<\/user_preferences>$/);
  });

  it("should return original prompt when no answers", () => {
    const emptyContext: BriefingContext = {
      answers: {},
      answeredAt: new Date(),
    };

    const result = injectBriefingToPrompt(
      basePrompt,
      emptyContext,
      sampleQuestions,
    );

    expect(result).toBe(basePrompt);
  });

  it("should handle prompts without </materials> tag", () => {
    const simplePrompt = "生成一篇文章。";

    const result = injectBriefingToPrompt(
      simplePrompt,
      sampleContext,
      sampleQuestions,
      "auto",
    );

    expect(result).toContain(simplePrompt);
    expect(result).toContain("<user_preferences>");
    expect(result).toContain("</user_preferences>");
  });
});

// ============================================================
// 辅助函数测试
// ============================================================

describe("Story 1.8: 辅助函数", () => {
  describe("isBriefingContextEmpty()", () => {
    it("should return true for empty answers", () => {
      const empty = createEmptyBriefingContext();
      expect(isBriefingContextEmpty(empty)).toBe(true);
    });

    it("should return false for non-empty answers", () => {
      expect(isBriefingContextEmpty(sampleContext)).toBe(false);
    });
  });

  describe("createEmptyBriefingContext()", () => {
    it("should create context with empty answers", () => {
      const context = createEmptyBriefingContext();
      expect(context.answers).toEqual({});
      expect(context.answeredAt).toBeInstanceOf(Date);
    });
  });

  describe("restoreBriefingContext()", () => {
    it("should restore context from storage format", () => {
      const { storageFormat } = formatBriefingResponse(
        sampleContext,
        sampleQuestions,
      );

      const restored = restoreBriefingContext(storageFormat);

      expect(restored.answers).toEqual(sampleContext.answers);
      expect(restored.answeredAt.toISOString()).toBe(
        sampleContext.answeredAt.toISOString(),
      );
    });
  });
});

// ============================================================
// 边界情况测试
// ============================================================

describe("Story 1.8: 边界情况", () => {
  it("should handle questions without category", () => {
    const noCategoryQuestion: BriefingQuestion = {
      id: "no_cat",
      type: "text",
      question: "无类别问题？",
      required: false,
    };

    const context: BriefingContext = {
      answers: { no_cat: "测试答案" },
      answeredAt: new Date(),
    };

    const result = formatBriefingResponse(context, [noCategoryQuestion]);

    expect(result.promptInjection).toContain("### 其他信息");
    expect(result.promptInjection).toContain("测试答案");
  });

  it("should skip unanswered questions", () => {
    const context: BriefingContext = {
      answers: { q_audience: "beginner" },
      answeredAt: new Date(),
    };

    const result = formatBriefingResponse(context, sampleQuestions);

    // 只应包含回答了的问题
    expect(result.storageFormat.responses.length).toBe(1);
    expect(result.promptInjection).not.toContain("这份内容的主要目标是？");
  });

  it("should handle scale without labels", () => {
    const noLabelScale: BriefingQuestion = {
      id: "scale_no_label",
      type: "scale",
      question: "评分？",
      scaleConfig: { min: 1, max: 10, step: 1 },
      required: false,
    };

    const context: BriefingContext = {
      answers: { scale_no_label: 7 },
      answeredAt: new Date(),
    };

    const result = formatBriefingResponse(context, [noLabelScale]);

    expect(result.promptInjection).toContain("答：7");
    expect(result.storageFormat.responses[0].answerLabel).toBe("7");
  });

  it("should handle option not found in choices", () => {
    const context: BriefingContext = {
      answers: { q_audience: "unknown_value" },
      answeredAt: new Date(),
    };

    const result = formatBriefingResponse(context, sampleQuestions);

    // 应该回退到原始值
    expect(result.promptInjection).toContain("答：unknown_value");
  });
});

// ============================================================
// Story 1.9: 快速模式测试
// ============================================================

describe("Story 1.9: 快速模式支持", () => {
  // 带默认值的问题列表
  const questionsWithDefaults: BriefingQuestion[] = [
    {
      id: "q_audience",
      type: "single_choice",
      category: "audience",
      question: "目标读者的技术水平是？",
      options: [
        { value: "beginner", label: "初学者" },
        { value: "intermediate", label: "中级" },
        { value: "advanced", label: "高级" },
      ],
      required: true,
      defaultValue: "intermediate",
    },
    {
      id: "q_tone",
      type: "scale",
      category: "tone",
      question: "内容的幽默程度？",
      scaleConfig: {
        min: 1,
        max: 5,
        step: 1,
        labels: { 1: "严肃", 3: "适度", 5: "幽默" },
      },
      required: false,
      defaultValue: 3,
    },
    {
      id: "q_constraint",
      type: "text",
      category: "constraint",
      question: "必须包含的内容？",
      required: false,
      // 无默认值
    },
  ];

  describe("AC1: createQuickModeContext() - 使用默认值", () => {
    it("should create context with default values from questions", () => {
      const context = createQuickModeContext(questionsWithDefaults);

      expect(context.answers.q_audience).toBe("intermediate");
      expect(context.answers.q_tone).toBe(3);
      expect(context.answers.q_constraint).toBeUndefined();
    });

    it("should create empty context for questions without defaults", () => {
      const noDefaultQuestions: BriefingQuestion[] = [
        {
          id: "q_text",
          type: "text",
          question: "无默认值问题？",
          required: false,
        },
      ];

      const context = createQuickModeContext(noDefaultQuestions);

      expect(Object.keys(context.answers)).toHaveLength(0);
    });

    it("should set answeredAt to current time", () => {
      const before = new Date();
      const context = createQuickModeContext(questionsWithDefaults);
      const after = new Date();

      expect(context.answeredAt.getTime()).toBeGreaterThanOrEqual(
        before.getTime(),
      );
      expect(context.answeredAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  describe("AC2 & AC3: createQuickModeStorageFormat() - 快速模式存储", () => {
    it("should create storage format with mode='quick'", () => {
      const storage = createQuickModeStorageFormat(questionsWithDefaults);

      expect(storage.version).toBe("1.0");
      expect(storage.mode).toBe("quick");
      expect(storage.skippedAt).toBeDefined();
    });

    it("should include all question defaults in storage", () => {
      const storage = createQuickModeStorageFormat(questionsWithDefaults);

      expect(storage.defaults).toHaveLength(3);
      expect(storage.defaults[0].questionId).toBe("q_audience");
      expect(storage.defaults[0].defaultValue).toBe("intermediate");
      expect(storage.defaults[1].questionId).toBe("q_tone");
      expect(storage.defaults[1].defaultValue).toBe(3);
      expect(storage.defaults[2].questionId).toBe("q_constraint");
      expect(storage.defaults[2].defaultValue).toBeUndefined();
    });

    it("should have valid ISO timestamp", () => {
      const storage = createQuickModeStorageFormat(questionsWithDefaults);

      expect(() => new Date(storage.skippedAt)).not.toThrow();
      expect(new Date(storage.skippedAt).toISOString()).toBe(storage.skippedAt);
    });
  });

  describe("isQuickModeStorage() - 类型判断", () => {
    it("should return true for quick mode storage", () => {
      const quickStorage = createQuickModeStorageFormat(questionsWithDefaults);

      expect(isQuickModeStorage(quickStorage)).toBe(true);
    });

    it("should return false for guided mode storage", () => {
      const guidedStorage = formatBriefingResponse(
        sampleContext,
        sampleQuestions,
      ).storageFormat;

      expect(isQuickModeStorage(guidedStorage)).toBe(false);
    });
  });

  describe("AC3 & AC4: determineGenerationMode() - 模式判断", () => {
    it("should return 'quick' when briefing is disabled", () => {
      const mode = determineGenerationMode(true, false);
      expect(mode).toBe("quick");
    });

    it("should return 'quick' when no briefing context", () => {
      const mode = determineGenerationMode(false, true);
      expect(mode).toBe("quick");
    });

    it("should return 'guided' when has context and briefing enabled", () => {
      const mode = determineGenerationMode(true, true);
      expect(mode).toBe("guided");
    });

    it("should return 'quick' when both disabled and no context", () => {
      const mode = determineGenerationMode(false, false);
      expect(mode).toBe("quick");
    });
  });

  describe("createGenerationModeMetadata() - 元数据生成", () => {
    it("should create quick mode metadata with skippedAt", () => {
      const metadata = createGenerationModeMetadata(
        "quick",
        questionsWithDefaults,
      );

      expect(metadata.mode).toBe("quick");
      expect(metadata.briefingEnabled).toBe(true);
      expect(metadata.questionsCount).toBe(3);
      expect(metadata.answeredCount).toBe(0);
      expect(metadata.skippedAt).toBeDefined();
      expect(metadata.completedAt).toBeUndefined();
    });

    it("should create guided mode metadata with completedAt", () => {
      const metadata = createGenerationModeMetadata(
        "guided",
        questionsWithDefaults,
        sampleContext,
      );

      expect(metadata.mode).toBe("guided");
      expect(metadata.briefingEnabled).toBe(true);
      expect(metadata.questionsCount).toBe(3);
      expect(metadata.answeredCount).toBe(6); // sampleContext has 6 answers
      expect(metadata.completedAt).toBeDefined();
      expect(metadata.skippedAt).toBeUndefined();
    });

    it("should show briefingEnabled=false for empty questions", () => {
      const metadata = createGenerationModeMetadata("quick", []);

      expect(metadata.briefingEnabled).toBe(false);
      expect(metadata.questionsCount).toBe(0);
    });

    it("should count answered questions correctly", () => {
      const partialContext: BriefingContext = {
        answers: { q_audience: "beginner", q_tone: 2 },
        answeredAt: new Date(),
      };

      const metadata = createGenerationModeMetadata(
        "guided",
        questionsWithDefaults,
        partialContext,
      );

      expect(metadata.answeredCount).toBe(2);
    });
  });
});
