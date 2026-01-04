/**
 * SeoPillar Blueprint Tests (Story 7.3)
 * @module knowledge-studio/blueprint/blueprints/professional/__tests__
 */

import { SeoPillarBlueprint, createSeoPillarBlueprint } from "../seo-pillar";
import type { JSONSchema7 } from "json-schema";

describe("SeoPillarBlueprint", () => {
  let blueprint: SeoPillarBlueprint;

  beforeEach(() => {
    blueprint = createSeoPillarBlueprint();
  });

  // ============================================================
  // Metadata Tests
  // ============================================================

  describe("Metadata", () => {
    it("should have correct blueprintId", () => {
      expect(blueprint.blueprintId).toBe("professional-seo_pillar");
    });

    it("should have correct displayName", () => {
      expect(blueprint.displayName).toBe("SEO霸屏专家");
    });

    it("should have pro tier", () => {
      expect(blueprint.tier).toBe("pro");
    });

    it("should target marketers and content creators", () => {
      expect(blueprint.targetUsers).toContain("marketer");
      expect(blueprint.targetUsers).toContain("content_creator");
      expect(blueprint.targetUsers).toContain("blogger");
    });

    it("should have professional category", () => {
      expect(blueprint.category).toBe("professional");
    });

    it("should have priority 3", () => {
      expect(blueprint.priority).toBe(3);
    });

    it("should be marked as new", () => {
      expect(blueprint.isNew).toBe(true);
    });

    it("should have icon 🔍", () => {
      expect(blueprint.icon).toBe("🔍");
    });

    it("should have description mentioning Pillar-Cluster", () => {
      expect(blueprint.description).toContain("Pillar-Cluster");
    });

    it("should have example prompts", () => {
      expect(blueprint.examplePrompts).toBeDefined();
      expect(blueprint.examplePrompts?.length).toBeGreaterThan(0);
    });

    it("should have tags", () => {
      expect(blueprint.tags).toContain("SEO");
      expect(blueprint.tags).toContain("内容策略");
      expect(blueprint.tags).toContain("长青内容");
    });
  });

  // ============================================================
  // Briefing Configuration Tests
  // ============================================================

  describe("Briefing Configuration", () => {
    it("should have briefing enabled", () => {
      expect(blueprint.briefingConfig.enabled).toBe(true);
    });

    it("should have maxQuestions = 3", () => {
      expect(blueprint.briefingConfig.maxQuestions).toBe(3);
    });

    it("should have 3 questions", () => {
      expect(blueprint.briefingConfig.questions).toHaveLength(3);
    });

    it("should have content_goal question as single_choice", () => {
      const goalQ = blueprint.briefingConfig.questions.find(
        (q) => q.id === "content_goal",
      );
      expect(goalQ).toBeDefined();
      expect(goalQ?.type).toBe("single_choice");
      expect(goalQ?.category).toBe("objective");
      expect(goalQ?.options).toHaveLength(4);
      expect(goalQ?.required).toBe(true);
    });

    it("should have content_scale question with 4 options", () => {
      const scaleQ = blueprint.briefingConfig.questions.find(
        (q) => q.id === "content_scale",
      );
      expect(scaleQ).toBeDefined();
      expect(scaleQ?.type).toBe("single_choice");
      expect(scaleQ?.category).toBe("constraint");
      expect(scaleQ?.options).toHaveLength(4);
      expect(scaleQ?.required).toBe(true);
    });

    it("should have time_horizon question as optional", () => {
      const timeQ = blueprint.briefingConfig.questions.find(
        (q) => q.id === "time_horizon",
      );
      expect(timeQ).toBeDefined();
      expect(timeQ?.type).toBe("single_choice");
      expect(timeQ?.category).toBe("constraint");
      expect(timeQ?.options).toHaveLength(3);
      expect(timeQ?.required).toBe(false);
    });

    it("should have proper default values", () => {
      const goalQ = blueprint.briefingConfig.questions.find(
        (q) => q.id === "content_goal",
      );
      const scaleQ = blueprint.briefingConfig.questions.find(
        (q) => q.id === "content_scale",
      );
      const timeQ = blueprint.briefingConfig.questions.find(
        (q) => q.id === "time_horizon",
      );

      expect(goalQ?.defaultValue).toBe("traffic");
      expect(scaleQ?.defaultValue).toBe("solo");
      expect(timeQ?.defaultValue).toBe("quarter");
    });
  });

  // ============================================================
  // getBriefingQuestions Tests
  // ============================================================

  describe("getBriefingQuestions", () => {
    it("should return briefing questions", () => {
      const questions = blueprint.getBriefingQuestions();
      expect(questions).toEqual(blueprint.briefingConfig.questions);
    });

    it("should have 3 questions", () => {
      const questions = blueprint.getBriefingQuestions();
      expect(questions).toHaveLength(3);
    });
  });

  // ============================================================
  // getOutputSchema Tests
  // ============================================================

  describe("getOutputSchema", () => {
    let schema: JSONSchema7;

    beforeEach(() => {
      schema = blueprint.getOutputSchema();
    });

    it("should return valid JSON Schema", () => {
      expect(schema.$schema).toBe("http://json-schema.org/draft-07/schema#");
      expect(schema.type).toBe("object");
    });

    it("should have required fields", () => {
      expect(schema.required).toContain("version");
      expect(schema.required).toContain("blueprintId");
      expect(schema.required).toContain("title");
      expect(schema.required).toContain("topicDomain");
      expect(schema.required).toContain("strategyOverview");
      expect(schema.required).toContain("pillarPages");
      expect(schema.required).toContain("clusterPages");
      expect(schema.required).toContain("keywordSuggestions");
      expect(schema.required).toContain("internalLinkStrategy");
      expect(schema.required).toContain("contentCalendar");
    });

    it("should define pillarPages array", () => {
      const props = schema.properties as Record<string, JSONSchema7>;
      expect(props.pillarPages).toBeDefined();
      expect(props.pillarPages.type).toBe("array");

      const pillarSchema = props.pillarPages.items as JSONSchema7;
      expect(pillarSchema.type).toBe("object");

      const pillarProps = pillarSchema.properties as Record<
        string,
        JSONSchema7
      >;
      expect(pillarProps.id).toBeDefined();
      expect(pillarProps.title).toBeDefined();
      expect(pillarProps.targetKeyword).toBeDefined();
      expect(pillarProps.sections).toBeDefined();
    });

    it("should define clusterPages array", () => {
      const props = schema.properties as Record<string, JSONSchema7>;
      expect(props.clusterPages).toBeDefined();
      expect(props.clusterPages.type).toBe("array");

      const clusterSchema = props.clusterPages.items as JSONSchema7;
      expect(clusterSchema.type).toBe("object");

      const clusterProps = clusterSchema.properties as Record<
        string,
        JSONSchema7
      >;
      expect(clusterProps.id).toBeDefined();
      expect(clusterProps.pillarId).toBeDefined();
      expect(clusterProps.targetKeyword).toBeDefined();
      expect(clusterProps.searchIntent).toBeDefined();
    });

    it("should define keywordSuggestions array", () => {
      const props = schema.properties as Record<string, JSONSchema7>;
      expect(props.keywordSuggestions).toBeDefined();
      expect(props.keywordSuggestions.type).toBe("array");

      const keywordSchema = props.keywordSuggestions.items as JSONSchema7;
      expect(keywordSchema.type).toBe("object");

      const keywordProps = keywordSchema.properties as Record<
        string,
        JSONSchema7
      >;
      expect(keywordProps.keyword).toBeDefined();
      expect(keywordProps.searchVolume).toBeDefined();
      expect(keywordProps.competition).toBeDefined();
      expect(keywordProps.isLongTail).toBeDefined();
    });

    it("should define internalLinkStrategy array", () => {
      const props = schema.properties as Record<string, JSONSchema7>;
      expect(props.internalLinkStrategy).toBeDefined();
      expect(props.internalLinkStrategy.type).toBe("array");

      const linkSchema = props.internalLinkStrategy.items as JSONSchema7;
      expect(linkSchema.type).toBe("object");

      const linkProps = linkSchema.properties as Record<string, JSONSchema7>;
      expect(linkProps.fromPageId).toBeDefined();
      expect(linkProps.toPageId).toBeDefined();
      expect(linkProps.anchorText).toBeDefined();
    });

    it("should define contentCalendar array", () => {
      const props = schema.properties as Record<string, JSONSchema7>;
      expect(props.contentCalendar).toBeDefined();
      expect(props.contentCalendar.type).toBe("array");

      const calendarSchema = props.contentCalendar.items as JSONSchema7;
      expect(calendarSchema.type).toBe("object");

      const calendarProps = calendarSchema.properties as Record<
        string,
        JSONSchema7
      >;
      expect(calendarProps.pageId).toBeDefined();
      expect(calendarProps.pageType).toBeDefined();
      expect(calendarProps.suggestedWeek).toBeDefined();
      expect(calendarProps.estimatedHours).toBeDefined();
    });

    it("should define numeric summary fields", () => {
      const props = schema.properties as Record<string, JSONSchema7>;
      expect(props.totalEstimatedHours).toBeDefined();
      expect(props.totalEstimatedHours.type).toBe("number");
      expect(props.estimatedKeywordCoverage).toBeDefined();
      expect(props.estimatedKeywordCoverage.type).toBe("number");
    });
  });

  // ============================================================
  // Factory Function Tests
  // ============================================================

  describe("Factory Function", () => {
    it("should create valid blueprint instance", () => {
      const instance = createSeoPillarBlueprint();
      expect(instance).toBeInstanceOf(SeoPillarBlueprint);
    });

    it("should create new instance each call", () => {
      const instance1 = createSeoPillarBlueprint();
      const instance2 = createSeoPillarBlueprint();
      expect(instance1).not.toBe(instance2);
    });

    it("should have consistent blueprintId", () => {
      const instance = createSeoPillarBlueprint();
      expect(instance.blueprintId).toBe("professional-seo_pillar");
    });
  });

  // ============================================================
  // Content Goal Option Tests
  // ============================================================

  describe("Content Goal Options", () => {
    it("should have traffic option", () => {
      const goalQ = blueprint.briefingConfig.questions.find(
        (q) => q.id === "content_goal",
      );
      const trafficOpt = goalQ?.options?.find((o) => o.value === "traffic");
      expect(trafficOpt).toBeDefined();
      expect(trafficOpt?.label).toBe("流量增长");
    });

    it("should have authority option", () => {
      const goalQ = blueprint.briefingConfig.questions.find(
        (q) => q.id === "content_goal",
      );
      const authorityOpt = goalQ?.options?.find((o) => o.value === "authority");
      expect(authorityOpt).toBeDefined();
      expect(authorityOpt?.label).toBe("建立权威");
    });

    it("should have conversion option", () => {
      const goalQ = blueprint.briefingConfig.questions.find(
        (q) => q.id === "content_goal",
      );
      const conversionOpt = goalQ?.options?.find(
        (o) => o.value === "conversion",
      );
      expect(conversionOpt).toBeDefined();
      expect(conversionOpt?.label).toBe("转化导向");
    });

    it("should have education option", () => {
      const goalQ = blueprint.briefingConfig.questions.find(
        (q) => q.id === "content_goal",
      );
      const educationOpt = goalQ?.options?.find((o) => o.value === "education");
      expect(educationOpt).toBeDefined();
      expect(educationOpt?.label).toBe("教育用户");
    });
  });

  // ============================================================
  // Content Scale Option Tests
  // ============================================================

  describe("Content Scale Options", () => {
    it("should have solo option", () => {
      const scaleQ = blueprint.briefingConfig.questions.find(
        (q) => q.id === "content_scale",
      );
      const soloOpt = scaleQ?.options?.find((o) => o.value === "solo");
      expect(soloOpt).toBeDefined();
      expect(soloOpt?.label).toBe("个人独立");
      expect(soloOpt?.description).toContain("1-2");
    });

    it("should have small_team option", () => {
      const scaleQ = blueprint.briefingConfig.questions.find(
        (q) => q.id === "content_scale",
      );
      const smallOpt = scaleQ?.options?.find((o) => o.value === "small_team");
      expect(smallOpt).toBeDefined();
      expect(smallOpt?.label).toBe("小团队");
      expect(smallOpt?.description).toContain("3-5");
    });

    it("should have content_team option", () => {
      const scaleQ = blueprint.briefingConfig.questions.find(
        (q) => q.id === "content_scale",
      );
      const contentOpt = scaleQ?.options?.find(
        (o) => o.value === "content_team",
      );
      expect(contentOpt).toBeDefined();
      expect(contentOpt?.label).toBe("内容团队");
      expect(contentOpt?.description).toContain("5-10");
    });

    it("should have agency option", () => {
      const scaleQ = blueprint.briefingConfig.questions.find(
        (q) => q.id === "content_scale",
      );
      const agencyOpt = scaleQ?.options?.find((o) => o.value === "agency");
      expect(agencyOpt).toBeDefined();
      expect(agencyOpt?.label).toBe("代理/大团队");
      expect(agencyOpt?.description).toContain("10+");
    });
  });

  // ============================================================
  // Time Horizon Option Tests
  // ============================================================

  describe("Time Horizon Options", () => {
    it("should have quarter option", () => {
      const timeQ = blueprint.briefingConfig.questions.find(
        (q) => q.id === "time_horizon",
      );
      const quarterOpt = timeQ?.options?.find((o) => o.value === "quarter");
      expect(quarterOpt).toBeDefined();
      expect(quarterOpt?.label).toBe("一个季度");
      expect(quarterOpt?.description).toContain("3");
    });

    it("should have half_year option", () => {
      const timeQ = blueprint.briefingConfig.questions.find(
        (q) => q.id === "time_horizon",
      );
      const halfYearOpt = timeQ?.options?.find((o) => o.value === "half_year");
      expect(halfYearOpt).toBeDefined();
      expect(halfYearOpt?.label).toBe("半年");
      expect(halfYearOpt?.description).toContain("6");
    });

    it("should have year option", () => {
      const timeQ = blueprint.briefingConfig.questions.find(
        (q) => q.id === "time_horizon",
      );
      const yearOpt = timeQ?.options?.find((o) => o.value === "year");
      expect(yearOpt).toBeDefined();
      expect(yearOpt?.label).toBe("一年");
      expect(yearOpt?.description).toContain("12");
    });
  });
});
