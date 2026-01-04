/**
 * Newsletter Blueprint Tests (Story 5.2)
 * @module knowledge-studio/blueprint/blueprints/creator/__tests__
 */

import { NewsletterBlueprint, createNewsletterBlueprint } from "../newsletter";
import type { JSONSchema7 } from "json-schema";

describe("NewsletterBlueprint", () => {
  let blueprint: NewsletterBlueprint;

  beforeEach(() => {
    blueprint = createNewsletterBlueprint();
  });

  // ============================================================
  // Metadata Tests
  // ============================================================

  describe("Metadata", () => {
    it("should have correct blueprintId", () => {
      expect(blueprint.blueprintId).toBe("creator-newsletter");
    });

    it("should have correct displayName", () => {
      expect(blueprint.displayName).toBe("周刊策展人");
    });

    it("should have pro tier", () => {
      expect(blueprint.tier).toBe("pro");
    });

    it("should target content creators", () => {
      expect(blueprint.targetUsers).toContain("content_creator");
      expect(blueprint.targetUsers).toContain("marketer");
      expect(blueprint.targetUsers).toContain("writer");
    });

    it("should have creator category", () => {
      expect(blueprint.category).toBe("creator");
    });

    it("should have priority 2", () => {
      expect(blueprint.priority).toBe(2);
    });

    it("should be marked as new", () => {
      expect(blueprint.isNew).toBe(true);
    });

    it("should have icon 📰", () => {
      expect(blueprint.icon).toBe("📰");
    });

    it("should have description", () => {
      expect(blueprint.description).toContain("周刊");
    });

    it("should have example prompts", () => {
      expect(blueprint.examplePrompts).toBeDefined();
      expect(blueprint.examplePrompts?.length).toBeGreaterThan(0);
    });

    it("should have tags", () => {
      expect(blueprint.tags).toContain("周刊");
      expect(blueprint.tags).toContain("Newsletter");
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

    it("should have newsletter_style question as single_choice", () => {
      const styleQ = blueprint.briefingConfig.questions.find(
        (q) => q.id === "newsletter_style",
      );
      expect(styleQ).toBeDefined();
      expect(styleQ?.type).toBe("single_choice");
      expect(styleQ?.category).toBe("tone");
      expect(styleQ?.options).toHaveLength(4);
      expect(styleQ?.required).toBe(true);
    });

    it("should have target_audience question with 4 options", () => {
      const audienceQ = blueprint.briefingConfig.questions.find(
        (q) => q.id === "target_audience",
      );
      expect(audienceQ).toBeDefined();
      expect(audienceQ?.type).toBe("single_choice");
      expect(audienceQ?.category).toBe("audience");
      expect(audienceQ?.options).toHaveLength(4);
    });

    it("should have content_count question as optional", () => {
      const countQ = blueprint.briefingConfig.questions.find(
        (q) => q.id === "content_count",
      );
      expect(countQ).toBeDefined();
      expect(countQ?.type).toBe("single_choice");
      expect(countQ?.required).toBe(false);
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
      expect(schema.required).toContain("theme");
      expect(schema.required).toContain("themeSummary");
      expect(schema.required).toContain("curatedItems");
      expect(schema.required).toContain("extendedReadings");
      expect(schema.required).toContain("editorNote");
      expect(schema.required).toContain("style");
      expect(schema.required).toContain("targetAudience");
    });

    it("should have curatedItems schema with proper structure", () => {
      const props = schema.properties as Record<string, JSONSchema7>;
      expect(props.curatedItems.type).toBe("array");
      const items = props.curatedItems.items as JSONSchema7;
      expect(items.properties).toHaveProperty("id");
      expect(items.properties).toHaveProperty("title");
      expect(items.properties).toHaveProperty("source");
      expect(items.properties).toHaveProperty("summary");
      expect(items.properties).toHaveProperty("editorNote");
    });

    it("should have curatedItems minItems constraint", () => {
      const props = schema.properties as Record<string, JSONSchema7>;
      expect(props.curatedItems.minItems).toBe(1);
    });

    it("should have extendedReadings schema", () => {
      const props = schema.properties as Record<string, JSONSchema7>;
      expect(props.extendedReadings.type).toBe("array");
      const items = props.extendedReadings.items as JSONSchema7;
      expect(items.required).toContain("title");
      expect(items.required).toContain("url");
      expect(items.required).toContain("description");
    });

    it("should have style enum", () => {
      const props = schema.properties as Record<string, JSONSchema7>;
      expect(props.style.enum).toContain("professional");
      expect(props.style.enum).toContain("casual");
      expect(props.style.enum).toContain("curated");
      expect(props.style.enum).toContain("analytical");
    });

    it("should have targetAudience enum", () => {
      const props = schema.properties as Record<string, JSONSchema7>;
      expect(props.targetAudience.enum).toContain("developers");
      expect(props.targetAudience.enum).toContain("designers");
      expect(props.targetAudience.enum).toContain("managers");
      expect(props.targetAudience.enum).toContain("general");
    });

    it("should have rating constraints in curatedItems", () => {
      const props = schema.properties as Record<string, JSONSchema7>;
      const curatedItems = props.curatedItems.items as JSONSchema7;
      const ratingProp = (
        curatedItems.properties as Record<string, JSONSchema7>
      ).rating;
      expect(ratingProp.minimum).toBe(1);
      expect(ratingProp.maximum).toBe(5);
    });
  });

  // ============================================================
  // Metadata via OrchestrationSkill Tests
  // ============================================================

  describe("Metadata via OrchestrationSkill", () => {
    it("should have correct skill metadata", () => {
      const metadata = blueprint.metadata;
      expect(metadata.id).toBe("creator-newsletter");
      expect(metadata.name).toBe("周刊策展人");
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

  describe("createNewsletterBlueprint", () => {
    it("should create a new instance", () => {
      const instance1 = createNewsletterBlueprint();
      const instance2 = createNewsletterBlueprint();
      expect(instance1).not.toBe(instance2);
    });

    it("should return NewsletterBlueprint instance", () => {
      const instance = createNewsletterBlueprint();
      expect(instance).toBeInstanceOf(NewsletterBlueprint);
    });
  });
});
