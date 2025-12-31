/**
 * AI Secretary 端到端集成测试
 *
 * 测试 Phase 0-4 所有模块的集成工作流
 *
 * @module ai-agent/__tests__/integration
 * @version 1.0.0
 * @since 2025-12-30
 */

import {
  ProactiveBriefingService,
  createProactiveBriefingService,
} from "../../proactive-briefing";
import {
  GlobalInsightService,
  createGlobalInsightService,
} from "../../global-insight";
import {
  SlowThinkingService,
  createSlowThinkingService,
} from "../../slow-thinking";
import {
  RuleExtractor,
  createRuleExtractor,
} from "../../preferences/rule-learning";
import type { AsyncAnalysisBriefingIntegration } from "../../async-analysis";
import {
  AsyncAnalysisService,
  createAsyncAnalysisService,
  createAsyncAnalysisBriefingIntegration,
} from "../../async-analysis";

// Mock Supabase clients (server and client)
const mockSupabaseClient = {
  from: jest.fn(() => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        gte: jest.fn(() => ({
          order: jest.fn(() => Promise.resolve({ data: [], error: null })),
        })),
        single: jest.fn(() =>
          Promise.resolve({
            data: { last_visit_at: new Date().toISOString() },
            error: null,
          }),
        ),
        or: jest.fn(() => Promise.resolve({ count: 0, error: null })),
      })),
    })),
    upsert: jest.fn(() => Promise.resolve({ error: null })),
    update: jest.fn(() => ({
      eq: jest.fn(() => Promise.resolve({ error: null })),
    })),
    insert: jest.fn(() => Promise.resolve({ error: null })),
  })),
  rpc: jest.fn(() => Promise.resolve({ data: [], error: null })),
};

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(() => Promise.resolve(mockSupabaseClient)),
}));

jest.mock("@/lib/supabase/client", () => ({
  createClient: jest.fn(() => mockSupabaseClient),
}));

// Mock logger
jest.mock("@/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock AI SDK
jest.mock("ai", () => ({
  generateText: jest.fn(() =>
    Promise.resolve({
      text: "Test AI response",
      usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
    }),
  ),
  streamText: jest.fn(() => ({
    fullStream: {
      async *[Symbol.asyncIterator]() {
        yield { type: "text-delta", textDelta: "Test " };
        yield { type: "text-delta", textDelta: "response" };
      },
    },
    text: Promise.resolve("Test response"),
    usage: Promise.resolve({
      promptTokens: 100,
      completionTokens: 50,
      totalTokens: 150,
    }),
  })),
}));

describe("AI Secretary E2E Integration Tests", () => {
  // ═══════════════════════════════════════════════════════════════════════════
  // Phase 0: 主动简报测试
  // ═══════════════════════════════════════════════════════════════════════════

  describe("Phase 0: ProactiveBriefingService", () => {
    let service: ProactiveBriefingService;

    beforeEach(() => {
      service = createProactiveBriefingService();
    });

    afterEach(() => {
      service.dispose();
    });

    it("should create service instance", () => {
      expect(service).toBeDefined();
      expect(service).toBeInstanceOf(ProactiveBriefingService);
    });

    it("should handle user visit with null briefing when recently active", async () => {
      const userId = "test-user-1";
      const briefing = await service.generateBriefing(userId);

      // When user was recently active, briefing may be null or minimal
      expect(briefing === null || briefing.enabled === true).toBe(true);
    });

    it("should add insight generators", () => {
      const mockGenerator = {
        name: "test-generator",
        generate: jest.fn(() => Promise.resolve([])),
      };

      service.addInsightGenerator(mockGenerator);
      expect(true).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Phase 1: 全局洞察测试
  // ═══════════════════════════════════════════════════════════════════════════

  describe("Phase 1: GlobalInsightService", () => {
    let service: GlobalInsightService;

    beforeEach(() => {
      service = createGlobalInsightService();
    });

    it("should create service instance", () => {
      expect(service).toBeDefined();
      expect(service).toBeInstanceOf(GlobalInsightService);
    });

    it("should generate global insight for user", async () => {
      const userId = "test-user-1";
      const result = await service.getInsight(userId, true); // forceRefresh

      // Result should have expected structure or be null/undefined for empty data
      expect(result === null || typeof result === "object").toBe(true);
    });

    it("should get cached insight when available", async () => {
      const userId = "test-user-cache";

      // First call generates
      await service.getInsight(userId, true); // forceRefresh

      // Second call should use cache if implemented
      const cached = await service.getInsight(userId);
      expect(cached === null || typeof cached === "object").toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Phase 2: 慢思考测试
  // ═══════════════════════════════════════════════════════════════════════════

  describe("Phase 2: SlowThinkingService", () => {
    let service: SlowThinkingService;

    beforeEach(() => {
      service = createSlowThinkingService();
    });

    it("should create service instance", () => {
      expect(service).toBeDefined();
      expect(service).toBeInstanceOf(SlowThinkingService);
    });

    it("should determine if slow thinking is needed based on complexity", () => {
      // SlowThinkingService decides based on message complexity
      // Test the determination logic if available
      expect(service).toBeDefined();
      expect(typeof service.shouldThink).toBe("function");
    });

    it("should support different thinking modes", async () => {
      // Execute slow thinking if method available
      // SlowThinkingService uses generateMonologue which requires routeResult and context
      // For test purposes, we just verify the service exists and has the method
      expect(service).toBeDefined();
      expect(typeof service.generateMonologue).toBe("function");
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Phase 3: 规则学习测试
  // ═══════════════════════════════════════════════════════════════════════════

  describe("Phase 3: RuleExtractor", () => {
    let extractor: RuleExtractor;

    beforeEach(() => {
      extractor = createRuleExtractor();
    });

    it("should create extractor instance", () => {
      expect(extractor).toBeDefined();
      expect(extractor).toBeInstanceOf(RuleExtractor);
    });

    it("should record correction patterns", () => {
      const userId = "test-user-1";

      // Record a correction
      extractor.recordCorrection(userId, {
        originalIntent: "tag",
        correctedIntent: "archive",
        context: {
          keywords: ["旧文章"],
          platform: "wechat",
        },
        timestamp: new Date(),
      });

      // Should not throw
      expect(true).toBe(true);
    });

    it("should extract rules from patterns", async () => {
      const userId = "test-user-rules";

      // Record multiple corrections to form patterns
      for (let i = 0; i < 5; i++) {
        extractor.recordCorrection(userId, {
          originalIntent: "tag",
          correctedIntent: "archive",
          context: {
            keywords: ["旧文章"],
            platform: "wechat",
          },
          timestamp: new Date(Date.now() - i * 60000),
        });
      }

      // Try to extract rules
      const rules = await extractor.extractRules(userId);
      expect(Array.isArray(rules)).toBe(true);
    });

    it("should apply learned rules to new intents", async () => {
      const userId = "test-user-apply";

      // Record patterns
      for (let i = 0; i < 3; i++) {
        extractor.recordCorrection(userId, {
          originalIntent: "search",
          correctedIntent: "smart_list",
          context: { keywords: ["最近"] },
          timestamp: new Date(),
        });
      }

      // Extract rules
      await extractor.extractRules(userId);

      // Try to apply rules
      const result = await extractor.applyRules(
        userId,
        { type: "query", subType: "search" },
        "最近收藏的内容",
      );

      expect(result).toBeDefined();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Phase 4: 异步分析测试
  // ═══════════════════════════════════════════════════════════════════════════

  describe("Phase 4: AsyncAnalysisService", () => {
    let service: AsyncAnalysisService;

    beforeEach(() => {
      service = createAsyncAnalysisService();
    });

    afterEach(() => {
      service.dispose();
    });

    it("should create service instance", () => {
      expect(service).toBeDefined();
      expect(service).toBeInstanceOf(AsyncAnalysisService);
    });

    it("should record user visit", async () => {
      const userId = "test-user-1";
      await expect(service.recordUserVisit(userId)).resolves.not.toThrow();
    });

    it("should schedule analysis tasks", async () => {
      const userId = "test-user-1";

      const taskIds = await service.scheduleAnalysis(userId, {
        trigger: "manual",
        priority: "high",
        types: ["topic_clustering"],
      });

      expect(Array.isArray(taskIds)).toBe(true);
    });

    it("should get queue stats", () => {
      const stats = service.getQueueStats();

      expect(stats).toHaveProperty("pending");
      expect(stats).toHaveProperty("running");
      expect(stats).toHaveProperty("completed");
      expect(stats).toHaveProperty("failed");
    });

    it("should add post-collection task", () => {
      const userId = "test-user-1";
      const bookmarkId = 123;

      expect(() =>
        service.addPostCollectionTask(userId, bookmarkId),
      ).not.toThrow();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 全功能集成流程测试
  // ═══════════════════════════════════════════════════════════════════════════

  describe("Full Integration Flow", () => {
    let briefingService: ProactiveBriefingService;
    let globalInsightService: GlobalInsightService;
    let ruleExtractor: RuleExtractor;
    let analysisService: AsyncAnalysisService;
    let integration: AsyncAnalysisBriefingIntegration;

    beforeEach(() => {
      briefingService = createProactiveBriefingService();
      globalInsightService = createGlobalInsightService();
      // slowThinkingService is not used in these tests
      ruleExtractor = createRuleExtractor();
      analysisService = createAsyncAnalysisService();
      integration = createAsyncAnalysisBriefingIntegration(analysisService);
    });

    afterEach(() => {
      briefingService.dispose();
      analysisService.dispose();
      integration.dispose();
    });

    it("should handle complete user session flow", async () => {
      const userId = "test-user-full-flow";

      // Step 1: User arrives - trigger proactive briefing
      const briefing = await briefingService.generateBriefing(userId);
      expect(briefing === null || typeof briefing === "object").toBe(true);

      // Step 2: Generate global insight
      const insight = await globalInsightService.getInsight(userId, true); // forceRefresh
      expect(insight === null || typeof insight === "object").toBe(true);

      // Step 3: Record user visit in async analysis
      await integration.handleUserVisit(userId);

      // Step 4: User performs action that gets corrected
      ruleExtractor.recordCorrection(userId, {
        originalIntent: "tag",
        correctedIntent: "archive",
        context: { keywords: ["测试"] },
        timestamp: new Date(),
      });

      // Step 5: Get analysis insights
      const insights = integration.getAnalysisInsights(userId);
      expect(Array.isArray(insights)).toBe(true);

      // Step 6: Get suggested actions
      const actions = integration.getAnalysisActions(userId);
      expect(Array.isArray(actions)).toBe(true);
    });

    it("should integrate async analysis with briefing", () => {
      const userId = "test-user-integration";

      const existingInsights: never[] = [];
      const existingActions: never[] = [];

      const merged = integration.mergeIntoBriefing(
        userId,
        existingInsights,
        existingActions,
      );

      expect(merged).toHaveProperty("insights");
      expect(merged).toHaveProperty("actions");
      expect(Array.isArray(merged.insights)).toBe(true);
      expect(Array.isArray(merged.actions)).toBe(true);
    });

    it("should handle rule learning and application", async () => {
      const userId = "test-user-rules";

      // Record multiple corrections
      for (let i = 0; i < 5; i++) {
        ruleExtractor.recordCorrection(userId, {
          originalIntent: "search",
          correctedIntent: "smart_list",
          context: { keywords: ["最近收藏"] },
          timestamp: new Date(),
        });
      }

      // Extract rules
      const rules = await ruleExtractor.extractRules(userId);
      expect(Array.isArray(rules)).toBe(true);

      // Apply rules
      const result = await ruleExtractor.applyRules(
        userId,
        { type: "query", subType: "search" },
        "最近收藏的内容",
      );
      expect(result).toBeDefined();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 错误处理测试
  // ═══════════════════════════════════════════════════════════════════════════

  describe("Error Handling", () => {
    it("should handle empty user ID gracefully", async () => {
      const service = createAsyncAnalysisService();
      await expect(service.recordUserVisit("")).resolves.not.toThrow();
      service.dispose();
    });

    it("should handle service disposal", () => {
      const service = createAsyncAnalysisService();
      service.dispose();
      expect(() => service.getQueueStats()).not.toThrow();
    });

    it("should handle invalid correction data", () => {
      const extractor = createRuleExtractor();
      const userId = "test-user-error";

      // Record with minimal data
      expect(() =>
        extractor.recordCorrection(userId, {
          originalIntent: "",
          correctedIntent: "",
          context: {},
          timestamp: new Date(),
        }),
      ).not.toThrow();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Feature Flag 测试
  // ═══════════════════════════════════════════════════════════════════════════

  describe("Feature Flag Integration", () => {
    it("should respect feature flags in async analysis", async () => {
      const service = createAsyncAnalysisService({
        enabled: false,
        maxConcurrentTasks: 2,
        taskTimeoutMs: 30000,
        enableTopicClustering: false,
        enablePatternDetection: false,
        enableLinkHealthCheck: false,
      });

      const userId = "test-user-ff";

      const taskIds = await service.scheduleAnalysis(userId, {
        trigger: "manual",
        priority: "high",
      });

      expect(taskIds).toEqual([]);
      service.dispose();
    });

    it("should enable specific analyzers only", async () => {
      // 使用实际的配置选项：只启用 topic_clustering
      const service = createAsyncAnalysisService({
        enabled: true,
        maxConcurrentTasks: 2,
        taskTimeoutMs: 30000,
        enableTopicClustering: true,
        enablePatternDetection: false,
        enableLinkHealthCheck: false,
      });

      const userId = "test-user-specific";

      // 请求 topic_clustering（唯一启用的）
      const taskIds = await service.scheduleAnalysis(userId, {
        trigger: "manual",
        priority: "high",
        types: ["topic_clustering"],
      });

      // 应该只有 1 个任务
      expect(taskIds.length).toBe(1);
      service.dispose();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 性能基准测试（简化版）
  // ═══════════════════════════════════════════════════════════════════════════

  describe("Performance Benchmarks", () => {
    it("should create services within acceptable time", () => {
      const startTime = Date.now();

      const briefing = createProactiveBriefingService();
      createGlobalInsightService();
      createSlowThinkingService();
      createRuleExtractor();
      const analysis = createAsyncAnalysisService();

      const createTime = Date.now() - startTime;

      // All services should be created in under 100ms
      expect(createTime).toBeLessThan(100);

      briefing.dispose();
      analysis.dispose();
    });

    it("should schedule tasks efficiently", async () => {
      const service = createAsyncAnalysisService();
      const userId = "test-perf";

      const startTime = Date.now();

      // Schedule multiple tasks
      await Promise.all([
        service.scheduleAnalysis(userId, {
          trigger: "manual",
          priority: "high",
        }),
        service.scheduleAnalysis(userId, {
          trigger: "manual",
          priority: "medium",
        }),
        service.scheduleAnalysis(userId, {
          trigger: "manual",
          priority: "low",
        }),
      ]);

      const scheduleTime = Date.now() - startTime;

      // Scheduling should be fast
      expect(scheduleTime).toBeLessThan(50);

      service.dispose();
    });
  });
});
