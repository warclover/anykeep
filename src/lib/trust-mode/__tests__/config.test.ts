/**
 * Trust Mode Config Unit Tests
 * V4.2 托管模式配置测试
 *
 * @version 1.0.0
 * @since 2025-12-11
 */

import {
  CONFIDENCE_THRESHOLDS,
  FAST_PATH_THRESHOLDS,
  FOLDER_LIMITS,
  CONFIRMATION_LIMITS,
  TRUST_MODE_CONFIGS,
  getTrustModeConfig,
  mergeWithOverrides,
  requiresConfirmation,
  shouldAutoClassify,
  shouldAutoCreateFolder,
  getLowConfidenceAction,
  getEffectiveConfidenceThresholds,
} from "../config";
import type { TrustModeConfig } from "@/types/trust-mode";

describe("Trust Mode Config", () => {
  // ============================================================================
  // 阈值配置测试
  // ============================================================================

  describe("CONFIDENCE_THRESHOLDS", () => {
    it("should have valid threshold values", () => {
      expect(CONFIDENCE_THRESHOLDS.HIGH).toBe(80);
      expect(CONFIDENCE_THRESHOLDS.MEDIUM).toBe(60);
      expect(CONFIDENCE_THRESHOLDS.LOW).toBe(40);
    });

    it("should have thresholds in descending order", () => {
      expect(CONFIDENCE_THRESHOLDS.HIGH).toBeGreaterThan(CONFIDENCE_THRESHOLDS.MEDIUM);
      expect(CONFIDENCE_THRESHOLDS.MEDIUM).toBeGreaterThan(CONFIDENCE_THRESHOLDS.LOW);
    });
  });

  describe("FAST_PATH_THRESHOLDS", () => {
    it("should have valid threshold values", () => {
      expect(FAST_PATH_THRESHOLDS.MIN_SOURCE_SAMPLES).toBeGreaterThan(0);
      expect(FAST_PATH_THRESHOLDS.MIN_SOURCE_CONFIDENCE).toBeGreaterThan(0);
      expect(FAST_PATH_THRESHOLDS.MIN_TITLE_SIMILARITY).toBeLessThanOrEqual(1);
      expect(FAST_PATH_THRESHOLDS.MIN_TITLE_SIMILARITY).toBeGreaterThan(0);
    });
  });

  describe("FOLDER_LIMITS", () => {
    it("should have reasonable daily limits", () => {
      expect(FOLDER_LIMITS.DAILY_AUTO_CREATE_LIMIT).toBeGreaterThan(0);
      expect(FOLDER_LIMITS.DAILY_AUTO_MERGE_LIMIT).toBeGreaterThan(0);
      expect(FOLDER_LIMITS.DAILY_AUTO_SPLIT_LIMIT).toBeGreaterThan(0);
      expect(FOLDER_LIMITS.DAILY_AUTO_RENAME_LIMIT).toBeGreaterThan(0);
    });

    it("should have valid folder size limits", () => {
      expect(FOLDER_LIMITS.MIN_FOLDER_SIZE_FOR_SPLIT).toBeLessThan(
        FOLDER_LIMITS.MAX_FOLDER_SIZE_BEFORE_SPLIT
      );
    });
  });

  describe("CONFIRMATION_LIMITS", () => {
    it("should have valid confirmation limits", () => {
      expect(CONFIRMATION_LIMITS.DEFAULT_EXPIRY_DAYS).toBeGreaterThan(0);
      expect(CONFIRMATION_LIMITS.MAX_PENDING_COUNT).toBeGreaterThan(0);
      expect(CONFIRMATION_LIMITS.BATCH_SIZE).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // 模式配置测试
  // ============================================================================

  describe("TRUST_MODE_CONFIGS", () => {
    it("should have all three modes configured", () => {
      expect(TRUST_MODE_CONFIGS).toHaveProperty("full_auto");
      expect(TRUST_MODE_CONFIGS).toHaveProperty("semi_auto");
      expect(TRUST_MODE_CONFIGS).toHaveProperty("manual");
    });

    it("full_auto config should enable auto classification", () => {
      const config = TRUST_MODE_CONFIGS.full_auto;
      expect(config.mode).toBe("full_auto");
      expect(config.classification.autoClassify).toBe(true);
      expect(config.folderManagement.autoCreate).toBe(true);
    });

    it("semi_auto config should enable auto classification with confirmation", () => {
      const config = TRUST_MODE_CONFIGS.semi_auto;
      expect(config.mode).toBe("semi_auto");
      expect(config.classification.autoClassify).toBe(true);
      expect(config.classification.confirmationThreshold).toBeDefined();
    });

    it("manual config should disable auto classification", () => {
      const config = TRUST_MODE_CONFIGS.manual;
      expect(config.mode).toBe("manual");
      expect(config.classification.autoClassify).toBe(false);
      expect(config.folderManagement.autoCreate).toBe(false);
    });
  });

  // ============================================================================
  // 辅助函数测试
  // ============================================================================

  describe("getTrustModeConfig", () => {
    it("should return correct config for each mode", () => {
      expect(getTrustModeConfig("full_auto").mode).toBe("full_auto");
      expect(getTrustModeConfig("semi_auto").mode).toBe("semi_auto");
      expect(getTrustModeConfig("manual").mode).toBe("manual");
    });

    it("should return complete config structure", () => {
      const config = getTrustModeConfig("full_auto");
      expect(config).toHaveProperty("classification");
      expect(config).toHaveProperty("folderManagement");
      expect(config).toHaveProperty("notification");
      expect(config).toHaveProperty("learning");
    });
  });

  describe("mergeWithOverrides", () => {
    it("should return base config when no overrides", () => {
      const baseConfig = getTrustModeConfig("full_auto");
      const merged = mergeWithOverrides(baseConfig, undefined);
      expect(merged).toEqual(baseConfig);
    });

    it("should merge classification overrides", () => {
      const baseConfig = getTrustModeConfig("full_auto");
      const overrides: Partial<TrustModeConfig> = {
        classification: {
          ...baseConfig.classification,
          confirmationThreshold: 70,
        },
      };
      const merged = mergeWithOverrides(baseConfig, overrides);
      expect(merged.classification.confirmationThreshold).toBe(70);
    });

    it("should not override mode property", () => {
      const baseConfig = getTrustModeConfig("full_auto");
      const overrides = {
        mode: "manual" as const,
      } as Partial<TrustModeConfig>;
      const merged = mergeWithOverrides(baseConfig, overrides);
      expect(merged.mode).toBe("full_auto"); // mode 不可覆盖
    });

    it("should merge nested properties correctly", () => {
      const baseConfig = getTrustModeConfig("semi_auto");
      const overrides: Partial<TrustModeConfig> = {
        notification: {
          ...baseConfig.notification,
          onFolderCreate: false,
        },
        learning: {
          ...baseConfig.learning,
          learnFromManualMoves: false,
        },
      };
      const merged = mergeWithOverrides(baseConfig, overrides);
      expect(merged.notification.onFolderCreate).toBe(false);
      expect(merged.learning.learnFromManualMoves).toBe(false);
    });
  });

  // ============================================================================
  // 决策辅助函数测试
  // ============================================================================

  describe("requiresConfirmation", () => {
    it("should never require confirmation for full_auto mode", () => {
      expect(requiresConfirmation("full_auto", 90)).toBe(false);
      expect(requiresConfirmation("full_auto", 50)).toBe(false);
      expect(requiresConfirmation("full_auto", 20)).toBe(false);
    });

    it("should never require confirmation for manual mode", () => {
      expect(requiresConfirmation("manual", 90)).toBe(false);
      expect(requiresConfirmation("manual", 50)).toBe(false);
      expect(requiresConfirmation("manual", 20)).toBe(false);
    });

    it("should require confirmation for semi_auto mode below threshold", () => {
      // 获取 semi_auto 的配置阈值
      const config = getTrustModeConfig("semi_auto");
      const threshold = config.classification.confirmationThreshold || CONFIDENCE_THRESHOLDS.MEDIUM;

      expect(requiresConfirmation("semi_auto", threshold - 1)).toBe(true);
      expect(requiresConfirmation("semi_auto", threshold + 1)).toBe(false);
    });
  });

  describe("shouldAutoClassify", () => {
    it("should return true for full_auto mode", () => {
      expect(shouldAutoClassify("full_auto")).toBe(true);
    });

    it("should return true for semi_auto mode", () => {
      expect(shouldAutoClassify("semi_auto")).toBe(true);
    });

    it("should return false for manual mode", () => {
      expect(shouldAutoClassify("manual")).toBe(false);
    });
  });

  describe("shouldAutoCreateFolder", () => {
    it("should return true for full_auto mode", () => {
      expect(shouldAutoCreateFolder("full_auto")).toBe(true);
    });

    it("should return false for semi_auto mode", () => {
      expect(shouldAutoCreateFolder("semi_auto")).toBe(false);
    });

    it("should return false for manual mode", () => {
      expect(shouldAutoCreateFolder("manual")).toBe(false);
    });
  });

  describe("getLowConfidenceAction", () => {
    it("should return correct action for each mode", () => {
      const fullAutoAction = getLowConfidenceAction("full_auto");
      const semiAutoAction = getLowConfidenceAction("semi_auto");
      const manualAction = getLowConfidenceAction("manual");

      // full_auto 应该使用 auto_inbox_then_cluster（自动放入待整理，后台聚类处理）
      expect(fullAutoAction).toBe("auto_inbox_then_cluster");

      // semi_auto 应该使用 pending_with_message
      expect(semiAutoAction).toBe("pending_with_message");

      // manual 应该直接放入 inbox
      expect(manualAction).toBe("direct_inbox");
    });
  });

  describe("getEffectiveConfidenceThresholds", () => {
    it("should return default thresholds without env overrides", () => {
      const thresholds = getEffectiveConfidenceThresholds();
      expect(thresholds.HIGH).toBe(CONFIDENCE_THRESHOLDS.HIGH);
      expect(thresholds.MEDIUM).toBe(CONFIDENCE_THRESHOLDS.MEDIUM);
      expect(thresholds.LOW).toBe(CONFIDENCE_THRESHOLDS.LOW);
    });
  });
});
