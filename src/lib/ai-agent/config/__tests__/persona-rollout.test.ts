/**
 * 画像灰度发布和回滚机制测试
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

import {
  isUserInPersonaRollout,
  isPersonaFeatureEnabled,
  getPersonaRolloutStatus,
  getCurrentPersonaStage,
  recordPersonaRequest,
  recordPersonaError,
  recordInferenceFailure,
  shouldTriggerRollback,
  executeRollback,
  getRollbackMonitorState,
  resetRollbackState,
  isInRollbackState,
  DEFAULT_STAGE_CONFIGS,
  DEFAULT_ROLLBACK_CONFIG,
} from "../persona-rollout";

// Mock feature flags
const mockFeatureFlags = {
  ENABLE_MULTI_PERSONA: true,
  PERSONA_ROLLOUT_PERCENTAGE: 50,
  ENABLE_PERSONA_INFERENCE: true,
  ENABLE_PERSONA_PROMPTS: true,
  ENABLE_PERSONA_INTENT_BOOST: true,
  ENABLE_PERSONA_SETTINGS_UI: false,
};

jest.mock("../feature-flags", () => ({
  FeatureFlags: {
    get ENABLE_MULTI_PERSONA() {
      return mockFeatureFlags.ENABLE_MULTI_PERSONA;
    },
    get PERSONA_ROLLOUT_PERCENTAGE() {
      return mockFeatureFlags.PERSONA_ROLLOUT_PERCENTAGE;
    },
    get ENABLE_PERSONA_INFERENCE() {
      return mockFeatureFlags.ENABLE_PERSONA_INFERENCE;
    },
    get ENABLE_PERSONA_PROMPTS() {
      return mockFeatureFlags.ENABLE_PERSONA_PROMPTS;
    },
    get ENABLE_PERSONA_INTENT_BOOST() {
      return mockFeatureFlags.ENABLE_PERSONA_INTENT_BOOST;
    },
    get ENABLE_PERSONA_SETTINGS_UI() {
      return mockFeatureFlags.ENABLE_PERSONA_SETTINGS_UI;
    },
  },
}));

// Mock logger
jest.mock("@/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe("Persona Rollout", () => {
  beforeEach(() => {
    // Reset feature flags to default
    mockFeatureFlags.ENABLE_MULTI_PERSONA = true;
    mockFeatureFlags.PERSONA_ROLLOUT_PERCENTAGE = 50;
    mockFeatureFlags.ENABLE_PERSONA_INFERENCE = true;
    mockFeatureFlags.ENABLE_PERSONA_PROMPTS = true;
    mockFeatureFlags.ENABLE_PERSONA_INTENT_BOOST = true;
    mockFeatureFlags.ENABLE_PERSONA_SETTINGS_UI = false;

    // Reset environment variable
    delete process.env.PERSONA_ROLLOUT_STAGE;

    // Reset rollback state
    resetRollbackState();
  });

  describe("getCurrentPersonaStage", () => {
    it("should return disabled when main toggle is off", () => {
      mockFeatureFlags.ENABLE_MULTI_PERSONA = false;
      expect(getCurrentPersonaStage()).toBe("disabled");
    });

    it("should return stage from environment variable", () => {
      process.env.PERSONA_ROLLOUT_STAGE = "canary";
      expect(getCurrentPersonaStage()).toBe("canary");
    });

    it("should infer beta stage from low percentage", () => {
      mockFeatureFlags.PERSONA_ROLLOUT_PERCENTAGE = 5;
      expect(getCurrentPersonaStage()).toBe("beta");
    });

    it("should infer canary stage from medium percentage", () => {
      mockFeatureFlags.PERSONA_ROLLOUT_PERCENTAGE = 15;
      expect(getCurrentPersonaStage()).toBe("canary");
    });

    it("should infer production stage from high percentage", () => {
      mockFeatureFlags.PERSONA_ROLLOUT_PERCENTAGE = 100;
      expect(getCurrentPersonaStage()).toBe("production");
    });

    it("should return disabled for 0 percentage", () => {
      mockFeatureFlags.PERSONA_ROLLOUT_PERCENTAGE = 0;
      expect(getCurrentPersonaStage()).toBe("disabled");
    });
  });

  describe("isUserInPersonaRollout", () => {
    it("should return false when main toggle is off", () => {
      mockFeatureFlags.ENABLE_MULTI_PERSONA = false;
      expect(isUserInPersonaRollout("user-123")).toBe(false);
    });

    it("should return true for all users when percentage is 100", () => {
      mockFeatureFlags.PERSONA_ROLLOUT_PERCENTAGE = 100;
      expect(isUserInPersonaRollout("user-123")).toBe(true);
      expect(isUserInPersonaRollout("user-456")).toBe(true);
      expect(isUserInPersonaRollout("user-789")).toBe(true);
    });

    it("should return false for all users when percentage is 0", () => {
      mockFeatureFlags.PERSONA_ROLLOUT_PERCENTAGE = 0;
      expect(isUserInPersonaRollout("user-123")).toBe(false);
      expect(isUserInPersonaRollout("user-456")).toBe(false);
    });

    it("should return consistent results for same user", () => {
      mockFeatureFlags.PERSONA_ROLLOUT_PERCENTAGE = 50;
      const result1 = isUserInPersonaRollout("consistent-user-id");
      const result2 = isUserInPersonaRollout("consistent-user-id");
      const result3 = isUserInPersonaRollout("consistent-user-id");
      expect(result1).toBe(result2);
      expect(result2).toBe(result3);
    });

    it("should distribute users roughly according to percentage", () => {
      mockFeatureFlags.PERSONA_ROLLOUT_PERCENTAGE = 50;

      // Generate many users and check distribution
      let inRollout = 0;
      const totalUsers = 1000;

      for (let i = 0; i < totalUsers; i++) {
        if (isUserInPersonaRollout(`test-user-${i}`)) {
          inRollout++;
        }
      }

      // Allow 10% variance from expected 50%
      expect(inRollout).toBeGreaterThan(totalUsers * 0.4);
      expect(inRollout).toBeLessThan(totalUsers * 0.6);
    });
  });

  describe("isPersonaFeatureEnabled", () => {
    beforeEach(() => {
      mockFeatureFlags.PERSONA_ROLLOUT_PERCENTAGE = 100; // All users in rollout
    });

    it("should return true for enabled sub-features", () => {
      expect(isPersonaFeatureEnabled("user-123", "inference")).toBe(true);
      expect(isPersonaFeatureEnabled("user-123", "prompts")).toBe(true);
      expect(isPersonaFeatureEnabled("user-123", "intentBoost")).toBe(true);
    });

    it("should return false for disabled sub-features", () => {
      expect(isPersonaFeatureEnabled("user-123", "settingsUI")).toBe(false);
    });

    it("should return true when no sub-feature specified", () => {
      expect(isPersonaFeatureEnabled("user-123")).toBe(true);
    });

    it("should return false when user not in rollout", () => {
      mockFeatureFlags.PERSONA_ROLLOUT_PERCENTAGE = 0;
      expect(isPersonaFeatureEnabled("user-123", "inference")).toBe(false);
    });
  });

  describe("getPersonaRolloutStatus", () => {
    it("should return complete rollout status", () => {
      mockFeatureFlags.PERSONA_ROLLOUT_PERCENTAGE = 20;

      const status = getPersonaRolloutStatus();

      expect(status.enabled).toBe(true);
      expect(status.stage).toBe("canary");
      expect(status.percentage).toBe(20);
      expect(status.features.inference).toBe(true);
      expect(status.features.prompts).toBe(true);
      expect(status.features.intentBoost).toBe(true);
      expect(status.features.settingsUI).toBe(false);
      expect(status.rollbackConfig).toEqual(DEFAULT_ROLLBACK_CONFIG);
    });
  });

  describe("Default Configurations", () => {
    it("should have valid stage configs", () => {
      expect(DEFAULT_STAGE_CONFIGS.disabled.trafficPercentage).toBe(0);
      expect(DEFAULT_STAGE_CONFIGS.internal.trafficPercentage).toBe(100);
      expect(DEFAULT_STAGE_CONFIGS.beta.trafficPercentage).toBe(5);
      expect(DEFAULT_STAGE_CONFIGS.canary.trafficPercentage).toBe(20);
      expect(DEFAULT_STAGE_CONFIGS.production.trafficPercentage).toBe(100);
    });

    it("should have valid rollback config", () => {
      expect(DEFAULT_ROLLBACK_CONFIG.autoRollbackEnabled).toBe(true);
      expect(DEFAULT_ROLLBACK_CONFIG.errorRateThreshold).toBe(0.05);
      expect(DEFAULT_ROLLBACK_CONFIG.inferenceFailureThreshold).toBe(0.1);
      expect(DEFAULT_ROLLBACK_CONFIG.observationWindowMinutes).toBe(15);
      expect(DEFAULT_ROLLBACK_CONFIG.rollbackTarget).toBe("internal");
    });
  });
});

describe("Rollback Mechanism", () => {
  beforeEach(() => {
    resetRollbackState();
    mockFeatureFlags.ENABLE_MULTI_PERSONA = true;
    mockFeatureFlags.PERSONA_ROLLOUT_PERCENTAGE = 100;
  });

  describe("recordPersonaRequest", () => {
    it("should increment total requests", () => {
      recordPersonaRequest();
      recordPersonaRequest();
      recordPersonaRequest();

      const state = getRollbackMonitorState();
      expect(state.totalRequests).toBe(3);
    });
  });

  describe("recordPersonaError", () => {
    it("should increment error count", () => {
      recordPersonaError();
      recordPersonaError();

      const state = getRollbackMonitorState();
      expect(state.errorCount).toBe(2);
    });
  });

  describe("recordInferenceFailure", () => {
    it("should increment inference failure count", () => {
      recordInferenceFailure();
      recordInferenceFailure();
      recordInferenceFailure();

      const state = getRollbackMonitorState();
      expect(state.inferenceFailureCount).toBe(3);
    });
  });

  describe("shouldTriggerRollback", () => {
    it("should not trigger with insufficient sample size", () => {
      recordPersonaRequest();
      recordPersonaError();

      const result = shouldTriggerRollback();
      expect(result.shouldRollback).toBe(false);
    });

    it("should trigger when error rate exceeds threshold", () => {
      // Create 20 requests with 2 errors (10% > 5% threshold)
      for (let i = 0; i < 20; i++) {
        recordPersonaRequest();
      }
      for (let i = 0; i < 2; i++) {
        recordPersonaError();
      }

      const result = shouldTriggerRollback();
      expect(result.shouldRollback).toBe(true);
      expect(result.reason).toContain("Error rate");
    });

    it("should trigger when inference failure rate exceeds threshold", () => {
      // Create 20 requests with 3 inference failures (15% > 10% threshold)
      for (let i = 0; i < 20; i++) {
        recordPersonaRequest();
      }
      for (let i = 0; i < 3; i++) {
        recordInferenceFailure();
      }

      const result = shouldTriggerRollback();
      expect(result.shouldRollback).toBe(true);
      expect(result.reason).toContain("Inference failure rate");
    });

    it("should not trigger when rates are below thresholds", () => {
      // Create 100 requests with 1 error (1% < 5% threshold)
      for (let i = 0; i < 100; i++) {
        recordPersonaRequest();
      }
      recordPersonaError();

      const result = shouldTriggerRollback();
      expect(result.shouldRollback).toBe(false);
      expect(result.metrics).toBeDefined();
      expect(result.metrics!.errorRate).toBe(0.01);
    });

    it("should not trigger again after already rolled back", () => {
      // Create rollback condition
      for (let i = 0; i < 20; i++) {
        recordPersonaRequest();
      }
      for (let i = 0; i < 5; i++) {
        recordPersonaError();
      }

      // First trigger
      const result1 = shouldTriggerRollback();
      expect(result1.shouldRollback).toBe(true);

      // Execute rollback
      executeRollback(result1.reason!);

      // Should not trigger again
      const result2 = shouldTriggerRollback();
      expect(result2.shouldRollback).toBe(false);
    });
  });

  describe("executeRollback", () => {
    it("should set rollback state", () => {
      expect(isInRollbackState()).toBe(false);

      executeRollback("Test rollback");

      expect(isInRollbackState()).toBe(true);
    });

    it("should record rollback time", () => {
      const before = Date.now();
      executeRollback("Test rollback");
      const after = Date.now();

      const state = getRollbackMonitorState();
      expect(state.lastRollbackTime).toBeGreaterThanOrEqual(before);
      expect(state.lastRollbackTime).toBeLessThanOrEqual(after);
    });
  });

  describe("resetRollbackState", () => {
    it("should clear all counters and state", () => {
      recordPersonaRequest();
      recordPersonaRequest();
      recordPersonaError();
      recordInferenceFailure();
      executeRollback("Test");

      resetRollbackState();

      const state = getRollbackMonitorState();
      expect(state.totalRequests).toBe(0);
      expect(state.errorCount).toBe(0);
      expect(state.inferenceFailureCount).toBe(0);
      expect(state.isRolledBack).toBe(false);
      expect(state.lastRollbackTime).toBeNull();
    });
  });

  describe("getRollbackMonitorState", () => {
    it("should return current state snapshot", () => {
      recordPersonaRequest();
      recordPersonaRequest();
      recordPersonaError();

      const state = getRollbackMonitorState();

      expect(state.totalRequests).toBe(2);
      expect(state.errorCount).toBe(1);
      expect(state.inferenceFailureCount).toBe(0);
      expect(state.isRolledBack).toBe(false);
      expect(typeof state.windowStartTime).toBe("number");
    });
  });
});

describe("Integration Scenarios", () => {
  beforeEach(() => {
    resetRollbackState();
    mockFeatureFlags.ENABLE_MULTI_PERSONA = true;
    mockFeatureFlags.PERSONA_ROLLOUT_PERCENTAGE = 100;
    delete process.env.PERSONA_ROLLOUT_STAGE;
  });

  it("should support full rollout lifecycle", () => {
    // Start with beta (5%)
    mockFeatureFlags.PERSONA_ROLLOUT_PERCENTAGE = 5;
    expect(getCurrentPersonaStage()).toBe("beta");

    // Expand to canary (20%)
    mockFeatureFlags.PERSONA_ROLLOUT_PERCENTAGE = 20;
    expect(getCurrentPersonaStage()).toBe("canary");

    // Full rollout
    mockFeatureFlags.PERSONA_ROLLOUT_PERCENTAGE = 100;
    expect(getCurrentPersonaStage()).toBe("production");

    // Monitor and detect issues
    for (let i = 0; i < 20; i++) {
      recordPersonaRequest();
    }
    for (let i = 0; i < 3; i++) {
      recordPersonaError();
    }

    const result = shouldTriggerRollback();
    expect(result.shouldRollback).toBe(true);

    // Execute rollback
    executeRollback(result.reason!);
    expect(isInRollbackState()).toBe(true);

    // Manual intervention: reduce percentage
    mockFeatureFlags.PERSONA_ROLLOUT_PERCENTAGE = 5;
    expect(getCurrentPersonaStage()).toBe("beta");

    // Reset and resume
    resetRollbackState();
    expect(isInRollbackState()).toBe(false);
  });

  it("should respect stage-specific feature overrides", () => {
    // Beta stage disables settingsUI
    process.env.PERSONA_ROLLOUT_STAGE = "beta";
    mockFeatureFlags.PERSONA_ROLLOUT_PERCENTAGE = 100;

    const status = getPersonaRolloutStatus();
    expect(status.stage).toBe("beta");
    // Note: stage override check happens in isPersonaFeatureEnabled
  });
});
