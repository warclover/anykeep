/**
 * KnowledgeAgent 单元测试
 *
 * @version 1.0.0
 * @since 2025-12-22
 */

import { KnowledgeAgent } from "../core/knowledge-agent";
import { AgentMemory } from "../core/agent-memory";
import type { AgentContext, AgentStreamChunk } from "../core/types";

// Mock AI SDK
jest.mock("ai", () => ({
  generateText: jest.fn(),
  streamText: jest.fn(),
  stepCountIs: jest.fn().mockReturnValue(() => false),
}));

// Mock Tools - must be before importing KnowledgeAgent
jest.mock("../tools", () => ({
  registerDefaultTools: jest.fn(),
  getToolsAsVercelTools: jest.fn().mockReturnValue({
    search_bookmarks: { execute: jest.fn() },
    list_recent: { execute: jest.fn() },
  }),
}));

// Mock mergeToolSets
jest.mock("../core/ai-sdk-types", () => ({
  mergeToolSets: jest.fn((...sets) => Object.assign({}, ...sets)),
}));

// Mock AI Provider Router
jest.mock("@/lib/ai-providers", () => ({
  aiProviderRouter: {
    selectProvider: jest.fn(),
    recordSuccess: jest.fn(),
    recordError: jest.fn(),
  },
}));

// Mock Skills
jest.mock("@/lib/ai-skills", () => ({
  getSkillsAsTools: jest.fn().mockReturnValue({
    search: { execute: jest.fn() },
    classify: { execute: jest.fn() },
  }),
}));

// Mock Logger
jest.mock("@/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock error messages - return original message in tests for easier debugging
jest.mock("../core/error-messages", () => ({
  getUserFriendlyError: jest.fn((error: unknown) =>
    error instanceof Error ? error.message : String(error),
  ),
}));

// Import mocked modules
import { generateText, streamText } from "ai";
import { aiProviderRouter } from "@/lib/ai-providers";

describe("KnowledgeAgent", () => {
  let agent: KnowledgeAgent;
  let memory: AgentMemory;
  let mockContext: AgentContext;

  // Mock model for provider selection
  const mockModel = { id: "gpt-4" };
  const mockProvider = { name: "openai", isConfigured: true };
  const mockSelection = { provider: mockProvider, model: mockModel };

  beforeEach(() => {
    jest.clearAllMocks();

    memory = new AgentMemory();
    agent = new KnowledgeAgent({}, memory);

    mockContext = {
      userId: "user-123",
      bookmarkIds: [1, 2, 3],
    };

    // Default mock for provider selection
    (aiProviderRouter.selectProvider as jest.Mock).mockReturnValue(
      mockSelection,
    );
  });

  describe("constructor", () => {
    it("should create agent with default config", () => {
      const defaultAgent = new KnowledgeAgent();

      const config = defaultAgent.getConfig();
      expect(config.type).toBe("knowledge");
      expect(config.name).toBe("知识助手");
      expect(config.enabledSkills).toContain("search");
    });

    it("should merge custom config with defaults", () => {
      const customAgent = new KnowledgeAgent({
        name: "Custom Agent",
        enabledSkills: ["custom-skill"],
      });

      const config = customAgent.getConfig();
      expect(config.name).toBe("Custom Agent");
      expect(config.enabledSkills).toContain("custom-skill");
      expect(config.type).toBe("knowledge"); // Default preserved
    });
  });

  describe("execute", () => {
    it("should execute successfully and return result", async () => {
      const mockResult = {
        text: "这是AI的回复",
        steps: [],
        usage: {
          inputTokens: 100,
          outputTokens: 50,
          totalTokens: 150,
        },
        finishReason: "stop",
      };

      (generateText as jest.Mock).mockResolvedValue(mockResult);

      const result = await agent.execute("搜索书签", mockContext);

      expect(result.success).toBe(true);
      expect(result.content).toBe("这是AI的回复");
      expect(result.tokensUsed?.total).toBe(150);
      expect(result.finishReason).toBe("stop");
    });

    it("should create conversation if not exists", async () => {
      const mockResult = {
        text: "Response",
        steps: [],
        finishReason: "stop",
      };

      (generateText as jest.Mock).mockResolvedValue(mockResult);

      await agent.execute("Hello", mockContext);

      // Should have created a conversation
      const conversations = memory.getUserConversations("user-123");
      expect(conversations.length).toBe(1);
      expect(conversations[0].agentType).toBe("knowledge");
    });

    it("should use existing conversation if provided", async () => {
      // Create conversation first
      const conversation = memory.createConversation("user-123", "knowledge");
      const contextWithConv = {
        ...mockContext,
        conversationId: conversation.id,
      };

      const mockResult = {
        text: "Response",
        steps: [],
        finishReason: "stop",
      };

      (generateText as jest.Mock).mockResolvedValue(mockResult);

      await agent.execute("Hello", contextWithConv);

      // Should not create new conversation
      const conversations = memory.getUserConversations("user-123");
      expect(conversations.length).toBe(1);
      expect(conversations[0].id).toBe(conversation.id);
    });

    it("should record tool calls from steps", async () => {
      const mockResult = {
        text: "搜索完成",
        steps: [
          {
            toolCalls: [
              {
                toolCallId: "tc-1",
                toolName: "search",
                args: { query: "test" },
              },
            ],
            toolResults: [
              {
                toolCallId: "tc-1",
                result: { items: [] },
              },
            ],
          },
        ],
        finishReason: "tool-calls",
      };

      (generateText as jest.Mock).mockResolvedValue(mockResult);

      const result = await agent.execute("搜索test", mockContext);

      expect(result.success).toBe(true);
      expect(result.toolCalls).toHaveLength(1);
      expect(result.toolCalls[0].toolName).toBe("search");
      expect(result.toolCalls[0].status).toBe("completed");
    });

    it("should handle provider unavailable", async () => {
      (aiProviderRouter.selectProvider as jest.Mock).mockReturnValue(null);

      const result = await agent.execute("Hello", mockContext);

      expect(result.success).toBe(false);
      expect(result.error).toBe("No suitable AI provider available");
      expect(result.finishReason).toBe("error");
    });

    it("should handle execution errors", async () => {
      (generateText as jest.Mock).mockRejectedValue(
        new Error("API rate limited"),
      );

      const result = await agent.execute("Hello", mockContext);

      expect(result.success).toBe(false);
      expect(result.error).toBe("API rate limited");
      expect(result.finishReason).toBe("error");
    });

    it("should pass correct parameters to generateText", async () => {
      const mockResult = {
        text: "Response",
        steps: [],
        finishReason: "stop",
      };

      (generateText as jest.Mock).mockResolvedValue(mockResult);

      await agent.execute("Hello", mockContext, {
        temperature: 0.5,
        maxTokens: 1000,
      });

      expect(generateText).toHaveBeenCalledWith(
        expect.objectContaining({
          model: mockModel,
          temperature: 0.5,
          maxOutputTokens: 1000,
        }),
      );
    });
  });

  describe("executeStream", () => {
    it("should stream text chunks", async () => {
      // Mock fullStream with text-delta chunks (actual implementation uses fullStream)
      const mockFullStream = {
        [Symbol.asyncIterator]: async function* () {
          yield { type: "text-delta", text: "Hello" };
          yield { type: "text-delta", text: " " };
          yield { type: "text-delta", text: "World" };
        },
      };

      const mockStreamResult = {
        fullStream: mockFullStream,
        steps: Promise.resolve([]),
        usage: Promise.resolve({
          inputTokens: 10,
          outputTokens: 5,
          totalTokens: 15,
        }),
        finishReason: Promise.resolve("stop"),
      };

      (streamText as jest.Mock).mockReturnValue(mockStreamResult);

      const chunks: AgentStreamChunk[] = [];
      for await (const chunk of agent.executeStream("Hello", mockContext)) {
        chunks.push(chunk);
      }

      // Should have text chunks
      const textOnlyChunks = chunks.filter((c) => c.type === "text");
      expect(textOnlyChunks.length).toBe(3);
      expect(textOnlyChunks[0]).toEqual({ type: "text", text: "Hello" });

      // Should have done chunk
      const doneChunk = chunks.find((c) => c.type === "done");
      expect(doneChunk).toBeDefined();
      if (doneChunk?.type === "done" && doneChunk.result) {
        expect(doneChunk.result.success).toBe(true);
        expect(doneChunk.result.content).toBe("Hello World");
      }
    });

    it("should handle provider unavailable in stream", async () => {
      (aiProviderRouter.selectProvider as jest.Mock).mockReturnValue(null);

      const chunks: AgentStreamChunk[] = [];
      for await (const chunk of agent.executeStream("Hello", mockContext)) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(1);
      expect(chunks[0].type).toBe("error");
      if (chunks[0].type === "error") {
        expect(chunks[0].error).toBe("No suitable AI provider available");
      }
    });

    it("should handle stream errors", async () => {
      const mockFullStream = {
        [Symbol.asyncIterator]: async function* () {
          throw new Error("Stream interrupted");
        },
      };

      const mockStreamResult = {
        fullStream: mockFullStream,
        steps: Promise.resolve([]),
        usage: Promise.resolve(null),
        finishReason: Promise.resolve("error"),
      };

      (streamText as jest.Mock).mockReturnValue(mockStreamResult);

      const chunks: AgentStreamChunk[] = [];
      for await (const chunk of agent.executeStream("Hello", mockContext)) {
        chunks.push(chunk);
      }

      // Should have error chunk
      const errorChunk = chunks.find((c) => c.type === "error");
      expect(errorChunk).toBeDefined();
    });

    it("should emit tool-call chunks", async () => {
      const mockFullStream = {
        [Symbol.asyncIterator]: async function* () {
          yield { type: "text-delta", text: "Searching..." };
        },
      };

      const mockStreamResult = {
        fullStream: mockFullStream,
        steps: Promise.resolve([
          {
            toolCalls: [
              {
                toolCallId: "tc-stream-1",
                toolName: "search",
                args: { query: "test" },
              },
            ],
            toolResults: [
              {
                toolCallId: "tc-stream-1",
                result: { found: true },
              },
            ],
          },
        ]),
        usage: Promise.resolve({ inputTokens: 10, outputTokens: 5 }),
        finishReason: Promise.resolve("tool-calls"),
      };

      (streamText as jest.Mock).mockReturnValue(mockStreamResult);

      const chunks: AgentStreamChunk[] = [];
      for await (const chunk of agent.executeStream("Search", mockContext)) {
        chunks.push(chunk);
      }

      // Should have tool-call chunk
      const toolCallChunk = chunks.find((c) => c.type === "tool-call");
      expect(toolCallChunk).toBeDefined();
      if (toolCallChunk?.type === "tool-call" && toolCallChunk.toolCall) {
        expect(toolCallChunk.toolCall.toolName).toBe("search");
      }
    });
  });

  describe("getConversation", () => {
    it("should return conversation by id", () => {
      const conversation = memory.createConversation("user-123", "knowledge");

      const retrieved = agent.getConversation(conversation.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(conversation.id);
    });

    it("should return null for non-existent conversation", () => {
      const result = agent.getConversation("non-existent");

      expect(result).toBeNull();
    });
  });

  describe("clearConversation", () => {
    it("should clear conversation from memory", () => {
      const conversation = memory.createConversation("user-123", "knowledge");

      agent.clearConversation(conversation.id);

      expect(agent.getConversation(conversation.id)).toBeNull();
    });
  });

  describe("getUserConversations", () => {
    it("should return all conversations for user", () => {
      memory.createConversation("user-123", "knowledge");
      memory.createConversation("user-123", "knowledge");
      memory.createConversation("other-user", "knowledge");

      const conversations = agent.getUserConversations("user-123");

      expect(conversations).toHaveLength(2);
    });
  });

  describe("finish reason mapping", () => {
    it("should map stop reason correctly", async () => {
      const mockResult = {
        text: "Done",
        steps: [],
        finishReason: "stop",
      };

      (generateText as jest.Mock).mockResolvedValue(mockResult);

      const result = await agent.execute("Hello", mockContext);
      expect(result.finishReason).toBe("stop");
    });

    it("should map length reason correctly", async () => {
      const mockResult = {
        text: "Truncated...",
        steps: [],
        finishReason: "length",
      };

      (generateText as jest.Mock).mockResolvedValue(mockResult);

      const result = await agent.execute("Hello", mockContext);
      expect(result.finishReason).toBe("length");
    });

    it("should map tool-calls reason correctly", async () => {
      const mockResult = {
        text: "Using tools",
        steps: [],
        finishReason: "tool-calls",
      };

      (generateText as jest.Mock).mockResolvedValue(mockResult);

      const result = await agent.execute("Hello", mockContext);
      expect(result.finishReason).toBe("tool-calls");
    });

    it("should map unknown reason to stop", async () => {
      const mockResult = {
        text: "Done",
        steps: [],
        finishReason: "unknown-reason",
      };

      (generateText as jest.Mock).mockResolvedValue(mockResult);

      const result = await agent.execute("Hello", mockContext);
      expect(result.finishReason).toBe("stop");
    });
  });
});
