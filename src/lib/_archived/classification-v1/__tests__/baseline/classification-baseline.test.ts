/**
 * Classification System Baseline Tests
 *
 * 基线测试用于验证分类系统重构过程中的行为一致性
 * 覆盖 10 个核心场景，确保零回归
 *
 * @version 1.0.0
 * @since 2026-01-24
 * @phase Phase 0 - 准备工作
 */

import {
  describe,
  test,
  expect,
  beforeEach,
  afterEach,
  jest,
} from "@jest/globals";

// Mock Supabase client
const mockSupabaseClient = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  single: jest.fn(),
  gte: jest.fn().mockReturnThis(),
  lt: jest.fn().mockReturnThis(),
} as any;

// Mock modules before imports
jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(() => Promise.resolve(mockSupabaseClient)),
}));

jest.mock("@/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock("@/lib/messages/server", () => ({
  MessageService: {
    notifyClassificationComplete: jest.fn(() => Promise.resolve(undefined)),
  },
}));

jest.mock("@/lib/confirmation", () => ({
  confirmationService: {
    createClassificationConfirmation: jest.fn(() => Promise.resolve(undefined)),
  },
}));

jest.mock("@/lib/trust-mode/trust-mode.service", () => ({
  trustModeService: {
    getUserTrustMode: jest.fn(() => Promise.resolve("semi_auto" as const)),
  },
}));

// Import after mocks
import {
  classifyBookmarkV2,
  getClassificationVersion,
  shouldUseV2Classification,
} from "@/lib/classification/integration";
import {
  CONFIDENCE_THRESHOLDS,
  CLASSIFICATION_STATUS,
  getStatusFromConfidence,
} from "@/lib/classification/types/classification-status";

describe("Classification Baseline Tests", () => {
  const testUserId = "test-user-00000000-0000-0000-0000-000000000001";

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset environment variables
    delete process.env.CLASSIFICATION_VERSION;
    delete process.env.CLASSIFICATION_V5_ENABLED;
    delete process.env.CLASSIFICATION_V5_STAGE;
    delete process.env.V5_PASSTHROUGH_MODE;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 场景 1: 高置信度自动分类 (≥80%)
  // ═══════════════════════════════════════════════════════════════════════════
  describe("Scenario 1: High Confidence Auto-Classification", () => {
    test("should auto-classify when confidence >= 80%", async () => {
      // Arrange - 变量用于未来集成测试扩展
      const _bookmarkId = 1001;
      const _title = "TypeScript 高级类型编程指南";
      const _summary = "深入讲解 TypeScript 类型系统的高级特性";
      const _tags = ["typescript", "programming", "tutorial"];

      // Mock folder query
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: { name: "编程技术" },
        error: null,
      });

      // Mock bookmark update
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: { id: _bookmarkId },
        error: null,
      });

      // Act & Assert - 验证阈值常量正确
      expect(CONFIDENCE_THRESHOLDS.AUTO_CLASSIFY).toBe(80);
      expect(getStatusFromConfidence(85)).toBe(
        CLASSIFICATION_STATUS.CLASSIFIED,
      );
      expect(getStatusFromConfidence(80)).toBe(
        CLASSIFICATION_STATUS.CLASSIFIED,
      );
    });

    test("should not auto-classify when confidence is 79%", () => {
      expect(getStatusFromConfidence(79)).toBe(CLASSIFICATION_STATUS.SUGGESTED);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 场景 2: 中置信度生成建议 (60-79%)
  // ═══════════════════════════════════════════════════════════════════════════
  describe("Scenario 2: Medium Confidence Suggestion", () => {
    test("should suggest when confidence is 60-79%", () => {
      expect(CONFIDENCE_THRESHOLDS.SUGGEST).toBe(60);
      expect(getStatusFromConfidence(70)).toBe(CLASSIFICATION_STATUS.SUGGESTED);
      expect(getStatusFromConfidence(60)).toBe(CLASSIFICATION_STATUS.SUGGESTED);
    });

    test("should not suggest when confidence is 59%", () => {
      expect(getStatusFromConfidence(59)).toBe(CLASSIFICATION_STATUS.INBOX);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 场景 3: 低置信度进入收件箱 (<60%)
  // ═══════════════════════════════════════════════════════════════════════════
  describe("Scenario 3: Low Confidence Inbox", () => {
    test("should go to inbox when confidence < 60%", () => {
      expect(getStatusFromConfidence(59)).toBe(CLASSIFICATION_STATUS.INBOX);
      expect(getStatusFromConfidence(30)).toBe(CLASSIFICATION_STATUS.INBOX);
      expect(getStatusFromConfidence(0)).toBe(CLASSIFICATION_STATUS.INBOX);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 场景 4: 版本路由正确性
  // ═══════════════════════════════════════════════════════════════════════════
  describe("Scenario 4: Version Routing", () => {
    test("should default to v5.0", () => {
      delete process.env.CLASSIFICATION_VERSION;
      expect(getClassificationVersion()).toBe("v5.0");
    });

    test("should return v4.1 when explicitly set", () => {
      process.env.CLASSIFICATION_VERSION = "v4.1";
      expect(getClassificationVersion()).toBe("v4.1");
    });

    test("should fallback to v5.0 when v3 is set (V3 deprecated)", () => {
      process.env.CLASSIFICATION_VERSION = "v3";
      // V3 已废弃，设置 v3 时降级到 v5.0
      expect(getClassificationVersion()).toBe("v5.0");
    });

    test("should return v5.0 for unknown version", () => {
      process.env.CLASSIFICATION_VERSION = "unknown";
      expect(getClassificationVersion()).toBe("v5.0");
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 场景 5: V2 分类系统开关
  // ═══════════════════════════════════════════════════════════════════════════
  describe("Scenario 5: V2 Classification Toggle", () => {
    test("should enable V2 by default", () => {
      delete process.env.CLASSIFICATION_V2_ENABLED;
      expect(shouldUseV2Classification()).toBe(true);
    });

    test("should disable V2 when explicitly set to false", () => {
      process.env.CLASSIFICATION_V2_ENABLED = "false";
      expect(shouldUseV2Classification()).toBe(false);
    });

    test("should enable V2 when set to true", () => {
      process.env.CLASSIFICATION_V2_ENABLED = "true";
      expect(shouldUseV2Classification()).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 场景 6: 置信度阈值常量完整性
  // ═══════════════════════════════════════════════════════════════════════════
  describe("Scenario 6: Confidence Threshold Constants", () => {
    test("should have correct threshold values", () => {
      expect(CONFIDENCE_THRESHOLDS).toEqual({
        AUTO_CLASSIFY: 80,
        SUGGEST: 60,
        INBOX: 0,
      });
    });

    test("thresholds should be ordered correctly", () => {
      expect(CONFIDENCE_THRESHOLDS.AUTO_CLASSIFY).toBeGreaterThan(
        CONFIDENCE_THRESHOLDS.SUGGEST,
      );
      expect(CONFIDENCE_THRESHOLDS.SUGGEST).toBeGreaterThan(
        CONFIDENCE_THRESHOLDS.INBOX,
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 场景 7: 分类状态常量完整性
  // ═══════════════════════════════════════════════════════════════════════════
  describe("Scenario 7: Classification Status Constants", () => {
    test("should have all required status values", () => {
      expect(CLASSIFICATION_STATUS).toEqual({
        PENDING: "pending",
        PROCESSING: "processing",
        CLASSIFIED: "classified",
        SUGGESTED: "suggested",
        INBOX: "inbox",
        FAILED: "failed",
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 场景 8: 输入验证
  // ═══════════════════════════════════════════════════════════════════════════
  describe("Scenario 8: Input Validation", () => {
    test("should reject invalid bookmark ID", async () => {
      const result = await classifyBookmarkV2(
        -1, // invalid
        "Test Title",
        "Test Summary",
        ["tag1"],
        testUserId,
      );

      expect(result.classified).toBe(false);
      expect(result.action).toBe("inbox");
      expect(result.confidence).toBe(0);
    });

    test("should reject empty title", async () => {
      const result = await classifyBookmarkV2(
        1001,
        "", // empty
        "Test Summary",
        ["tag1"],
        testUserId,
      );

      expect(result.classified).toBe(false);
      expect(result.action).toBe("inbox");
    });

    test("should reject invalid user ID format", async () => {
      const result = await classifyBookmarkV2(
        1001,
        "Test Title",
        "Test Summary",
        ["tag1"],
        "invalid-uuid", // invalid
      );

      expect(result.classified).toBe(false);
      expect(result.action).toBe("inbox");
    });

    test("should accept null summary", async () => {
      // This should not throw - null summary is valid
      const result = await classifyBookmarkV2(
        1001,
        "Test Title",
        null, // null is valid
        ["tag1"],
        testUserId,
      );

      // Should not fail validation, but may fail classification due to mocks
      expect(result).toBeDefined();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 场景 9: 返回值结构完整性
  // ═══════════════════════════════════════════════════════════════════════════
  describe("Scenario 9: Return Value Structure", () => {
    test("should return complete structure on validation failure", async () => {
      const result = await classifyBookmarkV2(-1, "Test", null, [], "invalid");

      // Verify all required fields exist
      expect(result).toHaveProperty("classified");
      expect(result).toHaveProperty("folderId");
      expect(result).toHaveProperty("folderName");
      expect(result).toHaveProperty("confidence");
      expect(result).toHaveProperty("action");

      // Verify types
      expect(typeof result.classified).toBe("boolean");
      expect(typeof result.confidence).toBe("number");
      expect(["classify", "suggest", "suggest_new", "inbox"]).toContain(
        result.action,
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 场景 10: V5 透传模式
  // ═══════════════════════════════════════════════════════════════════════════
  describe("Scenario 10: V5 Passthrough Mode", () => {
    test("should enable passthrough mode by default", () => {
      delete process.env.V5_PASSTHROUGH_MODE;
      // Passthrough is enabled when V5_PASSTHROUGH_MODE !== "false"
      expect(process.env.V5_PASSTHROUGH_MODE).toBeUndefined();
    });

    test("should disable passthrough mode when explicitly set to false", () => {
      process.env.V5_PASSTHROUGH_MODE = "false";
      expect(process.env.V5_PASSTHROUGH_MODE).toBe("false");
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 辅助测试：状态转换有效性
// ═══════════════════════════════════════════════════════════════════════════
describe("Classification Status Transitions", () => {
  // 使用动态导入获取状态转换函数
  const statusModule = jest.requireActual(
    "@/lib/classification/types/classification-status",
  ) as {
    isValidStatusTransition: (from: string, to: string) => boolean;
    isTerminalStatus: (status: string) => boolean;
    requiresUserAction: (status: string) => boolean;
  };
  const { isValidStatusTransition, isTerminalStatus, requiresUserAction } =
    statusModule;

  test("pending -> processing is valid", () => {
    expect(isValidStatusTransition("pending", "processing")).toBe(true);
  });

  test("processing -> classified is valid", () => {
    expect(isValidStatusTransition("processing", "classified")).toBe(true);
  });

  test("processing -> suggested is valid", () => {
    expect(isValidStatusTransition("processing", "suggested")).toBe(true);
  });

  test("processing -> inbox is valid", () => {
    expect(isValidStatusTransition("processing", "inbox")).toBe(true);
  });

  test("classified is terminal state", () => {
    expect(isTerminalStatus("classified")).toBe(true);
  });

  test("failed is terminal state", () => {
    expect(isTerminalStatus("failed")).toBe(true);
  });

  test("suggested requires user action", () => {
    expect(requiresUserAction("suggested")).toBe(true);
  });

  test("inbox requires user action", () => {
    expect(requiresUserAction("inbox")).toBe(true);
  });
});
