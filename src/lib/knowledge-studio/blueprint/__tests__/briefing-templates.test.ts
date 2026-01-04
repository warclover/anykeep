/**
 * Briefing 模板库单元测试 (Story 1.5)
 *
 * 测试 Story 1.5 的验收标准：
 * - AC1: 支持问题类型: audience, objective, tone, constraint, context
 * - AC2: 每个蓝图最多 3 个问题
 * - AC3: 每个问题包含: id, type, question, options (可选), required
 */

import {
  AUDIENCE_QUESTIONS,
  OBJECTIVE_QUESTIONS,
  TONE_QUESTIONS,
  CONSTRAINT_QUESTIONS,
  CONTEXT_QUESTIONS,
  getQuestionsByCategory,
  getQuestionTemplate,
  createCustomQuestion,
  validateBriefingQuestions,
  TECH_BLOG_QUESTIONS,
  TUTORIAL_QUESTIONS,
  BUSINESS_DOC_QUESTIONS,
} from "../briefing-templates";
import type { BriefingQuestion, BriefingQuestionCategory } from "../types";

describe("Story 1.5: Briefing 问题配置系统", () => {
  describe("AC1: 支持问题语义类别", () => {
    const categories: BriefingQuestionCategory[] = [
      "audience",
      "objective",
      "tone",
      "constraint",
      "context",
    ];

    it("should have predefined questions for all categories", () => {
      categories.forEach((category) => {
        const questions = getQuestionsByCategory(category);
        expect(questions.length).toBeGreaterThan(0);
      });
    });

    it("should return empty array for custom category", () => {
      const questions = getQuestionsByCategory("custom");
      expect(questions).toHaveLength(0);
    });

    it("should have audience questions with correct category", () => {
      Object.values(AUDIENCE_QUESTIONS).forEach((q) => {
        expect(q.category).toBe("audience");
      });
    });

    it("should have objective questions with correct category", () => {
      Object.values(OBJECTIVE_QUESTIONS).forEach((q) => {
        expect(q.category).toBe("objective");
      });
    });

    it("should have tone questions with correct category", () => {
      Object.values(TONE_QUESTIONS).forEach((q) => {
        expect(q.category).toBe("tone");
      });
    });

    it("should have constraint questions with correct category", () => {
      Object.values(CONSTRAINT_QUESTIONS).forEach((q) => {
        expect(q.category).toBe("constraint");
      });
    });

    it("should have context questions with correct category", () => {
      Object.values(CONTEXT_QUESTIONS).forEach((q) => {
        expect(q.category).toBe("context");
      });
    });
  });

  describe("AC2: 最多 3 个问题限制", () => {
    it("should pass validation for 1-3 questions", () => {
      const questions = [AUDIENCE_QUESTIONS.technicalLevel];
      expect(() => validateBriefingQuestions(questions, 3)).not.toThrow();

      const twoQuestions = [
        AUDIENCE_QUESTIONS.technicalLevel,
        OBJECTIVE_QUESTIONS.contentGoal,
      ];
      expect(() => validateBriefingQuestions(twoQuestions, 3)).not.toThrow();

      const threeQuestions = TECH_BLOG_QUESTIONS;
      expect(() => validateBriefingQuestions(threeQuestions, 3)).not.toThrow();
    });

    it("should fail validation for more than 3 questions", () => {
      const fourQuestions = [
        AUDIENCE_QUESTIONS.technicalLevel,
        AUDIENCE_QUESTIONS.readerRole,
        OBJECTIVE_QUESTIONS.contentGoal,
        TONE_QUESTIONS.writingStyle,
      ];

      expect(() => validateBriefingQuestions(fourQuestions, 3)).toThrow(
        "Briefing 问题数量超过限制",
      );
    });

    it("should respect custom maxQuestions limit", () => {
      const twoQuestions = [
        AUDIENCE_QUESTIONS.technicalLevel,
        OBJECTIVE_QUESTIONS.contentGoal,
      ];

      expect(() => validateBriefingQuestions(twoQuestions, 1)).toThrow(
        "Briefing 问题数量超过限制：最多 1 个，当前 2 个",
      );
    });

    it("should validate predefined question sets are within limit", () => {
      expect(TECH_BLOG_QUESTIONS.length).toBeLessThanOrEqual(3);
      expect(TUTORIAL_QUESTIONS.length).toBeLessThanOrEqual(3);
      expect(BUSINESS_DOC_QUESTIONS.length).toBeLessThanOrEqual(3);
    });
  });

  describe("AC3: 问题结构完整性", () => {
    const allQuestions: BriefingQuestion[] = [
      ...Object.values(AUDIENCE_QUESTIONS),
      ...Object.values(OBJECTIVE_QUESTIONS),
      ...Object.values(TONE_QUESTIONS),
      ...Object.values(CONSTRAINT_QUESTIONS),
      ...Object.values(CONTEXT_QUESTIONS),
    ];

    it("should have required fields: id, type, question, required", () => {
      allQuestions.forEach((q) => {
        expect(q.id).toBeDefined();
        expect(typeof q.id).toBe("string");
        expect(q.id.length).toBeGreaterThan(0);

        expect(q.type).toBeDefined();
        expect(["text", "single_choice", "multi_choice", "scale"]).toContain(
          q.type,
        );

        expect(q.question).toBeDefined();
        expect(typeof q.question).toBe("string");
        expect(q.question.length).toBeGreaterThan(0);

        expect(typeof q.required).toBe("boolean");
      });
    });

    it("should have options for single_choice and multi_choice types", () => {
      allQuestions
        .filter((q) => q.type === "single_choice" || q.type === "multi_choice")
        .forEach((q) => {
          expect(q.options).toBeDefined();
          expect(Array.isArray(q.options)).toBe(true);
          expect(q.options!.length).toBeGreaterThan(0);

          q.options!.forEach((opt) => {
            expect(opt.value).toBeDefined();
            expect(opt.label).toBeDefined();
          });
        });
    });

    it("should have scaleConfig for scale type", () => {
      allQuestions
        .filter((q) => q.type === "scale")
        .forEach((q) => {
          expect(q.scaleConfig).toBeDefined();
          expect(typeof q.scaleConfig!.min).toBe("number");
          expect(typeof q.scaleConfig!.max).toBe("number");
          expect(typeof q.scaleConfig!.step).toBe("number");
        });
    });

    it("should have unique IDs across all questions", () => {
      const ids = allQuestions.map((q) => q.id);
      const uniqueIds = new Set(ids);
      expect(ids.length).toBe(uniqueIds.size);
    });
  });

  describe("getQuestionTemplate()", () => {
    it("should return question by ID", () => {
      const question = getQuestionTemplate("audience_technical_level");

      expect(question).toBeDefined();
      expect(question?.id).toBe("audience_technical_level");
      expect(question?.category).toBe("audience");
    });

    it("should return undefined for non-existent ID", () => {
      const question = getQuestionTemplate("non_existent_id");

      expect(question).toBeUndefined();
    });
  });

  describe("createCustomQuestion()", () => {
    it("should create custom question with default category", () => {
      const customQ = createCustomQuestion({
        id: "custom_test",
        type: "text",
        question: "自定义问题？",
        required: false,
      });

      expect(customQ.id).toBe("custom_test");
      expect(customQ.category).toBe("custom");
    });

    it("should allow specifying category", () => {
      const customQ = createCustomQuestion({
        id: "custom_audience",
        type: "single_choice",
        category: "audience",
        question: "自定义受众问题？",
        options: [{ value: "a", label: "选项A" }],
        required: true,
      });

      expect(customQ.category).toBe("audience");
    });
  });

  describe("validateBriefingQuestions()", () => {
    it("should throw for duplicate question IDs", () => {
      const duplicateQuestions = [
        { ...AUDIENCE_QUESTIONS.technicalLevel, id: "same_id" },
        { ...OBJECTIVE_QUESTIONS.contentGoal, id: "same_id" },
      ];

      expect(() => validateBriefingQuestions(duplicateQuestions)).toThrow(
        "Briefing 问题 ID 必须唯一",
      );
    });

    it("should throw for single_choice without options", () => {
      const invalidQuestion: BriefingQuestion = {
        id: "invalid_choice",
        type: "single_choice",
        question: "无选项的选择题？",
        required: true,
      };

      expect(() => validateBriefingQuestions([invalidQuestion])).toThrow(
        '问题 "invalid_choice" 是选择题类型但没有定义选项',
      );
    });

    it("should throw for scale without scaleConfig", () => {
      const invalidQuestion: BriefingQuestion = {
        id: "invalid_scale",
        type: "scale",
        question: "无配置的刻度？",
        required: false,
      };

      expect(() => validateBriefingQuestions([invalidQuestion])).toThrow(
        '问题 "invalid_scale" 是刻度类型但没有定义 scaleConfig',
      );
    });
  });

  describe("预定义问题组合", () => {
    it("should have TECH_BLOG_QUESTIONS with 3 questions", () => {
      expect(TECH_BLOG_QUESTIONS).toHaveLength(3);
      expect(() =>
        validateBriefingQuestions(TECH_BLOG_QUESTIONS),
      ).not.toThrow();
    });

    it("should have TUTORIAL_QUESTIONS with 3 questions", () => {
      expect(TUTORIAL_QUESTIONS).toHaveLength(3);
      expect(() => validateBriefingQuestions(TUTORIAL_QUESTIONS)).not.toThrow();
    });

    it("should have BUSINESS_DOC_QUESTIONS with 3 questions", () => {
      expect(BUSINESS_DOC_QUESTIONS).toHaveLength(3);
      expect(() =>
        validateBriefingQuestions(BUSINESS_DOC_QUESTIONS),
      ).not.toThrow();
    });
  });
});
