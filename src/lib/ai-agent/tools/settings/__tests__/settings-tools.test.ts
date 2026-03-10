/**
 * Settings Tools 单元测试
 *
 * 测试用户设置管理工具
 *
 * @version 1.0.0
 * @since 2026-01-01
 */

import { getUserSettingsTool } from "../get-user-settings.tool";
import { getClassificationSettingsTool } from "../get-classification-settings.tool";
import { updateClassificationSettingsTool } from "../update-classification-settings.tool";
import { getUserInterestsTool } from "../get-user-interests.tool";
import { updateUserInterestsTool } from "../update-user-interests.tool";
import { updateTrustModeTool } from "../update-trust-mode.tool";
import type { ToolContext } from "../../types";

// Mock 数据
const mockUserSettings = {
  id: "test-user-id",
  trust_mode: "semi_auto",
  classification_enabled: true,
  auto_tagging_enabled: true,
  theme: "system",
  language: "zh-CN",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const mockClassificationSettings = {
  enabled: true,
  auto_classify: true,
  auto_tag: true,
  min_confidence: 0.7,
  excluded_platforms: [],
};

const mockUserInterests = {
  interests: ["技术", "前端", "React", "AI"],
  last_updated: new Date().toISOString(),
};

// Mock 结果存储
let mockSelectResult: { data: unknown; error: unknown } = {
  data: mockUserSettings,
  error: null,
};
let mockUpdateResult: { error: unknown } = { error: null };

// Mock effective config for trustModeService
const mockEffectiveConfig = {
  mode: "semi_auto" as const,
  config: {
    classification: {
      autoClassify: true,
      requireConfirmation: true,
      confirmationThreshold: 70,
      lowConfidenceAction: "ask_user",
    },
    folderManagement: {
      autoCreate: true,
      autoMerge: false,
      autoSplit: false,
      autoRename: false,
      dailyCreateLimit: 5,
    },
    learning: {
      learnFromManualMoves: true,
      learnFromDeletions: false,
    },
    notification: {
      onClassification: true,
      onFolderCreate: true,
      onFolderSuggestion: false,
      onMajorReorganization: false,
    },
  },
  stats: {
    autoDecisions: 42,
    userCorrections: 3,
    pendingConfirmations: 2,
    correctionRate: 0.07,
  },
};

// Mock trustModeService
const mockGetEffectiveConfig = jest.fn(() =>
  Promise.resolve({ ...mockEffectiveConfig }),
);
const mockUpdateOverrides = jest.fn(() => Promise.resolve());
const mockUpdateTrustMode = jest.fn(() => Promise.resolve());

jest.mock("@/lib/trust-mode/trust-mode.service", () => ({
  trustModeService: {
    getEffectiveConfig: (...args: unknown[]) => mockGetEffectiveConfig(...args),
    updateOverrides: (...args: unknown[]) => mockUpdateOverrides(...args),
    updateTrustMode: (...args: unknown[]) => mockUpdateTrustMode(...args),
  },
}));

// Mock interestService
const mockGetUserInterests = jest.fn(() =>
  Promise.resolve({
    presetInterests: ["tech_frontend", "tech_ai"],
    customInterests: [],
  }),
);
const mockSetPresetInterests = jest.fn(() => Promise.resolve());

jest.mock("@/lib/interests", () => ({
  createInterestService: jest.fn(() => ({
    getUserInterests: (...args: unknown[]) => mockGetUserInterests(...args),
    setPresetInterests: (...args: unknown[]) => mockSetPresetInterests(...args),
  })),
}));

// Mock interest domains
jest.mock("@/lib/user-interest/interest-domains", () => ({
  PRESET_INTEREST_DOMAINS: {
    tech_frontend: {
      name: "前端开发",
      icon: "💻",
      category: "tech",
      keywords: ["React", "Vue"],
    },
    tech_ai: {
      name: "AI/机器学习",
      icon: "🤖",
      category: "tech",
      keywords: ["LLM", "ML"],
    },
    design_ui: {
      name: "UI/UX设计",
      icon: "🎨",
      category: "design",
      keywords: ["Figma"],
    },
  },
  getAllPresetInterestIds: jest.fn(() => [
    "tech_frontend",
    "tech_backend",
    "tech_ai",
    "tech_mobile",
    "design_ui",
    "design_graphic",
    "product",
    "marketing",
    "reading",
    "investment",
    "lifestyle",
    "learning",
  ]),
}));

// Mock Supabase client
jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(() =>
    Promise.resolve({
      from: jest.fn((table: string) => {
        if (table === "profiles") {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn(() => Promise.resolve(mockSelectResult)),
              })),
            })),
            update: jest.fn(() => ({
              eq: jest.fn(() => Promise.resolve(mockUpdateResult)),
            })),
          };
        }
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => Promise.resolve({ data: null, error: null })),
          })),
        };
      }),
      rpc: jest.fn((funcName: string) => {
        if (funcName === "get_classification_settings") {
          return Promise.resolve({
            data: mockClassificationSettings,
            error: null,
          });
        }
        if (funcName === "update_classification_settings") {
          return Promise.resolve({
            data: mockClassificationSettings,
            error: null,
          });
        }
        if (funcName === "get_user_interests") {
          return Promise.resolve({ data: mockUserInterests, error: null });
        }
        if (funcName === "update_user_interests") {
          return Promise.resolve({ data: mockUserInterests, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      }),
    }),
  ),
}));

// Mock logger
jest.mock("@/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
  },
}));

describe("Settings Tools", () => {
  const mockContext: ToolContext = {
    userId: "test-user-id",
    conversationId: "test-session",
  };

  beforeEach(() => {
    mockSelectResult = { data: mockUserSettings, error: null };
    mockUpdateResult = { error: null };
    jest.clearAllMocks();
    // Reset mockGetEffectiveConfig to return default config
    mockGetEffectiveConfig.mockResolvedValue({ ...mockEffectiveConfig });
  });

  // ============================================
  // getUserSettingsTool Tests
  // ============================================
  describe("getUserSettingsTool", () => {
    describe("definition", () => {
      it("should have correct tool name", () => {
        expect(getUserSettingsTool.definition.name).toBe("get_user_settings");
      });

      it("should be in query category", () => {
        expect(getUserSettingsTool.definition.category).toBe("query");
      });

      it("should not require confirmation", () => {
        expect(getUserSettingsTool.definition.requiresConfirmation).toBe(false);
      });
    });

    describe("execute", () => {
      it("should get user settings", async () => {
        const result = await getUserSettingsTool.execute({}, mockContext);

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.trustMode.mode).toBe("semi_auto");
          expect(result.data.classification.autoClassify).toBe(true);
        }
      });

      it("should return error if settings not found", async () => {
        mockGetEffectiveConfig.mockRejectedValueOnce(new Error("Not found"));

        const result = await getUserSettingsTool.execute({}, mockContext);

        expect(result.success).toBe(false);
      });
    });
  });

  // ============================================
  // getClassificationSettingsTool Tests
  // ============================================
  describe("getClassificationSettingsTool", () => {
    describe("definition", () => {
      it("should have correct tool name", () => {
        expect(getClassificationSettingsTool.definition.name).toBe(
          "get_classification_settings",
        );
      });

      it("should be in query category", () => {
        expect(getClassificationSettingsTool.definition.category).toBe("query");
      });
    });

    describe("execute", () => {
      it("should get classification settings", async () => {
        const result = await getClassificationSettingsTool.execute(
          {},
          mockContext,
        );

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.mode).toBe("semi_auto");
          expect(result.data.classification.autoClassify).toBe(true);
        }
      });
    });
  });

  // ============================================
  // updateClassificationSettingsTool Tests
  // ============================================
  describe("updateClassificationSettingsTool", () => {
    describe("definition", () => {
      it("should have correct tool name", () => {
        expect(updateClassificationSettingsTool.definition.name).toBe(
          "update_classification_settings",
        );
      });

      it("should be in action category", () => {
        expect(updateClassificationSettingsTool.definition.category).toBe(
          "action",
        );
      });
    });

    describe("execute", () => {
      it("should update learnFromManualMoves setting", async () => {
        const result = await updateClassificationSettingsTool.execute(
          { learnFromManualMoves: false },
          mockContext,
        );

        expect(result.success).toBe(true);
        expect(mockUpdateOverrides).toHaveBeenCalledWith(
          "test-user-id",
          expect.objectContaining({
            learning: expect.objectContaining({
              learnFromManualMoves: false,
            }),
          }),
        );
      });

      it("should update learnFromDeletions setting", async () => {
        const result = await updateClassificationSettingsTool.execute(
          { learnFromDeletions: true },
          mockContext,
        );

        expect(result.success).toBe(true);
        expect(mockUpdateOverrides).toHaveBeenCalledWith(
          "test-user-id",
          expect.objectContaining({
            learning: expect.objectContaining({
              learnFromDeletions: true,
            }),
          }),
        );
      });

      it("should update confirmationThreshold", async () => {
        const result = await updateClassificationSettingsTool.execute(
          { confirmationThreshold: 80 },
          mockContext,
        );

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.updated).toContain("confirmationThreshold");
          expect(result.data.newValues.confirmationThreshold).toBe(80);
        }
      });
    });
  });

  // ============================================
  // getUserInterestsTool Tests
  // ============================================
  describe("getUserInterestsTool", () => {
    describe("definition", () => {
      it("should have correct tool name", () => {
        expect(getUserInterestsTool.definition.name).toBe("get_user_interests");
      });

      it("should be in query category", () => {
        expect(getUserInterestsTool.definition.category).toBe("query");
      });
    });

    describe("execute", () => {
      it("should get user interests", async () => {
        const result = await getUserInterestsTool.execute({}, mockContext);

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.presetInterests).toHaveLength(2);
          expect(result.data.summary.presetCount).toBe(2);
        }
      });
    });
  });

  // ============================================
  // updateUserInterestsTool Tests
  // ============================================
  describe("updateUserInterestsTool", () => {
    describe("definition", () => {
      it("should have correct tool name", () => {
        expect(updateUserInterestsTool.definition.name).toBe(
          "update_user_interests",
        );
      });

      it("should be in action category", () => {
        expect(updateUserInterestsTool.definition.category).toBe("action");
      });
    });

    describe("execute", () => {
      it("should add interest", async () => {
        const result = await updateUserInterestsTool.execute(
          { action: "add", presetInterests: ["tech_frontend"] },
          mockContext,
        );

        expect(result.success).toBe(true);
        expect(mockSetPresetInterests).toHaveBeenCalled();
      });

      it("should remove interest", async () => {
        const result = await updateUserInterestsTool.execute(
          { action: "remove", presetInterests: ["tech_frontend"] },
          mockContext,
        );

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.removed).toContain("tech_frontend");
        }
      });

      it("should replace all interests", async () => {
        const result = await updateUserInterestsTool.execute(
          {
            action: "replace",
            presetInterests: ["tech_frontend", "design_ui"],
          },
          mockContext,
        );

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.currentInterests).toEqual(
            expect.arrayContaining(["tech_frontend", "design_ui"]),
          );
        }
      });
    });
  });

  // ============================================
  // updateTrustModeTool Tests
  // ============================================
  describe("updateTrustModeTool", () => {
    describe("definition", () => {
      it("should have correct tool name", () => {
        expect(updateTrustModeTool.definition.name).toBe("update_trust_mode");
      });

      it("should be in action category", () => {
        expect(updateTrustModeTool.definition.category).toBe("action");
      });

      it("should not require confirmation", () => {
        expect(updateTrustModeTool.definition.requiresConfirmation).toBe(false);
      });
    });

    describe("execute", () => {
      it("should update trust mode to manual", async () => {
        const result = await updateTrustModeTool.execute(
          { mode: "manual" },
          mockContext,
        );

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.currentMode).toBe("manual");
          expect(result.data.previousMode).toBe("semi_auto");
        }
        expect(mockUpdateTrustMode).toHaveBeenCalledWith(
          "test-user-id",
          "manual",
        );
      });

      it("should update trust mode to semi_auto", async () => {
        // Current mode is semi_auto, so it should return "already in this mode"
        const result = await updateTrustModeTool.execute(
          { mode: "semi_auto" },
          mockContext,
        );

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.currentMode).toBe("semi_auto");
        }
      });

      it("should update trust mode to full_auto", async () => {
        const result = await updateTrustModeTool.execute(
          { mode: "full_auto" },
          mockContext,
        );

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.currentMode).toBe("full_auto");
        }
        expect(mockUpdateTrustMode).toHaveBeenCalledWith(
          "test-user-id",
          "full_auto",
        );
      });
    });
  });
});
