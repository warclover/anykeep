/**
 * 路由日志模块单元测试
 *
 * @module ai-skills/router/__tests__/route-logger.test
 */

import {
  createRouteLogger,
  getRouteLogger,
  resetRouteLogger,
  createRouteDecisionLog,
  type RouteDecisionLog,
} from "../route-logger";

// Mock logger
jest.mock("@/lib/logger", () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

import { logger } from "@/lib/logger";

describe("RouteLogger", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetRouteLogger();
  });

  describe("generateRouteId", () => {
    it("应生成带 route_ 前缀的 ID", () => {
      const routeLogger = createRouteLogger();
      const id = routeLogger.generateRouteId();
      expect(id).toMatch(/^route_[a-z0-9]{10}$/);
    });
  });

  describe("logRouteDecision", () => {
    it("应记录基础路由决策日志", () => {
      const routeLogger = createRouteLogger({ verbose: false });

      const log: RouteDecisionLog = {
        routeId: "route_abc123",
        timestamp: Date.now(),
        input: "搜索书签",
        inputLength: 4,
        classification: {
          intentType: "query",
          subType: "search",
          intentKey: "query:search",
          confidence: 0.85,
          complexity: "simple",
        },
        routing: {
          skillId: "search",
          mode: "atomic",
          isExplicit: false,
          reason: "search:semantic → 智能搜索",
        },
        performance: {
          classificationMs: 5,
          mappingMs: 2,
          totalMs: 10,
        },
      };

      routeLogger.logRouteDecision(log);

      expect(logger.info).toHaveBeenCalled();
    });

    it("应记录详细模式日志", () => {
      const routeLogger = createRouteLogger({ verbose: true });

      const log: RouteDecisionLog = {
        routeId: "route_xyz789",
        timestamp: Date.now(),
        input: "复习收藏",
        inputLength: 4,
        classification: {
          intentType: "learn",
          subType: "review",
          intentKey: "learn:review",
          confidence: 0.9,
          complexity: "medium",
          matchedPattern: "复习",
          matchScore: 0.85,
        },
        routing: {
          skillId: "knowledge_review",
          mode: "orchestration",
          isExplicit: false,
          reason: "learn:review → 知识回顾",
        },
        performance: {
          classificationMs: 8,
          mappingMs: 3,
          totalMs: 15,
        },
      };

      routeLogger.logRouteDecision(log);

      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          routeId: "route_xyz789",
          matchedPattern: "复习",
          matchScore: 0.85,
        }),
        expect.any(String),
      );
    });

    it("Feature Flag 禁用时应使用 warn 级别", () => {
      const routeLogger = createRouteLogger();

      const log: RouteDecisionLog = {
        routeId: "route_ff001",
        timestamp: Date.now(),
        input: "TTS 朗读",
        inputLength: 6,
        classification: {
          intentType: "create",
          subType: "tts",
          intentKey: "create:tts",
          confidence: 0.88,
          complexity: "medium",
        },
        routing: {
          skillId: "search",
          mode: "atomic",
          isExplicit: false,
          reason: "Skill 被禁用，回退到搜索",
        },
        featureFlag: {
          intentDisabled: false,
          skillDisabled: true,
          disabledReason: "Skill tts_synthesis 已被 Feature Flag 禁用",
        },
        performance: {
          classificationMs: 5,
          mappingMs: 2,
          totalMs: 10,
        },
      };

      routeLogger.logRouteDecision(log);

      expect(logger.warn).toHaveBeenCalled();
    });

    it("低置信度时应使用 warn 级别", () => {
      const routeLogger = createRouteLogger();

      const log: RouteDecisionLog = {
        routeId: "route_low001",
        timestamp: Date.now(),
        input: "...",
        inputLength: 3,
        classification: {
          intentType: "chitchat",
          subType: "unknown",
          intentKey: "chitchat:unknown",
          confidence: 0.3,
          complexity: "simple",
        },
        routing: {
          skillId: "search",
          mode: "atomic",
          isExplicit: false,
          reason: "无匹配映射",
        },
        performance: {
          classificationMs: 3,
          mappingMs: 1,
          totalMs: 5,
        },
      };

      routeLogger.logRouteDecision(log);

      expect(logger.warn).toHaveBeenCalled();
    });
  });

  describe("logExplicitRoute", () => {
    it("成功路由应记录 info 级别", () => {
      const routeLogger = createRouteLogger();

      routeLogger.logExplicitRoute(
        "route_exp001",
        "organize",
        "batch_organize",
        "Success",
        5,
      );

      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          routeId: "route_exp001",
          toolId: "organize",
          skillId: "batch_organize",
        }),
        expect.stringContaining("organize → batch_organize"),
      );
    });

    it("失败路由应记录 warn 级别", () => {
      const routeLogger = createRouteLogger();

      routeLogger.logExplicitRoute(
        "route_exp002",
        "unknown_tool",
        null,
        "Tool not found",
        3,
      );

      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          routeId: "route_exp002",
          toolId: "unknown_tool",
          skillId: null,
        }),
        expect.stringContaining("failed"),
      );
    });
  });

  describe("logFallback", () => {
    it("应记录回退日志", () => {
      const routeLogger = createRouteLogger();

      routeLogger.logFallback(
        "route_fb001",
        "knowledge_review",
        "search",
        "编排执行失败",
      );

      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          routeId: "route_fb001",
          originalSkillId: "knowledge_review",
          fallbackSkillId: "search",
          reason: "编排执行失败",
        }),
        expect.stringContaining("fallback"),
      );
    });
  });

  describe("logLowConfidence", () => {
    it("应记录低置信度警告", () => {
      const routeLogger = createRouteLogger();

      routeLogger.logLowConfidence("route_lc001", "帮我", 0.35, 0.4);

      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          routeId: "route_lc001",
          confidence: 0.35,
          threshold: 0.4,
        }),
        expect.stringContaining("Low confidence"),
      );
    });
  });

  describe("logFeatureFlagImpact", () => {
    it("应记录 Feature Flag 影响", () => {
      const routeLogger = createRouteLogger();

      routeLogger.logFeatureFlagImpact(
        "route_ff002",
        "create:tts",
        "tts_synthesis",
        "skill_disabled",
      );

      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          routeId: "route_ff002",
          intentKey: "create:tts",
          skillId: "tts_synthesis",
          impact: "skill_disabled",
        }),
        expect.stringContaining("Feature flag impact"),
      );
    });
  });

  describe("updateConfig", () => {
    it("应正确更新配置", () => {
      const routeLogger = createRouteLogger({ verbose: false });
      expect(routeLogger.getConfig().verbose).toBe(false);

      routeLogger.updateConfig({ verbose: true });
      expect(routeLogger.getConfig().verbose).toBe(true);
    });
  });
});

describe("createRouteDecisionLog", () => {
  it("应创建完整的日志条目", () => {
    const log = createRouteDecisionLog({
      routeId: "route_test001",
      input: "搜索 AI 相关的书签",
      intentType: "query",
      subType: "semantic",
      confidence: 0.85,
      complexity: "simple",
      skillId: "search",
      mode: "atomic",
      reason: "search:semantic → 智能搜索",
      matchedPattern: "搜索",
      matchScore: 0.8,
      classificationMs: 5,
      mappingMs: 2,
      totalMs: 10,
    });

    expect(log.routeId).toBe("route_test001");
    expect(log.classification.intentKey).toBe("search:semantic");
    expect(log.classification.matchedPattern).toBe("搜索");
    expect(log.routing.skillId).toBe("search");
    expect(log.performance.totalMs).toBe(10);
    expect(log.featureFlag).toBeUndefined();
  });

  it("应包含 Feature Flag 信息（当禁用时）", () => {
    const log = createRouteDecisionLog({
      routeId: "route_test002",
      input: "TTS 朗读",
      intentType: "create",
      subType: "tts",
      confidence: 0.88,
      complexity: "medium",
      skillId: "search",
      mode: "atomic",
      reason: "回退",
      skillDisabled: true,
      disabledReason: "TTS 已禁用",
      classificationMs: 5,
      mappingMs: 2,
      totalMs: 10,
    });

    expect(log.featureFlag).toBeDefined();
    expect(log.featureFlag?.skillDisabled).toBe(true);
    expect(log.featureFlag?.disabledReason).toBe("TTS 已禁用");
  });

  it("应截断长输入", () => {
    const longInput = "a".repeat(150); // 使用英文字符确保长度准确

    const log = createRouteDecisionLog({
      routeId: "route_test003",
      input: longInput,
      intentType: "query",
      subType: "keyword",
      confidence: 0.7,
      complexity: "simple",
      skillId: "search",
      mode: "atomic",
      reason: "关键词搜索",
      classificationMs: 3,
      mappingMs: 1,
      totalMs: 5,
    });

    expect(log.input.length).toBe(100);
    expect(log.inputLength).toBe(longInput.length);
  });

  it("应包含用户上下文（脱敏）", () => {
    const log = createRouteDecisionLog({
      routeId: "route_test004",
      input: "搜索",
      intentType: "query",
      subType: "keyword",
      confidence: 0.75,
      complexity: "simple",
      skillId: "search",
      mode: "atomic",
      reason: "搜索",
      classificationMs: 3,
      mappingMs: 1,
      totalMs: 5,
      userId: "user_abc123456789",
      hasPreferences: true,
    });

    expect(log.context).toBeDefined();
    expect(log.context?.userId).toBe("user_abc...");
    expect(log.context?.hasPreferences).toBe(true);
  });
});

describe("getRouteLogger (单例)", () => {
  beforeEach(() => {
    resetRouteLogger();
  });

  it("应返回同一个实例", () => {
    const logger1 = getRouteLogger();
    const logger2 = getRouteLogger();
    expect(logger1).toBe(logger2);
  });

  it("重置后应返回新实例", () => {
    const logger1 = getRouteLogger();
    resetRouteLogger();
    const logger2 = getRouteLogger();
    expect(logger1).not.toBe(logger2);
  });
});
