/**
 * LiteratureMatrix Blueprint Tests (Story 7.2)
 * @module knowledge-studio/blueprint/blueprints/professional/__tests__
 */

import {
  LiteratureMatrixBlueprint,
  createLiteratureMatrixBlueprint,
} from "../literature-matrix";
import type { JSONSchema7 } from "json-schema";

describe("LiteratureMatrixBlueprint", () => {
  let blueprint: LiteratureMatrixBlueprint;

  beforeEach(() => {
    blueprint = createLiteratureMatrixBlueprint();
  });

  // ============================================================
  // Metadata Tests
  // ============================================================

  describe("Metadata", () => {
    it("should have correct blueprintId", () => {
      expect(blueprint.blueprintId).toBe("professional-literature_matrix");
    });

    it("should have correct displayName", () => {
      expect(blueprint.displayName).toBe("文献矩阵");
    });

    it("should have pro tier", () => {
      expect(blueprint.tier).toBe("pro");
    });

    it("should target researchers and academics", () => {
      expect(blueprint.targetUsers).toContain("researcher");
      expect(blueprint.targetUsers).toContain("academic");
      expect(blueprint.targetUsers).toContain("student");
    });

    it("should have professional category", () => {
      expect(blueprint.category).toBe("professional");
    });

    it("should have priority 2", () => {
      expect(blueprint.priority).toBe(2);
    });

    it("should be marked as new", () => {
      expect(blueprint.isNew).toBe(true);
    });

    it("should have icon 📚", () => {
      expect(blueprint.icon).toBe("📚");
    });

    it("should have description mentioning literature review", () => {
      expect(blueprint.description).toContain("综述");
    });

    it("should have example prompts", () => {
      expect(blueprint.examplePrompts).toBeDefined();
      expect(blueprint.examplePrompts?.length).toBeGreaterThan(0);
    });

    it("should have tags", () => {
      expect(blueprint.tags).toContain("文献综述");
      expect(blueprint.tags).toContain("学术研究");
      expect(blueprint.tags).toContain("研究缺口");
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

    it("should have research_field question as single_choice", () => {
      const fieldQ = blueprint.briefingConfig.questions.find(
        (q) => q.id === "research_field",
      );
      expect(fieldQ).toBeDefined();
      expect(fieldQ?.type).toBe("single_choice");
      expect(fieldQ?.category).toBe("context");
      expect(fieldQ?.options).toHaveLength(4);
      expect(fieldQ?.required).toBe(true);
    });

    it("should have review_purpose question with 4 options", () => {
      const purposeQ = blueprint.briefingConfig.questions.find(
        (q) => q.id === "review_purpose",
      );
      expect(purposeQ).toBeDefined();
      expect(purposeQ?.type).toBe("single_choice");
      expect(purposeQ?.category).toBe("objective");
      expect(purposeQ?.options).toHaveLength(4);
      expect(purposeQ?.required).toBe(true);
    });

    it("should have depth question as optional", () => {
      const depthQ = blueprint.briefingConfig.questions.find(
        (q) => q.id === "depth",
      );
      expect(depthQ).toBeDefined();
      expect(depthQ?.type).toBe("single_choice");
      expect(depthQ?.category).toBe("constraint");
      expect(depthQ?.options).toHaveLength(3);
      expect(depthQ?.required).toBe(false);
    });

    it("should have proper default values", () => {
      const fieldQ = blueprint.briefingConfig.questions.find(
        (q) => q.id === "research_field",
      );
      const purposeQ = blueprint.briefingConfig.questions.find(
        (q) => q.id === "review_purpose",
      );
      const depthQ = blueprint.briefingConfig.questions.find(
        (q) => q.id === "depth",
      );

      expect(fieldQ?.defaultValue).toBe("cs");
      expect(purposeQ?.defaultValue).toBe("thesis");
      expect(depthQ?.defaultValue).toBe("standard");
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
      expect(schema.required).toContain("researchField");
      expect(schema.required).toContain("abstract");
      expect(schema.required).toContain("paperInfoTable");
      expect(schema.required).toContain("themeClusters");
      expect(schema.required).toContain("methodologyComparison");
      expect(schema.required).toContain("findingsSummary");
      expect(schema.required).toContain("researchGaps");
      expect(schema.required).toContain("futureDirections");
    });

    it("should define paperInfoTable array", () => {
      const props = schema.properties as Record<string, JSONSchema7>;
      expect(props.paperInfoTable).toBeDefined();
      expect(props.paperInfoTable.type).toBe("array");

      const paperSchema = props.paperInfoTable.items as JSONSchema7;
      expect(paperSchema.type).toBe("object");

      const paperProps = paperSchema.properties as Record<string, JSONSchema7>;
      expect(paperProps.id).toBeDefined();
      expect(paperProps.title).toBeDefined();
      expect(paperProps.authors).toBeDefined();
      expect(paperProps.year).toBeDefined();
      expect(paperProps.venue).toBeDefined();
    });

    it("should define themeClusters array", () => {
      const props = schema.properties as Record<string, JSONSchema7>;
      expect(props.themeClusters).toBeDefined();
      expect(props.themeClusters.type).toBe("array");

      const clusterSchema = props.themeClusters.items as JSONSchema7;
      expect(clusterSchema.type).toBe("object");

      const clusterProps = clusterSchema.properties as Record<
        string,
        JSONSchema7
      >;
      expect(clusterProps.id).toBeDefined();
      expect(clusterProps.name).toBeDefined();
      expect(clusterProps.paperIds).toBeDefined();
    });

    it("should define methodologyComparison array", () => {
      const props = schema.properties as Record<string, JSONSchema7>;
      expect(props.methodologyComparison).toBeDefined();
      expect(props.methodologyComparison.type).toBe("array");

      const methodSchema = props.methodologyComparison.items as JSONSchema7;
      expect(methodSchema.type).toBe("object");

      const methodProps = methodSchema.properties as Record<
        string,
        JSONSchema7
      >;
      expect(methodProps.paperId).toBeDefined();
      expect(methodProps.method).toBeDefined();
      expect(methodProps.strengths).toBeDefined();
      expect(methodProps.limitations).toBeDefined();
    });

    it("should define researchGaps array", () => {
      const props = schema.properties as Record<string, JSONSchema7>;
      expect(props.researchGaps).toBeDefined();
      expect(props.researchGaps.type).toBe("array");

      const gapSchema = props.researchGaps.items as JSONSchema7;
      expect(gapSchema.type).toBe("object");

      const gapProps = gapSchema.properties as Record<string, JSONSchema7>;
      expect(gapProps.id).toBeDefined();
      expect(gapProps.description).toBeDefined();
      expect(gapProps.importance).toBeDefined();
      expect(gapProps.potentialQuestions).toBeDefined();
    });

    it("should define futureDirections array", () => {
      const props = schema.properties as Record<string, JSONSchema7>;
      expect(props.futureDirections).toBeDefined();
      expect(props.futureDirections.type).toBe("array");

      const dirSchema = props.futureDirections.items as JSONSchema7;
      expect(dirSchema.type).toBe("object");

      const dirProps = dirSchema.properties as Record<string, JSONSchema7>;
      expect(dirProps.id).toBeDefined();
      expect(dirProps.title).toBeDefined();
      expect(dirProps.feasibility).toBeDefined();
      expect(dirProps.expectedImpact).toBeDefined();
    });

    it("should define findingsSummary array", () => {
      const props = schema.properties as Record<string, JSONSchema7>;
      expect(props.findingsSummary).toBeDefined();
      expect(props.findingsSummary.type).toBe("array");

      const findingSchema = props.findingsSummary.items as JSONSchema7;
      expect(findingSchema.type).toBe("object");

      const findingProps = findingSchema.properties as Record<
        string,
        JSONSchema7
      >;
      expect(findingProps.paperId).toBeDefined();
      expect(findingProps.mainFindings).toBeDefined();
      expect(findingProps.keyContributions).toBeDefined();
    });
  });

  // ============================================================
  // Factory Function Tests
  // ============================================================

  describe("Factory Function", () => {
    it("should create valid blueprint instance", () => {
      const instance = createLiteratureMatrixBlueprint();
      expect(instance).toBeInstanceOf(LiteratureMatrixBlueprint);
    });

    it("should create new instance each call", () => {
      const instance1 = createLiteratureMatrixBlueprint();
      const instance2 = createLiteratureMatrixBlueprint();
      expect(instance1).not.toBe(instance2);
    });

    it("should have consistent blueprintId", () => {
      const instance = createLiteratureMatrixBlueprint();
      expect(instance.blueprintId).toBe("professional-literature_matrix");
    });
  });

  // ============================================================
  // Research Field Option Tests
  // ============================================================

  describe("Research Field Options", () => {
    it("should have cs option", () => {
      const fieldQ = blueprint.briefingConfig.questions.find(
        (q) => q.id === "research_field",
      );
      const csOpt = fieldQ?.options?.find((o) => o.value === "cs");
      expect(csOpt).toBeDefined();
      expect(csOpt?.label).toBe("计算机科学");
    });

    it("should have medicine option", () => {
      const fieldQ = blueprint.briefingConfig.questions.find(
        (q) => q.id === "research_field",
      );
      const medOpt = fieldQ?.options?.find((o) => o.value === "medicine");
      expect(medOpt).toBeDefined();
      expect(medOpt?.label).toBe("医学/健康");
    });

    it("should have social option", () => {
      const fieldQ = blueprint.briefingConfig.questions.find(
        (q) => q.id === "research_field",
      );
      const socialOpt = fieldQ?.options?.find((o) => o.value === "social");
      expect(socialOpt).toBeDefined();
      expect(socialOpt?.label).toBe("社会科学");
    });

    it("should have other option", () => {
      const fieldQ = blueprint.briefingConfig.questions.find(
        (q) => q.id === "research_field",
      );
      const otherOpt = fieldQ?.options?.find((o) => o.value === "other");
      expect(otherOpt).toBeDefined();
      expect(otherOpt?.label).toBe("其他领域");
    });
  });

  // ============================================================
  // Review Purpose Option Tests
  // ============================================================

  describe("Review Purpose Options", () => {
    it("should have thesis option", () => {
      const purposeQ = blueprint.briefingConfig.questions.find(
        (q) => q.id === "review_purpose",
      );
      const thesisOpt = purposeQ?.options?.find((o) => o.value === "thesis");
      expect(thesisOpt).toBeDefined();
      expect(thesisOpt?.label).toBe("学位论文");
      expect(thesisOpt?.description).toContain("硕博");
    });

    it("should have proposal option", () => {
      const purposeQ = blueprint.briefingConfig.questions.find(
        (q) => q.id === "review_purpose",
      );
      const proposalOpt = purposeQ?.options?.find(
        (o) => o.value === "proposal",
      );
      expect(proposalOpt).toBeDefined();
      expect(proposalOpt?.label).toBe("研究提案");
    });

    it("should have survey option", () => {
      const purposeQ = blueprint.briefingConfig.questions.find(
        (q) => q.id === "review_purpose",
      );
      const surveyOpt = purposeQ?.options?.find((o) => o.value === "survey");
      expect(surveyOpt).toBeDefined();
      expect(surveyOpt?.label).toBe("综述论文");
    });

    it("should have learning option", () => {
      const purposeQ = blueprint.briefingConfig.questions.find(
        (q) => q.id === "review_purpose",
      );
      const learningOpt = purposeQ?.options?.find(
        (o) => o.value === "learning",
      );
      expect(learningOpt).toBeDefined();
      expect(learningOpt?.label).toBe("自学梳理");
    });
  });

  // ============================================================
  // Depth Option Tests
  // ============================================================

  describe("Depth Options", () => {
    it("should have overview option", () => {
      const depthQ = blueprint.briefingConfig.questions.find(
        (q) => q.id === "depth",
      );
      const overviewOpt = depthQ?.options?.find((o) => o.value === "overview");
      expect(overviewOpt).toBeDefined();
      expect(overviewOpt?.label).toBe("概览式");
    });

    it("should have standard option", () => {
      const depthQ = blueprint.briefingConfig.questions.find(
        (q) => q.id === "depth",
      );
      const standardOpt = depthQ?.options?.find((o) => o.value === "standard");
      expect(standardOpt).toBeDefined();
      expect(standardOpt?.label).toBe("标准式");
    });

    it("should have in_depth option", () => {
      const depthQ = blueprint.briefingConfig.questions.find(
        (q) => q.id === "depth",
      );
      const inDepthOpt = depthQ?.options?.find((o) => o.value === "in_depth");
      expect(inDepthOpt).toBeDefined();
      expect(inDepthOpt?.label).toBe("深入式");
      expect(inDepthOpt?.description).toContain("详细");
    });

    it("should have descriptions for depth options", () => {
      const depthQ = blueprint.briefingConfig.questions.find(
        (q) => q.id === "depth",
      );

      const overviewOpt = depthQ?.options?.find((o) => o.value === "overview");
      expect(overviewOpt?.description).toContain("快速");

      const standardOpt = depthQ?.options?.find((o) => o.value === "standard");
      expect(standardOpt?.description).toContain("常规");
    });
  });
});
