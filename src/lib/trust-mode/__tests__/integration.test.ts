/**
 * Trust Mode Integration Tests
 * V4.2 托管模式端到端集成测试
 *
 * @description 测试完整的 Trust Mode 流程
 * - 配置 → 分类决策 → 确认消息 → 用户反馈 → 学习更新
 *
 * @version 1.0.0
 * @since 2025-12-11
 */

import { TrustModeService } from "../trust-mode.service";
import { TrustModeRepository } from "../trust-mode.repository";
import { confirmationService } from "@/lib/confirmation/confirmation.service";
import { confirmationRepository } from "@/lib/confirmation/confirmation.repository";
import { preferenceLearner } from "@/lib/classification/learning/preference-learner";
import type { TrustMode, UserTrustModeRecord } from "@/types/trust-mode";
import type {
  PendingConfirmationRecord,
  ClassificationSuggestion,
} from "@/types/confirmation";

// ============================================================================
// Mock 设置
// ============================================================================

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(),
}));

jest.mock("../trust-mode.repository");
jest.mock("@/lib/confirmation/confirmation.repository");
jest.mock("@/lib/classification/learning/preference-learner");
jest.mock("@/lib/logger", () => ({
  logger: {
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  } as any,
}));

// ============================================================================
// 测试数据工厂
// ============================================================================

const createMockTrustModeRecord = (
  mode: TrustMode,
  overrides?: Partial<UserTrustModeRecord>,
): UserTrustModeRecord => ({
  id: 1,
  user_id: "test-user-123",
  trust_mode: mode,
  overrides: {} as any,
  mode_history: [],
  auto_decisions_count: 100,
  user_corrections_count: 5,
  pending_confirmations_count: 3,
  created_at: "2025-01-01T00:00:00Z",
  updated_at: "2025-01-01T00:00:00Z",
  ...overrides,
});

const createMockConfirmationRecord = (
  status: "pending" | "confirmed" | "rejected" = "pending",
): PendingConfirmationRecord => ({
  id: 1,
  user_id: "test-user-123",
  confirmation_type: "classification",
  bookmark_id: 100,
  folder_id: null,
  suggestion: {
    folderId: 10,
    folderName: "技术文章",
    confidence: 65,
    reason: "基于内容语义匹配",
    alternatives: [{ folderId: 11, folderName: "学习笔记", confidence: 45 }],
  } as ClassificationSuggestion,
  status,
  user_choice: null,
  expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  created_at: new Date().toISOString(),
  resolved_at: null,
});

// ============================================================================
// 集成测试
// ============================================================================

describe("Trust Mode Integration Tests", () => {
  let trustModeService: TrustModeService;
  let mockRepository: jest.Mocked<TrustModeRepository>;
  const testUserId = "test-user-123";

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock TrustModeRepository
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

    (TrustModeRepository as jest.Mock).mockImplementation(() => mockRepository);

    trustModeService = new TrustModeService();

    (trustModeService as any).getSupabase = jest.fn().mockResolvedValue({});
  });

  // ============================================================================
  // 流程 1: 完全托管模式 - 自动分类流程
  // ============================================================================

  describe("Flow 1: Full Auto Mode - Automatic Classification", () => {
    beforeEach(() => {
      mockRepository.getOrCreate.mockResolvedValue(
        createMockTrustModeRecord("full_auto"),
      );
    });

    it("should auto-classify high confidence items without confirmation", async () => {
      const decision = await trustModeService.getClassificationDecision({
        userId: testUserId,
        confidence: 85, // 高置信度
      });

      expect(decision.shouldAutoExecute).toBe(true);
      expect(decision.requiresConfirmation).toBe(false);
      expect(decision.reason).toContain("Full auto");
    });

    it("should auto-classify low confidence items in full_auto mode", async () => {
      const decision = await trustModeService.getClassificationDecision({
        userId: testUserId,
        confidence: 45, // 低置信度
      });

      // 完全托管模式下，即使低置信度也自动执行
      expect(decision.shouldAutoExecute).toBe(true);
      expect(decision.requiresConfirmation).toBe(false);
    });

    it("should increment auto_decisions_count after auto-classification", async () => {
      await trustModeService.recordAutoDecision(testUserId);

      expect(mockRepository.incrementStats).toHaveBeenCalledWith({
        userId: testUserId,
        autoDecisions: 1,
      });
    });
  });

  // ============================================================================
  // 流程 2: 半托管模式 - 待确认消息流程
  // ============================================================================

  describe("Flow 2: Semi-Auto Mode - Confirmation Flow", () => {
    beforeEach(() => {
      mockRepository.getOrCreate.mockResolvedValue(
        createMockTrustModeRecord("semi_auto"),
      );
    });

    it("should require confirmation for low confidence items", async () => {
      const decision = await trustModeService.getClassificationDecision({
        userId: testUserId,
        confidence: 55, // 低于阈值
      });

      expect(decision.shouldAutoExecute).toBe(false);
      expect(decision.requiresConfirmation).toBe(true);
      expect(decision.lowConfidenceAction).toBe("pending_with_message");
    });

    it("should auto-classify high confidence items without asking", async () => {
      const decision = await trustModeService.getClassificationDecision({
        userId: testUserId,
        confidence: 85, // 高置信度
      });

      expect(decision.shouldAutoExecute).toBe(true);
      expect(decision.requiresConfirmation).toBe(false);
    });

    it("should create confirmation when decision requires it", async () => {
      const mockConfirmation = createMockConfirmationRecord("pending");
      (confirmationRepository.findByBookmarkId as jest.Mock).mockResolvedValue(
        null,
      );
      (confirmationRepository.create as jest.Mock).mockResolvedValue(
        mockConfirmation,
      );

      const result = await confirmationService.createClassificationConfirmation(
        {
          userId: testUserId,
          bookmarkId: 100,
          bookmarkTitle: "测试书签",
          bookmarkUrl: "https://example.com",
          suggestion: {
            folderId: 10,
            folderName: "技术文章",
            confidence: 65,
            reason: "语义匹配",
            alternatives: [],
          } as any,
        },
      );

      expect(result.id).toBeDefined();
      expect(confirmationRepository.create).toHaveBeenCalled();
    });

    it("should process user confirmation response", async () => {
      const mockConfirmation = createMockConfirmationRecord("pending");
      (confirmationRepository.findById as jest.Mock).mockResolvedValue(
        mockConfirmation,
      );
      (confirmationRepository.updateStatus as jest.Mock).mockResolvedValue({
        ...mockConfirmation,
        status: "confirmed",
        user_choice: {
          choice: { selectedFolderId: 10 },
          timestamp: new Date().toISOString(),
        } as any,
      });
      (preferenceLearner.recordEvent as jest.Mock).mockResolvedValue(undefined);

      const result = await confirmationService.respondToClassification(
        1,
        testUserId,
        { selectedFolderId: 10 },
      );

      expect(result.success).toBe(true);
      expect(confirmationRepository.updateStatus).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // 流程 3: 手动模式 - 无自动分类
  // ============================================================================

  describe("Flow 3: Manual Mode - No Auto Classification", () => {
    beforeEach(() => {
      mockRepository.getOrCreate.mockResolvedValue(
        createMockTrustModeRecord("manual"),
      );
    });

    it("should never auto-classify in manual mode", async () => {
      const decision = await trustModeService.getClassificationDecision({
        userId: testUserId,
        confidence: 95, // 即使很高的置信度
      });

      expect(decision.shouldAutoExecute).toBe(false);
      expect(decision.reason).toContain("Manual");
    });

    it("should not create confirmations in manual mode", async () => {
      const decision = await trustModeService.getClassificationDecision({
        userId: testUserId,
        confidence: 50,
      });

      // 手动模式下不需要确认消息，用户完全控制
      expect(decision.requiresConfirmation).toBe(false);
      expect(decision.shouldAutoExecute).toBe(false);
    });
  });

  // ============================================================================
  // 流程 4: 模式切换
  // ============================================================================

  describe("Flow 4: Mode Switching", () => {
    it("should switch from manual to semi_auto", async () => {
      const manualRecord = createMockTrustModeRecord("manual");
      const semiAutoRecord = createMockTrustModeRecord("semi_auto");

      mockRepository.getOrCreate.mockResolvedValue(manualRecord);
      mockRepository.update.mockResolvedValue(semiAutoRecord);

      const result = await trustModeService.updateTrustMode(
        testUserId,
        "semi_auto",
      );

      expect(result.trust_mode).toBe("semi_auto");
      expect(mockRepository.update).toHaveBeenCalledWith({
        userId: testUserId,
        trustMode: "semi_auto",
        reason: undefined,
      });
    });

    it("should preserve overrides when switching modes", async () => {
      const recordWithOverrides = createMockTrustModeRecord("manual", {
        overrides: {
          classification: {
            confirmationThreshold: 90,
          } as any,
        } as any,
      });

      mockRepository.getOrCreate.mockResolvedValue(recordWithOverrides);
      mockRepository.update.mockResolvedValue({
        ...recordWithOverrides,
        trust_mode: "semi_auto",
      });

      const result = await trustModeService.updateTrustMode(
        testUserId,
        "semi_auto",
      );

      expect(result.overrides).toEqual(recordWithOverrides.overrides);
    });
  });

  // ============================================================================
  // 流程 5: 统计与学习反馈
  // ============================================================================

  describe("Flow 5: Statistics and Learning Feedback", () => {
    beforeEach(() => {
      mockRepository.getOrCreate.mockResolvedValue(
        createMockTrustModeRecord("semi_auto", {
          auto_decisions_count: 100,
          user_corrections_count: 10,
        }),
      );
    });

    it("should calculate correction rate correctly", async () => {
      const config = await trustModeService.getEffectiveConfig(testUserId);

      // 纠正率 = 10 / (100 + 10) ≈ 0.0909
      expect(config.stats.correctionRate).toBeCloseTo(0.0909, 2);
    });

    it("should increment correction count on user modification", async () => {
      await trustModeService.recordUserCorrection(testUserId);

      expect(mockRepository.incrementStats).toHaveBeenCalledWith({
        userId: testUserId,
        userCorrections: 1,
      });
    });

    it("should track pending confirmations count", async () => {
      mockRepository.getOrCreate.mockResolvedValue(
        createMockTrustModeRecord("semi_auto", {
          pending_confirmations_count: 5,
        }),
      );

      const config = await trustModeService.getEffectiveConfig(testUserId);

      expect(config.stats.pendingConfirmations).toBe(5);
    });
  });

  // ============================================================================
  // 流程 6: 阈值覆盖
  // ============================================================================

  describe("Flow 6: Threshold Overrides", () => {
    it("should apply custom confirmation threshold", async () => {
      const recordWithOverrides = createMockTrustModeRecord("semi_auto", {
        overrides: {
          // Partial override

          classification: {
            confirmationThreshold: 90,
          } as any,
        } as any,
      });

      mockRepository.getOrCreate.mockResolvedValue(recordWithOverrides);

      const config = await trustModeService.getEffectiveConfig(testUserId);

      expect(config.config.classification.confirmationThreshold).toBe(90);
    });

    it("should use default threshold when no override", async () => {
      mockRepository.getOrCreate.mockResolvedValue(
        createMockTrustModeRecord("semi_auto"),
      );

      const config = await trustModeService.getEffectiveConfig(testUserId);

      // 默认半托管模式配置存在
      expect(config.config.classification).toBeDefined();
      expect(config.mode).toBe("semi_auto");
    });
  });

  // ============================================================================
  // 流程 7: 过期确认处理
  // ============================================================================

  describe("Flow 7: Expired Confirmation Handling", () => {
    it("should handle expired confirmations based on mode config", async () => {
      const expiredConfirmations = [
        createMockConfirmationRecord("pending"),
        createMockConfirmationRecord("pending"),
      ];

      (confirmationRepository.findExpired as jest.Mock).mockResolvedValue(
        expiredConfirmations,
      );
      (confirmationRepository.updateStatus as jest.Mock).mockResolvedValue({
        ...expiredConfirmations[0],
        status: "expired",
      });

      const result = await confirmationService.processExpired();

      expect(result.processed).toBeGreaterThanOrEqual(0);
    });
  });

  // ============================================================================
  // 流程 8: 批量操作
  // ============================================================================

  describe("Flow 8: Batch Operations", () => {
    it("should batch confirm multiple items", async () => {
      const mockConfirmations = [
        createMockConfirmationRecord("pending"),
        { ...createMockConfirmationRecord("pending"), id: 2 } as any,
      ];

      // Mock findById for each confirmation
      mockConfirmations.forEach((record) => {
        (confirmationRepository.findById as jest.Mock).mockResolvedValueOnce(
          record,
        );
        (
          confirmationRepository.updateStatus as jest.Mock
        ).mockResolvedValueOnce({
          ...record,
          status: "confirmed",
        });
      });
      (preferenceLearner.recordEvent as jest.Mock).mockResolvedValue(undefined);

      const result = await confirmationService.batchConfirm(testUserId, [1, 2]);

      expect(result.success).toBe(2);
      expect(result.failed).toBe(0);
    });
  });

  // ============================================================================
  // 边界条件测试
  // ============================================================================

  describe("Edge Cases", () => {
    it("should handle new user without trust mode record", async () => {
      mockRepository.getOrCreate.mockResolvedValue(
        createMockTrustModeRecord("semi_auto"), // 默认模式
      );

      const config = await trustModeService.getEffectiveConfig("new-user-id");

      expect(config.mode).toBe("semi_auto");
    });

    it("should handle confidence at exact threshold", async () => {
      mockRepository.getOrCreate.mockResolvedValue(
        createMockTrustModeRecord("semi_auto"),
      );

      const decision = await trustModeService.getClassificationDecision({
        userId: testUserId,
        confidence: 80, // 恰好等于阈值
      });

      // 等于阈值时应该自动执行
      expect(decision.shouldAutoExecute).toBe(true);
    });

    it("should handle zero confidence gracefully", async () => {
      mockRepository.getOrCreate.mockResolvedValue(
        createMockTrustModeRecord("semi_auto"),
      );

      const decision = await trustModeService.getClassificationDecision({
        userId: testUserId,
        confidence: 0,
      });

      expect(decision.shouldAutoExecute).toBe(false);
      expect(decision.requiresConfirmation).toBe(true);
    });
  });

  // ============================================================================
  // 文件夹操作决策测试
  // ============================================================================

  describe("Folder Operation Decisions", () => {
    it("should auto-create folders in full_auto mode", async () => {
      mockRepository.getOrCreate.mockResolvedValue(
        createMockTrustModeRecord("full_auto"),
      );

      const decision = await trustModeService.getFolderOperationDecision(
        testUserId,
        "create",
      );

      expect(decision.shouldAutoExecute).toBe(true);
      expect(decision.requiresConfirmation).toBe(false);
    });

    it("should require confirmation for folder operations in semi_auto mode", async () => {
      mockRepository.getOrCreate.mockResolvedValue(
        createMockTrustModeRecord("semi_auto"),
      );

      const decision = await trustModeService.getFolderOperationDecision(
        testUserId,
        "merge",
      );

      expect(decision.shouldAutoExecute).toBe(false);
      expect(decision.requiresConfirmation).toBe(true);
    });

    it("should not auto-execute folder operations in manual mode", async () => {
      mockRepository.getOrCreate.mockResolvedValue(
        createMockTrustModeRecord("manual"),
      );

      const decision = await trustModeService.getFolderOperationDecision(
        testUserId,
        "split",
      );

      expect(decision.shouldAutoExecute).toBe(false);
      expect(decision.requiresConfirmation).toBe(false);
    });
  });
});
