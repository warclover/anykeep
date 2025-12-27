/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * get-trust-mode.tool.ts 单元测试
 *
 * @version 1.0.0
 * @since 2025-12-27
 */

import type { ToolContext } from "../../types";

// Mock 变量
let mockEffectiveConfig: any = null;

// Mock TrustModeService
jest.mock("@/lib/trust-mode/trust-mode.service", () => ({
  trustModeService: {
    getEffectiveConfig: jest.fn(() => Promise.resolve(mockEffectiveConfig)),
  },
}));

// Mock logger
jest.mock("@/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

import { getTrustModeTool } from "../get-trust-mode.tool";
import { trustModeService } from "@/lib/trust-mode/trust-mode.service";

describe("getTrustModeTool", () => {
  const mockContext: ToolContext = {
    userId: "test-user-123",
    conversationId: "test-conv-456",
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockEffectiveConfig = null;
  });

  describe("definition", () => {
    it("should have correct metadata", () => {
      expect(getTrustModeTool.definition.name).toBe("get_trust_mode");
      expect(getTrustModeTool.definition.category).toBe("query");
      expect(getTrustModeTool.definition.requiresConfirmation).toBe(false);
      expect(getTrustModeTool.definition.estimatedDurationMs).toBe(50);
    });

    it("should have includeStats parameter", () => {
      const schema = getTrustModeTool.definition.parameters;
      const parsed = schema.parse({ includeStats: true });
      expect(parsed.includeStats).toBe(true);
    });

    it("should default includeStats to false", () => {
      const schema = getTrustModeTool.definition.parameters;
      const parsed = schema.parse({});
      expect(parsed.includeStats).toBe(false);
    });
  });

  describe("execute - full_auto mode", () => {
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
          notification: {
            onMajorReorganization: true,
          },
          learning: {
            learnFromManualMoves: true,
            learnFromDeletions: true,
          },
        },
        stats: {
          autoDecisions: 100,
          userCorrections: 5,
          pendingConfirmations: 0,
          correctionRate: 0.05,
        },
      };
    });

    it("should return full_auto mode details", async () => {
      const result = await getTrustModeTool.execute({}, mockContext);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.mode).toBe("full_auto");
        expect(result.data.label).toBe("完全托管");
        expect(result.data.behavior.autoClassify).toBe(true);
        expect(result.data.behavior.requiresConfirmation).toBe(false);
        expect(result.data.behavior.lowConfidenceAction).toBe(
          "auto_inbox_then_cluster",
        );
      }
    });

    it("should not include stats by default", async () => {
      const result = await getTrustModeTool.execute({}, mockContext);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.stats).toBeUndefined();
      }
    });

    it("should include stats when requested", async () => {
      const result = await getTrustModeTool.execute(
        { includeStats: true },
        mockContext,
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.stats).toBeDefined();
        expect(result.data.stats?.autoDecisions).toBe(100);
        expect(result.data.stats?.userCorrections).toBe(5);
        expect(result.data.stats?.correctionRate).toBe(0.05);
      }
    });
  });

  describe("execute - semi_auto mode", () => {
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
            suggestAndWait: true,
          },
          notification: {
            onLowConfidence: true,
            onFolderSuggestion: true,
          },
          learning: {
            learnFromManualMoves: true,
            learnFromDeletions: true,
            askForFeedback: true,
          },
        },
        stats: {
          autoDecisions: 50,
          userCorrections: 10,
          pendingConfirmations: 5,
          correctionRate: 0.2,
        },
      };
    });

    it("should return semi_auto mode details", async () => {
      const result = await getTrustModeTool.execute({}, mockContext);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.mode).toBe("semi_auto");
        expect(result.data.label).toBe("半托管");
        expect(result.data.behavior.lowConfidenceAction).toBe(
          "pending_with_message",
        );
        expect(result.data.behavior.confirmationThreshold).toBe(60);
      }
    });
  });

  describe("execute - manual mode", () => {
    beforeEach(() => {
      mockEffectiveConfig = {
        mode: "manual",
        config: {
          mode: "manual",
          classification: {
            autoClassify: false,
            requireConfirmation: false,
            lowConfidenceAction: "direct_inbox",
            defaultDestination: "inbox",
            aiSummaryOnly: true,
          },
          folderManagement: {
            autoCreate: false,
            autoMerge: false,
            autoSplit: false,
            autoRename: false,
            suggestOnDemand: true,
          },
          notification: {
            enabled: false,
          },
          learning: {
            learnFromManualMoves: false,
            learnFromDeletions: false,
            preservePreferences: true,
          },
        },
        stats: {
          autoDecisions: 0,
          userCorrections: 0,
          pendingConfirmations: 0,
          correctionRate: 0,
        },
      };
    });

    it("should return manual mode details", async () => {
      const result = await getTrustModeTool.execute({}, mockContext);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.mode).toBe("manual");
        expect(result.data.label).toBe("不托管");
        expect(result.data.behavior.autoClassify).toBe(false);
        expect(result.data.behavior.lowConfidenceAction).toBe("direct_inbox");
      }
    });
  });

  describe("execute - error handling", () => {
    it("should handle service errors gracefully", async () => {
      (trustModeService.getEffectiveConfig as jest.Mock).mockRejectedValueOnce(
        new Error("Database connection failed"),
      );

      const result = await getTrustModeTool.execute({}, mockContext);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("获取信任模式失败");
        expect(result.error).toContain("Database connection failed");
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
          autoDecisions: 0,
          userCorrections: 0,
          pendingConfirmations: 0,
          correctionRate: 0,
        },
      };
    });

    it("should include execution time in metadata", async () => {
      const result = await getTrustModeTool.execute({}, mockContext);

      expect(result.success).toBe(true);
      expect(result.metadata?.executionTimeMs).toBeDefined();
      expect(result.metadata?.executionTimeMs).toBeGreaterThanOrEqual(0);
    });
  });
});
