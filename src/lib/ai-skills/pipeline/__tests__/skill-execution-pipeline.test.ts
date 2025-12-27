/**
 * Skill 执行流水线单元测试
 *
 * @version 1.0.0
 * @since 2025-12-27
 */

import {
  SkillExecutionPipeline,
  PipelineStage,
  isPipelineEvent,
  isSkillChunk,
  type PipelineContext,
  type PipelineChunk,
  type SkillRegistry,
} from "../index";
import type { OrchestrationSkill } from "../../orchestration/orchestration-skill";
import type { OrchestrationStreamChunk } from "../../output/types";

// ============================================
// Mock 工具
// ============================================

/**
 * 创建 Mock Skill
 */
function createMockSkill(
  id: string,
  options?: {
    parseInputResult?: unknown;
    executeChunks?: OrchestrationStreamChunk[];
    parseInputError?: Error;
    executeError?: Error;
  },
): OrchestrationSkill {
  const chunks = options?.executeChunks ?? [
    { type: "text", data: { text: "测试输出" } },
    { type: "done", data: { success: true } },
  ];

  return {
    metadata: {
      id,
      name: `Mock Skill ${id}`,
      description: "测试用 Skill",
      version: "1.0.0",
      author: "test",
      category: "test",
      capabilities: [],
    },
    parseInput: jest.fn().mockImplementation(async () => {
      if (options?.parseInputError) {
        throw options.parseInputError;
      }
      return options?.parseInputResult ?? { action: "test" };
    }),
    executeStream: jest.fn().mockImplementation(async function* () {
      if (options?.executeError) {
        throw options.executeError;
      }
      for (const chunk of chunks) {
        yield chunk;
      }
    }),
  } as unknown as OrchestrationSkill;
}

/**
 * 创建 Mock Skill 注册表
 */
function createMockRegistry(
  skills: Record<string, OrchestrationSkill>,
): SkillRegistry {
  const map = new Map(Object.entries(skills));
  return {
    get: (id: string) => map.get(id),
    has: (id: string) => map.has(id),
  };
}

/**
 * 创建测试上下文
 */
function createTestContext(
  overrides?: Partial<PipelineContext>,
): PipelineContext {
  return {
    userId: "test-user",
    traceId: "test-trace-123",
    config: {},
    ...overrides,
  };
}

/**
 * 收集所有输出块
 */
async function collectChunks(
  generator: AsyncGenerator<PipelineChunk>,
): Promise<PipelineChunk[]> {
  const chunks: PipelineChunk[] = [];
  for await (const chunk of generator) {
    chunks.push(chunk);
  }
  return chunks;
}

// ============================================
// 测试套件
// ============================================

describe("SkillExecutionPipeline", () => {
  let pipeline: SkillExecutionPipeline;
  let mockSkill: OrchestrationSkill;
  let registry: SkillRegistry;

  beforeEach(() => {
    mockSkill = createMockSkill("test_skill");
    registry = createMockRegistry({ test_skill: mockSkill });
    pipeline = new SkillExecutionPipeline({ skillRegistry: registry });
  });

  // ============================================
  // 解析阶段测试
  // ============================================

  describe("resolve stage", () => {
    it("should find registered skill", async () => {
      const context = createTestContext();
      const chunks = await collectChunks(
        pipeline.execute("test_skill", "测试输入", context),
      );

      // 应该有 RESOLVE 阶段的事件
      const resolveEvents = chunks.filter(
        (c) => isPipelineEvent(c) && c.stage === PipelineStage.RESOLVE,
      );
      expect(resolveEvents.length).toBeGreaterThanOrEqual(2);

      // 检查 running 和 completed 状态
      expect(
        resolveEvents.some((e) => isPipelineEvent(e) && e.status === "running"),
      ).toBe(true);
      expect(
        resolveEvents.some(
          (e) => isPipelineEvent(e) && e.status === "completed",
        ),
      ).toBe(true);
    });

    it("should throw SkillNotFoundError for unknown skill", async () => {
      const context = createTestContext();
      const chunks = await collectChunks(
        pipeline.execute("unknown_skill", "测试输入", context),
      );

      // 应该有失败事件
      const failedEvent = chunks.find(
        (c) =>
          isPipelineEvent(c) &&
          c.stage === PipelineStage.RESOLVE &&
          c.status === "failed",
      );
      expect(failedEvent).toBeDefined();
      if (isPipelineEvent(failedEvent!)) {
        expect(failedEvent.data?.errorCode).toBe("SKILL_NOT_FOUND");
      }
    });
  });

  // ============================================
  // 验证阶段测试
  // ============================================

  describe("validate stage", () => {
    it("should pass valid input", async () => {
      const context = createTestContext();
      const chunks = await collectChunks(
        pipeline.execute("test_skill", "有效的测试输入", context),
      );

      // 验证阶段应该完成
      const validateCompleted = chunks.find(
        (c) =>
          isPipelineEvent(c) &&
          c.stage === PipelineStage.VALIDATE &&
          c.status === "completed",
      );
      expect(validateCompleted).toBeDefined();
    });

    it("should reject empty input", async () => {
      const context = createTestContext();
      const chunks = await collectChunks(
        pipeline.execute("test_skill", "", context),
      );

      // 应该有验证失败事件
      const failedEvent = chunks.find(
        (c) =>
          isPipelineEvent(c) &&
          c.stage === PipelineStage.VALIDATE &&
          c.status === "failed",
      );
      expect(failedEvent).toBeDefined();
      if (isPipelineEvent(failedEvent!)) {
        expect(failedEvent.data?.errorCode).toBe("VALIDATION_FAILED");
      }
    });

    it("should skip validation when configured", async () => {
      const context = createTestContext({
        config: { skipValidation: true },
      });
      const chunks = await collectChunks(
        pipeline.execute("test_skill", "", context),
      );

      // 验证阶段应该被跳过，不应该有验证事件
      const validateEvents = chunks.filter(
        (c) => isPipelineEvent(c) && c.stage === PipelineStage.VALIDATE,
      );
      expect(validateEvents.length).toBe(0);
    });
  });

  // ============================================
  // 风险检查阶段测试
  // ============================================

  describe("risk check stage", () => {
    it("should allow low risk operations", async () => {
      // search 是低风险操作
      const searchSkill = createMockSkill("search");
      registry = createMockRegistry({ search: searchSkill });
      pipeline = new SkillExecutionPipeline({ skillRegistry: registry });

      const context = createTestContext();
      const chunks = await collectChunks(
        pipeline.execute("search", "搜索测试", context),
      );

      // 风险检查应该完成
      const riskCheckCompleted = chunks.find(
        (c) =>
          isPipelineEvent(c) &&
          c.stage === PipelineStage.RISK_CHECK &&
          c.status === "completed",
      );
      expect(riskCheckCompleted).toBeDefined();
    });

    it("should require confirmation for high risk operations", async () => {
      // delete 是高风险操作
      const deleteSkill = createMockSkill("delete");
      registry = createMockRegistry({ delete: deleteSkill });
      pipeline = new SkillExecutionPipeline({ skillRegistry: registry });

      const context = createTestContext({
        config: { affectedCount: 10 },
      });
      const chunks = await collectChunks(
        pipeline.execute("delete", "删除测试", context),
      );

      // 应该有需要确认的事件
      const needsConfirmation = chunks.find(
        (c) =>
          isPipelineEvent(c) &&
          c.stage === PipelineStage.RISK_CHECK &&
          c.status === "needs_confirmation",
      );
      expect(needsConfirmation).toBeDefined();
      if (isPipelineEvent(needsConfirmation!)) {
        expect(needsConfirmation.data?.requiresConfirmation).toBe(true);
      }
    });

    it("should require confirmation for batch > 50", async () => {
      const context = createTestContext({
        config: { affectedCount: 55 },
      });
      const chunks = await collectChunks(
        pipeline.execute("test_skill", "批量测试", context),
      );

      // 应该有需要确认的事件
      const needsConfirmation = chunks.find(
        (c) =>
          isPipelineEvent(c) &&
          c.stage === PipelineStage.RISK_CHECK &&
          c.status === "needs_confirmation",
      );
      expect(needsConfirmation).toBeDefined();
    });

    it("should skip confirmation when userConfirmed=true", async () => {
      // delete 是高风险操作，但用户已确认
      const deleteSkill = createMockSkill("delete");
      registry = createMockRegistry({ delete: deleteSkill });
      pipeline = new SkillExecutionPipeline({ skillRegistry: registry });

      const context = createTestContext({
        config: { affectedCount: 10, userConfirmed: true },
      });
      const chunks = await collectChunks(
        pipeline.execute("delete", "删除测试", context),
      );

      // 风险检查应该完成（不是 needs_confirmation）
      const riskCheckCompleted = chunks.find(
        (c) =>
          isPipelineEvent(c) &&
          c.stage === PipelineStage.RISK_CHECK &&
          c.status === "completed",
      );
      expect(riskCheckCompleted).toBeDefined();
    });

    it("should skip risk check when configured", async () => {
      const context = createTestContext({
        config: { skipRiskCheck: true, affectedCount: 100 },
      });
      const chunks = await collectChunks(
        pipeline.execute("test_skill", "测试", context),
      );

      // 风险检查阶段应该被跳过
      const riskCheckEvents = chunks.filter(
        (c) => isPipelineEvent(c) && c.stage === PipelineStage.RISK_CHECK,
      );
      expect(riskCheckEvents.length).toBe(0);
    });
  });

  // ============================================
  // 执行阶段测试
  // ============================================

  describe("execute stage", () => {
    it("should execute skill and yield chunks", async () => {
      const context = createTestContext({
        config: { skipRiskCheck: true },
      });
      const chunks = await collectChunks(
        pipeline.execute("test_skill", "测试输入", context),
      );

      // 应该有 Skill 输出块
      const skillChunks = chunks.filter(isSkillChunk);
      expect(skillChunks.length).toBeGreaterThan(0);

      // 应该有 text 块
      const textChunk = skillChunks.find((c) => c.type === "text");
      expect(textChunk).toBeDefined();
    });

    it("should handle cancellation", async () => {
      const cancelledSkill = createMockSkill("test_skill", {
        executeChunks: [
          { type: "text", data: { text: "开始" } },
          // 模拟长时间操作
        ],
      });
      registry = createMockRegistry({ test_skill: cancelledSkill });
      pipeline = new SkillExecutionPipeline({ skillRegistry: registry });

      const cancellationToken = {
        isCancelled: true,
        reason: "用户取消",
        onCancel: jest.fn(),
        throwIfCancelled: jest.fn(),
      };

      const context = createTestContext({
        config: { skipRiskCheck: true },
        cancellationToken,
      });

      const chunks = await collectChunks(
        pipeline.execute("test_skill", "测试", context),
      );

      // 应该有取消错误事件
      const cancelledEvent = chunks.find(
        (c) =>
          isPipelineEvent(c) && c.data?.errorCode === "EXECUTION_CANCELLED",
      );
      expect(cancelledEvent).toBeDefined();
    });

    it("should handle execution errors", async () => {
      const errorSkill = createMockSkill("test_skill", {
        executeError: new Error("执行失败"),
      });
      registry = createMockRegistry({ test_skill: errorSkill });
      pipeline = new SkillExecutionPipeline({ skillRegistry: registry });

      const context = createTestContext({
        config: { skipRiskCheck: true },
      });
      const chunks = await collectChunks(
        pipeline.execute("test_skill", "测试", context),
      );

      // 应该有执行失败事件
      const failedEvent = chunks.find(
        (c) =>
          isPipelineEvent(c) &&
          c.stage === PipelineStage.EXECUTE &&
          c.status === "failed",
      );
      expect(failedEvent).toBeDefined();
    });
  });

  // ============================================
  // 端到端测试
  // ============================================

  describe("end-to-end", () => {
    it("should complete full pipeline successfully", async () => {
      const context = createTestContext({
        config: { skipRiskCheck: true },
      });
      const chunks = await collectChunks(
        pipeline.execute("test_skill", "完整测试", context),
      );

      // 检查所有阶段都完成
      const stages = [
        PipelineStage.RESOLVE,
        PipelineStage.VALIDATE,
        PipelineStage.EXECUTE,
        PipelineStage.FORMAT,
      ];

      for (const stage of stages) {
        const completed = chunks.find(
          (c) =>
            isPipelineEvent(c) && c.stage === stage && c.status === "completed",
        );
        expect(completed).toBeDefined();
      }

      // 应该有 Skill 输出
      const skillChunks = chunks.filter(isSkillChunk);
      expect(skillChunks.length).toBeGreaterThan(0);
    });

    it("should stop at risk check when confirmation needed", async () => {
      const context = createTestContext({
        config: { affectedCount: 60 }, // 超过阈值(50)
      });
      const chunks = await collectChunks(
        pipeline.execute("test_skill", "批量操作", context),
      );

      // RESOLVE 和 VALIDATE 应该完成
      expect(
        chunks.some(
          (c) =>
            isPipelineEvent(c) &&
            c.stage === PipelineStage.RESOLVE &&
            c.status === "completed",
        ),
      ).toBe(true);
      expect(
        chunks.some(
          (c) =>
            isPipelineEvent(c) &&
            c.stage === PipelineStage.VALIDATE &&
            c.status === "completed",
        ),
      ).toBe(true);

      // RISK_CHECK 应该是 needs_confirmation
      expect(
        chunks.some(
          (c) =>
            isPipelineEvent(c) &&
            c.stage === PipelineStage.RISK_CHECK &&
            c.status === "needs_confirmation",
        ),
      ).toBe(true);

      // EXECUTE 不应该执行
      expect(
        chunks.some(
          (c) => isPipelineEvent(c) && c.stage === PipelineStage.EXECUTE,
        ),
      ).toBe(false);
    });

    it("should include traceId in all events", async () => {
      const context = createTestContext({
        config: { skipRiskCheck: true },
      });
      const chunks = await collectChunks(
        pipeline.execute("test_skill", "测试", context),
      );

      const pipelineEvents = chunks.filter(isPipelineEvent);
      for (const event of pipelineEvents) {
        expect(event.traceId).toBe("test-trace-123");
      }
    });
  });

  // ============================================
  // 类型守卫测试
  // ============================================

  describe("type guards", () => {
    it("isPipelineEvent should identify pipeline events", () => {
      const pipelineEvent = {
        type: "pipeline" as const,
        stage: PipelineStage.RESOLVE,
        status: "completed" as const,
        timestamp: Date.now(),
      };
      const skillChunk = {
        type: "text" as const,
        data: { text: "test" },
      };

      expect(isPipelineEvent(pipelineEvent)).toBe(true);
      expect(isPipelineEvent(skillChunk)).toBe(false);
    });

    it("isSkillChunk should identify skill chunks", () => {
      const pipelineEvent = {
        type: "pipeline" as const,
        stage: PipelineStage.RESOLVE,
        status: "completed" as const,
        timestamp: Date.now(),
      };
      const skillChunk = {
        type: "text" as const,
        data: { text: "test" },
      };

      expect(isSkillChunk(pipelineEvent)).toBe(false);
      expect(isSkillChunk(skillChunk)).toBe(true);
    });
  });
});
