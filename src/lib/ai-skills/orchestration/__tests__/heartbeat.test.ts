/**
 * OrchestrationSkill 心跳功能单元测试
 *
 * Phase 3.1: 进度心跳机制
 *
 * @version 1.0.0
 * @since 2026-01-10
 */

import type { HeartbeatChunk, OrchestrationStreamChunk } from "../../output/types";
import type {
  OrchestrationContext,
  OrchestrationSkillMetadata,
} from "../types";
import { OrchestrationSkill } from "../orchestration-skill";
import { z } from "zod";

// Mock logger
jest.mock("@/lib/logger", () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock SkillEventEmitter
jest.mock("../../events/skill-event-emitter", () => ({
  SkillEventEmitter: jest.fn().mockImplementation(() => ({
    emitExecutionStarted: jest.fn(),
    emitStepStarted: jest.fn(),
    emitStepCompleted: jest.fn(),
    emitExecutionCompleted: jest.fn(),
    emitCancelled: jest.fn(),
    emitDeliverableCreated: jest.fn(),
  })),
}));

/**
 * 测试用的 Skill 实现
 */
class TestHeartbeatSkill extends OrchestrationSkill<
  { message: string },
  { result: string }
> {
  // 实现抽象成员
  readonly inputSchema = z.object({ message: z.string() });
  readonly outputSchema = z.object({ result: z.string() });

  readonly metadata: OrchestrationSkillMetadata = {
    id: "test_heartbeat",
    name: "心跳测试 Skill",
    description: "用于测试心跳功能的 Skill",
    version: "1.0.0",
    category: "utility",
    author: "test",
    capabilities: ["test"],
    steps: [
      { id: "step1", name: "步骤1", weight: 1 },
      { id: "step2", name: "步骤2", weight: 1 },
    ],
  };

  async parseInput(
    message: string,
    _context: OrchestrationContext,
  ): Promise<{ message: string }> {
    return { message };
  }

  async *executeStream(
    _context: OrchestrationContext,
  ): AsyncGenerator<OrchestrationStreamChunk> {
    this.initProgress(this.metadata.steps!);
    yield* this.reportProgress("步骤1", 0, "开始执行");
    yield* this.emitText("处理中...");
    yield* this.reportProgress("步骤2", 50, "继续执行");
    yield* this.emitDone(true, "执行完成");
  }

  // 暴露受保护的方法供测试使用
  public testStartHeartbeat(
    callback: (chunk: HeartbeatChunk) => void,
    intervalMs?: number,
  ): void {
    this.startHeartbeat(callback, intervalMs);
  }

  public testStopHeartbeat(): void {
    this.stopHeartbeat();
  }

  public testIsHeartbeatRunning(): boolean {
    return this.isHeartbeatRunning();
  }

  public testInitProgress(): void {
    this.initProgress(this.metadata.steps!);
  }

  public testReportProgress(step: string, percent: number): void {
    if (this.progressState) {
      this.progressState.currentStep = step;
      this.progressState.percent = percent;
    }
  }

  public async *testWithHeartbeat<T>(
    generator: AsyncGenerator<T>,
    intervalMs?: number,
  ): AsyncGenerator<T | HeartbeatChunk> {
    yield* this.withHeartbeat(generator, intervalMs);
  }
}

describe("OrchestrationSkill 心跳功能", () => {
  let skill: TestHeartbeatSkill;

  beforeEach(() => {
    skill = new TestHeartbeatSkill();
    jest.useFakeTimers();
  });

  afterEach(() => {
    // 确保清理心跳定时器
    skill.testStopHeartbeat();
    jest.useRealTimers();
  });

  describe("startHeartbeat", () => {
    it("应启动心跳并定期调用回调", () => {
      const callback = jest.fn();
      skill.testInitProgress();
      skill.testReportProgress("测试步骤", 30);

      skill.testStartHeartbeat(callback, 500);

      // 初始状态：心跳已启动
      expect(skill.testIsHeartbeatRunning()).toBe(true);

      // 回调尚未调用
      expect(callback).not.toHaveBeenCalled();

      // 前进 500ms
      jest.advanceTimersByTime(500);

      // 回调被调用一次
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "heartbeat",
          data: expect.objectContaining({
            currentStep: "测试步骤",
            percent: 30,
            timestamp: expect.any(Number),
            elapsedMs: expect.any(Number),
          }),
        }),
      );

      // 再前进 500ms
      jest.advanceTimersByTime(500);
      expect(callback).toHaveBeenCalledTimes(2);
    });

    it("应使用默认间隔 500ms", () => {
      const callback = jest.fn();
      skill.testInitProgress();

      skill.testStartHeartbeat(callback);

      // 400ms 后未调用
      jest.advanceTimersByTime(400);
      expect(callback).not.toHaveBeenCalled();

      // 再 100ms 后调用
      jest.advanceTimersByTime(100);
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it("重复调用应停止之前的心跳", () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();
      skill.testInitProgress();

      skill.testStartHeartbeat(callback1, 500);
      jest.advanceTimersByTime(250);

      // 启动新心跳
      skill.testStartHeartbeat(callback2, 500);

      // 前进 500ms
      jest.advanceTimersByTime(500);

      // 只有 callback2 被调用
      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).toHaveBeenCalledTimes(1);
    });

    it("应支持异步回调", async () => {
      jest.useRealTimers();
      const results: HeartbeatChunk[] = [];
      const asyncCallback = jest.fn().mockImplementation(async (chunk) => {
        results.push(chunk);
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      skill.testInitProgress();
      skill.testStartHeartbeat(asyncCallback, 50);

      // 等待一些心跳
      await new Promise((resolve) => setTimeout(resolve, 130));

      skill.testStopHeartbeat();

      // 至少收到 2 次心跳
      expect(results.length).toBeGreaterThanOrEqual(2);
      expect(results[0].type).toBe("heartbeat");
    });
  });

  describe("stopHeartbeat", () => {
    it("应停止心跳", () => {
      const callback = jest.fn();
      skill.testInitProgress();

      skill.testStartHeartbeat(callback, 100);
      expect(skill.testIsHeartbeatRunning()).toBe(true);

      skill.testStopHeartbeat();
      expect(skill.testIsHeartbeatRunning()).toBe(false);

      // 前进时间，回调不应被调用
      jest.advanceTimersByTime(500);
      expect(callback).not.toHaveBeenCalled();
    });

    it("多次调用应安全", () => {
      skill.testStopHeartbeat();
      skill.testStopHeartbeat();
      expect(skill.testIsHeartbeatRunning()).toBe(false);
    });
  });

  describe("isHeartbeatRunning", () => {
    it("初始状态应为 false", () => {
      expect(skill.testIsHeartbeatRunning()).toBe(false);
    });

    it("启动后应为 true", () => {
      skill.testInitProgress();
      skill.testStartHeartbeat(jest.fn());
      expect(skill.testIsHeartbeatRunning()).toBe(true);
    });

    it("停止后应为 false", () => {
      skill.testInitProgress();
      skill.testStartHeartbeat(jest.fn());
      skill.testStopHeartbeat();
      expect(skill.testIsHeartbeatRunning()).toBe(false);
    });
  });

  describe("withHeartbeat 生成器包装器", () => {
    async function* testGenerator(): AsyncGenerator<{ type: string }> {
      yield { type: "item1" };
      await new Promise((resolve) => setTimeout(resolve, 100));
      yield { type: "item2" };
      await new Promise((resolve) => setTimeout(resolve, 100));
      yield { type: "item3" };
    }

    it("应在生成器迭代时插入心跳", async () => {
      jest.useRealTimers();
      skill.testInitProgress();
      skill.testReportProgress("测试", 50);

      const chunks: Array<{ type: string }> = [];

      for await (const chunk of skill.testWithHeartbeat(testGenerator(), 50)) {
        chunks.push(chunk);
      }

      // 应包含原始项和心跳
      const originalItems = chunks.filter((c) => c.type.startsWith("item"));
      const heartbeats = chunks.filter((c) => c.type === "heartbeat");

      expect(originalItems.length).toBe(3);
      expect(heartbeats.length).toBeGreaterThanOrEqual(2);
    });

    it("心跳应包含正确的进度信息", async () => {
      jest.useRealTimers();
      skill.testInitProgress();
      skill.testReportProgress("当前步骤", 75);

      const heartbeats: HeartbeatChunk[] = [];

      for await (const chunk of skill.testWithHeartbeat(testGenerator(), 50)) {
        if (chunk.type === "heartbeat") {
          heartbeats.push(chunk as HeartbeatChunk);
        }
      }

      expect(heartbeats.length).toBeGreaterThan(0);
      expect(heartbeats[0].data.currentStep).toBe("当前步骤");
      expect(heartbeats[0].data.percent).toBe(75);
    });
  });

  describe("emitDone 时自动停止心跳", () => {
    it("完成时应停止心跳", async () => {
      const callback = jest.fn();
      const context: OrchestrationContext = {
        userId: "test-user",
        conversationId: "test-conv",
        params: { message: "test" },
      };

      skill.testInitProgress();
      skill.testStartHeartbeat(callback);
      expect(skill.testIsHeartbeatRunning()).toBe(true);

      // 执行 Skill 流
      const chunks: OrchestrationStreamChunk[] = [];
      for await (const chunk of skill.executeStream(context)) {
        chunks.push(chunk);
      }

      // 心跳应已停止
      expect(skill.testIsHeartbeatRunning()).toBe(false);

      // 应有 done 块
      expect(chunks.some((c) => c.type === "done")).toBe(true);
    });
  });

  describe("emitError 时自动停止心跳", () => {
    it("错误时应停止心跳", async () => {
      // 创建一个会触发错误的 Skill
      const errorSkill = new TestHeartbeatSkill();
      errorSkill.testInitProgress();
      errorSkill.testStartHeartbeat(jest.fn());
      expect(errorSkill.testIsHeartbeatRunning()).toBe(true);

      // 直接调用 emitError 生成器方法（通过测试暴露）
      const errorGenerator = (errorSkill as unknown as {
        emitError: (
          message: string,
          code?: string,
        ) => Generator<OrchestrationStreamChunk>;
      }).emitError("测试错误", "TEST_ERROR");

      // 消费生成器
      Array.from(errorGenerator);

      // 心跳应已停止（通过 emitError）
      expect(errorSkill.testIsHeartbeatRunning()).toBe(false);
    });
  });

  describe("HeartbeatChunk 数据结构", () => {
    it("应包含所有必需字段", () => {
      const callback = jest.fn();
      skill.testInitProgress();
      skill.testReportProgress("测试步骤", 42);

      skill.testStartHeartbeat(callback, 100);
      jest.advanceTimersByTime(100);

      const chunk = callback.mock.calls[0][0] as HeartbeatChunk;

      expect(chunk).toEqual({
        type: "heartbeat",
        data: {
          currentStep: "测试步骤",
          percent: 42,
          timestamp: expect.any(Number),
          elapsedMs: expect.any(Number),
          // Phase 3.2: ETA 字段（可选）
          etaMs: expect.any(Number),
          etaFormatted: expect.any(String),
        },
      });

      // elapsedMs 应该接近 100ms（允许一些误差）
      expect(chunk.data.elapsedMs).toBeGreaterThanOrEqual(100);
      expect(chunk.data.elapsedMs).toBeLessThan(200);
    });

    it("无进度状态时应使用默认值", () => {
      const callback = jest.fn();

      // 不初始化进度
      skill.testStartHeartbeat(callback, 100);
      jest.advanceTimersByTime(100);

      const chunk = callback.mock.calls[0][0] as HeartbeatChunk;

      expect(chunk.data.currentStep).toBe("处理中");
      expect(chunk.data.percent).toBe(0);
    });
  });
});
