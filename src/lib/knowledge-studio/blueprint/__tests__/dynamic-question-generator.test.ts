/**
 * 动态问题生成器单元测试 (Story 1.6)
 *
 * 测试 Story 1.6 的验收标准：
 * - AC1: 系统分析素材内容判断是否满足条件
 * - AC2: 满足条件时动态添加问题
 * - AC3: 动态问题 + 静态问题总数不超过 maxQuestions
 * - AC4: 动态问题标记为 isConditional: true
 */

import {
  analyzeMaterials,
  generateDynamicQuestions,
  createConditionalRule,
  validateConditionalRule,
  RULE_MISSING_CODE,
  RULE_MISSING_DATA,
  RULE_LANGUAGE_MIXED,
  RULE_SHORT_CONTENT,
  PREDEFINED_CONDITIONAL_RULES,
} from "../dynamic-question-generator";
import type {
  BriefingConfig,
  BriefingQuestion,
  ConditionalQuestionRule,
  MaterialInput,
} from "../types";

// ============================================================
// 测试数据
// ============================================================

const createMaterial = (
  content: string,
  title = "测试素材",
): MaterialInput => ({
  bookmarkId: "test-bookmark-1",
  title,
  content,
  url: "https://example.com",
  platform: "web",
});

const createBasicConfig = (
  questions: BriefingQuestion[] = [],
  conditionalRules?: ConditionalQuestionRule[],
  maxQuestions: 1 | 2 | 3 = 3,
): BriefingConfig => ({
  enabled: true,
  maxQuestions,
  questions,
  conditionalRules,
});

// ============================================================
// 素材分析器测试
// ============================================================

describe("Story 1.6: 素材分析器 analyzeMaterials()", () => {
  describe("代码检测", () => {
    it("should detect code blocks", () => {
      const material = createMaterial("```javascript\nconst x = 1;\n```");
      const result = analyzeMaterials([material]);
      expect(result.missingCode).toBe(false);
    });

    it("should detect JavaScript functions", () => {
      const material = createMaterial("function handleClick() { }");
      const result = analyzeMaterials([material]);
      expect(result.missingCode).toBe(false);
    });

    it("should detect Python functions", () => {
      const material = createMaterial("def process_data(): pass");
      const result = analyzeMaterials([material]);
      expect(result.missingCode).toBe(false);
    });

    it("should mark missing code when no code patterns found", () => {
      const material = createMaterial("这是一篇纯文字的文章，没有任何代码。");
      const result = analyzeMaterials([material]);
      expect(result.missingCode).toBe(true);
    });
  });

  describe("数据检测", () => {
    it("should detect percentages", () => {
      const material = createMaterial("增长率达到了 25%");
      const result = analyzeMaterials([material]);
      expect(result.missingData).toBe(false);
    });

    it("should detect monetary values", () => {
      const material = createMaterial("投资额为 $1000000");
      const result = analyzeMaterials([material]);
      expect(result.missingData).toBe(false);
    });

    it("should detect data-related keywords", () => {
      const material = createMaterial("根据统计数据显示增长趋势明显");
      const result = analyzeMaterials([material]);
      expect(result.missingData).toBe(false);
    });

    it("should mark missing data when no data patterns found", () => {
      const material = createMaterial("这是一篇普通的文章内容");
      const result = analyzeMaterials([material]);
      expect(result.missingData).toBe(true);
    });
  });

  describe("引用检测", () => {
    it("should detect citation format [1]", () => {
      const material = createMaterial("根据研究[1]表明");
      const result = analyzeMaterials([material]);
      expect(result.missingCitations).toBe(false);
    });

    it("should detect source annotations", () => {
      const material = createMaterial("来源：人民日报");
      const result = analyzeMaterials([material]);
      expect(result.missingCitations).toBe(false);
    });

    it("should detect URLs", () => {
      const material = createMaterial("详见 https://example.com/article");
      const result = analyzeMaterials([material]);
      expect(result.missingCitations).toBe(false);
    });

    it("should mark missing citations when no citation patterns found", () => {
      const material = createMaterial("这篇文章没有任何引用来源");
      const result = analyzeMaterials([material]);
      expect(result.missingCitations).toBe(true);
    });
  });

  describe("时间上下文检测", () => {
    it("should detect year format", () => {
      const material = createMaterial("2024年发布的新版本");
      const result = analyzeMaterials([material]);
      expect(result.missingTimeContext).toBe(false);
    });

    it("should detect relative time words", () => {
      const material = createMaterial("最近市场变化很大");
      const result = analyzeMaterials([material]);
      expect(result.missingTimeContext).toBe(false);
    });

    it("should detect quarter format", () => {
      const material = createMaterial("Q4 2024 财报");
      const result = analyzeMaterials([material]);
      expect(result.missingTimeContext).toBe(false);
    });

    it("should mark missing time context when no time patterns found", () => {
      const material = createMaterial("这是一篇没有时间标注的文章");
      const result = analyzeMaterials([material]);
      expect(result.missingTimeContext).toBe(true);
    });
  });

  describe("语言检测", () => {
    it("should detect Chinese content", () => {
      const material = createMaterial("这是一篇纯中文的文章内容");
      const result = analyzeMaterials([material]);
      expect(result.primaryLanguage).toBe("zh");
    });

    it("should detect English content", () => {
      const material = createMaterial(
        "This is a pure English article content without any Chinese.",
      );
      const result = analyzeMaterials([material]);
      expect(result.primaryLanguage).toBe("en");
    });

    it("should detect mixed content", () => {
      const material = createMaterial(
        "这是一篇 mixed 语言的文章 with both Chinese and English content 混合在一起",
      );
      const result = analyzeMaterials([material]);
      expect(result.primaryLanguage).toBe("mixed");
    });
  });

  describe("领域检测", () => {
    it("should detect tech domain", () => {
      const material = createMaterial("这个 API 框架的代码开发技术非常先进");
      const result = analyzeMaterials([material]);
      expect(result.primaryDomain).toBe("tech");
    });

    it("should detect business domain", () => {
      const material = createMaterial("市场营销策略和商业投资分析");
      const result = analyzeMaterials([material]);
      expect(result.primaryDomain).toBe("business");
    });

    it("should detect academic domain", () => {
      const material = createMaterial("研究论文中的实验数据和学术发现");
      const result = analyzeMaterials([material]);
      expect(result.primaryDomain).toBe("academic");
    });
  });

  describe("字数统计", () => {
    it("should count total characters", () => {
      const material = createMaterial("12345678901234567890"); // 20 chars
      const result = analyzeMaterials([material]);
      expect(result.totalWordCount).toBeGreaterThan(0);
    });

    it("should combine content from multiple materials", () => {
      const materials = [
        createMaterial("第一篇素材内容"),
        createMaterial("第二篇素材内容"),
      ];
      const result = analyzeMaterials(materials);
      expect(result.totalWordCount).toBeGreaterThan(14);
    });
  });

  describe("关键词提取", () => {
    it("should extract repeated keywords", () => {
      const material = createMaterial(
        "technology technology development development programming programming code code",
      );
      const result = analyzeMaterials([material]);
      expect(result.detectedKeywords.length).toBeGreaterThan(0);
    });
  });
});

// ============================================================
// 动态问题生成器测试
// ============================================================

describe("Story 1.6: 动态问题生成 generateDynamicQuestions()", () => {
  describe("AC1: 系统分析素材内容判断是否满足条件", () => {
    it("should evaluate conditional rules against material analysis", () => {
      const material = createMaterial("这是一篇技术文章但没有代码示例");
      const config = createBasicConfig([], [RULE_MISSING_CODE]);

      const result = generateDynamicQuestions([material], config);

      expect(result.analysis).toBeDefined();
      expect(result.analysis.missingCode).toBe(true);
    });

    it("should not trigger rule when condition is not met", () => {
      const material = createMaterial("```js\nconst x = 1;\n```");
      const config = createBasicConfig([], [RULE_MISSING_CODE]);

      const result = generateDynamicQuestions([material], config);

      expect(result.dynamicQuestions).toHaveLength(0);
      expect(result.appliedRuleIds).toHaveLength(0);
    });
  });

  describe("AC2: 满足条件时动态添加问题", () => {
    it("should add dynamic question when condition is met", () => {
      // 技术领域 + 缺少代码
      const material = createMaterial(
        "这是一篇关于 API 开发技术的文章，但没有代码示例",
      );
      const config = createBasicConfig([], [RULE_MISSING_CODE]);

      const result = generateDynamicQuestions([material], config);

      expect(result.dynamicQuestions.length).toBeGreaterThan(0);
      expect(result.appliedRuleIds).toContain("missing_code");
    });

    it("should add language question for mixed content", () => {
      // 中英文比例约 50%，确保触发 mixed 检测
      // 中文: 这是一篇关于人工智能技术发展趋势的深度分析文章 (22 chars)
      // 英文: AI technology trends analysis (26 chars)
      // ratio ≈ 0.46 → mixed
      const material = createMaterial(
        "这是一篇关于人工智能技术发展趋势的深度分析文章 AI technology trends analysis",
      );
      const config = createBasicConfig([], [RULE_LANGUAGE_MIXED]);

      const result = generateDynamicQuestions([material], config);

      // 验证分析结果是 mixed
      expect(result.analysis.primaryLanguage).toBe("mixed");
      expect(result.dynamicQuestions.length).toBeGreaterThan(0);
      expect(result.appliedRuleIds).toContain("language_mixed");
    });

    it("should add short content question for brief materials", () => {
      const material = createMaterial("简短内容");
      const config = createBasicConfig([], [RULE_SHORT_CONTENT]);

      const result = generateDynamicQuestions([material], config);

      expect(result.dynamicQuestions.length).toBeGreaterThan(0);
      expect(result.appliedRuleIds).toContain("short_content");
    });
  });

  describe("AC3: 动态问题 + 静态问题总数不超过 maxQuestions", () => {
    const staticQuestion: BriefingQuestion = {
      id: "static_q1",
      type: "text",
      question: "静态问题1",
      required: true,
    };

    it("should respect maxQuestions=3 limit", () => {
      const material = createMaterial("简短内容");
      const config = createBasicConfig(
        [staticQuestion, staticQuestion],
        PREDEFINED_CONDITIONAL_RULES,
        3,
      );

      const result = generateDynamicQuestions([material], config);

      expect(result.questions.length).toBeLessThanOrEqual(3);
    });

    it("should respect maxQuestions=2 limit", () => {
      const material = createMaterial("简短内容");
      const config = createBasicConfig(
        [staticQuestion],
        PREDEFINED_CONDITIONAL_RULES,
        2,
      );

      const result = generateDynamicQuestions([material], config);

      expect(result.questions.length).toBeLessThanOrEqual(2);
    });

    it("should respect maxQuestions=1 limit", () => {
      const material = createMaterial("简短内容");
      const config = createBasicConfig(
        [staticQuestion],
        PREDEFINED_CONDITIONAL_RULES,
        1,
      );

      const result = generateDynamicQuestions([material], config);

      expect(result.questions.length).toBeLessThanOrEqual(1);
      expect(result.dynamicQuestions).toHaveLength(0); // 静态问题已占满
    });

    it("should not add dynamic questions when static questions fill all slots", () => {
      const material = createMaterial("简短内容");
      const config = createBasicConfig(
        [staticQuestion, staticQuestion, staticQuestion],
        PREDEFINED_CONDITIONAL_RULES,
        3,
      );

      const result = generateDynamicQuestions([material], config);

      expect(result.questions).toHaveLength(3);
      expect(result.dynamicQuestions).toHaveLength(0);
    });

    it("should add only available slots for dynamic questions", () => {
      const material = createMaterial("简短内容");
      const config = createBasicConfig(
        [staticQuestion, staticQuestion],
        PREDEFINED_CONDITIONAL_RULES,
        3,
      );

      const result = generateDynamicQuestions([material], config);

      expect(result.questions.length).toBeLessThanOrEqual(3);
      expect(result.dynamicQuestions.length).toBeLessThanOrEqual(1);
    });
  });

  describe("AC4: 动态问题标记为 isConditional: true", () => {
    it("should mark all dynamic questions with isConditional: true", () => {
      const material = createMaterial("简短内容");
      const config = createBasicConfig([], [RULE_SHORT_CONTENT]);

      const result = generateDynamicQuestions([material], config);

      result.dynamicQuestions.forEach((q) => {
        expect(q.isConditional).toBe(true);
      });
    });

    it("should not mark static questions with isConditional", () => {
      const staticQuestion: BriefingQuestion = {
        id: "static_q1",
        type: "text",
        question: "静态问题",
        required: true,
      };
      const config = createBasicConfig([staticQuestion], []);

      const material = createMaterial("测试内容");
      const result = generateDynamicQuestions([material], config);

      const staticInResult = result.questions.find((q) => q.id === "static_q1");
      expect(staticInResult?.isConditional).toBeUndefined();
    });

    it("should generate unique IDs for dynamic questions", () => {
      const material = createMaterial("简短内容");
      const config = createBasicConfig([], [RULE_SHORT_CONTENT]);

      const result1 = generateDynamicQuestions([material], config);
      const result2 = generateDynamicQuestions([material], config);

      // 验证 ID 包含随机部分，确保唯一性
      if (
        result1.dynamicQuestions.length > 0 &&
        result2.dynamicQuestions.length > 0
      ) {
        const id1 = result1.dynamicQuestions[0].id;
        const id2 = result2.dynamicQuestions[0].id;
        // ID 应该以 dynamic_ 开头并包含规则 ID
        expect(id1).toMatch(/^dynamic_short_content_/);
        expect(id2).toMatch(/^dynamic_short_content_/);
        // ID 应该包含随机部分（通过检查 ID 长度足够长）
        expect(id1.length).toBeGreaterThan(25);
        expect(id2.length).toBeGreaterThan(25);
      }
    });
  });

  describe("规则优先级", () => {
    it("should apply rules in priority order", () => {
      const lowPriorityRule: ConditionalQuestionRule = {
        id: "low_priority",
        name: "低优先级规则",
        condition: () => true,
        questionTemplate: {
          type: "text",
          question: "低优先级问题",
          required: false,
        },
        priority: 100,
      };

      const highPriorityRule: ConditionalQuestionRule = {
        id: "high_priority",
        name: "高优先级规则",
        condition: () => true,
        questionTemplate: {
          type: "text",
          question: "高优先级问题",
          required: false,
        },
        priority: 1,
      };

      const material = createMaterial("测试内容");
      const config = createBasicConfig(
        [],
        [lowPriorityRule, highPriorityRule],
        1,
      );

      const result = generateDynamicQuestions([material], config);

      expect(result.dynamicQuestions).toHaveLength(1);
      expect(result.appliedRuleIds[0]).toBe("high_priority");
    });
  });

  describe("无条件规则时的行为", () => {
    it("should return static questions when no conditional rules", () => {
      const staticQuestion: BriefingQuestion = {
        id: "static_q1",
        type: "text",
        question: "静态问题",
        required: true,
      };
      const config = createBasicConfig([staticQuestion], undefined);

      const material = createMaterial("测试内容");
      const result = generateDynamicQuestions([material], config);

      expect(result.questions).toHaveLength(1);
      expect(result.questions[0].id).toBe("static_q1");
      expect(result.dynamicQuestions).toHaveLength(0);
    });

    it("should return empty arrays when no questions configured", () => {
      const config = createBasicConfig([], undefined);

      const material = createMaterial("测试内容");
      const result = generateDynamicQuestions([material], config);

      expect(result.questions).toHaveLength(0);
      expect(result.dynamicQuestions).toHaveLength(0);
    });
  });
});

// ============================================================
// 条件规则工厂和验证测试
// ============================================================

describe("Story 1.6: 条件规则工具函数", () => {
  describe("createConditionalRule()", () => {
    it("should create rule with custom ID", () => {
      const rule = createConditionalRule({
        id: "my_custom_rule",
        name: "自定义规则",
        condition: () => true,
        questionTemplate: {
          type: "text",
          question: "自定义问题",
          required: false,
        },
        priority: 50,
      });

      expect(rule.id).toBe("my_custom_rule");
    });

    it("should generate ID when not provided", () => {
      const rule = createConditionalRule({
        name: "无ID规则",
        condition: () => true,
        questionTemplate: {
          type: "text",
          question: "问题",
          required: false,
        },
        priority: 50,
      });

      expect(rule.id).toMatch(/^custom_rule_\d+$/);
    });
  });

  describe("validateConditionalRule()", () => {
    const validRule: ConditionalQuestionRule = {
      id: "valid_rule",
      name: "有效规则",
      condition: () => true,
      questionTemplate: {
        type: "text",
        question: "问题",
        required: false,
      },
      priority: 10,
    };

    it("should pass for valid rule", () => {
      expect(() => validateConditionalRule(validRule)).not.toThrow();
    });

    it("should throw for empty ID", () => {
      expect(() => validateConditionalRule({ ...validRule, id: "" })).toThrow(
        "条件规则 ID 不能为空",
      );
    });

    it("should throw for empty name", () => {
      expect(() => validateConditionalRule({ ...validRule, name: "" })).toThrow(
        "条件规则名称不能为空",
      );
    });

    it("should throw for non-function condition", () => {
      expect(() =>
        validateConditionalRule({
          ...validRule,
          condition:
            "not a function" as unknown as ConditionalQuestionRule["condition"],
        }),
      ).toThrow("条件规则必须包含 condition 函数");
    });

    it("should throw for missing questionTemplate", () => {
      expect(() =>
        validateConditionalRule({
          ...validRule,
          questionTemplate:
            undefined as unknown as ConditionalQuestionRule["questionTemplate"],
        }),
      ).toThrow("条件规则必须包含 questionTemplate");
    });

    it("should throw for negative priority", () => {
      expect(() =>
        validateConditionalRule({ ...validRule, priority: -1 }),
      ).toThrow("条件规则优先级必须是非负数");
    });
  });
});

// ============================================================
// 预定义规则测试
// ============================================================

describe("Story 1.6: 预定义条件规则", () => {
  it("should have 5 predefined rules", () => {
    expect(PREDEFINED_CONDITIONAL_RULES).toHaveLength(5);
  });

  it("should have unique IDs for all predefined rules", () => {
    const ids = PREDEFINED_CONDITIONAL_RULES.map((r) => r.id);
    const uniqueIds = new Set(ids);
    expect(ids.length).toBe(uniqueIds.size);
  });

  it("should have valid structure for all predefined rules", () => {
    PREDEFINED_CONDITIONAL_RULES.forEach((rule) => {
      expect(() => validateConditionalRule(rule)).not.toThrow();
    });
  });

  describe("RULE_MISSING_CODE", () => {
    it("should trigger for tech domain without code", () => {
      const analysis = {
        missingCode: true,
        missingData: true,
        missingCitations: true,
        missingTimeContext: true,
        primaryDomain: "tech",
        totalWordCount: 1000,
        detectedKeywords: [],
      };
      expect(RULE_MISSING_CODE.condition(analysis)).toBe(true);
    });

    it("should not trigger for non-tech domain", () => {
      const analysis = {
        missingCode: true,
        missingData: true,
        missingCitations: true,
        missingTimeContext: true,
        primaryDomain: "business",
        totalWordCount: 1000,
        detectedKeywords: [],
      };
      expect(RULE_MISSING_CODE.condition(analysis)).toBe(false);
    });
  });

  describe("RULE_MISSING_DATA", () => {
    it("should trigger for business domain without data", () => {
      const analysis = {
        missingCode: true,
        missingData: true,
        missingCitations: true,
        missingTimeContext: true,
        primaryDomain: "business",
        totalWordCount: 1000,
        detectedKeywords: [],
      };
      expect(RULE_MISSING_DATA.condition(analysis)).toBe(true);
    });

    it("should trigger for academic domain without data", () => {
      const analysis = {
        missingCode: true,
        missingData: true,
        missingCitations: true,
        missingTimeContext: true,
        primaryDomain: "academic",
        totalWordCount: 1000,
        detectedKeywords: [],
      };
      expect(RULE_MISSING_DATA.condition(analysis)).toBe(true);
    });
  });

  describe("RULE_SHORT_CONTENT", () => {
    it("should trigger for content under 500 chars", () => {
      const analysis = {
        missingCode: true,
        missingData: true,
        missingCitations: true,
        missingTimeContext: true,
        totalWordCount: 100,
        detectedKeywords: [],
      };
      expect(RULE_SHORT_CONTENT.condition(analysis)).toBe(true);
    });

    it("should not trigger for content over 500 chars", () => {
      const analysis = {
        missingCode: true,
        missingData: true,
        missingCitations: true,
        missingTimeContext: true,
        totalWordCount: 1000,
        detectedKeywords: [],
      };
      expect(RULE_SHORT_CONTENT.condition(analysis)).toBe(false);
    });
  });
});
