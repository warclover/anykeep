/**
 * DueDiligence Blueprint Tests (Story 6.2)
 * @module knowledge-studio/blueprint/blueprints/business/__tests__
 */

import {
  DueDiligenceBlueprint,
  createDueDiligenceBlueprint,
} from "../due-diligence";
import type { JSONSchema7 } from "json-schema";

describe("DueDiligenceBlueprint", () => {
  let blueprint: DueDiligenceBlueprint;

  beforeEach(() => {
    blueprint = createDueDiligenceBlueprint();
  });

  // ============================================================
  // Metadata Tests
  // ============================================================

  describe("Metadata", () => {
    it("should have correct blueprintId", () => {
      expect(blueprint.blueprintId).toBe("business-due_diligence");
    });

    it("should have correct displayName", () => {
      expect(blueprint.displayName).toBe("尽调专家");
    });

    it("should have enterprise tier", () => {
      expect(blueprint.tier).toBe("enterprise");
    });

    it("should target investors and analysts", () => {
      expect(blueprint.targetUsers).toContain("investor");
      expect(blueprint.targetUsers).toContain("analyst");
      expect(blueprint.targetUsers).toContain("entrepreneur");
    });

    it("should have business category", () => {
      expect(blueprint.category).toBe("business");
    });

    it("should have priority 2", () => {
      expect(blueprint.priority).toBe(2);
    });

    it("should be marked as new", () => {
      expect(blueprint.isNew).toBe(true);
    });

    it("should have icon 📋", () => {
      expect(blueprint.icon).toBe("📋");
    });

    it("should have description mentioning risk", () => {
      expect(blueprint.description).toContain("风险");
    });

    it("should have example prompts", () => {
      expect(blueprint.examplePrompts).toBeDefined();
      expect(blueprint.examplePrompts?.length).toBeGreaterThan(0);
    });

    it("should have tags", () => {
      expect(blueprint.tags).toContain("尽调");
      expect(blueprint.tags).toContain("风险评估");
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

    it("should have investment_type question as single_choice", () => {
      const investQ = blueprint.briefingConfig.questions.find(
        (q) => q.id === "investment_type",
      );
      expect(investQ).toBeDefined();
      expect(investQ?.type).toBe("single_choice");
      expect(investQ?.category).toBe("context");
      expect(investQ?.options).toHaveLength(4);
      expect(investQ?.required).toBe(true);
    });

    it("should have risk_preference question with 3 options", () => {
      const riskQ = blueprint.briefingConfig.questions.find(
        (q) => q.id === "risk_preference",
      );
      expect(riskQ).toBeDefined();
      expect(riskQ?.type).toBe("single_choice");
      expect(riskQ?.category).toBe("constraint");
      expect(riskQ?.options).toHaveLength(3);
      expect(riskQ?.required).toBe(true);
    });

    it("should have focus_area question as multi_choice", () => {
      const focusQ = blueprint.briefingConfig.questions.find(
        (q) => q.id === "focus_area",
      );
      expect(focusQ).toBeDefined();
      expect(focusQ?.type).toBe("multi_choice");
      expect(focusQ?.category).toBe("objective");
      expect(focusQ?.options).toHaveLength(4);
      expect(focusQ?.required).toBe(false);
    });

    it("should have proper default values", () => {
      const investQ = blueprint.briefingConfig.questions.find(
        (q) => q.id === "investment_type",
      );
      const riskQ = blueprint.briefingConfig.questions.find(
        (q) => q.id === "risk_preference",
      );
      const focusQ = blueprint.briefingConfig.questions.find(
        (q) => q.id === "focus_area",
      );

      expect(investQ?.defaultValue).toBe("equity");
      expect(riskQ?.defaultValue).toBe("moderate");
      expect(focusQ?.defaultValue).toContain("financial");
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
      expect(schema.required).toContain("companyOverview");
      expect(schema.required).toContain("financialHealth");
      expect(schema.required).toContain("risks");
      expect(schema.required).toContain("overallRiskRating");
      expect(schema.required).toContain("investmentRecommendation");
    });

    it("should define companyOverview object", () => {
      const props = schema.properties as Record<string, JSONSchema7>;
      expect(props.companyOverview).toBeDefined();
      expect(props.companyOverview.type).toBe("object");

      const overviewProps = props.companyOverview.properties as Record<
        string,
        JSONSchema7
      >;
      expect(overviewProps.name).toBeDefined();
      expect(overviewProps.industry).toBeDefined();
      expect(overviewProps.mainBusiness).toBeDefined();
    });

    it("should define financialHealth object", () => {
      const props = schema.properties as Record<string, JSONSchema7>;
      expect(props.financialHealth).toBeDefined();
      expect(props.financialHealth.type).toBe("object");

      const healthProps = props.financialHealth.properties as Record<
        string,
        JSONSchema7
      >;
      expect(healthProps.revenue).toBeDefined();
      expect(healthProps.profitability).toBeDefined();
      expect(healthProps.cashFlow).toBeDefined();
      expect(healthProps.debtLevel).toBeDefined();
      expect(healthProps.trend).toBeDefined();
    });

    it("should define risks array with valid categories", () => {
      const props = schema.properties as Record<string, JSONSchema7>;
      expect(props.risks).toBeDefined();
      expect(props.risks.type).toBe("array");

      const itemSchema = props.risks.items as JSONSchema7;
      expect(itemSchema.type).toBe("object");

      const riskProps = itemSchema.properties as Record<string, JSONSchema7>;
      expect(riskProps.category.enum).toContain("financial");
      expect(riskProps.category.enum).toContain("operational");
      expect(riskProps.category.enum).toContain("legal");
      expect(riskProps.category.enum).toContain("market");
      expect(riskProps.category.enum).toContain("management");
      expect(riskProps.category.enum).toContain("technology");
    });

    it("should define opportunities array", () => {
      const props = schema.properties as Record<string, JSONSchema7>;
      expect(props.opportunities).toBeDefined();
      expect(props.opportunities.type).toBe("array");
    });

    it("should define verificationItems array", () => {
      const props = schema.properties as Record<string, JSONSchema7>;
      expect(props.verificationItems).toBeDefined();
      expect(props.verificationItems.type).toBe("array");
    });

    it("should define overallRiskRating enum", () => {
      const props = schema.properties as Record<string, JSONSchema7>;
      expect(props.overallRiskRating).toBeDefined();
      expect(props.overallRiskRating.enum).toContain("low");
      expect(props.overallRiskRating.enum).toContain("medium");
      expect(props.overallRiskRating.enum).toContain("high");
      expect(props.overallRiskRating.enum).toContain("very_high");
    });

    it("should define investmentRecommendation enum", () => {
      const props = schema.properties as Record<string, JSONSchema7>;
      expect(props.investmentRecommendation).toBeDefined();
      expect(props.investmentRecommendation.enum).toContain("proceed");
      expect(props.investmentRecommendation.enum).toContain(
        "proceed_with_caution",
      );
      expect(props.investmentRecommendation.enum).toContain("further_review");
      expect(props.investmentRecommendation.enum).toContain("pass");
    });

    it("should define redFlagCount as number", () => {
      const props = schema.properties as Record<string, JSONSchema7>;
      expect(props.redFlagCount).toBeDefined();
      expect(props.redFlagCount.type).toBe("number");
    });

    it("should define executiveSummary as string", () => {
      const props = schema.properties as Record<string, JSONSchema7>;
      expect(props.executiveSummary).toBeDefined();
      expect(props.executiveSummary.type).toBe("string");
    });
  });

  // ============================================================
  // Factory Function Tests
  // ============================================================

  describe("Factory Function", () => {
    it("should create valid blueprint instance", () => {
      const instance = createDueDiligenceBlueprint();
      expect(instance).toBeInstanceOf(DueDiligenceBlueprint);
    });

    it("should create new instance each call", () => {
      const instance1 = createDueDiligenceBlueprint();
      const instance2 = createDueDiligenceBlueprint();
      expect(instance1).not.toBe(instance2);
    });

    it("should have consistent blueprintId", () => {
      const instance = createDueDiligenceBlueprint();
      expect(instance.blueprintId).toBe("business-due_diligence");
    });
  });

  // ============================================================
  // Investment Type Option Tests
  // ============================================================

  describe("Investment Type Options", () => {
    it("should have equity option", () => {
      const investQ = blueprint.briefingConfig.questions.find(
        (q) => q.id === "investment_type",
      );
      const equityOpt = investQ?.options?.find((o) => o.value === "equity");
      expect(equityOpt).toBeDefined();
      expect(equityOpt?.label).toBe("股权投资");
    });

    it("should have M&A option", () => {
      const investQ = blueprint.briefingConfig.questions.find(
        (q) => q.id === "investment_type",
      );
      const maOpt = investQ?.options?.find((o) => o.value === "ma");
      expect(maOpt).toBeDefined();
      expect(maOpt?.label).toBe("并购收购");
    });

    it("should have public market option", () => {
      const investQ = blueprint.briefingConfig.questions.find(
        (q) => q.id === "investment_type",
      );
      const publicOpt = investQ?.options?.find((o) => o.value === "public");
      expect(publicOpt).toBeDefined();
      expect(publicOpt?.label).toBe("二级市场");
    });

    it("should have debt option", () => {
      const investQ = blueprint.briefingConfig.questions.find(
        (q) => q.id === "investment_type",
      );
      const debtOpt = investQ?.options?.find((o) => o.value === "debt");
      expect(debtOpt).toBeDefined();
      expect(debtOpt?.label).toBe("债权投资");
    });
  });

  // ============================================================
  // Risk Preference Option Tests
  // ============================================================

  describe("Risk Preference Options", () => {
    it("should have conservative option", () => {
      const riskQ = blueprint.briefingConfig.questions.find(
        (q) => q.id === "risk_preference",
      );
      const conservOpt = riskQ?.options?.find(
        (o) => o.value === "conservative",
      );
      expect(conservOpt).toBeDefined();
      expect(conservOpt?.label).toBe("保守型");
    });

    it("should have moderate option", () => {
      const riskQ = blueprint.briefingConfig.questions.find(
        (q) => q.id === "risk_preference",
      );
      const modOpt = riskQ?.options?.find((o) => o.value === "moderate");
      expect(modOpt).toBeDefined();
      expect(modOpt?.label).toBe("稳健型");
    });

    it("should have aggressive option", () => {
      const riskQ = blueprint.briefingConfig.questions.find(
        (q) => q.id === "risk_preference",
      );
      const aggrOpt = riskQ?.options?.find((o) => o.value === "aggressive");
      expect(aggrOpt).toBeDefined();
      expect(aggrOpt?.label).toBe("激进型");
    });
  });

  // ============================================================
  // Focus Area Option Tests
  // ============================================================

  describe("Focus Area Options", () => {
    it("should have financial focus option", () => {
      const focusQ = blueprint.briefingConfig.questions.find(
        (q) => q.id === "focus_area",
      );
      const finOpt = focusQ?.options?.find((o) => o.value === "financial");
      expect(finOpt).toBeDefined();
      expect(finOpt?.label).toBe("财务状况");
    });

    it("should have legal focus option", () => {
      const focusQ = blueprint.briefingConfig.questions.find(
        (q) => q.id === "focus_area",
      );
      const legalOpt = focusQ?.options?.find((o) => o.value === "legal");
      expect(legalOpt).toBeDefined();
      expect(legalOpt?.label).toBe("法律合规");
    });

    it("should have operational focus option", () => {
      const focusQ = blueprint.briefingConfig.questions.find(
        (q) => q.id === "focus_area",
      );
      const opOpt = focusQ?.options?.find((o) => o.value === "operational");
      expect(opOpt).toBeDefined();
      expect(opOpt?.label).toBe("运营能力");
    });

    it("should have market focus option", () => {
      const focusQ = blueprint.briefingConfig.questions.find(
        (q) => q.id === "focus_area",
      );
      const mktOpt = focusQ?.options?.find((o) => o.value === "market");
      expect(mktOpt).toBeDefined();
      expect(mktOpt?.label).toBe("市场竞争");
    });
  });
});
