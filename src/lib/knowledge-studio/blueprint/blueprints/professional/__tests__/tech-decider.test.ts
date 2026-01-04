/**
 * TechDecider Blueprint Tests (Story 7.1)
 * @module knowledge-studio/blueprint/blueprints/professional/__tests__
 */

import {
  TechDeciderBlueprint,
  createTechDeciderBlueprint,
} from "../tech-decider";
import type { JSONSchema7 } from "json-schema";

describe("TechDeciderBlueprint", () => {
  let blueprint: TechDeciderBlueprint;

  beforeEach(() => {
    blueprint = createTechDeciderBlueprint();
  });

  // ============================================================
  // Metadata Tests
  // ============================================================

  describe("Metadata", () => {
    it("should have correct blueprintId", () => {
      expect(blueprint.blueprintId).toBe("professional-tech_decider");
    });

    it("should have correct displayName", () => {
      expect(blueprint.displayName).toBe("技术决策助手");
    });

    it("should have pro tier", () => {
      expect(blueprint.tier).toBe("pro");
    });

    it("should target tech leads and architects", () => {
      expect(blueprint.targetUsers).toContain("tech_lead");
      expect(blueprint.targetUsers).toContain("architect");
      expect(blueprint.targetUsers).toContain("developer");
    });

    it("should have professional category", () => {
      expect(blueprint.category).toBe("professional");
    });

    it("should have priority 1", () => {
      expect(blueprint.priority).toBe(1);
    });

    it("should be marked as new", () => {
      expect(blueprint.isNew).toBe(true);
    });

    it("should have icon ⚖️", () => {
      expect(blueprint.icon).toBe("⚖️");
    });

    it("should have description mentioning ADR", () => {
      expect(blueprint.description).toContain("ADR");
    });

    it("should have example prompts", () => {
      expect(blueprint.examplePrompts).toBeDefined();
      expect(blueprint.examplePrompts?.length).toBeGreaterThan(0);
    });

    it("should have tags", () => {
      expect(blueprint.tags).toContain("ADR");
      expect(blueprint.tags).toContain("架构决策");
      expect(blueprint.tags).toContain("技术选型");
    });

    it("should have creditsCost of 2 (Story 8.1)", () => {
      expect(blueprint.creditsCost).toBe(2);
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

    it("should have decision_type question as single_choice", () => {
      const decisionQ = blueprint.briefingConfig.questions.find(
        (q) => q.id === "decision_type",
      );
      expect(decisionQ).toBeDefined();
      expect(decisionQ?.type).toBe("single_choice");
      expect(decisionQ?.category).toBe("context");
      expect(decisionQ?.options).toHaveLength(4);
      expect(decisionQ?.required).toBe(true);
    });

    it("should have team_size question with 4 options", () => {
      const teamQ = blueprint.briefingConfig.questions.find(
        (q) => q.id === "team_size",
      );
      expect(teamQ).toBeDefined();
      expect(teamQ?.type).toBe("single_choice");
      expect(teamQ?.category).toBe("context");
      expect(teamQ?.options).toHaveLength(4);
      expect(teamQ?.required).toBe(true);
    });

    it("should have urgency question as optional", () => {
      const urgencyQ = blueprint.briefingConfig.questions.find(
        (q) => q.id === "urgency",
      );
      expect(urgencyQ).toBeDefined();
      expect(urgencyQ?.type).toBe("single_choice");
      expect(urgencyQ?.category).toBe("constraint");
      expect(urgencyQ?.options).toHaveLength(4);
      expect(urgencyQ?.required).toBe(false);
    });

    it("should have proper default values", () => {
      const decisionQ = blueprint.briefingConfig.questions.find(
        (q) => q.id === "decision_type",
      );
      const teamQ = blueprint.briefingConfig.questions.find(
        (q) => q.id === "team_size",
      );
      const urgencyQ = blueprint.briefingConfig.questions.find(
        (q) => q.id === "urgency",
      );

      expect(decisionQ?.defaultValue).toBe("technology");
      expect(teamQ?.defaultValue).toBe("small");
      expect(urgencyQ?.defaultValue).toBe("medium");
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
      expect(schema.required).toContain("status");
      expect(schema.required).toContain("decisionBackground");
      expect(schema.required).toContain("candidateSolutions");
      expect(schema.required).toContain("evaluationMatrix");
      expect(schema.required).toContain("recommendedSolution");
      expect(schema.required).toContain("implementationRisks");
      expect(schema.required).toContain("actionItems");
    });

    it("should define decisionBackground object", () => {
      const props = schema.properties as Record<string, JSONSchema7>;
      expect(props.decisionBackground).toBeDefined();
      expect(props.decisionBackground.type).toBe("object");

      const bgProps = props.decisionBackground.properties as Record<
        string,
        JSONSchema7
      >;
      expect(bgProps.context).toBeDefined();
      expect(bgProps.problemStatement).toBeDefined();
      expect(bgProps.constraints).toBeDefined();
    });

    it("should define candidateSolutions array", () => {
      const props = schema.properties as Record<string, JSONSchema7>;
      expect(props.candidateSolutions).toBeDefined();
      expect(props.candidateSolutions.type).toBe("array");

      const solutionSchema = props.candidateSolutions.items as JSONSchema7;
      expect(solutionSchema.type).toBe("object");

      const solutionProps = solutionSchema.properties as Record<
        string,
        JSONSchema7
      >;
      expect(solutionProps.id).toBeDefined();
      expect(solutionProps.name).toBeDefined();
      expect(solutionProps.pros).toBeDefined();
      expect(solutionProps.cons).toBeDefined();
    });

    it("should define evaluationMatrix object", () => {
      const props = schema.properties as Record<string, JSONSchema7>;
      expect(props.evaluationMatrix).toBeDefined();
      expect(props.evaluationMatrix.type).toBe("object");

      const matrixProps = props.evaluationMatrix.properties as Record<
        string,
        JSONSchema7
      >;
      expect(matrixProps.criteria).toBeDefined();
      expect(matrixProps.rows).toBeDefined();
    });

    it("should define recommendedSolution object", () => {
      const props = schema.properties as Record<string, JSONSchema7>;
      expect(props.recommendedSolution).toBeDefined();
      expect(props.recommendedSolution.type).toBe("object");

      const recProps = props.recommendedSolution.properties as Record<
        string,
        JSONSchema7
      >;
      expect(recProps.solutionId).toBeDefined();
      expect(recProps.solutionName).toBeDefined();
      expect(recProps.rationale).toBeDefined();
      expect(recProps.confidence).toBeDefined();
    });

    it("should define implementationRisks array", () => {
      const props = schema.properties as Record<string, JSONSchema7>;
      expect(props.implementationRisks).toBeDefined();
      expect(props.implementationRisks.type).toBe("array");

      const riskSchema = props.implementationRisks.items as JSONSchema7;
      expect(riskSchema.type).toBe("object");

      const riskProps = riskSchema.properties as Record<string, JSONSchema7>;
      expect(riskProps.id).toBeDefined();
      expect(riskProps.description).toBeDefined();
      expect(riskProps.severity).toBeDefined();
      expect(riskProps.mitigation).toBeDefined();
    });

    it("should define actionItems array", () => {
      const props = schema.properties as Record<string, JSONSchema7>;
      expect(props.actionItems).toBeDefined();
      expect(props.actionItems.type).toBe("array");

      const actionSchema = props.actionItems.items as JSONSchema7;
      expect(actionSchema.type).toBe("object");

      const actionProps = actionSchema.properties as Record<
        string,
        JSONSchema7
      >;
      expect(actionProps.id).toBeDefined();
      expect(actionProps.description).toBeDefined();
      expect(actionProps.priority).toBeDefined();
    });

    it("should define status as enum", () => {
      const props = schema.properties as Record<string, JSONSchema7>;
      expect(props.status).toBeDefined();
      expect(props.status.type).toBe("string");
      expect(props.status.enum).toContain("proposed");
      expect(props.status.enum).toContain("accepted");
      expect(props.status.enum).toContain("deprecated");
      expect(props.status.enum).toContain("superseded");
    });
  });

  // ============================================================
  // Factory Function Tests
  // ============================================================

  describe("Factory Function", () => {
    it("should create valid blueprint instance", () => {
      const instance = createTechDeciderBlueprint();
      expect(instance).toBeInstanceOf(TechDeciderBlueprint);
    });

    it("should create new instance each call", () => {
      const instance1 = createTechDeciderBlueprint();
      const instance2 = createTechDeciderBlueprint();
      expect(instance1).not.toBe(instance2);
    });

    it("should have consistent blueprintId", () => {
      const instance = createTechDeciderBlueprint();
      expect(instance.blueprintId).toBe("professional-tech_decider");
    });
  });

  // ============================================================
  // Decision Type Option Tests
  // ============================================================

  describe("Decision Type Options", () => {
    it("should have technology option", () => {
      const decisionQ = blueprint.briefingConfig.questions.find(
        (q) => q.id === "decision_type",
      );
      const techOpt = decisionQ?.options?.find((o) => o.value === "technology");
      expect(techOpt).toBeDefined();
      expect(techOpt?.label).toBe("技术选型");
    });

    it("should have architecture option", () => {
      const decisionQ = blueprint.briefingConfig.questions.find(
        (q) => q.id === "decision_type",
      );
      const archOpt = decisionQ?.options?.find(
        (o) => o.value === "architecture",
      );
      expect(archOpt).toBeDefined();
      expect(archOpt?.label).toBe("架构设计");
    });

    it("should have pattern option", () => {
      const decisionQ = blueprint.briefingConfig.questions.find(
        (q) => q.id === "decision_type",
      );
      const patternOpt = decisionQ?.options?.find((o) => o.value === "pattern");
      expect(patternOpt).toBeDefined();
      expect(patternOpt?.label).toBe("设计模式");
    });

    it("should have tool option", () => {
      const decisionQ = blueprint.briefingConfig.questions.find(
        (q) => q.id === "decision_type",
      );
      const toolOpt = decisionQ?.options?.find((o) => o.value === "tool");
      expect(toolOpt).toBeDefined();
      expect(toolOpt?.label).toBe("工具选择");
    });
  });

  // ============================================================
  // Team Size Option Tests
  // ============================================================

  describe("Team Size Options", () => {
    it("should have solo option", () => {
      const teamQ = blueprint.briefingConfig.questions.find(
        (q) => q.id === "team_size",
      );
      const soloOpt = teamQ?.options?.find((o) => o.value === "solo");
      expect(soloOpt).toBeDefined();
      expect(soloOpt?.label).toBe("个人/独立开发者");
    });

    it("should have small team option", () => {
      const teamQ = blueprint.briefingConfig.questions.find(
        (q) => q.id === "team_size",
      );
      const smallOpt = teamQ?.options?.find((o) => o.value === "small");
      expect(smallOpt).toBeDefined();
      expect(smallOpt?.label).toBe("小型团队");
      expect(smallOpt?.description).toContain("2-5");
    });

    it("should have medium team option", () => {
      const teamQ = blueprint.briefingConfig.questions.find(
        (q) => q.id === "team_size",
      );
      const mediumOpt = teamQ?.options?.find((o) => o.value === "medium");
      expect(mediumOpt).toBeDefined();
      expect(mediumOpt?.label).toBe("中型团队");
      expect(mediumOpt?.description).toContain("6-20");
    });

    it("should have large team option", () => {
      const teamQ = blueprint.briefingConfig.questions.find(
        (q) => q.id === "team_size",
      );
      const largeOpt = teamQ?.options?.find((o) => o.value === "large");
      expect(largeOpt).toBeDefined();
      expect(largeOpt?.label).toBe("大型团队");
      expect(largeOpt?.description).toContain("20+");
    });
  });

  // ============================================================
  // Urgency Option Tests
  // ============================================================

  describe("Urgency Options", () => {
    it("should have low urgency option", () => {
      const urgencyQ = blueprint.briefingConfig.questions.find(
        (q) => q.id === "urgency",
      );
      const lowOpt = urgencyQ?.options?.find((o) => o.value === "low");
      expect(lowOpt).toBeDefined();
      expect(lowOpt?.label).toContain("低");
    });

    it("should have medium urgency option", () => {
      const urgencyQ = blueprint.briefingConfig.questions.find(
        (q) => q.id === "urgency",
      );
      const medOpt = urgencyQ?.options?.find((o) => o.value === "medium");
      expect(medOpt).toBeDefined();
      expect(medOpt?.label).toContain("中");
    });

    it("should have high urgency option", () => {
      const urgencyQ = blueprint.briefingConfig.questions.find(
        (q) => q.id === "urgency",
      );
      const highOpt = urgencyQ?.options?.find((o) => o.value === "high");
      expect(highOpt).toBeDefined();
      expect(highOpt?.label).toContain("高");
    });

    it("should have critical urgency option", () => {
      const urgencyQ = blueprint.briefingConfig.questions.find(
        (q) => q.id === "urgency",
      );
      const criticalOpt = urgencyQ?.options?.find(
        (o) => o.value === "critical",
      );
      expect(criticalOpt).toBeDefined();
      expect(criticalOpt?.label).toContain("紧急");
    });

    it("should have descriptions for urgency options", () => {
      const urgencyQ = blueprint.briefingConfig.questions.find(
        (q) => q.id === "urgency",
      );

      const lowOpt = urgencyQ?.options?.find((o) => o.value === "low");
      expect(lowOpt?.description).toContain("充足时间");

      const medOpt = urgencyQ?.options?.find((o) => o.value === "medium");
      expect(medOpt?.description).toContain("合理时间");

      const highOpt = urgencyQ?.options?.find((o) => o.value === "high");
      expect(highOpt?.description).toContain("快速");
    });
  });
});
