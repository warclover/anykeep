/**
 * TutorialArchitect Blueprint Tests (Story 4.2)
 * @module knowledge-studio/blueprint/blueprints/geek
 */

import {
  TutorialArchitectBlueprint,
  createTutorialArchitectBlueprint,
} from "../tutorial-architect";
import type { JSONSchema7 } from "json-schema";

describe("TutorialArchitectBlueprint", () => {
  let blueprint: TutorialArchitectBlueprint;

  beforeEach(() => {
    blueprint = createTutorialArchitectBlueprint();
  });

  // ============================================================
  // Metadata Tests
  // ============================================================

  describe("Metadata", () => {
    it("should have correct blueprintId", () => {
      expect(blueprint.blueprintId).toBe("geek-tutorial_architect");
    });

    it("should have correct displayName", () => {
      expect(blueprint.displayName).toBe("技术教程架构师");
    });

    it("should have pro tier", () => {
      expect(blueprint.tier).toBe("pro");
    });

    it("should target tech_writer, developer, content_creator", () => {
      expect(blueprint.targetUsers).toContain("tech_writer");
      expect(blueprint.targetUsers).toContain("developer");
      expect(blueprint.targetUsers).toContain("content_creator");
    });

    it("should have geek category", () => {
      expect(blueprint.category).toBe("geek");
    });

    it("should have priority 2", () => {
      expect(blueprint.priority).toBe(2);
    });

    it("should be marked as new", () => {
      expect(blueprint.isNew).toBe(true);
    });

    it("should have icon 📖", () => {
      expect(blueprint.icon).toBe("📖");
    });

    it("should have description", () => {
      expect(blueprint.description).toContain("MDX");
      expect(blueprint.description).toContain("教程");
    });

    it("should have example prompts", () => {
      expect(blueprint.examplePrompts).toBeDefined();
      expect(blueprint.examplePrompts?.length).toBeGreaterThan(0);
    });

    it("should have tags", () => {
      expect(blueprint.tags).toContain("教程");
      expect(blueprint.tags).toContain("技术写作");
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

    it("should have audience_level question with 3 options", () => {
      const audienceQuestion = blueprint.briefingConfig.questions.find(
        (q) => q.id === "audience_level",
      );
      expect(audienceQuestion).toBeDefined();
      expect(audienceQuestion?.type).toBe("single_choice");
      expect(audienceQuestion?.category).toBe("audience");
      expect(audienceQuestion?.options).toHaveLength(3);
      expect(audienceQuestion?.required).toBe(true);
    });

    it("should have tutorial_goal question as multi_choice", () => {
      const goalQuestion = blueprint.briefingConfig.questions.find(
        (q) => q.id === "tutorial_goal",
      );
      expect(goalQuestion).toBeDefined();
      expect(goalQuestion?.type).toBe("multi_choice");
      expect(goalQuestion?.category).toBe("objective");
      expect(goalQuestion?.options).toHaveLength(4);
    });

    it("should have output_format question as optional", () => {
      const formatQuestion = blueprint.briefingConfig.questions.find(
        (q) => q.id === "output_format",
      );
      expect(formatQuestion).toBeDefined();
      expect(formatQuestion?.type).toBe("single_choice");
      expect(formatQuestion?.required).toBe(false);
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
      expect(schema.required).toContain("title");
      expect(schema.required).toContain("introduction");
      expect(schema.required).toContain("targetAudience");
      expect(schema.required).toContain("learningObjectives");
      expect(schema.required).toContain("prerequisites");
      expect(schema.required).toContain("steps");
      expect(schema.required).toContain("faq");
      expect(schema.required).toContain("advancedResources");
      expect(schema.required).toContain("summary");
      expect(schema.required).toContain("estimatedTotalMinutes");
      expect(schema.required).toContain("difficultyLevel");
    });

    it("should have learningObjectives schema", () => {
      const props = schema.properties as Record<string, JSONSchema7>;
      expect(props.learningObjectives.type).toBe("array");
      const items = props.learningObjectives.items as JSONSchema7;
      expect(items.properties).toHaveProperty("id");
      expect(items.properties).toHaveProperty("description");
      expect(items.properties).toHaveProperty("type");
      expect(items.properties).toHaveProperty("bloomLevel");
    });

    it("should have prerequisites schema", () => {
      const props = schema.properties as Record<string, JSONSchema7>;
      expect(props.prerequisites.type).toBe("array");
      const items = props.prerequisites.items as JSONSchema7;
      expect(items.properties).toHaveProperty("id");
      expect(items.properties).toHaveProperty("name");
      expect(items.properties).toHaveProperty("description");
      expect(items.properties).toHaveProperty("required");
    });

    it("should have steps schema with codeExample", () => {
      const props = schema.properties as Record<string, JSONSchema7>;
      expect(props.steps.type).toBe("array");
      const items = props.steps.items as JSONSchema7;
      expect(items.properties).toHaveProperty("id");
      expect(items.properties).toHaveProperty("stepNumber");
      expect(items.properties).toHaveProperty("title");
      expect(items.properties).toHaveProperty("content");
      expect(items.properties).toHaveProperty("codeExample");
    });

    it("should have faq schema", () => {
      const props = schema.properties as Record<string, JSONSchema7>;
      expect(props.faq.type).toBe("array");
      const items = props.faq.items as JSONSchema7;
      expect(items.properties).toHaveProperty("question");
      expect(items.properties).toHaveProperty("answer");
    });

    it("should have advancedResources schema", () => {
      const props = schema.properties as Record<string, JSONSchema7>;
      expect(props.advancedResources.type).toBe("array");
      const items = props.advancedResources.items as JSONSchema7;
      expect(items.properties).toHaveProperty("title");
      expect(items.properties).toHaveProperty("type");
      expect(items.properties).toHaveProperty("description");
    });

    it("should have difficultyLevel enum", () => {
      const props = schema.properties as Record<string, JSONSchema7>;
      expect(props.difficultyLevel.enum).toEqual([
        "beginner",
        "intermediate",
        "advanced",
      ]);
    });
  });

  // ============================================================
  // Metadata via OrchestrationSkill Tests
  // ============================================================

  describe("Metadata via OrchestrationSkill", () => {
    it("should have correct skill metadata", () => {
      const metadata = blueprint.metadata;
      expect(metadata.id).toBe("geek-tutorial_architect");
      expect(metadata.name).toBe("技术教程架构师");
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

  describe("createTutorialArchitectBlueprint", () => {
    it("should create a new instance", () => {
      const instance1 = createTutorialArchitectBlueprint();
      const instance2 = createTutorialArchitectBlueprint();
      expect(instance1).not.toBe(instance2);
    });

    it("should return TutorialArchitectBlueprint instance", () => {
      const instance = createTutorialArchitectBlueprint();
      expect(instance).toBeInstanceOf(TutorialArchitectBlueprint);
    });
  });
});
