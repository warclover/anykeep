/**
 * Prompt 构建器测试
 *
 * @module ai-agent/slow-thinking/__tests__
 */

import {
  buildThinkingPrompt,
  buildQuickThinkingPrompt,
} from "../prompt-builder";
import type {
  SlowThinkingRouteResult,
  SlowThinkingDynamicContext,
} from "../types";

describe("prompt-builder", () => {
  const mockRouteResult: SlowThinkingRouteResult = {
    intent: {
      type: "query",
      subType: "search",
    },
    complexity: {
      level: "medium",
      score: 55,
    },
    mode: "atomic",
  };

  const mockContext: SlowThinkingDynamicContext = {
    stats: {
      totalBookmarks: 150,
    },
    recentActivity: {
      lastSaved: {
        title: "AI 学习笔记",
      },
    },
    globalInsight: {
      topicDistribution: [
        { topic: "AI", weight: 0.4 },
        { topic: "编程", weight: 0.3 },
        { topic: "产品", weight: 0.2 },
      ],
    },
    proactiveBriefing: {
      daysSinceLastVisit: 3,
    },
  };

  describe("buildThinkingPrompt", () => {
    it("should include user message", () => {
      const prompt = buildThinkingPrompt(
        "搜索 AI 相关",
        mockRouteResult,
        mockContext,
      );
      expect(prompt).toContain("搜索 AI 相关");
    });

    it("should include intent classification", () => {
      const prompt = buildThinkingPrompt("test", mockRouteResult, mockContext);
      expect(prompt).toContain("意图分类: query (search)");
    });

    it("should include complexity info", () => {
      const prompt = buildThinkingPrompt("test", mockRouteResult, mockContext);
      expect(prompt).toContain("复杂度: medium (55/100)");
    });

    it("should include execution mode", () => {
      const prompt = buildThinkingPrompt("test", mockRouteResult, mockContext);
      expect(prompt).toContain("默认执行模式: atomic");
    });

    it("should include user context", () => {
      const prompt = buildThinkingPrompt("test", mockRouteResult, mockContext);
      expect(prompt).toContain("总收藏数: 150");
      expect(prompt).toContain("最近活跃: AI 学习笔记");
      expect(prompt).toContain("主要关注: AI, 编程, 产品");
    });

    it("should include offline days when available", () => {
      const prompt = buildThinkingPrompt("test", mockRouteResult, mockContext);
      expect(prompt).toContain("离线天数: 3");
    });

    it("should handle missing context gracefully", () => {
      const emptyContext: SlowThinkingDynamicContext = {};
      const prompt = buildThinkingPrompt("test", mockRouteResult, emptyContext);
      expect(prompt).toContain("总收藏数: 未知");
      expect(prompt).toContain("最近活跃: 无");
      expect(prompt).toContain("主要关注: 未知");
      expect(prompt).not.toContain("离线天数");
    });

    it("should include structured output format requirements", () => {
      const prompt = buildThinkingPrompt("test", mockRouteResult, mockContext);
      expect(prompt).toContain("<thinking>");
      expect(prompt).toContain("<inferred_intent>");
      expect(prompt).toContain("<inferred_goal>");
      expect(prompt).toContain("<strategy>");
      expect(prompt).toContain("<suggest_route_change>");
      expect(prompt).toContain("<confidence>");
      expect(prompt).toContain("<conclusion>");
    });

    it("should include reasoning guidance", () => {
      const prompt = buildThinkingPrompt("test", mockRouteResult, mockContext);
      expect(prompt).toContain("用户字面上说了什么");
      expect(prompt).toContain("用户真正想要什么");
      expect(prompt).toContain("默认的执行方式是否最优");
    });

    it("should handle intent without subType", () => {
      const routeWithoutSubType: SlowThinkingRouteResult = {
        ...mockRouteResult,
        intent: { type: "query" },
      };
      const prompt = buildThinkingPrompt(
        "test",
        routeWithoutSubType,
        mockContext,
      );
      expect(prompt).toContain("意图分类: query");
      expect(prompt).not.toContain("意图分类: query ()");
    });
  });

  describe("buildQuickThinkingPrompt", () => {
    it("should include user request", () => {
      const prompt = buildQuickThinkingPrompt("搜索内容", mockRouteResult);
      expect(prompt).toContain("搜索内容");
    });

    it("should include intent type", () => {
      const prompt = buildQuickThinkingPrompt("test", mockRouteResult);
      expect(prompt).toContain("意图: query");
    });

    it("should include complexity level", () => {
      const prompt = buildQuickThinkingPrompt("test", mockRouteResult);
      expect(prompt).toContain("复杂度: medium");
    });

    it("should include expected output format", () => {
      const prompt = buildQuickThinkingPrompt("test", mockRouteResult);
      expect(prompt).toContain("<inferred_intent>");
      expect(prompt).toContain("<suggest_route_change>");
      expect(prompt).toContain("<confidence>");
    });

    it("should be shorter than full thinking prompt", () => {
      const quickPrompt = buildQuickThinkingPrompt("test", mockRouteResult);
      const fullPrompt = buildThinkingPrompt(
        "test",
        mockRouteResult,
        mockContext,
      );
      expect(quickPrompt.length).toBeLessThan(fullPrompt.length);
    });
  });
});
