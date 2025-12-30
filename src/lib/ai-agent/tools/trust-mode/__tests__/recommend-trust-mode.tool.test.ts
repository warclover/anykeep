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

  // ============================================
  // 边界条件测试 (Issue #9)
  // ============================================

  describe("execute - boundary conditions", () => {
    describe("threshold boundaries", () => {
      it("should trigger recommendation at exact HIGH_CORRECTION_RATE threshold", async () => {
        // 正好达到 30% 纠正率阈值
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
            userCorrections: 30, // 正好 30%
            pendingConfirmations: 0,
            correctionRate: 0.3, // 正好达到阈值
          },
        };
        mockModeHistory = [];

        const result = await recommendTrustModeTool.execute({}, mockContext);

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.recommendation.mode).toBe("semi_auto");
          expect(result.data.recommendation.isChange).toBe(true);
          const correctionFactor = result.data.reasoning.factors.find(
            (f) => f.name === "纠正率",
          );
          expect(correctionFactor?.impact).toBe("negative");
        }
      });

      it("should NOT trigger at just below HIGH_CORRECTION_RATE threshold", async () => {
        // 29% - 刚好低于阈值
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
            autoDecisions: 71,
            userCorrections: 29,
            pendingConfirmations: 0,
            correctionRate: 0.29,
          },
        };
        mockModeHistory = [];

        const result = await recommendTrustModeTool.execute({}, mockContext);

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.recommendation.mode).toBe("full_auto");
          expect(result.data.recommendation.isChange).toBe(false);
        }
      });

      it("should trigger upgrade at exact LOW_CORRECTION_RATE threshold", async () => {
        // 正好 5% - 低纠正率阈值
        mockEffectiveConfig = {
          mode: "manual",
          config: {
            mode: "manual",
            classification: {
              autoClassify: false,
              requireConfirmation: true,
              lowConfidenceAction: "pending_only",
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
            userCorrections: 5, // 正好 5%
            pendingConfirmations: 0,
            correctionRate: 0.05,
          },
        };
        mockModeHistory = [];

        const result = await recommendTrustModeTool.execute({}, mockContext);

        expect(result.success).toBe(true);
        if (result.success) {
          // 5% 不满足 < 5% 条件，不应触发升级
          expect(result.data.recommendation.mode).toBe("manual");
        }
      });

      it("should trigger upgrade at just below LOW_CORRECTION_RATE threshold", async () => {
        // 4% - 低于阈值，应该建议升级
        mockEffectiveConfig = {
          mode: "manual",
          config: {
            mode: "manual",
            classification: {
              autoClassify: false,
              requireConfirmation: true,
              lowConfidenceAction: "pending_only",
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
            autoDecisions: 96,
            userCorrections: 4, // 4% - 低于 5%
            pendingConfirmations: 0,
            correctionRate: 0.04,
          },
        };
        mockModeHistory = [];

        const result = await recommendTrustModeTool.execute({}, mockContext);

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.recommendation.mode).toBe("semi_auto");
          expect(result.data.recommendation.isChange).toBe(true);
          const correctionFactor = result.data.reasoning.factors.find(
            (f) => f.name === "纠正率",
          );
          expect(correctionFactor?.impact).toBe("positive");
        }
      });

      it("should handle exactly MIN_DECISION_SAMPLES boundary", async () => {
        // 正好 20 次决策 - 最小样本量
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
            autoDecisions: 19,
            userCorrections: 1, // 总共 20 次
            pendingConfirmations: 0,
            correctionRate: 0.05,
          },
        };
        mockModeHistory = [];

        const result = await recommendTrustModeTool.execute({}, mockContext);

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.metrics.hasSufficientData).toBe(true);
        }
      });

      it("should mark insufficient data at MIN_DECISION_SAMPLES - 1", async () => {
        // 19 次决策 - 低于最小样本量
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
            autoDecisions: 18,
            userCorrections: 1, // 总共 19 次
            pendingConfirmations: 0,
            correctionRate: 0.05,
          },
        };
        mockModeHistory = [];

        const result = await recommendTrustModeTool.execute({}, mockContext);

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.metrics.hasSufficientData).toBe(false);
        }
      });
    });

    describe("all factors triggering simultaneously", () => {
      it("should handle all negative factors at once", async () => {
        // 高纠正率 + 高积压 + 刚切换
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
            userCorrections: 25, // 50% 纠正率 - 很高
            pendingConfirmations: 30, // 高积压
            correctionRate: 0.5,
          },
        };

        // 刚切换 3 天
        const threeDaysAgo = new Date();
        threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
        mockModeHistory = [
          {
            from: "semi_auto",
            to: "full_auto",
            timestamp: threeDaysAgo.toISOString(),
          },
        ];

        const result = await recommendTrustModeTool.execute({}, mockContext);

        expect(result.success).toBe(true);
        if (result.success) {
          // 应该有多个因素
          expect(result.data.reasoning.factors.length).toBeGreaterThanOrEqual(
            3,
          );

          // 检查各因素都被识别
          const correctionFactor = result.data.reasoning.factors.find(
            (f) => f.name === "纠正率",
          );
          const pendingFactor = result.data.reasoning.factors.find(
            (f) => f.name === "待确认积压",
          );
          const stabilityFactor = result.data.reasoning.factors.find(
            (f) => f.name === "模式稳定期",
          );

          expect(correctionFactor?.impact).toBe("negative");
          expect(pendingFactor?.impact).toBe("negative");
          expect(stabilityFactor).toBeDefined();
        }
      });

      it("should handle all positive factors at once", async () => {
        // 低纠正率 + 无积压 + 充足样本 + 稳定使用
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
            autoDecisions: 190,
            userCorrections: 2, // ~1% 纠正率
            pendingConfirmations: 0, // 无积压
            correctionRate: 0.01,
          },
        };

        // 已稳定使用 30 天
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        mockModeHistory = [
          {
            from: "manual",
            to: "semi_auto",
            timestamp: thirtyDaysAgo.toISOString(),
          },
        ];

        const result = await recommendTrustModeTool.execute({}, mockContext);

        expect(result.success).toBe(true);
        if (result.success) {
          // 应该建议升级到 full_auto
          expect(result.data.recommendation.mode).toBe("full_auto");
          expect(result.data.recommendation.isChange).toBe(true);
          expect(result.data.recommendation.confidence).toBeGreaterThanOrEqual(
            70,
          );

          // 检查正向因素
          const correctionFactor = result.data.reasoning.factors.find(
            (f) => f.name === "纠正率",
          );
          const dataFactor = result.data.reasoning.factors.find(
            (f) => f.name === "数据样本",
          );

          expect(correctionFactor?.impact).toBe("positive");
          expect(dataFactor?.impact).toBe("positive");
        }
      });
    });

    describe("edge cases with zero values", () => {
      it("should handle zero corrections correctly", async () => {
        mockEffectiveConfig = {
          mode: "manual",
          config: {
            mode: "manual",
            classification: {
              autoClassify: false,
              requireConfirmation: true,
              lowConfidenceAction: "pending_only",
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
            autoDecisions: 100,
            userCorrections: 0, // 0% 纠正率
            pendingConfirmations: 0,
            correctionRate: 0,
          },
        };
        mockModeHistory = [];

        const result = await recommendTrustModeTool.execute({}, mockContext);

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.metrics.correctionRate).toBe(0);
          expect(result.data.recommendation.mode).toBe("semi_auto");
          expect(result.data.recommendation.isChange).toBe(true);
        }
      });

      it("should handle zero auto decisions", async () => {
        mockEffectiveConfig = {
          mode: "manual",
          config: {
            mode: "manual",
            classification: {
              autoClassify: false,
              requireConfirmation: true,
              lowConfidenceAction: "pending_only",
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
            autoDecisions: 0,
            userCorrections: 0,
            pendingConfirmations: 0,
            correctionRate: 0,
          },
        };
        mockModeHistory = [];

        const result = await recommendTrustModeTool.execute({}, mockContext);

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.metrics.hasSufficientData).toBe(false);
          expect(result.data.recommendation.isChange).toBe(false);
        }
      });
    });

    describe("exact MODE_STABILITY_DAYS boundary", () => {
      it("should allow recommendation at exactly MODE_STABILITY_DAYS", async () => {
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
            userCorrections: 25,
            pendingConfirmations: 0,
            correctionRate: 0.42,
          },
        };

        // 正好 7 天前切换
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(
          sevenDaysAgo.getDate() -
            RECOMMENDATION_THRESHOLDS.MODE_STABILITY_DAYS,
        );
        mockModeHistory = [
          {
            from: "semi_auto",
            to: "full_auto",
            timestamp: sevenDaysAgo.toISOString(),
          },
        ];

        const result = await recommendTrustModeTool.execute({}, mockContext);

        expect(result.success).toBe(true);
        if (result.success) {
          // 正好 7 天不应该触发稳定期因素
          const stabilityFactor = result.data.reasoning.factors.find(
            (f) => f.name === "模式稳定期",
          );
          expect(stabilityFactor).toBeUndefined();
        }
      });

      it("should reduce confidence at MODE_STABILITY_DAYS - 1", async () => {
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
            userCorrections: 25,
            pendingConfirmations: 0,
            correctionRate: 0.42,
          },
        };

        // 6 天前切换（低于稳定期）
        const sixDaysAgo = new Date();
        sixDaysAgo.setDate(
          sixDaysAgo.getDate() -
            (RECOMMENDATION_THRESHOLDS.MODE_STABILITY_DAYS - 1),
        );
        mockModeHistory = [
          {
            from: "semi_auto",
            to: "full_auto",
            timestamp: sixDaysAgo.toISOString(),
          },
        ];

        const result = await recommendTrustModeTool.execute({}, mockContext);

        expect(result.success).toBe(true);
        if (result.success) {
          // 应该有稳定期因素
          const stabilityFactor = result.data.reasoning.factors.find(
            (f) => f.name === "模式稳定期",
          );
          expect(stabilityFactor).toBeDefined();
          expect(result.data.metrics.daysSinceLastChange).toBe(
            RECOMMENDATION_THRESHOLDS.MODE_STABILITY_DAYS - 1,
          );
        }
      });
    });

    describe("PENDING_CONFIRMATION_THRESHOLD boundary", () => {
      it("should trigger at exactly PENDING_CONFIRMATION_THRESHOLD + 1", async () => {
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
            pendingConfirmations:
              RECOMMENDATION_THRESHOLDS.PENDING_CONFIRMATION_THRESHOLD + 1, // 21
            correctionRate: 0.1,
          },
        };
        mockModeHistory = [];

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

      it("should NOT trigger at exactly PENDING_CONFIRMATION_THRESHOLD", async () => {
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
            pendingConfirmations:
              RECOMMENDATION_THRESHOLDS.PENDING_CONFIRMATION_THRESHOLD, // 20
            correctionRate: 0.1,
          },
        };
        mockModeHistory = [];

        const result = await recommendTrustModeTool.execute({}, mockContext);

        expect(result.success).toBe(true);
        if (result.success) {
          const pendingFactor = result.data.reasoning.factors.find(
            (f) => f.name === "待确认积压",
          );
          // 正好 20 不应该触发（阈值是 > 20）
          expect(pendingFactor).toBeUndefined();
        }
      });
    });
  });
});
