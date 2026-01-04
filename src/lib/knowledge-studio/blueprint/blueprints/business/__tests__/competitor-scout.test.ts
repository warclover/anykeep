/**
 * CompetitorScout Blueprint Tests (Story 6.1)
 * @module knowledge-studio/blueprint/blueprints/business/__tests__
 */

import {
  CompetitorScoutBlueprint,
  createCompetitorScoutBlueprint,
} from "../competitor-scout";
import type { JSONSchema7 } from "json-schema";

describe("CompetitorScoutBlueprint", () => {
  let blueprint: CompetitorScoutBlueprint;

  beforeEach(() => {
    blueprint = createCompetitorScoutBlueprint();
  });

  // ============================================================
  // Metadata Tests
  // ============================================================

  describe("Metadata", () => {
    it("should have correct blueprintId", () => {
      expect(blueprint.blueprintId).toBe("business-competitor_scout");
    });

    it("should have correct displayName", () => {
      expect(blueprint.displayName).toBe("竞品侦察兵");
    });

    it("should have pro tier", () => {
      expect(blueprint.tier).toBe("pro");
    });

    it("should target product managers and marketers", () => {
      expect(blueprint.targetUsers).toContain("product_manager");
      expect(blueprint.targetUsers).toContain("marketer");
      expect(blueprint.targetUsers).toContain("entrepreneur");
    });

    it("should have business category", () => {
      expect(blueprint.category).toBe("business");
    });

    it("should have priority 1", () => {
      expect(blueprint.priority).toBe(1);
    });

    it("should be marked as new", () => {
      expect(blueprint.isNew).toBe(true);
    });

    it("should have icon 🔍", () => {
      expect(blueprint.icon).toBe("🔍");
    });

    it("should have description", () => {
      expect(blueprint.description).toContain("SWOT");
    });

    it("should have example prompts", () => {
      expect(blueprint.examplePrompts).toBeDefined();
      expect(blueprint.examplePrompts?.length).toBeGreaterThan(0);
    });

    it("should have tags", () => {
      expect(blueprint.tags).toContain("竞品分析");
      expect(blueprint.tags).toContain("SWOT");
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

    it("should have analysis_dimension question as multi_choice", () => {
      const dimQ = blueprint.briefingConfig.questions.find(
        (q) => q.id === "analysis_dimension",
      );
      expect(dimQ).toBeDefined();
      expect(dimQ?.type).toBe("multi_choice");
      expect(dimQ?.category).toBe("objective");
      expect(dimQ?.options).toHaveLength(4);
      expect(dimQ?.required).toBe(true);
    });

    it("should have target_market question with 3 options", () => {
      const marketQ = blueprint.briefingConfig.questions.find(
        (q) => q.id === "target_market",
      );
      expect(marketQ).toBeDefined();
      expect(marketQ?.type).toBe("single_choice");
      expect(marketQ?.category).toBe("context");
      expect(marketQ?.options).toHaveLength(3);
    });

    it("should have competitor_count question as optional", () => {
      const countQ = blueprint.briefingConfig.questions.find(
        (q) => q.id === "competitor_count",
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
      expect(schema.required).toContain("analysisScope");
      expect(schema.required).toContain("targetMarket");
      expect(schema.required).toContain("competitors");
      expect(schema.required).toContain("swotAnalysis");
      expect(schema.required).toContain("featureMatrix");
      expect(schema.required).toContain("differentiationOpportunities");
      expect(schema.required).toContain("strategicRecommendations");
      expect(schema.required).toContain("summary");
      expect(schema.required).toContain("analysisDimensions");
    });

    it("should have targetMarket enum", () => {
      const props = schema.properties as Record<string, JSONSchema7>;
      expect(props.targetMarket.enum).toContain("b2b");
      expect(props.targetMarket.enum).toContain("b2c");
      expect(props.targetMarket.enum).toContain("b2b2c");
    });

    it("should have competitors schema with constraints", () => {
      const props = schema.properties as Record<string, JSONSchema7>;
      expect(props.competitors.type).toBe("array");
      expect(props.competitors.minItems).toBe(1);
      expect(props.competitors.maxItems).toBe(5);
    });

    it("should have swotAnalysis with all four quadrants", () => {
      const props = schema.properties as Record<string, JSONSchema7>;
      expect(props.swotAnalysis.type).toBe("object");
      const swotProps = props.swotAnalysis.properties as Record<
        string,
        JSONSchema7
      >;
      expect(swotProps).toHaveProperty("strengths");
      expect(swotProps).toHaveProperty("weaknesses");
      expect(swotProps).toHaveProperty("opportunities");
      expect(swotProps).toHaveProperty("threats");
    });

    it("should have swotAnalysis required fields", () => {
      const props = schema.properties as Record<string, JSONSchema7>;
      expect(props.swotAnalysis.required).toContain("strengths");
      expect(props.swotAnalysis.required).toContain("weaknesses");
      expect(props.swotAnalysis.required).toContain("opportunities");
      expect(props.swotAnalysis.required).toContain("threats");
    });

    it("should have featureMatrix schema", () => {
      const props = schema.properties as Record<string, JSONSchema7>;
      expect(props.featureMatrix.type).toBe("array");
      const items = props.featureMatrix.items as JSONSchema7;
      expect(items.properties).toHaveProperty("feature");
      expect(items.properties).toHaveProperty("category");
      expect(items.properties).toHaveProperty("support");
    });

    it("should have support enum in featureMatrix", () => {
      const props = schema.properties as Record<string, JSONSchema7>;
      const items = props.featureMatrix.items as JSONSchema7;
      const supportProp = (items.properties as Record<string, JSONSchema7>)
        .support;
      expect(supportProp.additionalProperties).toBeDefined();
    });

    it("should have differentiationOpportunities schema", () => {
      const props = schema.properties as Record<string, JSONSchema7>;
      expect(props.differentiationOpportunities.type).toBe("array");
      const items = props.differentiationOpportunities.items as JSONSchema7;
      expect(items.required).toContain("id");
      expect(items.required).toContain("description");
      expect(items.required).toContain("priority");
      expect(items.required).toContain("difficulty");
    });

    it("should have difficulty enum in opportunities", () => {
      const props = schema.properties as Record<string, JSONSchema7>;
      const items = props.differentiationOpportunities.items as JSONSchema7;
      const diffProp = (items.properties as Record<string, JSONSchema7>)
        .difficulty;
      expect(diffProp.enum).toContain("low");
      expect(diffProp.enum).toContain("medium");
      expect(diffProp.enum).toContain("high");
    });

    it("should have strategicRecommendations schema", () => {
      const props = schema.properties as Record<string, JSONSchema7>;
      expect(props.strategicRecommendations.type).toBe("array");
      const items = props.strategicRecommendations.items as JSONSchema7;
      expect(items.required).toContain("id");
      expect(items.required).toContain("type");
      expect(items.required).toContain("recommendation");
      expect(items.required).toContain("rationale");
      expect(items.required).toContain("timeframe");
    });

    it("should have recommendation type enum", () => {
      const props = schema.properties as Record<string, JSONSchema7>;
      const items = props.strategicRecommendations.items as JSONSchema7;
      const typeProp = (items.properties as Record<string, JSONSchema7>).type;
      expect(typeProp.enum).toContain("product");
      expect(typeProp.enum).toContain("marketing");
      expect(typeProp.enum).toContain("pricing");
      expect(typeProp.enum).toContain("positioning");
    });

    it("should have timeframe enum", () => {
      const props = schema.properties as Record<string, JSONSchema7>;
      const items = props.strategicRecommendations.items as JSONSchema7;
      const tfProp = (items.properties as Record<string, JSONSchema7>)
        .timeframe;
      expect(tfProp.enum).toContain("short-term");
      expect(tfProp.enum).toContain("medium-term");
      expect(tfProp.enum).toContain("long-term");
    });
  });

  // ============================================================
  // Metadata via OrchestrationSkill Tests
  // ============================================================

  describe("Metadata via OrchestrationSkill", () => {
    it("should have correct skill metadata", () => {
      const metadata = blueprint.metadata;
      expect(metadata.id).toBe("business-competitor_scout");
      expect(metadata.name).toBe("竞品侦察兵");
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

  describe("createCompetitorScoutBlueprint", () => {
    it("should create a new instance", () => {
      const instance1 = createCompetitorScoutBlueprint();
      const instance2 = createCompetitorScoutBlueprint();
      expect(instance1).not.toBe(instance2);
    });

    it("should return CompetitorScoutBlueprint instance", () => {
      const instance = createCompetitorScoutBlueprint();
      expect(instance).toBeInstanceOf(CompetitorScoutBlueprint);
    });
  });
});
