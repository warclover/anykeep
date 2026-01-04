/**
 * PitchNarrative Blueprint Tests (Story 6.3)
 * @module knowledge-studio/blueprint/blueprints/business/__tests__
 */

import {
  PitchNarrativeBlueprint,
  createPitchNarrativeBlueprint,
} from "../pitch-narrative";
import type { JSONSchema7 } from "json-schema";

describe("PitchNarrativeBlueprint", () => {
  let blueprint: PitchNarrativeBlueprint;

  beforeEach(() => {
    blueprint = createPitchNarrativeBlueprint();
  });

  // ============================================================
  // Metadata Tests
  // ============================================================

  describe("Metadata", () => {
    it("should have correct blueprintId", () => {
      expect(blueprint.blueprintId).toBe("business-pitch_narrative");
    });

    it("should have correct displayName", () => {
      expect(blueprint.displayName).toBe("故事线专家");
    });

    it("should have pro tier", () => {
      expect(blueprint.tier).toBe("pro");
    });

    it("should target entrepreneurs and investors", () => {
      expect(blueprint.targetUsers).toContain("entrepreneur");
      expect(blueprint.targetUsers).toContain("investor");
      expect(blueprint.targetUsers).toContain("marketer");
    });

    it("should have business category", () => {
      expect(blueprint.category).toBe("business");
    });

    it("should have priority 3", () => {
      expect(blueprint.priority).toBe(3);
    });

    it("should be marked as new", () => {
      expect(blueprint.isNew).toBe(true);
    });

    it("should have icon 🎤", () => {
      expect(blueprint.icon).toBe("🎤");
    });

    it("should have description mentioning BP", () => {
      expect(blueprint.description).toContain("BP");
    });

    it("should have description mentioning versions", () => {
      expect(blueprint.description).toContain("10");
      expect(blueprint.description).toContain("5");
      expect(blueprint.description).toContain("3");
    });

    it("should have example prompts", () => {
      expect(blueprint.examplePrompts).toBeDefined();
      expect(blueprint.examplePrompts?.length).toBeGreaterThan(0);
    });

    it("should have tags", () => {
      expect(blueprint.tags).toContain("融资");
      expect(blueprint.tags).toContain("BP");
      expect(blueprint.tags).toContain("路演");
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

    it("should have funding_stage question as single_choice", () => {
      const fundingQ = blueprint.briefingConfig.questions.find(
        (q) => q.id === "funding_stage",
      );
      expect(fundingQ).toBeDefined();
      expect(fundingQ?.type).toBe("single_choice");
      expect(fundingQ?.category).toBe("context");
      expect(fundingQ?.options).toHaveLength(4);
      expect(fundingQ?.required).toBe(true);
    });

    it("should have investor_type question with 4 options", () => {
      const investorQ = blueprint.briefingConfig.questions.find(
        (q) => q.id === "investor_type",
      );
      expect(investorQ).toBeDefined();
      expect(investorQ?.type).toBe("single_choice");
      expect(investorQ?.category).toBe("context");
      expect(investorQ?.options).toHaveLength(4);
      expect(investorQ?.required).toBe(true);
    });

    it("should have pitch_duration question as optional", () => {
      const durationQ = blueprint.briefingConfig.questions.find(
        (q) => q.id === "pitch_duration",
      );
      expect(durationQ).toBeDefined();
      expect(durationQ?.type).toBe("single_choice");
      expect(durationQ?.category).toBe("constraint");
      expect(durationQ?.options).toHaveLength(3);
      expect(durationQ?.required).toBe(false);
    });

    it("should have proper default values", () => {
      const fundingQ = blueprint.briefingConfig.questions.find(
        (q) => q.id === "funding_stage",
      );
      const investorQ = blueprint.briefingConfig.questions.find(
        (q) => q.id === "investor_type",
      );
      const durationQ = blueprint.briefingConfig.questions.find(
        (q) => q.id === "pitch_duration",
      );

      expect(fundingQ?.defaultValue).toBe("seed");
      expect(investorQ?.defaultValue).toBe("vc");
      expect(durationQ?.defaultValue).toBe("5min");
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
      expect(schema.required).toContain("openingHook");
      expect(schema.required).toContain("versions");
      expect(schema.required).toContain("teamIntro");
      expect(schema.required).toContain("fundingAsk");
      expect(schema.required).toContain("closingCta");
    });

    it("should define openingHook object", () => {
      const props = schema.properties as Record<string, JSONSchema7>;
      expect(props.openingHook).toBeDefined();
      expect(props.openingHook.type).toBe("object");

      const hookProps = props.openingHook.properties as Record<
        string,
        JSONSchema7
      >;
      expect(hookProps.thirtySecond).toBeDefined();
      expect(hookProps.elevatorPitch).toBeDefined();
      expect(hookProps.hookPoints).toBeDefined();
    });

    it("should define versions array", () => {
      const props = schema.properties as Record<string, JSONSchema7>;
      expect(props.versions).toBeDefined();
      expect(props.versions.type).toBe("array");

      const versionItemSchema = props.versions.items as JSONSchema7;
      expect(versionItemSchema.type).toBe("object");

      const versionProps = versionItemSchema.properties as Record<
        string,
        JSONSchema7
      >;
      expect(versionProps.versionId).toBeDefined();
      expect(versionProps.name).toBeDefined();
      expect(versionProps.targetDuration).toBeDefined();
      expect(versionProps.sections).toBeDefined();
    });

    it("should define section schema within versions", () => {
      const props = schema.properties as Record<string, JSONSchema7>;
      const versionItemSchema = props.versions.items as JSONSchema7;
      const versionProps = versionItemSchema.properties as Record<
        string,
        JSONSchema7
      >;

      expect(versionProps.sections.type).toBe("array");
      const sectionSchema = versionProps.sections.items as JSONSchema7;
      const sectionProps = sectionSchema.properties as Record<
        string,
        JSONSchema7
      >;

      expect(sectionProps.id).toBeDefined();
      expect(sectionProps.title).toBeDefined();
      expect(sectionProps.script).toBeDefined();
      expect(sectionProps.suggestedDuration).toBeDefined();
      expect(sectionProps.keyPoints).toBeDefined();
    });

    it("should define teamIntro object", () => {
      const props = schema.properties as Record<string, JSONSchema7>;
      expect(props.teamIntro).toBeDefined();
      expect(props.teamIntro.type).toBe("object");

      const teamProps = props.teamIntro.properties as Record<
        string,
        JSONSchema7
      >;
      expect(teamProps.highlights).toBeDefined();
      expect(teamProps.coreMembers).toBeDefined();
      expect(teamProps.teamAdvantage).toBeDefined();
    });

    it("should define fundingAsk object", () => {
      const props = schema.properties as Record<string, JSONSchema7>;
      expect(props.fundingAsk).toBeDefined();
      expect(props.fundingAsk.type).toBe("object");

      const fundingProps = props.fundingAsk.properties as Record<
        string,
        JSONSchema7
      >;
      expect(fundingProps.amount).toBeDefined();
      expect(fundingProps.stage).toBeDefined();
      expect(fundingProps.useOfFunds).toBeDefined();
      expect(fundingProps.milestones).toBeDefined();
    });

    it("should define closingCta as string", () => {
      const props = schema.properties as Record<string, JSONSchema7>;
      expect(props.closingCta).toBeDefined();
      expect(props.closingCta.type).toBe("string");
    });

    it("should define fundingStage as string", () => {
      const props = schema.properties as Record<string, JSONSchema7>;
      expect(props.fundingStage).toBeDefined();
      expect(props.fundingStage.type).toBe("string");
    });

    it("should define targetInvestorType as string", () => {
      const props = schema.properties as Record<string, JSONSchema7>;
      expect(props.targetInvestorType).toBeDefined();
      expect(props.targetInvestorType.type).toBe("string");
    });
  });

  // ============================================================
  // Factory Function Tests
  // ============================================================

  describe("Factory Function", () => {
    it("should create valid blueprint instance", () => {
      const instance = createPitchNarrativeBlueprint();
      expect(instance).toBeInstanceOf(PitchNarrativeBlueprint);
    });

    it("should create new instance each call", () => {
      const instance1 = createPitchNarrativeBlueprint();
      const instance2 = createPitchNarrativeBlueprint();
      expect(instance1).not.toBe(instance2);
    });

    it("should have consistent blueprintId", () => {
      const instance = createPitchNarrativeBlueprint();
      expect(instance.blueprintId).toBe("business-pitch_narrative");
    });
  });

  // ============================================================
  // Funding Stage Option Tests
  // ============================================================

  describe("Funding Stage Options", () => {
    it("should have seed option", () => {
      const fundingQ = blueprint.briefingConfig.questions.find(
        (q) => q.id === "funding_stage",
      );
      const seedOpt = fundingQ?.options?.find((o) => o.value === "seed");
      expect(seedOpt).toBeDefined();
      expect(seedOpt?.label).toBe("种子轮");
    });

    it("should have Pre-A option", () => {
      const fundingQ = blueprint.briefingConfig.questions.find(
        (q) => q.id === "funding_stage",
      );
      const preAOpt = fundingQ?.options?.find((o) => o.value === "pre_a");
      expect(preAOpt).toBeDefined();
      expect(preAOpt?.label).toBe("Pre-A轮");
    });

    it("should have Series A option", () => {
      const fundingQ = blueprint.briefingConfig.questions.find(
        (q) => q.id === "funding_stage",
      );
      const seriesAOpt = fundingQ?.options?.find((o) => o.value === "series_a");
      expect(seriesAOpt).toBeDefined();
      expect(seriesAOpt?.label).toBe("A轮");
    });

    it("should have Series B+ option", () => {
      const fundingQ = blueprint.briefingConfig.questions.find(
        (q) => q.id === "funding_stage",
      );
      const seriesBOpt = fundingQ?.options?.find(
        (o) => o.value === "series_b_plus",
      );
      expect(seriesBOpt).toBeDefined();
      expect(seriesBOpt?.label).toBe("B轮及以后");
    });
  });

  // ============================================================
  // Investor Type Option Tests
  // ============================================================

  describe("Investor Type Options", () => {
    it("should have angel investor option", () => {
      const investorQ = blueprint.briefingConfig.questions.find(
        (q) => q.id === "investor_type",
      );
      const angelOpt = investorQ?.options?.find((o) => o.value === "angel");
      expect(angelOpt).toBeDefined();
      expect(angelOpt?.label).toBe("天使投资人");
    });

    it("should have VC option", () => {
      const investorQ = blueprint.briefingConfig.questions.find(
        (q) => q.id === "investor_type",
      );
      const vcOpt = investorQ?.options?.find((o) => o.value === "vc");
      expect(vcOpt).toBeDefined();
      expect(vcOpt?.label).toBe("风险投资");
    });

    it("should have CVC option", () => {
      const investorQ = blueprint.briefingConfig.questions.find(
        (q) => q.id === "investor_type",
      );
      const cvcOpt = investorQ?.options?.find((o) => o.value === "cvc");
      expect(cvcOpt).toBeDefined();
      expect(cvcOpt?.label).toBe("战略投资");
    });

    it("should have PE option", () => {
      const investorQ = blueprint.briefingConfig.questions.find(
        (q) => q.id === "investor_type",
      );
      const peOpt = investorQ?.options?.find((o) => o.value === "pe");
      expect(peOpt).toBeDefined();
      expect(peOpt?.label).toBe("私募股权");
    });
  });

  // ============================================================
  // Pitch Duration Option Tests
  // ============================================================

  describe("Pitch Duration Options", () => {
    it("should have 3 minute option", () => {
      const durationQ = blueprint.briefingConfig.questions.find(
        (q) => q.id === "pitch_duration",
      );
      const threeMinOpt = durationQ?.options?.find((o) => o.value === "3min");
      expect(threeMinOpt).toBeDefined();
      expect(threeMinOpt?.label).toBe("3分钟");
    });

    it("should have 5 minute option", () => {
      const durationQ = blueprint.briefingConfig.questions.find(
        (q) => q.id === "pitch_duration",
      );
      const fiveMinOpt = durationQ?.options?.find((o) => o.value === "5min");
      expect(fiveMinOpt).toBeDefined();
      expect(fiveMinOpt?.label).toBe("5分钟");
    });

    it("should have 10 minute option", () => {
      const durationQ = blueprint.briefingConfig.questions.find(
        (q) => q.id === "pitch_duration",
      );
      const tenMinOpt = durationQ?.options?.find((o) => o.value === "10min");
      expect(tenMinOpt).toBeDefined();
      expect(tenMinOpt?.label).toBe("10分钟");
    });

    it("should have descriptions for duration options", () => {
      const durationQ = blueprint.briefingConfig.questions.find(
        (q) => q.id === "pitch_duration",
      );

      const threeMinOpt = durationQ?.options?.find((o) => o.value === "3min");
      expect(threeMinOpt?.description).toContain("路演比赛");

      const fiveMinOpt = durationQ?.options?.find((o) => o.value === "5min");
      expect(fiveMinOpt?.description).toContain("初次见面");

      const tenMinOpt = durationQ?.options?.find((o) => o.value === "10min");
      expect(tenMinOpt?.description).toContain("正式路演");
    });
  });
});
