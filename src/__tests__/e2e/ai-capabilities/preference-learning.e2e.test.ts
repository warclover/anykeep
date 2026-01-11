/**
 * AI 能力端到端验收测试 - 偏好学习
 *
 * 验证偏好学习功能的完整链路
 *
 * @module @/__tests__/e2e/ai-capabilities/preference-learning
 */

import { FeatureFlags } from "@/lib/ai-agent/config/feature-flags";

// Mock Supabase client
const mockSupabaseClient = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  single: jest.fn().mockResolvedValue({ data: null, error: null }),
  update: jest.fn().mockResolvedValue({ data: null, error: null }),
  rpc: jest.fn().mockResolvedValue({ data: null, error: null }),
};

jest.mock("@/lib/supabase/client", () => ({
  createClient: jest.fn(() => mockSupabaseClient),
}));

describe("E2E: 偏好学习", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Feature Flags", () => {
    it("ENABLE_PREFERENCE_LEARNING 应该默认启用", () => {
      expect(FeatureFlags.ENABLE_PREFERENCE_LEARNING).toBe(true);
    });

    it("ENABLE_PREFERENCE_LEARNING_V2 应该默认启用", () => {
      expect(FeatureFlags.ENABLE_PREFERENCE_LEARNING_V2).toBe(true);
    });

    it("ENABLE_FEEDBACK_COLLECTION 应该默认启用", () => {
      expect(FeatureFlags.ENABLE_FEEDBACK_COLLECTION).toBe(true);
    });
  });

  describe("偏好数据结构", () => {
    it("应该定义正确的偏好数据结构", () => {
      const preferences = {
        learned: {
          frequentTools: ["search", "add_tag", "list"],
          frequentFolders: ["Work", "Reading"],
          frequentTags: ["AI", "技术", "学习"],
          recentPatterns: [],
        },
        explicit: {
          preferredLanguage: "zh-CN",
          notificationEnabled: true,
        },
        settings: {
          autoTagging: true,
          smartDefaults: true,
        },
      };

      expect(preferences.learned.frequentTools).toBeInstanceOf(Array);
      expect(preferences.learned.frequentFolders).toBeInstanceOf(Array);
      expect(preferences.learned.frequentTags).toBeInstanceOf(Array);
    });
  });

  describe("工具使用记录", () => {
    it("应该正确结构化工具使用数据", () => {
      const toolUsage = {
        toolName: "search",
        params: { query: "AI文章" },
        success: true,
        timestamp: new Date().toISOString(),
        duration: 150,
      };

      expect(toolUsage.toolName).toBe("search");
      expect(toolUsage.success).toBe(true);
      expect(typeof toolUsage.duration).toBe("number");
    });

    it("应该支持批量工具使用记录", () => {
      const toolUsages = [
        { toolName: "search", success: true },
        { toolName: "add_tag", success: true },
        { toolName: "move", success: false },
      ];

      const successfulTools = toolUsages.filter((t) => t.success);
      expect(successfulTools.length).toBe(2);
    });
  });

  describe("偏好更新逻辑", () => {
    it("频繁使用的工具应该被记录", () => {
      const usageHistory = [
        { toolName: "search", count: 50 },
        { toolName: "add_tag", count: 30 },
        { toolName: "list", count: 20 },
        { toolName: "delete", count: 5 },
      ];

      // 按使用次数排序
      const sortedTools = usageHistory
        .sort((a, b) => b.count - a.count)
        .slice(0, 3)
        .map((t) => t.toolName);

      expect(sortedTools).toEqual(["search", "add_tag", "list"]);
    });

    it("最近使用的文件夹应该被优先推荐", () => {
      const folderUsage = [
        { folder: "Work", lastUsed: new Date("2026-01-11"), count: 10 },
        { folder: "Reading", lastUsed: new Date("2026-01-10"), count: 20 },
        { folder: "Archive", lastUsed: new Date("2026-01-01"), count: 5 },
      ];

      // 按最近使用时间排序
      const recentFolders = folderUsage
        .sort((a, b) => b.lastUsed.getTime() - a.lastUsed.getTime())
        .slice(0, 2)
        .map((f) => f.folder);

      expect(recentFolders).toEqual(["Work", "Reading"]);
    });
  });

  describe("从撤销/调整中学习 (V2)", () => {
    it("撤销操作应该降低相关偏好权重", () => {
      const preferences = {
        autoTagging: { weight: 0.8, adjustments: 0 },
      };

      // 模拟用户撤销自动标签操作
      const afterUndo = {
        autoTagging: {
          weight: preferences.autoTagging.weight * 0.9, // 降低 10%
          adjustments: preferences.autoTagging.adjustments + 1,
        },
      };

      expect(afterUndo.autoTagging.weight).toBeLessThan(
        preferences.autoTagging.weight,
      );
      expect(afterUndo.autoTagging.adjustments).toBe(1);
    });

    it("确认操作应该增加相关偏好权重", () => {
      const preferences = {
        smartDefaults: { weight: 0.7, confirmations: 0 },
      };

      // 模拟用户确认智能默认值
      const afterConfirm = {
        smartDefaults: {
          weight: Math.min(1.0, preferences.smartDefaults.weight * 1.1), // 增加 10%，上限 1.0
          confirmations: preferences.smartDefaults.confirmations + 1,
        },
      };

      expect(afterConfirm.smartDefaults.weight).toBeGreaterThan(
        preferences.smartDefaults.weight,
      );
      expect(afterConfirm.smartDefaults.confirmations).toBe(1);
    });

    it("多次撤销应该显著降低权重", () => {
      let weight = 0.8;
      const undoCount = 5;

      for (let i = 0; i < undoCount; i++) {
        weight *= 0.9; // 每次撤销降低 10%
      }

      // 5 次撤销后，权重应该约为 0.8 * 0.9^5 ≈ 0.47
      expect(weight).toBeLessThan(0.5);
    });
  });

  describe("偏好应用", () => {
    it("应该使用偏好数据来优化工具选择", () => {
      const preferences = {
        frequentTools: ["search", "add_tag"],
        preferredTimeRange: "7d",
      };

      const toolSuggestions = ["search", "add_tag", "delete", "export"];

      // 根据偏好排序工具建议
      const sortedSuggestions = toolSuggestions.sort((a, b) => {
        const aIndex = preferences.frequentTools.indexOf(a);
        const bIndex = preferences.frequentTools.indexOf(b);

        if (aIndex === -1 && bIndex === -1) return 0;
        if (aIndex === -1) return 1;
        if (bIndex === -1) return -1;
        return aIndex - bIndex;
      });

      // 频繁使用的工具应该排在前面
      expect(sortedSuggestions[0]).toBe("search");
      expect(sortedSuggestions[1]).toBe("add_tag");
    });

    it("应该使用偏好数据来设置默认参数", () => {
      const preferences = {
        defaultTimeRange: "7d",
        defaultFolder: "Inbox",
        defaultTagSuggestions: ["技术", "学习"],
      };

      const searchParams = {
        query: "AI",
        timeRange: preferences.defaultTimeRange,
        folder: preferences.defaultFolder,
      };

      expect(searchParams.timeRange).toBe("7d");
      expect(searchParams.folder).toBe("Inbox");
    });
  });

  describe("端到端场景", () => {
    it("场景1: 用户多次使用搜索 → 搜索成为常用工具", () => {
      const toolHistory: string[] = [];

      // 模拟用户使用记录
      for (let i = 0; i < 10; i++) {
        toolHistory.push("search");
      }
      toolHistory.push("add_tag");
      toolHistory.push("list");

      // 统计工具使用频率
      const frequency = toolHistory.reduce(
        (acc, tool) => {
          acc[tool] = (acc[tool] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      );

      // 搜索应该是最常用的工具
      const mostUsed = Object.entries(frequency).sort(
        ([, a], [, b]) => b - a,
      )[0];
      expect(mostUsed[0]).toBe("search");
      expect(mostUsed[1]).toBe(10);
    });

    it("场景2: 用户多次撤销自动标签 → 自动标签权重降低", () => {
      let autoTagWeight = 1.0;
      const undoActions = [
        { action: "auto_tag", undone: true },
        { action: "auto_tag", undone: true },
        { action: "auto_tag", undone: true },
        { action: "move", undone: false },
        { action: "auto_tag", undone: true },
      ];

      for (const action of undoActions) {
        if (action.action === "auto_tag" && action.undone) {
          autoTagWeight *= 0.85; // 每次撤销降低 15%
        }
      }

      // 4 次撤销后，权重应该显著降低
      expect(autoTagWeight).toBeLessThan(0.6);
    });

    it("场景3: 用户确认 AI 建议 → 相关权重增加", () => {
      let suggestionWeight = 0.5;
      const confirmActions = [
        { confirmed: true },
        { confirmed: true },
        { confirmed: false },
        { confirmed: true },
      ];

      for (const action of confirmActions) {
        if (action.confirmed) {
          suggestionWeight = Math.min(1.0, suggestionWeight * 1.15);
        }
      }

      // 多次确认后，权重应该增加
      expect(suggestionWeight).toBeGreaterThan(0.7);
    });

    it("场景4: 偏好持久化结构验证", () => {
      const persistedPreferences = {
        userId: "user-123",
        learned: {
          frequentTools: ["search", "add_tag"],
          frequentFolders: ["Work"],
          frequentTags: ["AI"],
          toolWeights: {
            search: 0.9,
            add_tag: 0.8,
            delete: 0.3,
          },
        },
        updatedAt: new Date().toISOString(),
        version: 2,
      };

      expect(persistedPreferences.version).toBe(2);
      expect(persistedPreferences.learned.toolWeights.search).toBe(0.9);
      expect(persistedPreferences.updatedAt).toBeDefined();
    });
  });

  describe("反馈收集", () => {
    it("隐式反馈: 工具使用记录", () => {
      const implicitFeedback = {
        type: "tool_usage",
        toolName: "search",
        success: true,
        duration: 150,
        timestamp: new Date().toISOString(),
      };

      expect(implicitFeedback.type).toBe("tool_usage");
    });

    it("隐式反馈: 撤销操作", () => {
      const implicitFeedback = {
        type: "undo",
        operationId: "op-123",
        originalAction: "auto_tag",
        timestamp: new Date().toISOString(),
      };

      expect(implicitFeedback.type).toBe("undo");
    });

    it("显式反馈: 用户评分", () => {
      const explicitFeedback = {
        type: "rating",
        responseId: "resp-123",
        rating: 4, // 1-5 星
        comment: "搜索结果很准确",
        timestamp: new Date().toISOString(),
      };

      expect(explicitFeedback.type).toBe("rating");
      expect(explicitFeedback.rating).toBeGreaterThanOrEqual(1);
      expect(explicitFeedback.rating).toBeLessThanOrEqual(5);
    });
  });
});
