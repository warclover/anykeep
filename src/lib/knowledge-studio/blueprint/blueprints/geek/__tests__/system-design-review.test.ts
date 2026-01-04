/**
 * SystemDesignReview Blueprint Tests (Story 4.4)
 * @module knowledge-studio/blueprint/blueprints/geek
 */

import {
  SystemDesignReviewBlueprint,
  createSystemDesignReviewBlueprint,
} from "../system-design-review";
import type { JSONSchema7 } from "json-schema";

describe("SystemDesignReviewBlueprint", () => {
  let blueprint: SystemDesignReviewBlueprint;

  beforeEach(() => {
    blueprint = createSystemDesignReviewBlueprint();
  });

  // ============================================================
  // Metadata Tests
  // ============================================================

  describe("Metadata", () => {
    it("should have correct blueprintId", () => {
      expect(blueprint.blueprintId).toBe("geek-system_design_review");
    });

    it("should have correct displayName", () => {
      expect(blueprint.displayName).toBe("系统架构评审官");
    });

    it("should have pro tier", () => {
      expect(blueprint.tier).toBe("pro");
    });

    it("should target architect, developer, product_manager", () => {
      expect(blueprint.targetUsers).toContain("architect");
      expect(blueprint.targetUsers).toContain("developer");
      expect(blueprint.targetUsers).toContain("product_manager");
    });

    it("should have geek category", () => {
      expect(blueprint.category).toBe("geek");
    });

    it("should have priority 4", () => {
      expect(blueprint.priority).toBe(4);
    });

    it("should be marked as new", () => {
      expect(blueprint.isNew).toBe(true);
    });

    it("should have icon 🏗️", () => {
      expect(blueprint.icon).toBe("🏗️");
    });

    it("should have description", () => {
      expect(blueprint.description).toContain("评审");
      expect(blueprint.description).toContain("架构");
    });

    it("should have example prompts", () => {
      expect(blueprint.examplePrompts).toBeDefined();
      expect(blueprint.examplePrompts?.length).toBeGreaterThan(0);
    });

    it("should have tags", () => {
      expect(blueprint.tags).toContain("架构");
      expect(blueprint.tags).toContain("评审");
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

    it("should have review_focus question as multi_choice", () => {
      const focusQuestion = blueprint.briefingConfig.questions.find(
        (q) => q.id === "review_focus",
      );
      expect(focusQuestion).toBeDefined();
      expect(focusQuestion?.type).toBe("multi_choice");
      expect(focusQuestion?.category).toBe("objective");
      expect(focusQuestion?.options).toHaveLength(4);
      expect(focusQuestion?.required).toBe(true);
    });

    it("should have system_scale question with 4 options", () => {
      const scaleQuestion = blueprint.briefingConfig.questions.find(
        (q) => q.id === "system_scale",
      );
      expect(scaleQuestion).toBeDefined();
      expect(scaleQuestion?.type).toBe("single_choice");
      expect(scaleQuestion?.category).toBe("context");
      expect(scaleQuestion?.options).toHaveLength(4);
    });

    it("should have review_depth question as optional", () => {
      const depthQuestion = blueprint.briefingConfig.questions.find(
        (q) => q.id === "review_depth",
      );
      expect(depthQuestion).toBeDefined();
      expect(depthQuestion?.type).toBe("single_choice");
      expect(depthQuestion?.required).toBe(false);
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
      expect(schema.required).toContain("systemName");
      expect(schema.required).toContain("reviewScope");
      expect(schema.required).toContain("methodology");
      expect(schema.required).toContain("reviewItems");
      expect(schema.required).toContain("strengths");
      expect(schema.required).toContain("risks");
      expect(schema.required).toContain("recommendations");
      expect(schema.required).toContain("dimensionScores");
      expect(schema.required).toContain("overallAssessment");
    });

    it("should have reviewItems schema with dimension enum", () => {
      const props = schema.properties as Record<string, JSONSchema7>;
      expect(props.reviewItems.type).toBe("array");
      const items = props.reviewItems.items as JSONSchema7;
      expect(items.properties).toHaveProperty("dimension");
      expect(items.properties).toHaveProperty("score");
      expect(items.properties).toHaveProperty("rationale");
      const dimensionProp = (items.properties as Record<string, JSONSchema7>)
        .dimension;
      expect(dimensionProp.enum).toContain("scalability");
      expect(dimensionProp.enum).toContain("reliability");
    });

    it("should have strengths schema with impact", () => {
      const props = schema.properties as Record<string, JSONSchema7>;
      expect(props.strengths.type).toBe("array");
      const items = props.strengths.items as JSONSchema7;
      expect(items.properties).toHaveProperty("relatedDimensions");
      expect(items.properties).toHaveProperty("impact");
    });

    it("should have risks schema with severity and probability", () => {
      const props = schema.properties as Record<string, JSONSchema7>;
      expect(props.risks.type).toBe("array");
      const items = props.risks.items as JSONSchema7;
      expect(items.properties).toHaveProperty("riskType");
      expect(items.properties).toHaveProperty("severity");
      expect(items.properties).toHaveProperty("probability");
    });

    it("should have recommendations schema with priority and complexity", () => {
      const props = schema.properties as Record<string, JSONSchema7>;
      expect(props.recommendations.type).toBe("array");
      const items = props.recommendations.items as JSONSchema7;
      expect(items.properties).toHaveProperty("priority");
      expect(items.properties).toHaveProperty("expectedBenefit");
      expect(items.properties).toHaveProperty("complexity");
    });

    it("should have overallAssessment schema with grade", () => {
      const props = schema.properties as Record<string, JSONSchema7>;
      expect(props.overallAssessment.type).toBe("object");
      const assessProps = props.overallAssessment.properties as Record<
        string,
        JSONSchema7
      >;
      expect(assessProps.grade.enum).toEqual(["A", "B", "C", "D", "F"]);
      expect(assessProps.recommendation.enum).toContain("strongly_recommend");
      expect(assessProps.recommendation.enum).toContain("not_recommend");
    });

    it("should have score constraints", () => {
      const props = schema.properties as Record<string, JSONSchema7>;
      const reviewItems = props.reviewItems.items as JSONSchema7;
      const scoreProp = (reviewItems.properties as Record<string, JSONSchema7>)
        .score;
      expect(scoreProp.minimum).toBe(1);
      expect(scoreProp.maximum).toBe(5);
    });
  });

  // ============================================================
  // Metadata via OrchestrationSkill Tests
  // ============================================================

  describe("Metadata via OrchestrationSkill", () => {
    it("should have correct skill metadata", () => {
      const metadata = blueprint.metadata;
      expect(metadata.id).toBe("geek-system_design_review");
      expect(metadata.name).toBe("系统架构评审官");
      expect(metadata.version).toBe("2.0.0");
      expect(metadata.category).toBe("learning");
    });

    it("should have correct capabilities", () => {
      const metadata = blueprint.metadata;
      expect(metadata.capabilities).toContain("generation");
      expect(metadata.capabilities).toContain("outline");
      expect(metadata.capabilities).toContain("structured-output");
    });
  });

  // ============================================================
  // Factory Function Tests
  // ============================================================

  describe("createSystemDesignReviewBlueprint", () => {
    it("should create a new instance", () => {
      const instance1 = createSystemDesignReviewBlueprint();
      const instance2 = createSystemDesignReviewBlueprint();
      expect(instance1).not.toBe(instance2);
    });

    it("should return SystemDesignReviewBlueprint instance", () => {
      const instance = createSystemDesignReviewBlueprint();
      expect(instance).toBeInstanceOf(SystemDesignReviewBlueprint);
    });
  });
});
