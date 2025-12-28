/**
 * ReAct 循环执行器测试
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

import {
  ReactLoopExecutor,
  createReactLoopExecutor,
  type AtomicExecutor,
} from "../react-loop-executor";
import type { AgentStreamChunk } from "../../core/types";
import type { UnifiedStreamChunk } from "../../../ai-skills/output/types";

// Mock logger
jest.mock("@/lib/logger", () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// ============================================================================
// 测试辅助函数
// ============================================================================

/**
 * 创建模拟的 AtomicExecutor
 */
function createMockAtomicExecutor(chunks: AgentStreamChunk[]): AtomicExecutor {
  return async function* () {
    for (const chunk of chunks) {
      yield chunk;
    }
  };
}

/**
 * 收集所有流式输出块
 */
async function collectChunks(
  generator: AsyncGenerator<UnifiedStreamChunk>,
): Promise<UnifiedStreamChunk[]> {
  const chunks: UnifiedStreamChunk[] = [];
  for await (const chunk of generator) {
    chunks.push(chunk);
  }
  return chunks;
}

// ============================================================================
// 基础功能测试
// ============================================================================

describe("ReactLoopExecutor", () => {
  describe("构造函数", () => {
    it("应使用默认配置创建执行器", () => {
      const executor = new ReactLoopExecutor();
      const config = executor.getConfig();

      expect(config.maxRounds).toBe(5);
      expect(config.showThinking).toBe(true);
      expect(config.enableObservation).toBe(true);
      expect(config.goalAchievedThreshold).toBe(0.8);
    });

    it("应允许覆盖默认配置", () => {
      const executor = new ReactLoopExecutor({
        maxRounds: 3,
        showThinking: false,
      });
      const config = executor.getConfig();

      expect(config.maxRounds).toBe(3);
      expect(config.showThinking).toBe(false);
      expect(config.enableObservation).toBe(true);
    });
  });

  describe("工厂函数", () => {
    it("createReactLoopExecutor 应创建执行器实例", () => {
      const executor = createReactLoopExecutor({ maxRounds: 2 });
      expect(executor).toBeInstanceOf(ReactLoopExecutor);
      expect(executor.getConfig().maxRounds).toBe(2);
    });
  });
});

// ============================================================================
// 执行流程测试
// ============================================================================

describe("executeWithReact", () => {
  let executor: ReactLoopExecutor;

  beforeEach(() => {
    executor = new ReactLoopExecutor({
      maxRounds: 3,
      showThinking: true,
      enableObservation: true,
    });
  });

  describe("直接回答场景（无工具调用）", () => {
    it("应在无工具调用时单轮完成", async () => {
      const mockExecutor = createMockAtomicExecutor([
        { type: "text", text: "这是直接回答的内容。" },
        {
          type: "done",
          result: {
            success: true,
            content: "这是直接回答的内容。",
            toolCalls: [],
            durationMs: 100,
          },
        },
      ]);

      const chunks = await collectChunks(
        executor.executeWithReact(
          "你好",
          { userId: "test-user" },
          mockExecutor,
        ),
      );

      // 应包含思考块
      const thinkingChunks = chunks.filter((c) => c.type === "thinking");
      expect(thinkingChunks.length).toBeGreaterThan(0);

      // 应包含文本块
      const textChunks = chunks.filter((c) => c.type === "text");
      expect(textChunks.length).toBeGreaterThan(0);

      // 应包含完成块
      const doneChunks = chunks.filter((c) => c.type === "done");
      expect(doneChunks.length).toBe(1);

      // 最后一个思考块应标记完成
      const lastThinking = thinkingChunks[thinkingChunks.length - 1];
      expect(lastThinking.type).toBe("thinking");
      if (lastThinking.type === "thinking") {
        expect(lastThinking.data.phase).toBe("react_complete");
        expect(lastThinking.data.isFinal).toBe(true);
      }
    });
  });

  describe("工具调用场景", () => {
    it("应处理单次工具调用", async () => {
      const mockExecutor = createMockAtomicExecutor([
        {
          type: "tool-call",
          toolCall: {
            id: "call-1",
            toolName: "search",
            args: { query: "test" },
            status: "completed" as const,
            result: { total: 5, results: [] },
          },
        },
        { type: "text", text: "综上所述，根据搜索结果，找到了 5 条记录。" },
        {
          type: "done",
          result: {
            success: true,
            content: "综上所述，根据搜索结果，找到了 5 条记录。",
            toolCalls: [
              {
                id: "call-1",
                toolName: "search",
                args: { query: "test" },
                status: "completed" as const,
                result: { total: 5, results: [] },
              },
            ],
            durationMs: 200,
          },
        },
      ]);

      const chunks = await collectChunks(
        executor.executeWithReact(
          "搜索 test",
          { userId: "test-user" },
          mockExecutor,
        ),
      );

      // 应包含工具调用块（至少 1 个）
      const toolCallChunks = chunks.filter((c) => c.type === "tool-call");
      expect(toolCallChunks.length).toBeGreaterThanOrEqual(1);

      // 检查第一个工具调用内容
      const toolCallChunk = toolCallChunks[0];
      if (toolCallChunk.type === "tool-call") {
        expect(toolCallChunk.data.toolName).toBe("search");
        expect(toolCallChunk.data.status).toBe("completed");
      }
    });

    it("应在多轮后达成目标时停止", async () => {
      // 模拟需要多轮的场景
      let callCount = 0;
      const mockExecutor: AtomicExecutor = async function* () {
        callCount++;
        if (callCount === 1) {
          yield {
            type: "tool-call" as const,
            toolCall: {
              id: "call-1",
              toolName: "search",
              args: { query: "test" },
              status: "completed" as const,
              result: { total: 10 },
            },
          };
          yield { type: "text" as const, text: "正在搜索..." };
          yield {
            type: "done" as const,
            result: {
              success: true,
              content: "正在搜索...",
              toolCalls: [],
              durationMs: 100,
            },
          };
        } else {
          yield { type: "text" as const, text: "综上所述，这是最终答案。" };
          yield {
            type: "done" as const,
            result: {
              success: true,
              content: "综上所述，这是最终答案。",
              toolCalls: [],
              durationMs: 100,
            },
          };
        }
      };

      const chunks = await collectChunks(
        executor.executeWithReact(
          "分析数据",
          { userId: "test-user" },
          mockExecutor,
        ),
      );

      // 应完成执行
      const doneChunks = chunks.filter((c) => c.type === "done");
      expect(doneChunks.length).toBeGreaterThan(0);
    });
  });

  describe("最大轮次限制", () => {
    it("应在达到最大轮次时停止", async () => {
      // 每轮都有工具调用，永不停止
      const mockExecutor: AtomicExecutor = async function* () {
        yield {
          type: "tool-call" as const,
          toolCall: {
            id: "call-x",
            toolName: "search",
            args: {},
            status: "completed" as const,
            result: { needsMore: true },
          },
        };
        yield { type: "text" as const, text: "继续处理..." };
        yield {
          type: "done" as const,
          result: {
            success: true,
            content: "继续处理...",
            toolCalls: [],
            durationMs: 50,
          },
        };
      };

      const limitedExecutor = new ReactLoopExecutor({
        maxRounds: 2,
        showThinking: true,
      });

      const chunks = await collectChunks(
        limitedExecutor.executeWithReact(
          "无限任务",
          { userId: "test-user" },
          mockExecutor,
        ),
      );

      // 最后一个思考块应提示达到最大轮次
      const thinkingChunks = chunks.filter((c) => c.type === "thinking");
      const lastThinking = thinkingChunks[thinkingChunks.length - 1];
      if (lastThinking?.type === "thinking") {
        expect(lastThinking.data.content).toContain("最大轮次");
      }
    });
  });

  describe("错误处理", () => {
    it("应处理原子执行器抛出的错误", async () => {
      const mockExecutor: AtomicExecutor = async function* () {
        throw new Error("模拟执行错误");
      };

      const chunks = await collectChunks(
        executor.executeWithReact(
          "会失败的任务",
          { userId: "test-user" },
          mockExecutor,
        ),
      );

      // 应包含错误块
      const errorChunks = chunks.filter((c) => c.type === "error");
      expect(errorChunks.length).toBe(1);

      const errorChunk = errorChunks[0];
      if (errorChunk.type === "error") {
        expect(errorChunk.data.message).toContain("模拟执行错误");
        expect(errorChunk.data.retryable).toBe(true);
      }
    });
  });
});

// ============================================================================
// 回调测试
// ============================================================================

describe("ReactLoopCallbacks", () => {
  it("应在各阶段调用回调", async () => {
    const callbacks = {
      onLoopStart: jest.fn(),
      onRoundStart: jest.fn(),
      onRoundEnd: jest.fn(),
      onLoopEnd: jest.fn(),
    };

    const executor = new ReactLoopExecutor(
      { maxRounds: 2, showThinking: false },
      callbacks,
    );

    const mockExecutor = createMockAtomicExecutor([
      { type: "text", text: "回答" },
      {
        type: "done",
        result: {
          success: true,
          content: "回答",
          toolCalls: [],
          durationMs: 50,
        },
      },
    ]);

    await collectChunks(
      executor.executeWithReact(
        "测试回调",
        { userId: "test-user" },
        mockExecutor,
      ),
    );

    // 验证回调被调用
    expect(callbacks.onLoopStart).toHaveBeenCalledTimes(1);
    expect(callbacks.onRoundStart).toHaveBeenCalled();
    expect(callbacks.onRoundEnd).toHaveBeenCalled();
    expect(callbacks.onLoopEnd).toHaveBeenCalledTimes(1);

    // 验证 onLoopEnd 参数
    const loopEndCall = callbacks.onLoopEnd.mock.calls[0][0];
    expect(loopEndCall.success).toBe(true);
    expect(loopEndCall.finishReason).toBe("no_tool_calls");
  });
});

// ============================================================================
// 配置更新测试
// ============================================================================

describe("updateConfig", () => {
  it("应允许动态更新配置", () => {
    const executor = new ReactLoopExecutor({ maxRounds: 5 });
    expect(executor.getConfig().maxRounds).toBe(5);

    executor.updateConfig({ maxRounds: 10 });
    expect(executor.getConfig().maxRounds).toBe(10);

    // 其他配置应保持不变
    expect(executor.getConfig().showThinking).toBe(true);
  });
});

// ============================================================================
// 思考块禁用测试
// ============================================================================

describe("showThinking 配置", () => {
  it("当 showThinking 为 false 时不应产生思考块", async () => {
    const executor = new ReactLoopExecutor({
      maxRounds: 2,
      showThinking: false,
    });

    const mockExecutor = createMockAtomicExecutor([
      { type: "text", text: "简洁回答" },
      {
        type: "done",
        result: {
          success: true,
          content: "简洁回答",
          toolCalls: [],
          durationMs: 30,
        },
      },
    ]);

    const chunks = await collectChunks(
      executor.executeWithReact(
        "简洁测试",
        { userId: "test-user" },
        mockExecutor,
      ),
    );

    // 不应包含思考块
    const thinkingChunks = chunks.filter((c) => c.type === "thinking");
    expect(thinkingChunks.length).toBe(0);

    // 应包含文本和完成块
    expect(chunks.filter((c) => c.type === "text").length).toBeGreaterThan(0);
    expect(chunks.filter((c) => c.type === "done").length).toBe(1);
  });
});
