/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * recommend-trust-mode.tool.ts 单元测试
 *
 * @version 1.0.0
 * @since 2025-12-27
 */

import type { ToolContext } from "../../types";
import { RECOMMENDATION_THRESHOLDS } from "../types";

// Mock 变量
let mockEffectiveConfig: any = null;
let mockModeHistory: any[] = [];

// Mock TrustModeService
jest.mock("@/lib/trust-mode/trust-mode.service", () => ({
  trustModeService: {
    getEffectiveConfig: jest.fn(() => Promise.resolve(mockEffectiveConfig)),
    getModeHistory: jest.fn(() => Promise.resolve(mockModeHistory)),
  },
}));

// Mock logger
jest.mock("@/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

import { recommendTrustModeTool } from "../recommend-trust-mode.tool";
import { trustModeService } from "@/lib/trust-mode/trust-mode.service";

describe("recommendTrustModeTool", () => {
  const mockContext: ToolContext = {
    userId: "test-user-123",
    conversationId: "test-conv-456",
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockEffectiveConfig = null;
    mockModeHistory = [];
  });

  describe("definition", () => {
    it("should have correct metadata", () => {
      expect(recommendTrustModeTool.definition.name).toBe(
        "recommend_trust_mode",
      );
      expect(recommendTrustModeTool.definition.category).toBe("query");
      expect(recommendTrustModeTool.definition.requiresConfirmation).toBe(
        false,
      );
      expect(recommendTrustModeTool.definition.estimatedDurationMs).toBe(200);
    });

    it("should have considerHistory parameter", () => {
      const schema = recommendTrustModeTool.definition.parameters;
      const parsed = schema.parse({ considerHistory: false });
      expect(parsed.considerHistory).toBe(false);
    });

    it("should default considerHistory to true", () => {
      const schema = recommendTrustModeTool.definition.parameters;
      const parsed = schema.parse({});
      expect(parsed.considerHistory).toBe(true);
    });
  });

  describe("execute - high correction rate scenario", () => {
    beforeEach(() => {
      mockEffectiveConfig = {
        mode: "full_auto",
        config: {
          mode: "full_auto",
          classification: {
            autoClassify: true,
            requireConfirmation: false,
            lowConfidenceAction: "auto_inbox_then_cluster",
          },
          folderManagement: {
            autoCreate: true,
            autoMerge: true,
            autoSplit: true,
            autoRename: true,
          },
          notification: {},
          learning: {
            learnFromManualMoves: true,
            learnFromDeletions: true,
          },
        },
        stats: {
          autoDecisions: 70,
          userCorrections: 30, // 30% 纠正率
          pendingConfirmations: 0,
          correctionRate: 0.3,
        },
      };
      mockModeHistory = [];
    });

    it("should recommend semi_auto when correction rate is high", async () => {
      const result = await recommendTrustModeTool.execute({}, mockContext);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.current.mode).toBe("full_auto");
        expect(result.data.recommendation.mode).toBe("semi_auto");
        expect(result.data.recommendation.isChange).toBe(true);
        expect(result.data.metrics.correctionRate).toBe(30);
      }
    });

    it("should include correction rate factor", async () => {
      const result = await recommendTrustModeTool.execute({}, mockContext);

      expect(result.success).toBe(true);
      if (result.success) {
        const correctionFactor = result.data.reasoning.factors.find(
          (f) => f.name === "纠正率",
        );
        expect(correctionFactor).toBeDefined();
        expect(correctionFactor?.impact).toBe("negative");
      }
    });
  });

  describe("execute - low correction rate scenario", () => {
    beforeEach(() => {
      mockEffectiveConfig = {
        mode: "semi_auto",
        config: {
          mode: "semi_auto",
          classification: {
            autoClassify: true,
            requireConfirmation: false,
            lowConfidenceAction: "pending_with_message",
            confirmationThreshold: 60,
          },
          folderManagement: {
            autoCreate: false,
            autoMerge: false,
            autoSplit: false,
            autoRename: false,
          },
          notification: {},
          learning: {
            learnFromManualMoves: true,
            learnFromDeletions: true,
          },
        },
        stats: {
          autoDecisions: 95,
          userCorrections: 2, // ~2% 纠正率
          pendingConfirmations: 0,
          correctionRate: 0.02,
        },
      };
      mockModeHistory = [];
    });

    it("should recommend full_auto when correction rate is low and data sufficient", async () => {
      const result = await recommendTrustModeTool.execute({}, mockContext);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.current.mode).toBe("semi_auto");
        expect(result.data.recommendation.mode).toBe("full_auto");
        expect(result.data.recommendation.isChange).toBe(true);
        expect(result.data.metrics.hasSufficientData).toBe(true);
      }
    });
  });

  describe("execute - insufficient data scenario", () => {
    beforeEach(() => {
      mockEffectiveConfig = {
        mode: "full_auto",
        config: {
          mode: "full_auto",
          classification: {
            autoClassify: true,
            requireConfirmation: false,
            lowConfidenceAction: "auto_inbox_then_cluster",
          },
          folderManagement: {
            autoCreate: true,
            autoMerge: true,
            autoSplit: true,
            autoRename: true,
          },
          notification: {},
          learning: {
            learnFromManualMoves: true,
            learnFromDeletions: true,
          },
        },
        stats: {
          autoDecisions: 5, // 不足 MIN_DECISION_SAMPLES
          userCorrections: 0,
          pendingConfirmations: 0,
          correctionRate: 0,
        },
      };
      mockModeHistory = [];
    });

    it("should recommend keeping current mode with insufficient data", async () => {
      const result = await recommendTrustModeTool.execute({}, mockContext);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.recommendation.mode).toBe("full_auto");
        expect(result.data.recommendation.isChange).toBe(false);
        expect(result.data.metrics.hasSufficientData).toBe(false);
      }
    });

    it("should have low confidence when data insufficient", async () => {
      const result = await recommendTrustModeTool.execute({}, mockContext);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.recommendation.confidence).toBeLessThanOrEqual(50);
      }
    });
  });

  describe("execute - pending confirmations backlog scenario", () => {
    beforeEach(() => {
      mockEffectiveConfig = {
        mode: "semi_auto",
        config: {
          mode: "semi_auto",
          classification: {
            autoClassify: true,
            requireConfirmation: false,
            lowConfidenceAction: "pending_with_message",
            confirmationThreshold: 60,
          },
          folderManagement: {
            autoCreate: false,
            autoMerge: false,
            autoSplit: false,
            autoRename: false,
          },
          notification: {},
          learning: {
            learnFromManualMoves: true,
            learnFromDeletions: true,
          },
        },
        stats: {
          autoDecisions: 50,
          userCorrections: 5,
          pendingConfirmations: 25, // 高于阈值
          correctionRate: 0.1,
        },
      };
      mockModeHistory = [];
    });

    it("should identify pending backlog issue", async () => {
      const result = await recommendTrustModeTool.execute({}, mockContext);

      expect(result.success).toBe(true);
      if (result.success) {
        const pendingFactor = result.data.reasoning.factors.find(
          (f) => f.name === "待确认积压",
        );
        expect(pendingFactor).toBeDefined();
        expect(pendingFactor?.impact).toBe("negative");
      }
    });
  });

  describe("execute - mode stability check", () => {
    beforeEach(() => {
      mockEffectiveConfig = {
        mode: "full_auto",
        config: {
          mode: "full_auto",
          classification: {
            autoClassify: true,
            requireConfirmation: false,
            lowConfidenceAction: "auto_inbox_then_cluster",
          },
          folderManagement: {
            autoCreate: true,
            autoMerge: true,
            autoSplit: true,
            autoRename: true,
          },
          notification: {},
          learning: {
            learnFromManualMoves: true,
            learnFromDeletions: true,
          },
        },
        stats: {
          autoDecisions: 60,
          userCorrections: 25, // 高纠正率
          pendingConfirmations: 0,
          correctionRate: 0.42,
        },
      };

      // 刚切换 2 天
      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
      mockModeHistory = [
        {
          from: "semi_auto",
          to: "full_auto",
          timestamp: twoDaysAgo.toISOString(),
        },
      ];
    });

    it("should consider recent mode change and reduce confidence", async () => {
      const result = await recommendTrustModeTool.execute(
        { considerHistory: true },
        mockContext,
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.metrics.daysSinceLastChange).toBeLessThan(
          RECOMMENDATION_THRESHOLDS.MODE_STABILITY_DAYS,
        );
        // 应该有稳定期因素
        const stabilityFactor = result.data.reasoning.factors.find(
          (f) => f.name === "模式稳定期",
        );
        expect(stabilityFactor).toBeDefined();
      }
    });

    it("should not consider history when disabled", async () => {
      const result = await recommendTrustModeTool.execute(
        { considerHistory: false },
        mockContext,
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.metrics.daysSinceLastChange).toBeUndefined();
      }
    });
  });

  describe("execute - no change needed scenario", () => {
    beforeEach(() => {
      mockEffectiveConfig = {
        mode: "semi_auto",
        config: {
          mode: "semi_auto",
          classification: {
            autoClassify: true,
            requireConfirmation: false,
            lowConfidenceAction: "pending_with_message",
            confirmationThreshold: 60,
          },
          folderManagement: {
            autoCreate: false,
            autoMerge: false,
            autoSplit: false,
            autoRename: false,
          },
          notification: {},
          learning: {
            learnFromManualMoves: true,
            learnFromDeletions: true,
          },
        },
        stats: {
          autoDecisions: 80,
          userCorrections: 12, // 15% - 正常范围
          pendingConfirmations: 3,
          correctionRate: 0.15,
        },
      };
      mockModeHistory = [];
    });

    it("should recommend keeping current mode when metrics are normal", async () => {
      const result = await recommendTrustModeTool.execute({}, mockContext);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.recommendation.mode).toBe("semi_auto");
        expect(result.data.recommendation.isChange).toBe(false);
        expect(result.data.message).toContain("保持当前");
      }
    });
  });

  describe("execute - error handling", () => {
    it("should handle service errors gracefully", async () => {
      (trustModeService.getEffectiveConfig as jest.Mock).mockRejectedValueOnce(
        new Error("Database error"),
      );

      const result = await recommendTrustModeTool.execute({}, mockContext);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("获取推荐失败");
        expect(result.errorCode).toBe("EXECUTION_ERROR");
      }
    });
  });

  describe("execute - metadata", () => {
    beforeEach(() => {
      mockEffectiveConfig = {
        mode: "full_auto",
        config: {
          mode: "full_auto",
          classification: {
            autoClassify: true,
            requireConfirmation: false,
            lowConfidenceAction: "auto_inbox_then_cluster",
          },
          folderManagement: {
            autoCreate: true,
            autoMerge: true,
            autoSplit: true,
            autoRename: true,
          },
          notification: {},
          learning: {
            learnFromManualMoves: true,
            learnFromDeletions: true,
          },
        },
        stats: {
          autoDecisions: 50,
          userCorrections: 5,
          pendingConfirmations: 0,
          correctionRate: 0.1,
        },
      };
      mockModeHistory = [];
    });

    it("should include execution time in metadata", async () => {
      const result = await recommendTrustModeTool.execute({}, mockContext);

      expect(result.success).toBe(true);
      expect(result.metadata?.executionTimeMs).toBeDefined();
      expect(result.metadata?.executionTimeMs).toBeGreaterThanOrEqual(0);
    });
  });
});
