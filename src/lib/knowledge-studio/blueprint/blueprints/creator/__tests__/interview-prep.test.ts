/**
 * InterviewPrep Blueprint Tests (Story 5.3)
 * @module knowledge-studio/blueprint/blueprints/creator/__tests__
 */

import {
  InterviewPrepBlueprint,
  createInterviewPrepBlueprint,
} from "../interview-prep";
import type { JSONSchema7 } from "json-schema";

describe("InterviewPrepBlueprint", () => {
  let blueprint: InterviewPrepBlueprint;

  beforeEach(() => {
    blueprint = createInterviewPrepBlueprint();
  });

  // ============================================================
  // Metadata Tests
  // ============================================================

  describe("Metadata", () => {
    it("should have correct blueprintId", () => {
      expect(blueprint.blueprintId).toBe("creator-interview_prep");
    });

    it("should have correct displayName", () => {
      expect(blueprint.displayName).toBe("访谈准备官");
    });

    it("should have pro tier", () => {
      expect(blueprint.tier).toBe("pro");
    });

    it("should target podcasters and journalists", () => {
      expect(blueprint.targetUsers).toContain("content_creator");
      expect(blueprint.targetUsers).toContain("journalist");
      expect(blueprint.targetUsers).toContain("podcaster");
    });

    it("should have creator category", () => {
      expect(blueprint.category).toBe("creator");
    });

    it("should have priority 3", () => {
      expect(blueprint.priority).toBe(3);
    });

    it("should be marked as new", () => {
      expect(blueprint.isNew).toBe(true);
    });

    it("should have icon 🎙️", () => {
      expect(blueprint.icon).toBe("🎙️");
    });

    it("should have description", () => {
      expect(blueprint.description).toContain("访谈");
    });

    it("should have example prompts", () => {
      expect(blueprint.examplePrompts).toBeDefined();
      expect(blueprint.examplePrompts?.length).toBeGreaterThan(0);
    });

    it("should have tags", () => {
      expect(blueprint.tags).toContain("访谈");
      expect(blueprint.tags).toContain("播客");
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

    it("should have interview_purpose question as single_choice", () => {
      const purposeQ = blueprint.briefingConfig.questions.find(
        (q) => q.id === "interview_purpose",
      );
      expect(purposeQ).toBeDefined();
      expect(purposeQ?.type).toBe("single_choice");
      expect(purposeQ?.category).toBe("objective");
      expect(purposeQ?.options).toHaveLength(4);
      expect(purposeQ?.required).toBe(true);
    });

    it("should have target_audience question with 3 options", () => {
      const audienceQ = blueprint.briefingConfig.questions.find(
        (q) => q.id === "target_audience",
      );
      expect(audienceQ).toBeDefined();
      expect(audienceQ?.type).toBe("single_choice");
      expect(audienceQ?.category).toBe("audience");
      expect(audienceQ?.options).toHaveLength(3);
    });

    it("should have interview_depth question as optional", () => {
      const depthQ = blueprint.briefingConfig.questions.find(
        (q) => q.id === "interview_depth",
      );
      expect(depthQ).toBeDefined();
      expect(depthQ?.type).toBe("single_choice");
      expect(depthQ?.required).toBe(false);
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
      expect(schema.required).toContain("purpose");
      expect(schema.required).toContain("targetAudience");
      expect(schema.required).toContain("guestProfile");
      expect(schema.required).toContain("icebreakerQuestions");
      expect(schema.required).toContain("topicSections");
      expect(schema.required).toContain("closingQuestions");
      expect(schema.required).toContain("totalQuestions");
      expect(schema.required).toContain("estimatedDuration");
      expect(schema.required).toContain("style");
    });

    it("should have guestProfile schema", () => {
      const props = schema.properties as Record<string, JSONSchema7>;
      expect(props.guestProfile.type).toBe("object");
      const guestProps = props.guestProfile.properties as Record<
        string,
        JSONSchema7
      >;
      expect(guestProps).toHaveProperty("name");
      expect(guestProps).toHaveProperty("expertise");
      expect(guestProps).toHaveProperty("summary");
    });

    it("should have icebreakerQuestions with min/max constraints", () => {
      const props = schema.properties as Record<string, JSONSchema7>;
      expect(props.icebreakerQuestions.type).toBe("array");
      expect(props.icebreakerQuestions.minItems).toBe(2);
      expect(props.icebreakerQuestions.maxItems).toBe(3);
    });

    it("should have topicSections schema", () => {
      const props = schema.properties as Record<string, JSONSchema7>;
      expect(props.topicSections.type).toBe("array");
      expect(props.topicSections.minItems).toBe(1);
      const items = props.topicSections.items as JSONSchema7;
      expect(items.properties).toHaveProperty("id");
      expect(items.properties).toHaveProperty("name");
      expect(items.properties).toHaveProperty("questions");
      expect(items.properties).toHaveProperty("estimatedMinutes");
    });

    it("should have closingQuestions with min/max constraints", () => {
      const props = schema.properties as Record<string, JSONSchema7>;
      expect(props.closingQuestions.type).toBe("array");
      expect(props.closingQuestions.minItems).toBe(1);
      expect(props.closingQuestions.maxItems).toBe(2);
    });

    it("should have purpose enum", () => {
      const props = schema.properties as Record<string, JSONSchema7>;
      expect(props.purpose.enum).toContain("introduction");
      expect(props.purpose.enum).toContain("expertise");
      expect(props.purpose.enum).toContain("story");
      expect(props.purpose.enum).toContain("trending");
    });

    it("should have targetAudience enum", () => {
      const props = schema.properties as Record<string, JSONSchema7>;
      expect(props.targetAudience.enum).toContain("professional");
      expect(props.targetAudience.enum).toContain("enthusiast");
      expect(props.targetAudience.enum).toContain("general");
    });

    it("should have InterviewQuestion definition", () => {
      const definitions = schema.definitions as Record<string, JSONSchema7>;
      expect(definitions).toHaveProperty("InterviewQuestion");
      const questionDef = definitions.InterviewQuestion;
      expect(questionDef.properties).toHaveProperty("id");
      expect(questionDef.properties).toHaveProperty("question");
      expect(questionDef.properties).toHaveProperty("type");
      expect(questionDef.properties).toHaveProperty("depth");
    });

    it("should have question type enum in definition", () => {
      const definitions = schema.definitions as Record<string, JSONSchema7>;
      const questionDef = definitions.InterviewQuestion;
      const typeEnum = (questionDef.properties as Record<string, JSONSchema7>)
        .type.enum;
      expect(typeEnum).toContain("icebreaker");
      expect(typeEnum).toContain("core");
      expect(typeEnum).toContain("followup");
      expect(typeEnum).toContain("closing");
    });

    it("should have depth constraints in definition", () => {
      const definitions = schema.definitions as Record<string, JSONSchema7>;
      const questionDef = definitions.InterviewQuestion;
      const depthProp = (questionDef.properties as Record<string, JSONSchema7>)
        .depth;
      expect(depthProp.minimum).toBe(1);
      expect(depthProp.maximum).toBe(5);
    });
  });

  // ============================================================
  // Metadata via OrchestrationSkill Tests
  // ============================================================

  describe("Metadata via OrchestrationSkill", () => {
    it("should have correct skill metadata", () => {
      const metadata = blueprint.metadata;
      expect(metadata.id).toBe("creator-interview_prep");
      expect(metadata.name).toBe("访谈准备官");
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

  describe("createInterviewPrepBlueprint", () => {
    it("should create a new instance", () => {
      const instance1 = createInterviewPrepBlueprint();
      const instance2 = createInterviewPrepBlueprint();
      expect(instance1).not.toBe(instance2);
    });

    it("should return InterviewPrepBlueprint instance", () => {
      const instance = createInterviewPrepBlueprint();
      expect(instance).toBeInstanceOf(InterviewPrepBlueprint);
    });
  });
});
