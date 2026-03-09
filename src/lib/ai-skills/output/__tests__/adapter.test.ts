/**
 * UnifiedOutputAdapter 单元测试
 *
 * @description 测试统一输出适配器的核心功能
 */

import {
  UnifiedOutputAdapter,
  createUnifiedOutputAdapter,
  unifiedOutputAdapter,
} from "../adapter";
import type {
  AgentStreamChunk,
  AgentToolCall,
} from "../../../ai-agent/core/types";
import type { PendingConfirmation } from "../../../ai-agent/tools/types";
import type { UnifiedStreamChunk, OrchestrationStreamChunk } from "../types";

describe("UnifiedOutputAdapter", () => {
  let adapter: UnifiedOutputAdapter;

  beforeEach(() => {
    adapter = new UnifiedOutputAdapter();
  });

  describe("constructor", () => {
    it("使用默认配置初始化", () => {
      const instance = new UnifiedOutputAdapter();
      // Verify through behavior - showToolCallDetails should be true by default
      const chunk: AgentStreamChunk = {
        type: "tool-call",
        toolCall: {
          id: "test-id",
          toolName: "test_tool",
          args: { foo: "bar" },
          status: "completed",
        },
      };
      const result = instance.adaptAtomicChunk(chunk);
      expect(result.type).toBe("tool-call");
    });

    it("接受自定义配置", () => {
      const instance = new UnifiedOutputAdapter({
        includeDebugInfo: true,
        showToolCallDetails: false,
      });
      const chunk: AgentStreamChunk = {
        type: "tool-call",
        toolCall: {
          id: "test-id",
          toolName: "test_tool",
          args: {},
          status: "pending",
        },
      };
      // When showToolCallDetails is false, should return empty text
      const result = instance.adaptAtomicChunk(chunk);
      expect(result.type).toBe("text");
      expect((result.data as any).text).toBe("");
    });
  });

  describe("adaptAtomicChunk", () => {
    describe("text chunks", () => {
      it("转换文本块", () => {
        const chunk: AgentStreamChunk = {
          type: "text",
          text: "Hello, world!",
        };

        const result = adapter.adaptAtomicChunk(chunk);

        expect(result.type).toBe("text");
        expect((result.data as any).text).toBe("Hello, world!");
        expect((result.data as any).isPartial).toBe(true);
      });

      it("处理空文本", () => {
        const chunk: AgentStreamChunk = {
          type: "text",
          text: "",
        };

        const result = adapter.adaptAtomicChunk(chunk);

        expect(result.type).toBe("text");
        expect((result.data as any).text).toBe("");
      });

      it("处理 undefined 文本", () => {
        const chunk: AgentStreamChunk = {
          type: "text",
          text: undefined,
        };

        const result = adapter.adaptAtomicChunk(chunk);

        expect(result.type).toBe("text");
        expect((result.data as any).text).toBe("");
      });
    });

    describe("tool-call chunks", () => {
      it("转换工具调用块", () => {
        const toolCall: AgentToolCall = {
          id: "call-123",
          toolName: "search_bookmarks",
          args: { query: "react" },
          status: "completed",
          result: { bookmarks: [] },
        };
        const chunk: AgentStreamChunk = {
          type: "tool-call",
          toolCall,
        };

        const result = adapter.adaptAtomicChunk(chunk);

        expect(result.type).toBe("tool-call");
        expect((result.data as any).toolName).toBe("search_bookmarks");
        expect((result.data as any).args).toEqual({ query: "react" });
        expect((result.data as any).status).toBe("completed");
        expect((result.data as any).result).toEqual({ bookmarks: [] });
      });

      it("处理失败的工具调用", () => {
        const toolCall: AgentToolCall = {
          id: "call-456",
          toolName: "delete_bookmark",
          args: { id: 123 },
          status: "failed",
          error: "Permission denied",
        };
        const chunk: AgentStreamChunk = {
          type: "tool-call",
          toolCall,
        };

        const result = adapter.adaptAtomicChunk(chunk);

        expect(result.type).toBe("tool-call");
        expect((result.data as any).status).toBe("failed");
        expect((result.data as any).error).toBe("Permission denied");
      });

      it("处理 undefined 工具调用", () => {
        const chunk: AgentStreamChunk = {
          type: "tool-call",
          toolCall: undefined,
        };

        const result = adapter.adaptAtomicChunk(chunk);

        expect(result.type).toBe("tool-call");
        expect((result.data as any).toolName).toBe("unknown");
        expect((result.data as any).args).toEqual({});
        expect((result.data as any).status).toBe("pending");
      });
    });

    describe("tool-result chunks", () => {
      it("转换工具结果块为空文本", () => {
        const chunk: AgentStreamChunk = {
          type: "tool-result",
          toolResult: {
            type: "tool-result",
            toolCallId: "call-123",
          } as any,
        };

        const result = adapter.adaptAtomicChunk(chunk);

        // tool-result returns empty text to avoid duplication
        expect(result.type).toBe("text");
        expect((result.data as any).text).toBe("");
      });
    });

    describe("confirmation chunks", () => {
      it("转换确认请求块", () => {
        const confirmation = {
          confirmationId: "confirm-789",
          toolName: "batch_delete",
          description: "删除 5 个书签",
          impactSummary: "此操作将永久删除选中的书签",
          affectedItems: [
            { id: 1, title: "书签1" },
            { id: 2, title: "书签2" },
            { id: 3, title: "书签3" },
            { id: 4, title: "书签4" },
            { id: 5, title: "书签5" },
          ],
          params: {},
        } as PendingConfirmation;
        const chunk: AgentStreamChunk = {
          type: "confirmation",
          confirmation,
        };

        const result = adapter.adaptAtomicChunk(chunk);

        expect(result.type).toBe("confirmation");
        expect((result.data as any).id).toBe("confirm-789");
        expect((result.data as any).title).toBe("batch_delete");
        expect((result.data as any).message).toBe("删除 5 个书签");
        expect((result.data as any).options).toHaveLength(2);
        expect((result.data as any).options[0].id).toBe("confirm");
        expect((result.data as any).options[1].id).toBe("cancel");
      });

      it("使用 impactSummary 作为备选 message", () => {
        const confirmation: PendingConfirmation = {
          confirmationId: "confirm-abc",
          toolName: "move_bookmarks",
          description: "",
          impactSummary: "将 3 个书签移动到新文件夹",
          affectedItems: [],
          params: {},
          expiresAt: new Date(),
          riskLevel: "low",
        };
        const chunk: AgentStreamChunk = {
          type: "confirmation",
          confirmation,
        };

        const result = adapter.adaptAtomicChunk(chunk);

        expect((result.data as any).message).toBe("将 3 个书签移动到新文件夹");
      });
    });

    describe("error chunks", () => {
      it("转换错误块", () => {
        const chunk: AgentStreamChunk = {
          type: "error",
          error: "Network connection failed",
        };

        const result = adapter.adaptAtomicChunk(chunk);

        expect(result.type).toBe("error");
        expect((result.data as any).message).toBe("Network connection failed");
        expect((result.data as any).retryable).toBe(true);
      });

      it("处理 undefined 错误", () => {
        const chunk: AgentStreamChunk = {
          type: "error",
          error: undefined,
        };

        const result = adapter.adaptAtomicChunk(chunk);

        expect((result.data as any).message).toBe("Unknown error");
      });
    });

    describe("done chunks", () => {
      it("转换成功完成块", () => {
        const chunk: AgentStreamChunk = {
          type: "done",
          result: {
            success: true,
            content: "任务完成",
            toolCalls: [],
            durationMs: 1500,
            tokensUsed: {
              prompt: 100,
              completion: 50,
              total: 150,
            },
          },
        };

        const result = adapter.adaptAtomicChunk(chunk);

        expect(result.type).toBe("done");
        expect((result.data as any).success).toBe(true);
        expect((result.data as any).summary).toBe("任务完成");
        expect((result.data as any).tokensUsed).toBe(150);
        expect((result.data as any).durationMs).toBe(1500);
        expect((result.data as any).mode).toBe("atomic");
      });

      it("转换失败完成块", () => {
        const chunk: AgentStreamChunk = {
          type: "done",
          result: {
            success: false,
            content: "",
            toolCalls: [],
            durationMs: 500,
            error: "Failed to process",
          },
        };

        const result = adapter.adaptAtomicChunk(chunk);

        expect((result.data as any).success).toBe(false);
      });

      it("处理 undefined result", () => {
        const chunk: AgentStreamChunk = {
          type: "done",
          result: undefined,
        };

        const result = adapter.adaptAtomicChunk(chunk);

        expect((result.data as any).success).toBe(false);
        expect((result.data as any).mode).toBe("atomic");
      });
    });

    describe("unknown chunk types", () => {
      it("处理未知类型返回空文本", () => {
        const chunk = {
          type: "unknown-type",
        } as unknown as AgentStreamChunk;

        const result = adapter.adaptAtomicChunk(chunk);

        expect(result.type).toBe("text");
        expect((result.data as any).text).toBe("");
      });
    });
  });

  describe("adaptOrchestrationChunk", () => {
    it("直接返回编排模式输出", () => {
      const chunk: OrchestrationStreamChunk = {
        type: "progress",
        data: {
          step: "分析数据",
          percent: 50,
          message: "正在处理...",
          timestamp: Date.now(),
        },
      };

      const result = adapter.adaptOrchestrationChunk(chunk);

      expect(result).toEqual(chunk);
    });

    it("处理交付物块", () => {
      const chunk: OrchestrationStreamChunk = {
        type: "deliverable",
        data: {
          id: "del-123",
          type: "report",
          title: "周报",
          format: "markdown",
          content: "# 周报\n\n内容...",
          downloadable: true,
          shareable: true,
        },
      };

      const result = adapter.adaptOrchestrationChunk(chunk);

      expect(result.type).toBe("deliverable");
      expect((result.data as any).title).toBe("周报");
    });
  });

  describe("createRoutingChunk", () => {
    it("创建原子模式路由块", () => {
      const chunk = adapter.createRoutingChunk(
        "atomic",
        "简单查询",
        null,
        "search",
        "simple",
      );

      expect(chunk.type).toBe("routing");
      expect((chunk.data as any).mode).toBe("atomic");
      expect((chunk.data as any).reason).toBe("简单查询");
      expect((chunk.data as any).skill).toBeNull();
      expect((chunk.data as any).intentType).toBe("search");
      expect((chunk.data as any).complexityLevel).toBe("simple");
    });

    it("创建编排模式路由块", () => {
      const chunk = adapter.createRoutingChunk(
        "orchestration",
        "复杂任务需要多步骤处理",
        "batch_organize",
        "cleanup",
        "complex",
      );

      expect(chunk.type).toBe("routing");
      expect((chunk.data as any).mode).toBe("orchestration");
      expect((chunk.data as any).skill).toBe("batch_organize");
    });
  });

  describe("createFallbackChunk", () => {
    it("创建回退通知块", () => {
      const chunk = adapter.createFallbackChunk("Skill 执行超时");

      expect(chunk.type).toBe("fallback");
      expect((chunk.data as any).reason).toBe("Skill 执行超时");
      expect((chunk.data as any).originalMode).toBe("orchestration");
      expect((chunk.data as any).fallbackMode).toBe("atomic");
    });
  });

  describe("createErrorChunk", () => {
    it("创建基本错误块", () => {
      const chunk = adapter.createErrorChunk("发生错误");

      expect(chunk.type).toBe("error");
      expect((chunk.data as any).message).toBe("发生错误");
      expect((chunk.data as any).retryable).toBe(false);
    });

    it("创建可重试错误块", () => {
      const chunk = adapter.createErrorChunk(
        "网络超时",
        "NETWORK_TIMEOUT",
        true,
      );

      expect((chunk.data as { message: string }).message).toBe("网络超时");
      expect((chunk.data as { code: string }).code).toBe("NETWORK_TIMEOUT");
      expect((chunk.data as { retryable: boolean }).retryable).toBe(true);
    });
  });

  describe("filterEmptyChunks", () => {
    it("过滤空文本块", () => {
      const chunks: UnifiedStreamChunk[] = [
        { type: "text", data: { text: "Hello" } },
        { type: "text", data: { text: "" } },
        { type: "text", data: { text: "World" } },
        { type: "text", data: { text: "" } },
      ];

      const result = adapter.filterEmptyChunks(chunks);

      expect(result).toHaveLength(2);
      expect((result[0].data as { text: string }).text).toBe("Hello");
      expect((result[1].data as { text: string }).text).toBe("World");
    });

    it("保留非文本块", () => {
      const chunks: UnifiedStreamChunk[] = [
        { type: "text", data: { text: "" } },
        {
          type: "progress",
          data: { step: "test", percent: 50, timestamp: Date.now() },
        },
        { type: "text", data: { text: "" } },
      ];

      const result = adapter.filterEmptyChunks(chunks);

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe("progress");
    });

    it("处理空数组", () => {
      const result = adapter.filterEmptyChunks([]);
      expect(result).toEqual([]);
    });
  });

  describe("mergeTextChunks", () => {
    it("合并连续文本块", () => {
      const chunks: UnifiedStreamChunk[] = [
        { type: "text", data: { text: "Hello, ", isPartial: true } },
        { type: "text", data: { text: "world", isPartial: true } },
        { type: "text", data: { text: "!", isPartial: true } },
      ];

      const result = adapter.mergeTextChunks(chunks);

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe("text");
      expect((result[0].data as { text: string }).text).toBe("Hello, world!");
      expect((result[0].data as { isPartial?: boolean }).isPartial).toBe(false);
    });

    it("在非文本块处断开合并", () => {
      const chunks: UnifiedStreamChunk[] = [
        { type: "text", data: { text: "Part 1" } },
        {
          type: "progress",
          data: { step: "loading", percent: 50, timestamp: Date.now() },
        },
        { type: "text", data: { text: "Part 2" } },
      ];

      const result = adapter.mergeTextChunks(chunks);

      expect(result).toHaveLength(3);
      expect(result[0].type).toBe("text");
      expect((result[0].data as { text: string }).text).toBe("Part 1");
      expect(result[1].type).toBe("progress");
      expect(result[2].type).toBe("text");
      expect((result[2].data as { text: string }).text).toBe("Part 2");
    });

    it("处理以非文本块开头的数组", () => {
      const chunks: UnifiedStreamChunk[] = [
        {
          type: "routing",
          data: { mode: "atomic", reason: "test", skill: null },
        },
        { type: "text", data: { text: "Response" } },
      ];

      const result = adapter.mergeTextChunks(chunks);

      expect(result).toHaveLength(2);
      expect(result[0].type).toBe("routing");
      expect((result[1].data as { text: string }).text).toBe("Response");
    });

    it("处理空数组", () => {
      const result = adapter.mergeTextChunks([]);
      expect(result).toEqual([]);
    });
  });

  describe("updateConfig", () => {
    it("更新配置", () => {
      const instance = new UnifiedOutputAdapter();

      // Initially showToolCallDetails is true
      const chunk: AgentStreamChunk = {
        type: "tool-call",
        toolCall: {
          id: "id",
          toolName: "test",
          args: {},
          status: "pending",
        },
      };
      let result = instance.adaptAtomicChunk(chunk);
      expect(result.type).toBe("tool-call");

      // Update config
      instance.updateConfig({ showToolCallDetails: false });

      // Now should return empty text
      result = instance.adaptAtomicChunk(chunk);
      expect(result.type).toBe("text");
      expect((result.data as { text: string }).text).toBe("");
    });

    it("部分更新配置", () => {
      const instance = new UnifiedOutputAdapter({
        includeDebugInfo: true,
        showToolCallDetails: true,
      });

      instance.updateConfig({ showToolCallDetails: false });

      // Only showToolCallDetails should change
      const chunk: AgentStreamChunk = {
        type: "tool-call",
        toolCall: {
          id: "id",
          toolName: "test",
          args: {},
          status: "pending",
        },
      };
      const result = instance.adaptAtomicChunk(chunk);
      expect(result.type).toBe("text");
    });
  });
});

describe("createUnifiedOutputAdapter", () => {
  it("创建新的适配器实例", () => {
    const adapter = createUnifiedOutputAdapter();
    expect(adapter).toBeInstanceOf(UnifiedOutputAdapter);
  });

  it("接受配置参数", () => {
    const adapter = createUnifiedOutputAdapter({
      showToolCallDetails: false,
    });
    const chunk: AgentStreamChunk = {
      type: "tool-call",
      toolCall: {
        id: "id",
        toolName: "test",
        args: {},
        status: "pending",
      },
    };
    const result = adapter.adaptAtomicChunk(chunk);
    expect(result.type).toBe("text");
  });
});

describe("unifiedOutputAdapter (singleton)", () => {
  it("导出默认实例", () => {
    expect(unifiedOutputAdapter).toBeInstanceOf(UnifiedOutputAdapter);
  });
});
