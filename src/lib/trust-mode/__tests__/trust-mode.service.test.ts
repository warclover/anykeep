/**
 * Trust Mode Service Unit Tests
 * V4.2 托管模式服务测试
 *
 * @version 1.0.0
 * @since 2025-12-11
 */

import type { ClassificationDecisionContext } from "../trust-mode.service";
import { TrustModeService } from "../trust-mode.service";
import { TrustModeRepository } from "../trust-mode.repository";
import type { UserTrustModeRecord } from "@/types/trust-mode";

// ============================================================================
// Mock 设置
// ============================================================================

// Mock Supabase
jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(),
}));

// Mock Repository
jest.mock("../trust-mode.repository");

describe("TrustModeService", () => {
  let service: TrustModeService;
  let mockRepository: jest.Mocked<TrustModeRepository>;

  // 标准测试用户
  const testUserId = "test-user-123";

  // 创建模拟记录
  const createMockRecord = (
    mode: "full_auto" | "semi_auto" | "manual",
    overrides?: Record<string, unknown>,
  ): UserTrustModeRecord => ({
    id: 1,
    user_id: testUserId,
    trust_mode: mode,
    overrides: overrides || {},
    mode_history: [],
    auto_decisions_count: 100,
    user_corrections_count: 5,
    pending_confirmations_count: 3,
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
  });

  beforeEach(() => {
    // 重置所有 mock
    jest.clearAllMocks();

    // 创建 mock repository
    mockRepository = {
      findByUserId: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateOverrides: jest.fn(),
      getOrCreate: jest.fn(),
      incrementStats: jest.fn(),
      resetPendingCount: jest.fn(),
      getModeHistory: jest.fn(),
      delete: jest.fn(),
    } as unknown as jest.Mocked<TrustModeRepository>;

    // Mock TrustModeRepository 构造函数
    (TrustModeRepository as jest.Mock).mockImplementation(() => mockRepository);

    // 创建服务实例
    service = new TrustModeService();

    // Mock getSupabase 方法

    (service as any).getSupabase = jest.fn().mockResolvedValue({});
  });

  // ============================================================================
  // 静态方法测试
  // ============================================================================

  describe("Static Methods", () => {
    describe("checkRequiresConfirmation", () => {
      it("should return false for full_auto mode regardless of confidence", () => {
        expect(
          TrustModeService.checkRequiresConfirmation("full_auto", 90),
        ).toBe(false);
        expect(
          TrustModeService.checkRequiresConfirmation("full_auto", 50),
        ).toBe(false);
        expect(
          TrustModeService.checkRequiresConfirmation("full_auto", 20),
        ).toBe(false);
      });

      it("should return false for manual mode regardless of confidence", () => {
        expect(TrustModeService.checkRequiresConfirmation("manual", 90)).toBe(
          false,
        );
        expect(TrustModeService.checkRequiresConfirmation("manual", 50)).toBe(
          false,
        );
        expect(TrustModeService.checkRequiresConfirmation("manual", 20)).toBe(
          false,
        );
      });

      it("should return true for semi_auto mode when confidence is below threshold", () => {
        // semi_auto 阈值通常是 MEDIUM (60)
        expect(
          TrustModeService.checkRequiresConfirmation("semi_auto", 59),
        ).toBe(true);
        expect(
          TrustModeService.checkRequiresConfirmation("semi_auto", 40),
        ).toBe(true);
      });

      it("should return false for semi_auto mode when confidence is above threshold", () => {
        expect(
          TrustModeService.checkRequiresConfirmation("semi_auto", 70),
        ).toBe(false);
        expect(
          TrustModeService.checkRequiresConfirmation("semi_auto", 90),
        ).toBe(false);
      });
    });

    describe("checkShouldAutoClassify", () => {
      it("should return true for full_auto mode", () => {
        expect(TrustModeService.checkShouldAutoClassify("full_auto")).toBe(
          true,
        );
      });

      it("should return true for semi_auto mode", () => {
        expect(TrustModeService.checkShouldAutoClassify("semi_auto")).toBe(
          true,
        );
      });

      it("should return false for manual mode", () => {
        expect(TrustModeService.checkShouldAutoClassify("manual")).toBe(false);
      });
    });

    describe("checkShouldAutoCreateFolder", () => {
      it("should return true for full_auto mode", () => {
        expect(TrustModeService.checkShouldAutoCreateFolder("full_auto")).toBe(
          true,
        );
      });

      it("should return false for semi_auto mode", () => {
        expect(TrustModeService.checkShouldAutoCreateFolder("semi_auto")).toBe(
          false,
        );
      });

      it("should return false for manual mode", () => {
        expect(TrustModeService.checkShouldAutoCreateFolder("manual")).toBe(
          false,
        );
      });
    });

    describe("getLowConfidenceAction", () => {
      it("should return auto_inbox_then_cluster for full_auto mode", () => {
        expect(TrustModeService.getLowConfidenceAction("full_auto")).toBe(
          "auto_inbox_then_cluster",
        );
      });

      it("should return pending_with_message for semi_auto mode", () => {
        expect(TrustModeService.getLowConfidenceAction("semi_auto")).toBe(
          "pending_with_message",
        );
      });

      it("should return direct_inbox for manual mode", () => {
        expect(TrustModeService.getLowConfidenceAction("manual")).toBe(
          "direct_inbox",
        );
      });
    });
  });

  // ============================================================================
  // 实例方法测试
  // ============================================================================

  describe("Instance Methods", () => {
    describe("getUserTrustMode", () => {
      it("should return user trust mode from repository", async () => {
        mockRepository.findByUserId.mockResolvedValue(
          createMockRecord("semi_auto"),
        );

        const mode = await service.getUserTrustMode(testUserId);

        expect(mode).toBe("semi_auto");
        expect(mockRepository.findByUserId).toHaveBeenCalledWith(testUserId);
      });

      it("should return full_auto as default when no record exists", async () => {
        mockRepository.findByUserId.mockResolvedValue(null);

        const mode = await service.getUserTrustMode(testUserId);

        expect(mode).toBe("full_auto");
      });
    });

    describe("getEffectiveConfig", () => {
      it("should return effective config with stats", async () => {
        const mockRecord = createMockRecord("full_auto");
        mockRepository.getOrCreate.mockResolvedValue(mockRecord);

        const result = await service.getEffectiveConfig(testUserId);

        expect(result.mode).toBe("full_auto");
        expect(result.config).toBeDefined();
        expect(result.config.mode).toBe("full_auto");
        expect(result.stats.autoDecisions).toBe(100);
        expect(result.stats.userCorrections).toBe(5);
        expect(result.stats.pendingConfirmations).toBe(3);
      });

      it("should calculate correction rate correctly", async () => {
        const mockRecord = createMockRecord("full_auto");
        mockRecord.auto_decisions_count = 90;
        mockRecord.user_corrections_count = 10;
        mockRepository.getOrCreate.mockResolvedValue(mockRecord);

        const result = await service.getEffectiveConfig(testUserId);

        // 10 / (90 + 10) = 0.1
        expect(result.stats.correctionRate).toBe(0.1);
      });

      it("should return zero correction rate when no decisions", async () => {
        const mockRecord = createMockRecord("full_auto");
        mockRecord.auto_decisions_count = 0;
        mockRecord.user_corrections_count = 0;
        mockRepository.getOrCreate.mockResolvedValue(mockRecord);

        const result = await service.getEffectiveConfig(testUserId);

        expect(result.stats.correctionRate).toBe(0);
      });
    });

    describe("updateTrustMode", () => {
      it("should update trust mode via repository", async () => {
        const updatedRecord = createMockRecord("manual");
        mockRepository.update.mockResolvedValue(updatedRecord);

        const result = await service.updateTrustMode(
          testUserId,
          "manual",
          "User preference",
        );

        expect(result.trust_mode).toBe("manual");
        expect(mockRepository.update).toHaveBeenCalledWith({
          userId: testUserId,
          trustMode: "manual",
          reason: "User preference",
        });
      });
    });

    describe("updateOverrides", () => {
      it("should update overrides via repository", async () => {
        const updatedRecord = createMockRecord("full_auto");
        mockRepository.updateOverrides.mockResolvedValue(updatedRecord);

        const overrides = {
          classification: {
            autoClassify: true,
            requireConfirmation: false,
            confirmationThreshold: 70,
            lowConfidenceAction: "auto_inbox_then_cluster" as const,
          },
        };

        await service.updateOverrides(testUserId, overrides);

        expect(mockRepository.updateOverrides).toHaveBeenCalledWith(
          testUserId,
          overrides,
        );
      });
    });

    describe("getClassificationDecision", () => {
      describe("Manual Mode", () => {
        it("should never auto execute in manual mode", async () => {
          mockRepository.getOrCreate.mockResolvedValue(
            createMockRecord("manual"),
          );

          const context: ClassificationDecisionContext = {
            userId: testUserId,
            confidence: 95,
          };

          const decision = await service.getClassificationDecision(context);

          expect(decision.shouldAutoExecute).toBe(false);
          expect(decision.requiresConfirmation).toBe(false);
          expect(decision.lowConfidenceAction).toBe("direct_inbox");
        });
      });

      describe("Full Auto Mode", () => {
        it("should always auto execute in full_auto mode", async () => {
          mockRepository.getOrCreate.mockResolvedValue(
            createMockRecord("full_auto"),
          );

          const context: ClassificationDecisionContext = {
            userId: testUserId,
            confidence: 85,
          };

          const decision = await service.getClassificationDecision(context);

          expect(decision.shouldAutoExecute).toBe(true);
          expect(decision.requiresConfirmation).toBe(false);
        });

        it("should handle low confidence in full_auto mode", async () => {
          mockRepository.getOrCreate.mockResolvedValue(
            createMockRecord("full_auto"),
          );

          const context: ClassificationDecisionContext = {
            userId: testUserId,
            confidence: 30, // 低于 MEDIUM 阈值
          };

          const decision = await service.getClassificationDecision(context);

          expect(decision.shouldAutoExecute).toBe(true);
          expect(decision.lowConfidenceAction).toBe("auto_inbox_then_cluster");
          expect(decision.reason).toContain("low confidence");
        });

        it("should not notify on new folder creation by default in full_auto mode", async () => {
          mockRepository.getOrCreate.mockResolvedValue(
            createMockRecord("full_auto"),
          );

          const context: ClassificationDecisionContext = {
            userId: testUserId,
            confidence: 85,
            isNewFolder: true,
          };

          const decision = await service.getClassificationDecision(context);

          // full_auto 模式配置中 onFolderCreate 为 false（仅 onMajorReorganization 为 true）
          expect(decision.shouldNotify).toBe(false);
        });
      });

      describe("Semi Auto Mode", () => {
        it("should auto execute when confidence is above threshold", async () => {
          mockRepository.getOrCreate.mockResolvedValue(
            createMockRecord("semi_auto"),
          );

          const context: ClassificationDecisionContext = {
            userId: testUserId,
            confidence: 80, // 高于阈值
          };

          const decision = await service.getClassificationDecision(context);

          expect(decision.shouldAutoExecute).toBe(true);
          expect(decision.requiresConfirmation).toBe(false);
        });

        it("should require confirmation when confidence is below threshold", async () => {
          mockRepository.getOrCreate.mockResolvedValue(
            createMockRecord("semi_auto"),
          );

          const context: ClassificationDecisionContext = {
            userId: testUserId,
            confidence: 50, // 低于阈值
          };

          const decision = await service.getClassificationDecision(context);

          expect(decision.shouldAutoExecute).toBe(false);
          expect(decision.requiresConfirmation).toBe(true);
          expect(decision.shouldNotify).toBe(true);
        });
      });
    });

    describe("getFolderOperationDecision", () => {
      it("should return all false for manual mode", async () => {
        mockRepository.getOrCreate.mockResolvedValue(
          createMockRecord("manual"),
        );

        const decision = await service.getFolderOperationDecision(
          testUserId,
          "create",
        );

        expect(decision.shouldAutoExecute).toBe(false);
        expect(decision.requiresConfirmation).toBe(false);
        expect(decision.shouldNotify).toBe(false);
      });

      it("should auto execute folder operations in full_auto mode", async () => {
        mockRepository.getOrCreate.mockResolvedValue(
          createMockRecord("full_auto"),
        );

        const createDecision = await service.getFolderOperationDecision(
          testUserId,
          "create",
        );
        expect(createDecision.shouldAutoExecute).toBe(true);

        const mergeDecision = await service.getFolderOperationDecision(
          testUserId,
          "merge",
        );
        expect(mergeDecision.shouldAutoExecute).toBe(true);

        const splitDecision = await service.getFolderOperationDecision(
          testUserId,
          "split",
        );
        expect(splitDecision.shouldAutoExecute).toBe(true);

        const renameDecision = await service.getFolderOperationDecision(
          testUserId,
          "rename",
        );
        expect(renameDecision.shouldAutoExecute).toBe(true);
      });

      it("should require confirmation for all operations in semi_auto mode", async () => {
        mockRepository.getOrCreate.mockResolvedValue(
          createMockRecord("semi_auto"),
        );

        const decision = await service.getFolderOperationDecision(
          testUserId,
          "create",
        );

        expect(decision.shouldAutoExecute).toBe(false);
        expect(decision.requiresConfirmation).toBe(true);
        expect(decision.shouldNotify).toBe(true);
      });
    });

    describe("recordAutoDecision", () => {
      it("should increment auto decisions count", async () => {
        await service.recordAutoDecision(testUserId);

        expect(mockRepository.incrementStats).toHaveBeenCalledWith({
          userId: testUserId,
          autoDecisions: 1,
        });
      });
    });

    describe("recordUserCorrection", () => {
      it("should increment user corrections count", async () => {
        await service.recordUserCorrection(testUserId);

        expect(mockRepository.incrementStats).toHaveBeenCalledWith({
          userId: testUserId,
          userCorrections: 1,
        });
      });
    });

    describe("incrementPendingCount", () => {
      it("should increment pending confirmations count", async () => {
        await service.incrementPendingCount(testUserId);

        expect(mockRepository.incrementStats).toHaveBeenCalledWith({
          userId: testUserId,
          pendingConfirmations: 1,
        });
      });
    });

    describe("decrementPendingCount", () => {
      it("should decrement pending confirmations count", async () => {
        await service.decrementPendingCount(testUserId);

        expect(mockRepository.incrementStats).toHaveBeenCalledWith({
          userId: testUserId,
          pendingConfirmations: -1,
        });
      });
    });

    describe("getModeHistory", () => {
      it("should return mode history from repository", async () => {
        const mockHistory = [
          {
            from: "full_auto",
            to: "semi_auto",
            timestamp: "2025-01-01",
            reason: "test",
          },
        ];
        mockRepository.getModeHistory.mockResolvedValue(mockHistory as any);

        const history = await service.getModeHistory(testUserId);

        expect(history).toEqual(mockHistory);
        expect(mockRepository.getModeHistory).toHaveBeenCalledWith(testUserId);
      });
    });

    describe("shouldLearn", () => {
      it("should check learning settings for manual moves", async () => {
        mockRepository.getOrCreate.mockResolvedValue(
          createMockRecord("full_auto"),
        );

        const result = await service.shouldLearn(testUserId, "manual_move");

        // full_auto 配置中 learnFromManualMoves 应该是 true
        expect(typeof result).toBe("boolean");
      });

      it("should check learning settings for deletions", async () => {
        mockRepository.getOrCreate.mockResolvedValue(
          createMockRecord("full_auto"),
        );

        const result = await service.shouldLearn(testUserId, "deletion");

        expect(typeof result).toBe("boolean");
      });
    });
  });
});
