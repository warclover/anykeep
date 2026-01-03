/**
 * Conversion Types 单元测试
 * @module knowledge-studio/conversion/__tests__
 */

// Jest provides describe, it, expect as globals
import {
  DEFAULT_TRIAL_CONFIG,
  type UserTrialState,
  type ConversionEvent,
  type ConversionStage,
  type ConversionTrigger,
  type UpgradePromptType,
  type UpgradePromptConfig,
  type TrialConfig,
  type ConversionFunnelMetrics,
  type UserConversionInsight,
} from "../types";

describe("DEFAULT_TRIAL_CONFIG", () => {
  it("should have correct default values", () => {
    expect(DEFAULT_TRIAL_CONFIG.durationDays).toBe(7);
    expect(DEFAULT_TRIAL_CONFIG.generationQuota).toBe(5);
    expect(DEFAULT_TRIAL_CONFIG.unlockedFeatures).toEqual([
      "blueprint_blogger",
      "chat_to_edit",
    ]);
    expect(DEFAULT_TRIAL_CONFIG.reminderDays).toEqual([3, 1, 0]);
    expect(DEFAULT_TRIAL_CONFIG.enableFeatureGating).toBe(true);
  });
});

describe("Type guards and interfaces", () => {
  describe("UserTrialState", () => {
    it("should accept valid trial state", () => {
      const state: UserTrialState = {
        userId: "user-123",
        status: "active",
        startedAt: new Date(),
        expiresAt: new Date(),
        generationsUsed: 2,
        featuresExperienced: ["chat_to_edit"],
        conversionStage: "activation",
        lastActiveAt: new Date(),
      };
      expect(state.userId).toBe("user-123");
      expect(state.status).toBe("active");
    });

    it("should accept all status values", () => {
      const statuses: UserTrialState["status"][] = [
        "active",
        "expired",
        "converted",
        "cancelled",
      ];
      statuses.forEach((status) => {
        const state: UserTrialState = {
          userId: "user-123",
          status,
          startedAt: new Date(),
          expiresAt: new Date(),
          generationsUsed: 0,
          featuresExperienced: [],
          conversionStage: "awareness",
          lastActiveAt: new Date(),
        };
        expect(state.status).toBe(status);
      });
    });
  });

  describe("ConversionEvent", () => {
    it("should accept valid conversion event", () => {
      const event: ConversionEvent = {
        id: "event-123",
        userId: "user-123",
        trigger: "feature_locked",
        timestamp: new Date(),
        context: {
          sourcePage: "/knowledge-studio",
          featureId: "chat_to_edit",
        },
      };
      expect(event.trigger).toBe("feature_locked");
    });

    it("should accept all trigger types", () => {
      const triggers: ConversionTrigger[] = [
        "quota_exhausted",
        "feature_locked",
        "trial_ending",
        "trial_expired",
        "manual_upgrade",
        "promo_offer",
      ];
      triggers.forEach((trigger) => {
        const event: ConversionEvent = {
          id: `event-${trigger}`,
          userId: "user-123",
          trigger,
          timestamp: new Date(),
          context: {},
        };
        expect(event.trigger).toBe(trigger);
      });
    });
  });

  describe("ConversionStage", () => {
    it("should include all stages", () => {
      const stages: ConversionStage[] = [
        "awareness",
        "activation",
        "engagement",
        "consideration",
        "conversion",
        "retention",
      ];
      stages.forEach((stage) => {
        const state: Partial<UserTrialState> = {
          conversionStage: stage,
        };
        expect(state.conversionStage).toBe(stage);
      });
    });
  });

  describe("UpgradePromptConfig", () => {
    it("should accept valid prompt config", () => {
      const config: UpgradePromptConfig = {
        type: "modal",
        trigger: "trial_ending",
        title: "Upgrade Now",
        description: "Get more features",
        primaryCta: "Upgrade",
        dismissible: true,
        cooldownHours: 24,
        priority: 80,
      };
      expect(config.type).toBe("modal");
      expect(config.priority).toBe(80);
    });

    it("should accept all prompt types", () => {
      const types: UpgradePromptType[] = [
        "modal",
        "banner",
        "inline",
        "tooltip",
      ];
      types.forEach((type) => {
        const config: UpgradePromptConfig = {
          type,
          trigger: "feature_locked",
          title: "Test",
          description: "Test",
          primaryCta: "Test",
          dismissible: true,
          cooldownHours: 1,
          priority: 50,
        };
        expect(config.type).toBe(type);
      });
    });
  });

  describe("TrialConfig", () => {
    it("should accept valid trial config", () => {
      const config: TrialConfig = {
        durationDays: 14,
        generationQuota: 5,
        unlockedFeatures: ["feature1", "feature2"],
        reminderDays: [7, 3, 1],
        enableFeatureGating: true,
      };
      expect(config.durationDays).toBe(14);
      expect(config.generationQuota).toBe(5);
    });
  });

  describe("ConversionFunnelMetrics", () => {
    it("should accept valid funnel metrics", () => {
      const metrics: ConversionFunnelMetrics = {
        period: {
          start: new Date(),
          end: new Date(),
        },
        stageCounts: {
          awareness: 100,
          activation: 80,
          engagement: 60,
          consideration: 40,
          conversion: 20,
          retention: 15,
        },
        stageConversionRates: {
          awareness: 100,
          activation: 80,
          engagement: 75,
          consideration: 66,
          conversion: 50,
          retention: 75,
        },
        overallConversionRate: 20,
        averageConversionDays: 4.5,
        triggerDistribution: {
          quota_exhausted: 10,
          feature_locked: 30,
          trial_ending: 25,
          trial_expired: 5,
          manual_upgrade: 20,
          promo_offer: 10,
        },
      };
      expect(metrics.overallConversionRate).toBe(20);
    });
  });

  describe("UserConversionInsight", () => {
    it("should accept valid user insight", () => {
      const insight: UserConversionInsight = {
        userId: "user-123",
        conversionProbability: 75,
        recommendedTrigger: "trial_ending",
        recommendedPromptType: "modal",
        valueScore: 85,
        churnRisk: "low",
      };
      expect(insight.conversionProbability).toBe(75);
      expect(insight.churnRisk).toBe("low");
    });

    it("should accept all churn risk levels", () => {
      const risks: UserConversionInsight["churnRisk"][] = [
        "low",
        "medium",
        "high",
      ];
      risks.forEach((risk) => {
        const insight: UserConversionInsight = {
          userId: "user-123",
          conversionProbability: 50,
          recommendedTrigger: "feature_locked",
          recommendedPromptType: "tooltip",
          valueScore: 50,
          churnRisk: risk,
        };
        expect(insight.churnRisk).toBe(risk);
      });
    });
  });
});
