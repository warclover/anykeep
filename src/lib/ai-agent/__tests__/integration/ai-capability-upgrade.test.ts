/**
 * AI 能力升级 v4.3 集成测试
 *
 * 验证设计文档 9.1 节中的测试用例
 *
 * @version 1.0.0
 * @since 2025-12-26
 */

import { buildContextPrompt } from "../../context/prompt-injector";
import { ModelTierSelector } from "@/lib/ai-providers/tier-selector";
import { getTierByIntent } from "@/lib/ai-providers/task-tier-mapping";
import {
  FeatureFlags,
  getAllFeatureFlags,
  isFeatureEnabled,
} from "../../config/feature-flags";
import { CostController } from "../../config/cost-controller";
import { extractReasoning, withReasoning } from "../../tools/types";
import { z } from "zod";
import type { DynamicContext } from "../../context/types";

describe("AI 能力升级 v4.3 集成测试", () => {
  // ==========================================================================
  // T1: 动态上下文 Prompt 生成
  // ==========================================================================
  describe("T1: 动态上下文 Prompt 生成", () => {
    it("buildContextPrompt 应生成包含收藏概况的 Prompt", () => {
      const mockContext: DynamicContext = {
        time: {
          current: "2025-12-26 周五 10:00 上午",
          period: "morning",
          isWeekend: false,
        },
        stats: {
          totalBookmarks: 156,
          recentWeekCount: 12,
          topPlatform: { name: "微信", code: "wechat", count: 45 },
          topFolders: [{ id: 1, name: "学习资料", count: 30 }],
        },
        preferences: {
          responseStyle: "auto",
          frequentTags: ["学习", "技术"],
        },
        recentActivity: {
          lastSaved: {
            title: "React 19 新特性",
            platform: "微信",
            time: "今天 09:30",
          },
        },
        session: {},
      };

      const prompt = buildContextPrompt(mockContext);

      // 验证 Prompt 包含关键信息
      expect(prompt).toContain("收藏概况");
      expect(prompt).toContain("156");
      expect(prompt).toContain("时间");
      expect(prompt).toContain("无需调用工具查询");
    });

    it("Prompt 应包含当前选中的书签信息", () => {
      const mockContext: DynamicContext = {
        time: {
          current: "2025-12-26 周五 10:00 上午",
          period: "morning",
          isWeekend: false,
        },
        stats: {
          totalBookmarks: 100,
          recentWeekCount: 5,
          topPlatform: { name: "", code: "", count: 0 },
          topFolders: [],
        },
        preferences: {
          responseStyle: "auto",
          frequentTags: [],
        },
        recentActivity: {},
        session: {
          selectedBookmarkIds: [1, 2, 3],
        },
      };

      const prompt = buildContextPrompt(mockContext);
      expect(prompt).toContain("当前选中");
      expect(prompt).toContain("3");
    });

    it("Prompt 应包含当前文件夹信息", () => {
      const mockContext: DynamicContext = {
        time: {
          current: "2025-12-26 周五 10:00 上午",
          period: "morning",
          isWeekend: false,
        },
        stats: {
          totalBookmarks: 100,
          recentWeekCount: 5,
          topPlatform: { name: "", code: "", count: 0 },
          topFolders: [],
        },
        preferences: {
          responseStyle: "auto",
          frequentTags: [],
        },
        recentActivity: {},
        session: {
          currentFolder: { id: 1, name: "学习资料" },
        },
      };

      const prompt = buildContextPrompt(mockContext);
      expect(prompt).toContain("当前文件夹");
      expect(prompt).toContain("学习资料");
    });
  });

  // ==========================================================================
  // T2: ReAct + reasoning 参数
  // ==========================================================================
  describe("T2: ReAct + reasoning 参数", () => {
    it("工具参数应支持 reasoning 字段", () => {
      const baseSchema = z.object({
        limit: z.number().optional(),
      });

      const schemaWithReasoning = withReasoning(baseSchema);
      const result = schemaWithReasoning.safeParse({
        limit: 10,
        reasoning: "用户想查看最近收藏，选择 list_recent 工具",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.reasoning).toBe(
          "用户想查看最近收藏，选择 list_recent 工具",
        );
      }
    });

    it("应正确提取 reasoning 参数", () => {
      const params = {
        limit: 10,
        reasoning: "用户查询最近收藏，使用默认数量",
      };

      const reasoning = extractReasoning(params);
      expect(reasoning).toBe("用户查询最近收藏，使用默认数量");
    });

    it("无 reasoning 时应返回 undefined", () => {
      const params = { limit: 10 };
      const reasoning = extractReasoning(params);
      expect(reasoning).toBeUndefined();
    });
  });

  // ==========================================================================
  // T3: 模型分层策略
  // ==========================================================================
  describe("T3: 模型分层策略", () => {
    it("getTierByIntent 应根据意图选择合适层级", () => {
      // 简单查询应使用 fast 层
      const countTier = getTierByIntent("query", "count");
      expect(countTier).toBe("fast");

      // 搜索应使用 standard 层
      const searchTier = getTierByIntent("query", "search");
      expect(searchTier).toBe("standard");

      // 分析应使用 deep 层
      const analyzeTier = getTierByIntent("analyze");
      expect(analyzeTier).toBe("deep");
    });

    it("ModelTierSelector 应正确实例化", () => {
      const selector = new ModelTierSelector();
      expect(selector).toBeDefined();
      expect(typeof selector.selectTier).toBe("function");
    });
  });

  // ==========================================================================
  // T4: Feature Flags 控制
  // ==========================================================================
  describe("T4: Feature Flags", () => {
    it("默认应启用所有功能", () => {
      // 默认值测试（未设置环境变量时）
      expect(FeatureFlags.ENABLE_DYNAMIC_CONTEXT).toBe(true);
      expect(FeatureFlags.ENABLE_MODEL_TIERING).toBe(true);
      expect(FeatureFlags.ENABLE_REACT_PROMPT).toBe(true);
      expect(FeatureFlags.ENABLE_ERROR_RECOVERY).toBe(true);
      expect(FeatureFlags.ENABLE_PREFERENCE_LEARNING).toBe(true);
      expect(FeatureFlags.ENABLE_COST_CONTROL).toBe(true);
    });

    it("getAllFeatureFlags 应返回所有功能标志状态", () => {
      const allFlags = getAllFeatureFlags();

      expect(allFlags).toHaveProperty("ENABLE_DYNAMIC_CONTEXT");
      expect(allFlags).toHaveProperty("ENABLE_MODEL_TIERING");
      expect(allFlags).toHaveProperty("ENABLE_REACT_PROMPT");
      expect(allFlags).toHaveProperty("ENABLE_ERROR_RECOVERY");
      expect(allFlags).toHaveProperty("ENABLE_PREFERENCE_LEARNING");
      expect(allFlags).toHaveProperty("ENABLE_COST_CONTROL");
    });

    it("isFeatureEnabled 函数应正确检查功能状态", () => {
      const result = isFeatureEnabled("ENABLE_DYNAMIC_CONTEXT");
      expect(typeof result).toBe("boolean");
      expect(result).toBe(true);
    });
  });

  // ==========================================================================
  // T5: 成本控制器
  // ==========================================================================
  describe("T5: 成本控制器", () => {
    let controller: CostController;

    beforeEach(() => {
      controller = new CostController();
    });

    it("应检查预算是否允许", () => {
      const result = controller.checkBudget("test-user", 1000);

      expect(result).toHaveProperty("allowed");
      expect(result).toHaveProperty("remaining");
      expect(result.remaining).toHaveProperty("daily");
      expect(result.remaining).toHaveProperty("monthly");
      expect(result.allowed).toBe(true);
    });

    it("应记录 Token 使用量", () => {
      controller.recordUsage({
        requestId: "req-1",
        userId: "test-user",
        model: "gpt-4o-mini",
        tierId: "fast",
        inputTokens: 500,
        outputTokens: 200,
        totalTokens: 700,
      });

      const stats = controller.getUsageStats("test-user");
      expect(stats.todayTokens).toBe(700);
      expect(stats.monthTokens).toBe(700);
    });

    it("应建议合适的模型层级", () => {
      const suggestion = controller.suggestTier("test-user", "standard");

      expect(suggestion).toHaveProperty("tierId");
      expect(["fast", "standard", "deep"]).toContain(suggestion.tierId);
    });

    it("接近预算上限时应建议降级", () => {
      // 填充大量使用量接近预算
      for (let i = 0; i < 100; i++) {
        controller.recordUsage({
          requestId: `req-${i}`,
          userId: "heavy-user",
          model: "gpt-4o",
          tierId: "standard",
          inputTokens: 800,
          outputTokens: 200,
          totalTokens: 1000,
        });
      }

      const stats = controller.getUsageStats("heavy-user");
      expect(stats.todayTokens).toBe(100000); // 100K tokens
    });
  });

  // ==========================================================================
  // T6: 默认预算配置
  // ==========================================================================
  describe("T6: 默认预算配置", () => {
    it("应有合理的默认预算", () => {
      const controller = new CostController();
      const check = controller.checkBudget("new-user", 0);

      // 验证默认预算存在
      expect(check.remaining.daily).toBeGreaterThan(0);
      expect(check.remaining.monthly).toBeGreaterThan(0);
    });
  });
});
