/**
 * UnifiedEngine 集成测试
 *
 * 验证统一引擎的完整流程：
 * - 意图分类 → 模式选择 → 路由分发 → 执行输出
 *
 * @version 1.0.0
 * @since 2025-12-24
 */

import { UnifiedEngine, createUnifiedEngine } from "../unified-engine";
import type { EngineContext } from "../types";
import type {
  AgentStreamChunk,
  AgentContext,
} from "../../../ai-agent/core/types";
import { z } from "zod";

import type { UnifiedStreamChunk } from "../../output/types";
import type { OrchestrationSkill } from "../../orchestration/orchestration-skill";

// Mock skill 接口定义（用于测试）
// 注意：这是一个简化版本，使用 as unknown as 进行类型断言
interface MockOrchestrationSkill {
  metadata: {
    id: string;
    name: string;
    description: string;
    category: string;
    version: string;
    enabled: boolean;
    triggers: string[];
    deliverableTypes: string[];
    steps: Array<{ id: string; name: string; description: string }>;
  };
  inputSchema: z.ZodType<unknown>;
  outputSchema: z.ZodType<unknown>;
  parseInput: jest.Mock;
  executeStream: jest.Mock;
}

// 类型断言帮助函数
function asOrchestrationSkill(
  mock: MockOrchestrationSkill,
): OrchestrationSkill<unknown, unknown> {
  return mock as unknown as OrchestrationSkill<unknown, unknown>;
}

// Mock dependencies
jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({ data: null, error: null })),
          order: jest.fn(() => Promise.resolve({ data: [], error: null })),
        })),
      })),
    })),
    auth: {
      getUser: jest.fn(() =>
        Promise.resolve({
          data: { user: { id: "test-user-id" } },
          error: null,
        }),
      ),
    },
  })),
}));

jest.mock("@/lib/logger", () => {
  // 显式类型定义避免隐式 any
  interface MockLogger {
    info: jest.Mock;
    error: jest.Mock;
    debug: jest.Mock;
    warn: jest.Mock;
    child: jest.Mock;
  }

  const mockLogger: MockLogger = {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    child: jest.fn(),
  };

  // child 返回自身（在定义后设置避免循环引用）
  mockLogger.child.mockReturnValue(mockLogger);

  return { logger: mockLogger };
});

describe("UnifiedEngine Integration Tests", () => {
  let engine: UnifiedEngine;

  const createMockContext = (
    overrides: Partial<EngineContext> = {},
  ): EngineContext => ({
    userId: "test-user",
    conversationId: "test-conv",
    traceId: "test-trace",
    ...overrides,
  });

  beforeEach(() => {
    engine = createUnifiedEngine({ debug: true });
  });

  describe("Engine Initialization", () => {
    it("should create engine with default config", () => {
      const newEngine = new UnifiedEngine();
      expect(newEngine).toBeInstanceOf(UnifiedEngine);
      expect(newEngine.isReady()).toBe(false); // No atomic executor set
    });

    it("should create engine with custom config", () => {
      const customEngine = createUnifiedEngine({
        enabled: true,
        debug: true,
        includeRoutingInfo: true,
      });
      expect(customEngine).toBeInstanceOf(UnifiedEngine);
    });

    it("should update config", () => {
      engine.updateConfig({ debug: false });
      // Config updated successfully (no error thrown)
      expect(engine).toBeDefined();
    });
  });

  describe("Atomic Executor", () => {
    it("should set atomic executor", () => {
      const mockExecutor =
        async function* (): AsyncGenerator<AgentStreamChunk> {
          yield { type: "text", text: "Hello" };
          yield { type: "done" };
        };

      engine.setAtomicExecutor(mockExecutor);
      expect(engine.isReady()).toBe(true);
    });

    it("should execute with atomic executor", async () => {
      const chunks: UnifiedStreamChunk[] = [];
      const mockExecutor =
        async function* (): AsyncGenerator<AgentStreamChunk> {
          yield { type: "text", text: "Response text" };
          yield { type: "done" };
        };

      engine.setAtomicExecutor(mockExecutor);

      for await (const chunk of engine.execute(
        "简单查询",
        createMockContext(),
        { forceMode: "atomic" },
      )) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBeGreaterThan(0);
      // Should have text chunks
      const textChunk = chunks.find((c) => c.type === "text");
      expect(textChunk).toBeDefined();
    });

    it("should handle missing atomic executor gracefully", async () => {
      const newEngine = createUnifiedEngine();
      const chunks: UnifiedStreamChunk[] = [];

      for await (const chunk of newEngine.execute(
        "test query",
        createMockContext(),
        { forceMode: "atomic" },
      )) {
        chunks.push(chunk);
      }

      // Should return error chunk
      const errorChunk = chunks.find((c) => c.type === "error");
      expect(errorChunk).toBeDefined();
      expect(errorChunk?.data?.code).toBe("EXECUTOR_NOT_CONFIGURED");
    });
  });

  describe("Orchestration Skill Registration", () => {
    it("should register orchestration skill", () => {
      const mockSkill: MockOrchestrationSkill = {
        metadata: {
          id: "test-report",
          name: "Test Report",
          description: "Generate test reports",
          category: "understanding",
          version: "1.0.0",
          enabled: true,
          triggers: ["报告", "生成报告"],
          deliverableTypes: ["report"],
          steps: [{ id: "step1", name: "Step 1", description: "First step" }],
        },
        inputSchema: z.object({ type: z.string() }),
        outputSchema: z.object({ report: z.any() }),
        parseInput: jest.fn().mockResolvedValue({ type: "test" }),
        executeStream: jest.fn().mockImplementation(async function* () {
          yield { type: "progress", stepId: "step1", status: "running" };
          yield { type: "deliverable", format: "report", content: {} };
          yield { type: "done" };
        }),
      };

      engine.registerOrchestrationSkill(asOrchestrationSkill(mockSkill));

      const registeredSkills = engine.getRegisteredOrchestrationSkills();
      expect(registeredSkills).toHaveLength(1);
      expect(registeredSkills[0].id).toBe("test-report");
    });

    it("should execute orchestration skill with forceMode", async () => {
      const chunks: UnifiedStreamChunk[] = [];

      const mockSkill: MockOrchestrationSkill = {
        metadata: {
          id: "force-test",
          name: "Force Test",
          description: "Test forced orchestration",
          category: "utility",
          version: "1.0.0",
          enabled: true,
          triggers: ["force"],
          deliverableTypes: ["document"],
          steps: [
            { id: "process", name: "Process", description: "Processing" },
          ],
        },
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        parseInput: jest.fn().mockResolvedValue({}),
        executeStream: jest.fn().mockImplementation(async function* () {
          yield {
            type: "progress",
            data: { step: "process", percent: 50, timestamp: Date.now() },
          };
          yield { type: "text", data: { text: "Orchestrated output" } };
          yield {
            type: "progress",
            data: { step: "process", percent: 100, timestamp: Date.now() },
          };
          yield { type: "done", data: { success: true } };
        }),
      };

      engine.registerOrchestrationSkill(asOrchestrationSkill(mockSkill));

      for await (const chunk of engine.execute(
        "force test",
        createMockContext(),
        { forceMode: "orchestration", forceSkill: "force-test" },
      )) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBeGreaterThan(0);
    });
  });

  describe("Routing Integration", () => {
    it("should access router through getRouter", () => {
      const router = engine.getRouter();
      expect(router).toBeDefined();
      expect(router.route).toBeDefined();
    });

    it("should route requests through IntentRouter", async () => {
      // Set up atomic executor for fallback
      const mockExecutor =
        async function* (): AsyncGenerator<AgentStreamChunk> {
          yield { type: "text", text: "Atomic response" };
          yield { type: "done" };
        };
      engine.setAtomicExecutor(mockExecutor);

      // Register an orchestration skill
      const mockSkill: MockOrchestrationSkill = {
        metadata: {
          id: "knowledge-review",
          name: "知识回顾",
          description: "Review knowledge",
          category: "understanding",
          version: "1.0.0",
          enabled: true,
          triggers: ["回顾", "复习", "知识回顾"],
          deliverableTypes: ["report"],
          steps: [{ id: "collect", name: "收集", description: "Collect data" }],
        },
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        parseInput: jest.fn().mockResolvedValue({}),
        executeStream: jest.fn().mockImplementation(async function* () {
          yield {
            type: "progress",
            data: { step: "collect", percent: 100, timestamp: Date.now() },
          };
          yield { type: "done", data: { success: true } };
        }),
      };
      engine.registerOrchestrationSkill(asOrchestrationSkill(mockSkill));

      const chunks: UnifiedStreamChunk[] = [];
      for await (const chunk of engine.execute(
        "帮我回顾一下最近收藏的内容",
        createMockContext(),
        { includeRoutingInfo: true },
      )) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBeGreaterThan(0);
      // Should include routing info when enabled
      const routingChunk = chunks.find((c) => c.type === "routing");
      expect(routingChunk).toBeDefined();
    });
  });

  describe("Orchestration Engine Access", () => {
    it("should access orchestration engine", () => {
      const orchEngine = engine.getOrchestrationEngine();
      expect(orchEngine).toBeDefined();
      expect(orchEngine.register).toBeDefined();
      expect(orchEngine.execute).toBeDefined();
    });

    it("should check skill existence", () => {
      const orchEngine = engine.getOrchestrationEngine();

      // Initially no skills
      expect(orchEngine.hasSkill("non-existent")).toBe(false);

      // Register a skill
      const mockSkill: MockOrchestrationSkill = {
        metadata: {
          id: "check-skill",
          name: "Check Skill",
          description: "Skill for checking",
          category: "utility",
          version: "1.0.0",
          enabled: true,
          triggers: ["check"],
          deliverableTypes: ["document"],
          steps: [],
        },
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        parseInput: jest.fn(),
        executeStream: jest.fn(),
      };

      engine.registerOrchestrationSkill(asOrchestrationSkill(mockSkill));
      expect(orchEngine.hasSkill("check-skill")).toBe(true);
    });
  });

  describe("Output Adapter", () => {
    it("should access output adapter", () => {
      const adapter = engine.getOutputAdapter();
      expect(adapter).toBeDefined();
      expect(adapter.adaptAtomicChunk).toBeDefined();
      expect(adapter.adaptOrchestrationChunk).toBeDefined();
    });

    it("should create error chunks", () => {
      const adapter = engine.getOutputAdapter();
      const errorChunk = adapter.createErrorChunk(
        "Test error",
        "TEST_ERROR",
        true,
      );

      expect(errorChunk.type).toBe("error");
      expect((errorChunk.data as { message: string }).message).toBe(
        "Test error",
      );
      expect((errorChunk.data as { code: string }).code).toBe("TEST_ERROR");
      expect((errorChunk.data as { retryable: boolean }).retryable).toBe(true);
    });

    it("should create fallback chunks", () => {
      const adapter = engine.getOutputAdapter();
      const fallbackChunk = adapter.createFallbackChunk("Fallback reason");

      expect(fallbackChunk.type).toBe("fallback");
      expect((fallbackChunk.data as { reason: string }).reason).toBe(
        "Fallback reason",
      );
    });
  });

  describe("Error Handling", () => {
    it("should handle executor errors with fallback", async () => {
      const failingExecutor =
        async function* (): AsyncGenerator<AgentStreamChunk> {
          throw new Error("Executor failed");
        };

      engine.setAtomicExecutor(failingExecutor);

      const chunks: UnifiedStreamChunk[] = [];
      for await (const chunk of engine.execute(
        "test query",
        createMockContext(),
        { forceMode: "atomic" },
      )) {
        chunks.push(chunk);
      }

      // AtomicFallbackHandler 会生成降级响应而非错误块
      // 应该有 fallback 块（表示降级）和 done 块（表示完成但失败）
      const fallbackChunk = chunks.find((c) => c.type === "fallback");
      expect(fallbackChunk).toBeDefined();

      const doneChunk = chunks.find((c) => c.type === "done");
      expect(doneChunk).toBeDefined();
      expect(doneChunk?.data).toHaveProperty("success", false);
    });

    it("should handle orchestration skill errors with fallback to atomic", async () => {
      // Set up atomic executor for fallback
      const atomicExecutor =
        async function* (): AsyncGenerator<AgentStreamChunk> {
          yield { type: "text", text: "Fallback response" };
          yield { type: "done" };
        };
      engine.setAtomicExecutor(atomicExecutor);

      // Register a failing orchestration skill
      const failingSkill: MockOrchestrationSkill = {
        metadata: {
          id: "failing-skill",
          name: "Failing Skill",
          description: "A skill that fails",
          category: "utility",
          version: "1.0.0",
          enabled: true,
          triggers: ["fail"],
          deliverableTypes: ["document"],
          steps: [{ id: "fail", name: "Fail", description: "Will fail" }],
        },
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        parseInput: jest.fn().mockResolvedValue({}),
        executeStream: jest.fn().mockImplementation(async function* () {
          yield { type: "progress", stepId: "fail", status: "running" };
          yield {
            type: "error",
            error: "Simulated failure",
            code: "TEST_ERROR",
            retryable: true,
          };
        }),
      };

      engine.registerOrchestrationSkill(asOrchestrationSkill(failingSkill));

      const chunks: UnifiedStreamChunk[] = [];
      for await (const chunk of engine.execute(
        "fail request",
        createMockContext(),
        { forceMode: "orchestration", forceSkill: "failing-skill" },
      )) {
        chunks.push(chunk);
      }

      // Should have fallback handling
      expect(chunks.length).toBeGreaterThan(0);
    });
  });

  describe("Disabled Engine", () => {
    it("should bypass routing when disabled", async () => {
      const disabledEngine = createUnifiedEngine({ enabled: false });

      const atomicExecutor =
        async function* (): AsyncGenerator<AgentStreamChunk> {
          yield { type: "text", text: "Direct atomic" };
          yield { type: "done" };
        };
      disabledEngine.setAtomicExecutor(atomicExecutor);

      const chunks: UnifiedStreamChunk[] = [];
      for await (const chunk of disabledEngine.execute(
        "complex query that would normally route to orchestration",
        createMockContext(),
      )) {
        chunks.push(chunk);
      }

      // Should go directly to atomic without routing
      expect(chunks.length).toBeGreaterThan(0);
      const textChunk = chunks.find((c) => c.type === "text");
      expect((textChunk?.data as { text: string } | undefined)?.text).toBe(
        "Direct atomic",
      );
    });
  });

  describe("Suggestions Injection", () => {
    it("should inject suggestions chunk before done chunk on success", async () => {
      // Set up atomic executor that returns success
      const atomicExecutor =
        async function* (): AsyncGenerator<AgentStreamChunk> {
          yield { type: "text", text: "搜索结果如下" };
          yield {
            type: "done",
            result: {
              success: true,
              content: "搜索完成",
              toolCalls: [],
              durationMs: 100,
            },
          };
        };
      engine.setAtomicExecutor(atomicExecutor);

      const chunks: UnifiedStreamChunk[] = [];
      // Use a query message to trigger query intent with suggestions
      for await (const chunk of engine.execute(
        "搜索关于AI的文章",
        createMockContext(),
      )) {
        chunks.push(chunk);
      }

      // Find suggestions and done chunks
      const suggestionsIndex = chunks.findIndex(
        (c) => c.type === "suggestions",
      );
      const doneIndex = chunks.findIndex((c) => c.type === "done");

      // Suggestions should be present and before done
      if (suggestionsIndex !== -1) {
        expect(suggestionsIndex).toBeLessThan(doneIndex);

        // Verify suggestions structure
        const suggestionsChunk = chunks[suggestionsIndex];
        expect(suggestionsChunk.type).toBe("suggestions");
        expect(
          (suggestionsChunk.data as { suggestions: unknown[] }).suggestions,
        ).toBeInstanceOf(Array);
      }
    });

    it("should not inject suggestions when execution fails", async () => {
      // Set up atomic executor that returns failure
      const atomicExecutor =
        async function* (): AsyncGenerator<AgentStreamChunk> {
          yield { type: "text", text: "Error occurred" };
          yield {
            type: "done",
            result: {
              success: false,
              content: "",
              toolCalls: [],
              durationMs: 50,
              error: "Test error",
            },
          };
        };
      engine.setAtomicExecutor(atomicExecutor);

      const chunks: UnifiedStreamChunk[] = [];
      for await (const chunk of engine.execute(
        "failing query",
        createMockContext(),
        { forceMode: "atomic" },
      )) {
        chunks.push(chunk);
      }

      // Should not have suggestions chunk for failed execution
      const suggestionsChunk = chunks.find((c) => c.type === "suggestions");
      expect(suggestionsChunk).toBeUndefined();
    });
  });
});

describe("UnifiedEngine Factory", () => {
  it("should create engine via factory function", () => {
    const engine = createUnifiedEngine();
    expect(engine).toBeInstanceOf(UnifiedEngine);
  });

  it("should create engine with config via factory", () => {
    const engine = createUnifiedEngine({
      enabled: true,
      debug: true,
      includeRoutingInfo: true,
      defaultOptions: {
        includeRoutingInfo: true,
      },
    });
    expect(engine).toBeInstanceOf(UnifiedEngine);
  });
});

describe("Refine Intent Handling", () => {
  let engine: UnifiedEngine;

  beforeEach(() => {
    engine = createUnifiedEngine({ debug: true });
  });

  it("should detect refine intent for filter requests", async () => {
    // Set up atomic executor
    const atomicExecutor =
      async function* (): AsyncGenerator<AgentStreamChunk> {
        yield { type: "text", text: "筛选后的结果" };
        yield { type: "done" };
      };
    engine.setAtomicExecutor(atomicExecutor);

    const chunks: UnifiedStreamChunk[] = [];
    for await (const chunk of engine.execute(
      "里面有关于 API 的吗？",
      {
        userId: "test-user",
        conversationId: "test-conv",
        lastSearchResults: {
          query: "Claude",
          resultIds: [101, 102, 103, 104, 105],
          searchedAt: Date.now(),
        },
      },
      { includeRoutingInfo: true },
    )) {
      chunks.push(chunk);
    }

    // Should have routing chunk showing refine intent
    const routingChunk = chunks.find((c) => c.type === "routing");
    expect(routingChunk).toBeDefined();
    if (routingChunk?.data) {
      const data = routingChunk.data as { intentType?: string };
      expect(data.intentType).toBe("refine");
    }
  });

  it("should inject search results context for refine intent", async () => {
    let capturedContext: AgentContext | undefined;

    // Set up atomic executor that captures context (receives AgentContext, not EngineContext)
    const atomicExecutor = async function* (
      _input: string,
      ctx: AgentContext,
    ): AsyncGenerator<AgentStreamChunk> {
      capturedContext = ctx;
      yield { type: "text", text: "筛选完成" };
      yield { type: "done" };
    };
    engine.setAtomicExecutor(atomicExecutor);

    for await (const _chunk of engine.execute(
      "里面有没有关于 TypeScript 的？",
      {
        userId: "test-user",
        conversationId: "test-conv",
        lastSearchResults: {
          query: "编程语言",
          resultIds: [1, 2, 3, 4, 5],
          searchedAt: Date.now(),
        },
      },
    )) {
      // Just consume chunks
    }

    // Verify context was enhanced with refine information
    // Note: attachmentContext is converted to systemPrompt in AgentContext
    expect(capturedContext).toBeDefined();
    expect(capturedContext?.systemPrompt).toContain(
      "用户正在筛选之前的搜索结果",
    );
    expect(capturedContext?.systemPrompt).toContain("编程语言");
    expect(capturedContext?.bookmarkIds).toEqual([1, 2, 3, 4, 5]);
  });

  it("should not inject context when no search results exist", async () => {
    let capturedContext: EngineContext | undefined;

    const atomicExecutor = async function* (
      _input: string,
      ctx: EngineContext,
    ): AsyncGenerator<AgentStreamChunk> {
      capturedContext = ctx;
      yield { type: "text", text: "响应" };
      yield { type: "done" };
    };
    engine.setAtomicExecutor(atomicExecutor);

    for await (const _chunk of engine.execute("里面有关于什么的？", {
      userId: "test-user",
      conversationId: "test-conv",
      // No lastSearchResults
    })) {
      // Just consume chunks
    }

    // Should not have refine context when no search results
    expect(capturedContext).toBeDefined();
    expect(capturedContext?.attachmentContext).toBeUndefined();
  });

  it("should preserve existing bookmarkIds when refining", async () => {
    let capturedContext: EngineContext | undefined;

    const atomicExecutor = async function* (
      _input: string,
      ctx: EngineContext,
    ): AsyncGenerator<AgentStreamChunk> {
      capturedContext = ctx;
      yield { type: "text", text: "筛选完成" };
      yield { type: "done" };
    };
    engine.setAtomicExecutor(atomicExecutor);

    const existingBookmarkIds = [10, 20, 30];

    for await (const _chunk of engine.execute("筛选一下这些", {
      userId: "test-user",
      conversationId: "test-conv",
      bookmarkIds: existingBookmarkIds,
      lastSearchResults: {
        query: "测试",
        resultIds: [100, 200, 300],
        searchedAt: Date.now(),
      },
    })) {
      // Just consume chunks
    }

    // Should preserve existing bookmarkIds, not replace with search results
    expect(capturedContext?.bookmarkIds).toEqual(existingBookmarkIds);
  });
});
