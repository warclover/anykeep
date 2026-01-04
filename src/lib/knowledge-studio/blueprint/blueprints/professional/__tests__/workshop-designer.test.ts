/**
 * WorkshopDesigner Blueprint Tests (Story 7.4)
 * @module knowledge-studio/blueprint/blueprints/professional/__tests__
 */

import {
  WorkshopDesignerBlueprint,
  createWorkshopDesignerBlueprint,
} from "../workshop-designer";
import type { JSONSchema7 } from "json-schema";

describe("WorkshopDesignerBlueprint", () => {
  let blueprint: WorkshopDesignerBlueprint;

  beforeEach(() => {
    blueprint = createWorkshopDesignerBlueprint();
  });

  // ============================================================
  // Metadata Tests
  // ============================================================

  describe("Metadata", () => {
    it("should have correct blueprintId", () => {
      expect(blueprint.blueprintId).toBe("professional-workshop_designer");
    });

    it("should have correct displayName", () => {
      expect(blueprint.displayName).toBe("课程设计师");
    });

    it("should have pro tier", () => {
      expect(blueprint.tier).toBe("pro");
    });

    it("should target trainers and educators", () => {
      expect(blueprint.targetUsers).toContain("trainer");
      expect(blueprint.targetUsers).toContain("educator");
      expect(blueprint.targetUsers).toContain("facilitator");
    });

    it("should have professional category", () => {
      expect(blueprint.category).toBe("professional");
    });

    it("should have priority 4", () => {
      expect(blueprint.priority).toBe(4);
    });

    it("should be marked as new", () => {
      expect(blueprint.isNew).toBe(true);
    });

    it("should have icon 🎓", () => {
      expect(blueprint.icon).toBe("🎓");
    });

    it("should have description mentioning workshop", () => {
      expect(blueprint.description).toContain("工作坊");
    });

    it("should have example prompts", () => {
      expect(blueprint.examplePrompts).toBeDefined();
      expect(blueprint.examplePrompts?.length).toBeGreaterThan(0);
    });

    it("should have tags", () => {
      expect(blueprint.tags).toContain("培训");
      expect(blueprint.tags).toContain("工作坊");
      expect(blueprint.tags).toContain("课程设计");
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

    it("should have workshop_duration question as single_choice", () => {
      const durationQ = blueprint.briefingConfig.questions.find(
        (q) => q.id === "workshop_duration",
      );
      expect(durationQ).toBeDefined();
      expect(durationQ?.type).toBe("single_choice");
      expect(durationQ?.category).toBe("constraint");
      expect(durationQ?.options).toHaveLength(4);
      expect(durationQ?.required).toBe(true);
    });

    it("should have delivery_format question with 4 options", () => {
      const formatQ = blueprint.briefingConfig.questions.find(
        (q) => q.id === "delivery_format",
      );
      expect(formatQ).toBeDefined();
      expect(formatQ?.type).toBe("single_choice");
      expect(formatQ?.category).toBe("context");
      expect(formatQ?.options).toHaveLength(4);
      expect(formatQ?.required).toBe(true);
    });

    it("should have interaction_level question as optional", () => {
      const interactionQ = blueprint.briefingConfig.questions.find(
        (q) => q.id === "interaction_level",
      );
      expect(interactionQ).toBeDefined();
      expect(interactionQ?.type).toBe("single_choice");
      expect(interactionQ?.category).toBe("objective");
      expect(interactionQ?.options).toHaveLength(3);
      expect(interactionQ?.required).toBe(false);
    });

    it("should have proper default values", () => {
      const durationQ = blueprint.briefingConfig.questions.find(
        (q) => q.id === "workshop_duration",
      );
      const formatQ = blueprint.briefingConfig.questions.find(
        (q) => q.id === "delivery_format",
      );
      const interactionQ = blueprint.briefingConfig.questions.find(
        (q) => q.id === "interaction_level",
      );

      expect(durationQ?.defaultValue).toBe("half_day");
      expect(formatQ?.defaultValue).toBe("in_person");
      expect(interactionQ?.defaultValue).toBe("balanced");
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
      expect(schema.required).toContain("overview");
      expect(schema.required).toContain("totalDurationMinutes");
      expect(schema.required).toContain("timeline");
      expect(schema.required).toContain("sessionDescriptions");
      expect(schema.required).toContain("activityFormats");
      expect(schema.required).toContain("materialsList");
      expect(schema.required).toContain("facilitatorTips");
    });

    it("should define timeline array", () => {
      const props = schema.properties as Record<string, JSONSchema7>;
      expect(props.timeline).toBeDefined();
      expect(props.timeline.type).toBe("array");

      const timelineSchema = props.timeline.items as JSONSchema7;
      expect(timelineSchema.type).toBe("object");

      const timelineProps = timelineSchema.properties as Record<
        string,
        JSONSchema7
      >;
      expect(timelineProps.id).toBeDefined();
      expect(timelineProps.startMinute).toBeDefined();
      expect(timelineProps.durationMinutes).toBeDefined();
      expect(timelineProps.type).toBeDefined();
    });

    it("should define sessionDescriptions array", () => {
      const props = schema.properties as Record<string, JSONSchema7>;
      expect(props.sessionDescriptions).toBeDefined();
      expect(props.sessionDescriptions.type).toBe("array");

      const sessionSchema = props.sessionDescriptions.items as JSONSchema7;
      expect(sessionSchema.type).toBe("object");

      const sessionProps = sessionSchema.properties as Record<
        string,
        JSONSchema7
      >;
      expect(sessionProps.id).toBeDefined();
      expect(sessionProps.title).toBeDefined();
      expect(sessionProps.learningObjectives).toBeDefined();
    });

    it("should define activityFormats array", () => {
      const props = schema.properties as Record<string, JSONSchema7>;
      expect(props.activityFormats).toBeDefined();
      expect(props.activityFormats.type).toBe("array");

      const activitySchema = props.activityFormats.items as JSONSchema7;
      expect(activitySchema.type).toBe("object");

      const activityProps = activitySchema.properties as Record<
        string,
        JSONSchema7
      >;
      expect(activityProps.id).toBeDefined();
      expect(activityProps.name).toBeDefined();
      expect(activityProps.type).toBeDefined();
      expect(activityProps.durationMinutes).toBeDefined();
    });

    it("should define materialsList array", () => {
      const props = schema.properties as Record<string, JSONSchema7>;
      expect(props.materialsList).toBeDefined();
      expect(props.materialsList.type).toBe("array");

      const materialSchema = props.materialsList.items as JSONSchema7;
      expect(materialSchema.type).toBe("object");

      const materialProps = materialSchema.properties as Record<
        string,
        JSONSchema7
      >;
      expect(materialProps.id).toBeDefined();
      expect(materialProps.name).toBeDefined();
      expect(materialProps.type).toBeDefined();
      expect(materialProps.required).toBeDefined();
    });

    it("should define facilitatorTips array", () => {
      const props = schema.properties as Record<string, JSONSchema7>;
      expect(props.facilitatorTips).toBeDefined();
      expect(props.facilitatorTips.type).toBe("array");

      const tipSchema = props.facilitatorTips.items as JSONSchema7;
      expect(tipSchema.type).toBe("object");

      const tipProps = tipSchema.properties as Record<string, JSONSchema7>;
      expect(tipProps.id).toBeDefined();
      expect(tipProps.title).toBeDefined();
      expect(tipProps.type).toBeDefined();
      expect(tipProps.priority).toBeDefined();
    });

    it("should define assessmentMethods array", () => {
      const props = schema.properties as Record<string, JSONSchema7>;
      expect(props.assessmentMethods).toBeDefined();
      expect(props.assessmentMethods.type).toBe("array");

      const assessSchema = props.assessmentMethods.items as JSONSchema7;
      expect(assessSchema.type).toBe("object");

      const assessProps = assessSchema.properties as Record<
        string,
        JSONSchema7
      >;
      expect(assessProps.id).toBeDefined();
      expect(assessProps.name).toBeDefined();
      expect(assessProps.type).toBeDefined();
      expect(assessProps.timing).toBeDefined();
    });

    it("should define recommendedGroupSize object", () => {
      const props = schema.properties as Record<string, JSONSchema7>;
      expect(props.recommendedGroupSize).toBeDefined();
      expect(props.recommendedGroupSize.type).toBe("object");

      const groupProps = props.recommendedGroupSize.properties as Record<
        string,
        JSONSchema7
      >;
      expect(groupProps.min).toBeDefined();
      expect(groupProps.max).toBeDefined();
      expect(groupProps.optimal).toBeDefined();
    });
  });

  // ============================================================
  // Factory Function Tests
  // ============================================================

  describe("Factory Function", () => {
    it("should create valid blueprint instance", () => {
      const instance = createWorkshopDesignerBlueprint();
      expect(instance).toBeInstanceOf(WorkshopDesignerBlueprint);
    });

    it("should create new instance each call", () => {
      const instance1 = createWorkshopDesignerBlueprint();
      const instance2 = createWorkshopDesignerBlueprint();
      expect(instance1).not.toBe(instance2);
    });

    it("should have consistent blueprintId", () => {
      const instance = createWorkshopDesignerBlueprint();
      expect(instance.blueprintId).toBe("professional-workshop_designer");
    });
  });

  // ============================================================
  // Workshop Duration Option Tests
  // ============================================================

  describe("Workshop Duration Options", () => {
    it("should have short option", () => {
      const durationQ = blueprint.briefingConfig.questions.find(
        (q) => q.id === "workshop_duration",
      );
      const shortOpt = durationQ?.options?.find((o) => o.value === "short");
      expect(shortOpt).toBeDefined();
      expect(shortOpt?.label).toContain("1-2");
    });

    it("should have half_day option", () => {
      const durationQ = blueprint.briefingConfig.questions.find(
        (q) => q.id === "workshop_duration",
      );
      const halfDayOpt = durationQ?.options?.find(
        (o) => o.value === "half_day",
      );
      expect(halfDayOpt).toBeDefined();
      expect(halfDayOpt?.label).toContain("半天");
      expect(halfDayOpt?.description).toContain("深度培训");
    });

    it("should have full_day option", () => {
      const durationQ = blueprint.briefingConfig.questions.find(
        (q) => q.id === "workshop_duration",
      );
      const fullDayOpt = durationQ?.options?.find(
        (o) => o.value === "full_day",
      );
      expect(fullDayOpt).toBeDefined();
      expect(fullDayOpt?.label).toContain("全天");
      expect(fullDayOpt?.description).toContain("工作坊");
    });

    it("should have multi_day option", () => {
      const durationQ = blueprint.briefingConfig.questions.find(
        (q) => q.id === "workshop_duration",
      );
      const multiDayOpt = durationQ?.options?.find(
        (o) => o.value === "multi_day",
      );
      expect(multiDayOpt).toBeDefined();
      expect(multiDayOpt?.label).toContain("多日");
    });
  });

  // ============================================================
  // Delivery Format Option Tests
  // ============================================================

  describe("Delivery Format Options", () => {
    it("should have in_person option", () => {
      const formatQ = blueprint.briefingConfig.questions.find(
        (q) => q.id === "delivery_format",
      );
      const inPersonOpt = formatQ?.options?.find(
        (o) => o.value === "in_person",
      );
      expect(inPersonOpt).toBeDefined();
      expect(inPersonOpt?.label).toBe("线下面授");
    });

    it("should have online_sync option", () => {
      const formatQ = blueprint.briefingConfig.questions.find(
        (q) => q.id === "delivery_format",
      );
      const onlineOpt = formatQ?.options?.find(
        (o) => o.value === "online_sync",
      );
      expect(onlineOpt).toBeDefined();
      expect(onlineOpt?.label).toBe("线上同步");
    });

    it("should have hybrid option", () => {
      const formatQ = blueprint.briefingConfig.questions.find(
        (q) => q.id === "delivery_format",
      );
      const hybridOpt = formatQ?.options?.find((o) => o.value === "hybrid");
      expect(hybridOpt).toBeDefined();
      expect(hybridOpt?.label).toBe("混合模式");
    });

    it("should have self_paced option", () => {
      const formatQ = blueprint.briefingConfig.questions.find(
        (q) => q.id === "delivery_format",
      );
      const selfPacedOpt = formatQ?.options?.find(
        (o) => o.value === "self_paced",
      );
      expect(selfPacedOpt).toBeDefined();
      expect(selfPacedOpt?.label).toBe("自主学习");
    });
  });

  // ============================================================
  // Interaction Level Option Tests
  // ============================================================

  describe("Interaction Level Options", () => {
    it("should have lecture option", () => {
      const interactionQ = blueprint.briefingConfig.questions.find(
        (q) => q.id === "interaction_level",
      );
      const lectureOpt = interactionQ?.options?.find(
        (o) => o.value === "lecture",
      );
      expect(lectureOpt).toBeDefined();
      expect(lectureOpt?.label).toBe("讲授为主");
      expect(lectureOpt?.description).toContain("70%");
    });

    it("should have balanced option", () => {
      const interactionQ = blueprint.briefingConfig.questions.find(
        (q) => q.id === "interaction_level",
      );
      const balancedOpt = interactionQ?.options?.find(
        (o) => o.value === "balanced",
      );
      expect(balancedOpt).toBeDefined();
      expect(balancedOpt?.label).toBe("讲练结合");
      expect(balancedOpt?.description).toContain("50%");
    });

    it("should have workshop option", () => {
      const interactionQ = blueprint.briefingConfig.questions.find(
        (q) => q.id === "interaction_level",
      );
      const workshopOpt = interactionQ?.options?.find(
        (o) => o.value === "workshop",
      );
      expect(workshopOpt).toBeDefined();
      expect(workshopOpt?.label).toBe("工作坊型");
      expect(workshopOpt?.description).toContain("70%");
    });
  });
});
