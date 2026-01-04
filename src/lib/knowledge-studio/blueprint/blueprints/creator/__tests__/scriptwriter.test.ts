/**
 * Scriptwriter Blueprint Tests (Story 5.1)
 * @module knowledge-studio/blueprint/blueprints/creator/__tests__
 */

import {
  ScriptwriterBlueprint,
  createScriptwriterBlueprint,
} from "../scriptwriter";
import type { JSONSchema7 } from "json-schema";

describe("ScriptwriterBlueprint", () => {
  let blueprint: ScriptwriterBlueprint;

  beforeEach(() => {
    blueprint = createScriptwriterBlueprint();
  });

  // ============================================================
  // Metadata Tests
  // ============================================================

  describe("Metadata", () => {
    it("should have correct blueprintId", () => {
      expect(blueprint.blueprintId).toBe("creator-scriptwriter");
    });

    it("should have correct displayName", () => {
      expect(blueprint.displayName).toBe("视频编剧");
    });

    it("should have pro tier", () => {
      expect(blueprint.tier).toBe("pro");
    });

    it("should target video creators", () => {
      expect(blueprint.targetUsers).toContain("video_creator");
      expect(blueprint.targetUsers).toContain("content_creator");
      expect(blueprint.targetUsers).toContain("marketer");
    });

    it("should have creator category", () => {
      expect(blueprint.category).toBe("creator");
    });

    it("should have priority 1", () => {
      expect(blueprint.priority).toBe(1);
    });

    it("should be marked as new", () => {
      expect(blueprint.isNew).toBe(true);
    });

    it("should have icon 🎬", () => {
      expect(blueprint.icon).toBe("🎬");
    });

    it("should have description", () => {
      expect(blueprint.description).toContain("分镜脚本");
    });

    it("should have example prompts", () => {
      expect(blueprint.examplePrompts).toBeDefined();
      expect(blueprint.examplePrompts?.length).toBeGreaterThan(0);
    });

    it("should have tags", () => {
      expect(blueprint.tags).toContain("视频");
      expect(blueprint.tags).toContain("脚本");
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

    it("should have video_type question as single_choice", () => {
      const videoTypeQ = blueprint.briefingConfig.questions.find(
        (q) => q.id === "video_type",
      );
      expect(videoTypeQ).toBeDefined();
      expect(videoTypeQ?.type).toBe("single_choice");
      expect(videoTypeQ?.category).toBe("context");
      expect(videoTypeQ?.options).toHaveLength(4);
      expect(videoTypeQ?.required).toBe(true);
    });

    it("should have target_duration question with 3 options", () => {
      const durationQ = blueprint.briefingConfig.questions.find(
        (q) => q.id === "target_duration",
      );
      expect(durationQ).toBeDefined();
      expect(durationQ?.type).toBe("single_choice");
      expect(durationQ?.category).toBe("constraint");
      expect(durationQ?.options).toHaveLength(3);
    });

    it("should have style question as optional", () => {
      const styleQ = blueprint.briefingConfig.questions.find(
        (q) => q.id === "style",
      );
      expect(styleQ).toBeDefined();
      expect(styleQ?.type).toBe("single_choice");
      expect(styleQ?.required).toBe(false);
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
      expect(schema.required).toContain("videoTitle");
      expect(schema.required).toContain("videoType");
      expect(schema.required).toContain("targetDuration");
      expect(schema.required).toContain("estimatedDuration");
      expect(schema.required).toContain("openingHook");
      expect(schema.required).toContain("sections");
      expect(schema.required).toContain("closingCta");
      expect(schema.required).toContain("style");
    });

    it("should have sections schema with shot structure", () => {
      const props = schema.properties as Record<string, JSONSchema7>;
      expect(props.sections.type).toBe("array");
      const items = props.sections.items as JSONSchema7;
      expect(items.properties).toHaveProperty("id");
      expect(items.properties).toHaveProperty("name");
      expect(items.properties).toHaveProperty("type");
      expect(items.properties).toHaveProperty("shots");
      expect(items.properties).toHaveProperty("totalDuration");
    });

    it("should have shot schema with required fields", () => {
      const props = schema.properties as Record<string, JSONSchema7>;
      const sectionItems = props.sections.items as JSONSchema7;
      const shotsProps = (
        sectionItems.properties as Record<string, JSONSchema7>
      ).shots;
      expect(shotsProps.type).toBe("array");
      const shotItems = shotsProps.items as JSONSchema7;
      expect(shotItems.required).toContain("shotNumber");
      expect(shotItems.required).toContain("timestamp");
      expect(shotItems.required).toContain("duration");
      expect(shotItems.required).toContain("visual");
      expect(shotItems.required).toContain("narration");
    });

    it("should have videoType enum", () => {
      const props = schema.properties as Record<string, JSONSchema7>;
      expect(props.videoType.enum).toContain("explainer");
      expect(props.videoType.enum).toContain("vlog");
      expect(props.videoType.enum).toContain("promotional");
      expect(props.videoType.enum).toContain("documentary");
    });

    it("should have section type enum", () => {
      const props = schema.properties as Record<string, JSONSchema7>;
      const sectionItems = props.sections.items as JSONSchema7;
      const typeEnum = (sectionItems.properties as Record<string, JSONSchema7>)
        .type.enum;
      expect(typeEnum).toContain("hook");
      expect(typeEnum).toContain("intro");
      expect(typeEnum).toContain("body");
      expect(typeEnum).toContain("conclusion");
      expect(typeEnum).toContain("cta");
    });
  });

  // ============================================================
  // Metadata via OrchestrationSkill Tests
  // ============================================================

  describe("Metadata via OrchestrationSkill", () => {
    it("should have correct skill metadata", () => {
      const metadata = blueprint.metadata;
      expect(metadata.id).toBe("creator-scriptwriter");
      expect(metadata.name).toBe("视频编剧");
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

  describe("createScriptwriterBlueprint", () => {
    it("should create a new instance", () => {
      const instance1 = createScriptwriterBlueprint();
      const instance2 = createScriptwriterBlueprint();
      expect(instance1).not.toBe(instance2);
    });

    it("should return ScriptwriterBlueprint instance", () => {
      const instance = createScriptwriterBlueprint();
      expect(instance).toBeInstanceOf(ScriptwriterBlueprint);
    });
  });
});
