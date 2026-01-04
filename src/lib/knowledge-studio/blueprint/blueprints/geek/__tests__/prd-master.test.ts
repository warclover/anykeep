/**
 * PrdMaster Blueprint Tests (Story 4.3)
 * @module knowledge-studio/blueprint/blueprints/geek
 */

import { PrdMasterBlueprint, createPrdMasterBlueprint } from "../prd-master";
import type { JSONSchema7 } from "json-schema";

describe("PrdMasterBlueprint", () => {
  let blueprint: PrdMasterBlueprint;

  beforeEach(() => {
    blueprint = createPrdMasterBlueprint();
  });

  // ============================================================
  // Metadata Tests
  // ============================================================

  describe("Metadata", () => {
    it("should have correct blueprintId", () => {
      expect(blueprint.blueprintId).toBe("geek-prd_master");
    });

    it("should have correct displayName", () => {
      expect(blueprint.displayName).toBe("PRD大师");
    });

    it("should have pro tier", () => {
      expect(blueprint.tier).toBe("pro");
    });

    it("should target product_manager, developer, architect", () => {
      expect(blueprint.targetUsers).toContain("product_manager");
      expect(blueprint.targetUsers).toContain("developer");
      expect(blueprint.targetUsers).toContain("architect");
    });

    it("should have geek category", () => {
      expect(blueprint.category).toBe("geek");
    });

    it("should have priority 3", () => {
      expect(blueprint.priority).toBe(3);
    });

    it("should be marked as new", () => {
      expect(blueprint.isNew).toBe(true);
    });

    it("should have icon 📋", () => {
      expect(blueprint.icon).toBe("📋");
    });

    it("should have description", () => {
      expect(blueprint.description).toContain("PRD");
      expect(blueprint.description).toContain("用户故事");
    });

    it("should have example prompts", () => {
      expect(blueprint.examplePrompts).toBeDefined();
      expect(blueprint.examplePrompts?.length).toBeGreaterThan(0);
    });

    it("should have tags", () => {
      expect(blueprint.tags).toContain("PRD");
      expect(blueprint.tags).toContain("产品");
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

    it("should have product_stage question with 4 options", () => {
      const stageQuestion = blueprint.briefingConfig.questions.find(
        (q) => q.id === "product_stage",
      );
      expect(stageQuestion).toBeDefined();
      expect(stageQuestion?.type).toBe("single_choice");
      expect(stageQuestion?.category).toBe("context");
      expect(stageQuestion?.options).toHaveLength(4);
      expect(stageQuestion?.required).toBe(true);
    });

    it("should have prd_focus question as multi_choice", () => {
      const focusQuestion = blueprint.briefingConfig.questions.find(
        (q) => q.id === "prd_focus",
      );
      expect(focusQuestion).toBeDefined();
      expect(focusQuestion?.type).toBe("multi_choice");
      expect(focusQuestion?.category).toBe("objective");
      expect(focusQuestion?.options).toHaveLength(4);
    });

    it("should have detail_level question as optional", () => {
      const detailQuestion = blueprint.briefingConfig.questions.find(
        (q) => q.id === "detail_level",
      );
      expect(detailQuestion).toBeDefined();
      expect(detailQuestion?.type).toBe("single_choice");
      expect(detailQuestion?.required).toBe(false);
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
      expect(schema.required).toContain("productName");
      expect(schema.required).toContain("productVision");
      expect(schema.required).toContain("problemStatement");
      expect(schema.required).toContain("userPersonas");
      expect(schema.required).toContain("userStories");
      expect(schema.required).toContain("featureModules");
      expect(schema.required).toContain("milestones");
    });

    it("should have userPersonas schema", () => {
      const props = schema.properties as Record<string, JSONSchema7>;
      expect(props.userPersonas.type).toBe("array");
      const items = props.userPersonas.items as JSONSchema7;
      expect(items.properties).toHaveProperty("id");
      expect(items.properties).toHaveProperty("name");
      expect(items.properties).toHaveProperty("coreNeeds");
      expect(items.properties).toHaveProperty("painPoints");
    });

    it("should have userStories schema with acceptanceCriteria", () => {
      const props = schema.properties as Record<string, JSONSchema7>;
      expect(props.userStories.type).toBe("array");
      const items = props.userStories.items as JSONSchema7;
      expect(items.properties).toHaveProperty("asA");
      expect(items.properties).toHaveProperty("iWantTo");
      expect(items.properties).toHaveProperty("soThat");
      expect(items.properties).toHaveProperty("priority");
      expect(items.properties).toHaveProperty("acceptanceCriteria");
    });

    it("should have featureModules schema with nested features", () => {
      const props = schema.properties as Record<string, JSONSchema7>;
      expect(props.featureModules.type).toBe("array");
      const items = props.featureModules.items as JSONSchema7;
      expect(items.properties).toHaveProperty("id");
      expect(items.properties).toHaveProperty("name");
      expect(items.properties).toHaveProperty("features");
      expect(items.properties).toHaveProperty("priority");
    });

    it("should have milestones schema", () => {
      const props = schema.properties as Record<string, JSONSchema7>;
      expect(props.milestones.type).toBe("array");
      const items = props.milestones.items as JSONSchema7;
      expect(items.properties).toHaveProperty("id");
      expect(items.properties).toHaveProperty("name");
      expect(items.properties).toHaveProperty("moduleIds");
    });

    it("should have competitorAnalysis as optional", () => {
      expect(schema.required).not.toContain("competitorAnalysis");
    });

    it("should have priority enum values", () => {
      const props = schema.properties as Record<string, JSONSchema7>;
      const userStoryItems = props.userStories.items as JSONSchema7;
      const priorityProp = (
        userStoryItems.properties as Record<string, JSONSchema7>
      ).priority;
      expect(priorityProp.enum).toEqual(["must", "should", "could", "wont"]);
    });
  });

  // ============================================================
  // Metadata via OrchestrationSkill Tests
  // ============================================================

  describe("Metadata via OrchestrationSkill", () => {
    it("should have correct skill metadata", () => {
      const metadata = blueprint.metadata;
      expect(metadata.id).toBe("geek-prd_master");
      expect(metadata.name).toBe("PRD大师");
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

  describe("createPrdMasterBlueprint", () => {
    it("should create a new instance", () => {
      const instance1 = createPrdMasterBlueprint();
      const instance2 = createPrdMasterBlueprint();
      expect(instance1).not.toBe(instance2);
    });

    it("should return PrdMasterBlueprint instance", () => {
      const instance = createPrdMasterBlueprint();
      expect(instance).toBeInstanceOf(PrdMasterBlueprint);
    });
  });
});
