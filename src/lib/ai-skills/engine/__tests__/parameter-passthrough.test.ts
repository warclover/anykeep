/**
 * Parameter Passthrough Tests
 *
 * 验证 ExecutionCoordinator.buildAgentContext() 正确透传所有参数
 *
 * @module ai-skills/engine/__tests__/parameter-passthrough.test
 * @version 1.0.0
 * @since 2026-01-12
 */

import { ExecutionCoordinator } from "../execution-coordinator";
import type { EngineContext } from "../types";
import type { OrchestrationEngine } from "../orchestration-engine";
import type { UnifiedOutputAdapter } from "../../output/adapter";

// ============================================
// Mock Setup
// ============================================

const mockOrchestrationEngine = {
  hasSkill: jest.fn().mockReturnValue(false),
  execute: jest.fn(),
} as unknown as OrchestrationEngine;

const mockOutputAdapter = {
  adaptAtomicChunk: jest.fn((chunk) => chunk),
  adaptOrchestrationChunk: jest.fn((chunk) => chunk),
  createRoutingChunk: jest.fn(),
  createErrorChunk: jest.fn(),
  createFallbackChunk: jest.fn(),
} as unknown as UnifiedOutputAdapter;

// Helper to access private method
function getBuildAgentContext(coordinator: ExecutionCoordinator) {
  return (context: EngineContext) => {
    return (coordinator as any).buildAgentContext(context);
  };
}

// ============================================
// Test Cases
// ============================================

describe("Parameter Passthrough", () => {
  let coordinator: ExecutionCoordinator;
  let buildAgentContext: ReturnType<typeof getBuildAgentContext>;

  beforeEach(() => {
    coordinator = new ExecutionCoordinator(
      mockOrchestrationEngine,
      mockOutputAdapter,
    );
    buildAgentContext = getBuildAgentContext(coordinator);
  });

  describe("置信度分层参数透传", () => {
    it("should pass through confidence tiering parameters", () => {
      const context: EngineContext = {
        userId: "test-user",
        responseStrategy: "silent",
        confidenceLevel: "high",
        enhancedConfidence: 0.92,
      };

      const agentContext = buildAgentContext(context);

      expect(agentContext.responseStrategy).toBe("silent");
      expect(agentContext.confidenceLevel).toBe("high");
      expect(agentContext.enhancedConfidence).toBe(0.92);
    });

    it("should handle medium confidence level", () => {
      const context: EngineContext = {
        userId: "test-user",
        responseStrategy: "explain",
        confidenceLevel: "medium",
        enhancedConfidence: 0.72,
      };

      const agentContext = buildAgentContext(context);

      expect(agentContext.responseStrategy).toBe("explain");
      expect(agentContext.confidenceLevel).toBe("medium");
      expect(agentContext.enhancedConfidence).toBe(0.72);
    });

    it("should handle low confidence level", () => {
      const context: EngineContext = {
        userId: "test-user",
        responseStrategy: "clarify",
        confidenceLevel: "low",
        enhancedConfidence: 0.45,
      };

      const agentContext = buildAgentContext(context);

      expect(agentContext.responseStrategy).toBe("clarify");
      expect(agentContext.confidenceLevel).toBe("low");
      expect(agentContext.enhancedConfidence).toBe(0.45);
    });
  });

  describe("文件夹上下文参数透传", () => {
    it("should pass through folder context", () => {
      const context: EngineContext = {
        userId: "test-user",
        folderId: 123,
        totalBookmarks: 500,
        totalFolders: 20,
        folders: [{ id: 123, name: "技术文章" }],
      };

      const agentContext = buildAgentContext(context);

      expect(agentContext.folderId).toBe(123);
      expect(agentContext.totalBookmarks).toBe(500);
      expect(agentContext.totalFolders).toBe(20);
      expect(agentContext.folders).toHaveLength(1);
      expect(agentContext.folders?.[0].name).toBe("技术文章");
    });

    it("should pass through tags", () => {
      const context: EngineContext = {
        userId: "test-user",
        tags: ["React", "TypeScript", "Next.js"],
      };

      const agentContext = buildAgentContext(context);

      expect(agentContext.tags).toEqual(["React", "TypeScript", "Next.js"]);
    });

    it("should handle empty folder context", () => {
      const context: EngineContext = {
        userId: "test-user",
      };

      const agentContext = buildAgentContext(context);

      expect(agentContext.folderId).toBeUndefined();
      expect(agentContext.totalBookmarks).toBeUndefined();
      expect(agentContext.totalFolders).toBeUndefined();
      expect(agentContext.folders).toBeUndefined();
      expect(agentContext.tags).toBeUndefined();
    });
  });

  describe("置信度 Prompt 注入", () => {
    it("should inject confidence prompt into systemPrompt for high confidence", () => {
      const context: EngineContext = {
        userId: "test-user",
        responseStrategy: "silent",
        confidenceLevel: "high",
        enhancedConfidence: 0.92,
      };

      const agentContext = buildAgentContext(context);

      expect(agentContext.systemPrompt).toContain("【AI 执行策略】");
      expect(agentContext.systemPrompt).toContain("高（≥80%）");
      expect(agentContext.systemPrompt).toContain("静默执行");
      expect(agentContext.systemPrompt).toContain("0.92");
    });

    it("should inject confidence prompt for clarify strategy", () => {
      const context: EngineContext = {
        userId: "test-user",
        responseStrategy: "clarify",
        confidenceLevel: "low",
        enhancedConfidence: 0.45,
      };

      const agentContext = buildAgentContext(context);

      expect(agentContext.systemPrompt).toContain("【AI 执行策略】");
      expect(agentContext.systemPrompt).toContain("低（<60%）");
      expect(agentContext.systemPrompt).toContain("轻量级澄清");
      expect(agentContext.systemPrompt).toContain("0.45");
    });

    it("should not inject confidence prompt when fields are missing", () => {
      const context: EngineContext = {
        userId: "test-user",
        // No confidence fields
      };

      const agentContext = buildAgentContext(context);

      // systemPrompt should not contain confidence info
      if (agentContext.systemPrompt) {
        expect(agentContext.systemPrompt).not.toContain("【AI 执行策略】");
      }
    });
  });

  describe("数据上下文 Prompt 注入", () => {
    it("should inject data context prompt with folder name", () => {
      const context: EngineContext = {
        userId: "test-user",
        folderId: 123,
        totalBookmarks: 500,
        folders: [{ id: 123, name: "技术文章" }],
      };

      const agentContext = buildAgentContext(context);

      expect(agentContext.systemPrompt).toContain("【用户数据上下文】");
      expect(agentContext.systemPrompt).toContain("技术文章");
      expect(agentContext.systemPrompt).toContain("500");
    });

    it("should show folder ID when folder name not found", () => {
      const context: EngineContext = {
        userId: "test-user",
        folderId: 999,
        folders: [{ id: 123, name: "技术文章" }],
      };

      const agentContext = buildAgentContext(context);

      expect(agentContext.systemPrompt).toContain("ID:999");
    });

    it("should inject all data context fields", () => {
      const context: EngineContext = {
        userId: "test-user",
        folderId: 123,
        totalBookmarks: 500,
        totalFolders: 20,
        folders: [{ id: 123, name: "技术文章" }],
      };

      const agentContext = buildAgentContext(context);

      expect(agentContext.systemPrompt).toContain("当前文件夹: 技术文章");
      expect(agentContext.systemPrompt).toContain("书签总数: 500");
      expect(agentContext.systemPrompt).toContain("文件夹数: 20");
    });

    it("should not inject data context when no fields provided", () => {
      const context: EngineContext = {
        userId: "test-user",
      };

      const agentContext = buildAgentContext(context);

      // systemPrompt should not contain data context
      if (agentContext.systemPrompt) {
        expect(agentContext.systemPrompt).not.toContain("【用户数据上下文】");
      }
    });
  });

  describe("现有字段保持不变", () => {
    it("should preserve existing field mappings", () => {
      const context: EngineContext = {
        userId: "test-user-123",
        conversationId: "conv-456",
        bookmarkIds: [1, 2, 3],
        messageHistory: [{ role: "user", content: "hello" }],
        traceId: "trace-789",
        intentType: "query",
        intentSubType: "keyword",
        intentConfidence: 0.85,
        slots: {
          intentType: "query:keyword",
          slots: {
            query: {
              name: "query",
              value: "test query",
              type: "string",
              confidence: 0.9,
              required: true,
              source: "extracted",
            },
          },
          completeness: 1.0,
        },
      };

      const agentContext = buildAgentContext(context);

      expect(agentContext.userId).toBe("test-user-123");
      expect(agentContext.conversationId).toBe("conv-456");
      expect(agentContext.bookmarkIds).toEqual([1, 2, 3]);
      expect(agentContext.messageHistory).toHaveLength(1);
      expect(agentContext.traceId).toBe("trace-789");
      expect(agentContext.intentType).toBe("query");
      expect(agentContext.intentSubType).toBe("keyword");
      expect(agentContext.intentConfidence).toBe(0.85);
      expect(agentContext.slots).toEqual({
        intentType: "query:keyword",
        slots: {
          query: {
            name: "query",
            value: "test query",
            type: "string",
            confidence: 0.9,
            required: true,
            source: "extracted",
          },
        },
        completeness: 1.0,
      });
    });
  });

  describe("组合场景", () => {
    it("should combine confidence and data context prompts", () => {
      const context: EngineContext = {
        userId: "test-user",
        // Confidence
        responseStrategy: "explain",
        confidenceLevel: "medium",
        enhancedConfidence: 0.72,
        // Data context
        folderId: 123,
        totalBookmarks: 500,
        folders: [{ id: 123, name: "技术文章" }],
      };

      const agentContext = buildAgentContext(context);

      expect(agentContext.systemPrompt).toContain("【AI 执行策略】");
      expect(agentContext.systemPrompt).toContain("【用户数据上下文】");
    });

    it("should combine with attachment context", () => {
      const context: EngineContext = {
        userId: "test-user",
        attachmentContext: "用户附加了 3 个书签",
        responseStrategy: "silent",
        confidenceLevel: "high",
        enhancedConfidence: 0.92,
      };

      const agentContext = buildAgentContext(context);

      expect(agentContext.systemPrompt).toContain("用户附加了 3 个书签");
      expect(agentContext.systemPrompt).toContain("【AI 执行策略】");
    });
  });
});
