/**
 * 大纲生成器测试 (Story 2.1)
 * @module knowledge-studio/blueprint/__tests__
 */

/* eslint-disable @typescript-eslint/no-require-imports */

import {
  generateOutline,
  generateOutlineStream,
  countOutlineNodes,
  flattenOutlineNodes,
  getOutlineDepth,
  createEmptyOutline,
  isOutlineEmpty,
  OutlineParseError,
  OutlineValidationError,
} from "../outline-generator";
import type { MaterialInput, BlueprintOutline, OutlineNode } from "../types";

// ============================================================
// Mocks
// ============================================================

// Mock AI Provider Router
jest.mock("@/lib/ai-providers", () => ({
  aiProviderRouter: {
    selectProvider: jest.fn().mockReturnValue({
      provider: {
        name: "deepseek",
        defaultModel: "deepseek-chat",
      },
      model: {},
      reason: "test",
    }),
    recordSuccess: jest.fn(),
    recordFailure: jest.fn(),
  },
}));

// Mock Vercel AI SDK
jest.mock("ai", () => ({
  generateText: jest.fn(),
}));

// Mock logger
jest.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

// ============================================================
// Test Data
// ============================================================

const mockMaterials: MaterialInput[] = [
  {
    bookmarkId: "bm-1",
    title: "Introduction to AI",
    content: "AI is transforming the world...",
    url: "https://example.com/ai-intro",
    platform: "blog",
  },
  {
    bookmarkId: "bm-2",
    title: "Machine Learning Basics",
    content: "Machine learning is a subset of AI...",
    url: "https://example.com/ml-basics",
    platform: "tutorial",
  },
];

const mockOutlineResponse = {
  title: "AI 技术入门指南",
  summary: "这是一份关于人工智能技术的入门指南，涵盖基础概念和实践应用。",
  nodes: [
    {
      id: "section-1",
      title: "什么是人工智能",
      level: 1,
      description: "介绍人工智能的定义和发展历史",
      estimatedWords: 500,
      children: [
        {
          id: "section-1-1",
          title: "AI 的定义",
          level: 2,
          description: "人工智能的多种定义和理解",
          estimatedWords: 200,
        },
      ],
    },
    {
      id: "section-2",
      title: "机器学习基础",
      level: 1,
      description: "机器学习的核心概念和方法",
      estimatedWords: 800,
    },
  ],
  totalEstimatedWords: 1500,
  generatedBy: "deepseek",
};

// ============================================================
// Tests
// ============================================================

describe("OutlineGenerator", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("generateOutline", () => {
    it("should generate outline successfully", async () => {
      // Arrange
      const { generateText } = require("ai");
      generateText.mockResolvedValue({
        text: JSON.stringify(mockOutlineResponse),
        usage: { totalTokens: 500 },
      });

      // Act
      const result = await generateOutline(mockMaterials, {
        blueprintId: "test-blueprint",
        blueprintName: "Test Blueprint",
        targetLength: "medium",
      });

      // Assert
      expect(result.outline).toBeDefined();
      expect(result.outline.title).toBe("AI 技术入门指南");
      expect(result.outline.nodes).toHaveLength(2);
      expect(result.durationMs).toBeGreaterThan(0);
      expect(result.modelUsed).toBe("deepseek-chat");
    });

    it("should parse JSON wrapped in code block", async () => {
      // Arrange
      const { generateText } = require("ai");
      const wrappedJson = `\`\`\`json\n${JSON.stringify(mockOutlineResponse)}\n\`\`\``;
      generateText.mockResolvedValue({
        text: wrappedJson,
        usage: { totalTokens: 500 },
      });

      // Act
      const result = await generateOutline(mockMaterials, {
        blueprintId: "test-blueprint",
        blueprintName: "Test Blueprint",
        targetLength: "medium",
      });

      // Assert
      expect(result.outline.title).toBe("AI 技术入门指南");
    });

    it("should handle empty materials", async () => {
      // Arrange
      const { generateText } = require("ai");
      generateText.mockResolvedValue({
        text: JSON.stringify({
          title: "Empty Outline",
          summary: "No materials provided",
          nodes: [{ id: "s1", title: "Introduction", level: 1 }],
          totalEstimatedWords: 100,
          generatedBy: "deepseek",
        }),
        usage: { totalTokens: 100 },
      });

      // Act
      const result = await generateOutline([], {
        blueprintId: "test-blueprint",
        blueprintName: "Test Blueprint",
        targetLength: "short",
      });

      // Assert
      expect(result.outline).toBeDefined();
      expect(result.outline.nodes.length).toBeGreaterThan(0);
    });

    it("should throw OutlineParseError for invalid JSON", async () => {
      // Arrange
      const { generateText } = require("ai");
      generateText.mockResolvedValue({
        text: "This is not JSON",
        usage: { totalTokens: 50 },
      });

      // Act & Assert
      await expect(
        generateOutline(mockMaterials, {
          blueprintId: "test-blueprint",
          blueprintName: "Test Blueprint",
          targetLength: "medium",
        }),
      ).rejects.toThrow(OutlineParseError);
    });

    it("should throw OutlineValidationError for empty nodes", async () => {
      // Arrange
      const { generateText } = require("ai");
      generateText.mockResolvedValue({
        text: JSON.stringify({
          title: "Test",
          summary: "Test",
          nodes: [],
          totalEstimatedWords: 0,
          generatedBy: "deepseek",
        }),
        usage: { totalTokens: 50 },
      });

      // Act & Assert
      await expect(
        generateOutline(mockMaterials, {
          blueprintId: "test-blueprint",
          blueprintName: "Test Blueprint",
          targetLength: "medium",
        }),
      ).rejects.toThrow(OutlineValidationError);
    });

    it("should use briefing context when provided", async () => {
      // Arrange
      const { generateText } = require("ai");
      generateText.mockResolvedValue({
        text: JSON.stringify(mockOutlineResponse),
        usage: { totalTokens: 500 },
      });

      const briefingContext = {
        answers: {
          audience: "beginner",
          tone: "casual",
        },
        answeredAt: new Date(),
      };

      // Act
      const result = await generateOutline(
        mockMaterials,
        {
          blueprintId: "test-blueprint",
          blueprintName: "Test Blueprint",
          targetLength: "medium",
        },
        briefingContext,
      );

      // Assert
      expect(result.outline).toBeDefined();
      expect(generateText).toHaveBeenCalled();
    });
  });

  describe("generateOutlineStream", () => {
    it("should yield progress chunks", async () => {
      // Arrange
      const { generateText } = require("ai");
      generateText.mockResolvedValue({
        text: JSON.stringify(mockOutlineResponse),
        usage: { totalTokens: 500 },
      });

      // Act
      const generator = generateOutlineStream(mockMaterials, {
        blueprintId: "test-blueprint",
        blueprintName: "Test Blueprint",
        targetLength: "medium",
      });

      const chunks: { type: string }[] = [];

      // Collect all chunks
      let result = await generator.next();
      while (!result.done) {
        chunks.push(result.value);
        result = await generator.next();
      }
      const outline = result.value;

      // Assert
      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks.some((c) => c.type === "progress")).toBe(true);
      expect(chunks.some((c) => c.type === "text")).toBe(true);
      expect(outline).toBeDefined();
      expect(outline?.title).toBe("AI 技术入门指南");
    });

    it("should yield error chunk on failure", async () => {
      // Arrange
      const { generateText } = require("ai");
      generateText.mockRejectedValue(new Error("API Error"));

      // Act
      const generator = generateOutlineStream(mockMaterials, {
        blueprintId: "test-blueprint",
        blueprintName: "Test Blueprint",
        targetLength: "medium",
      });

      const chunks: { type: string }[] = [];

      // Collect chunks until error
      try {
        let result = await generator.next();
        while (!result.done) {
          chunks.push(result.value);
          result = await generator.next();
        }
      } catch {
        // Expected error
      }

      // Assert
      expect(chunks.some((c) => c.type === "error")).toBe(true);
    });
  });
});

describe("Utility Functions", () => {
  const testNodes: OutlineNode[] = [
    {
      id: "s1",
      title: "Section 1",
      level: 1,
      children: [
        {
          id: "s1-1",
          title: "Section 1.1",
          level: 2,
          children: [
            {
              id: "s1-1-1",
              title: "Section 1.1.1",
              level: 3,
            },
          ],
        },
        {
          id: "s1-2",
          title: "Section 1.2",
          level: 2,
        },
      ],
    },
    {
      id: "s2",
      title: "Section 2",
      level: 1,
    },
  ];

  describe("countOutlineNodes", () => {
    it("should count all nodes including nested", () => {
      expect(countOutlineNodes(testNodes)).toBe(5);
    });

    it("should return 0 for empty array", () => {
      expect(countOutlineNodes([])).toBe(0);
    });
  });

  describe("flattenOutlineNodes", () => {
    it("should flatten nested nodes", () => {
      const flat = flattenOutlineNodes(testNodes);
      expect(flat).toHaveLength(5);
      expect(flat.map((n) => n.id)).toEqual([
        "s1",
        "s1-1",
        "s1-1-1",
        "s1-2",
        "s2",
      ]);
    });

    it("should return empty array for empty input", () => {
      expect(flattenOutlineNodes([])).toEqual([]);
    });
  });

  describe("getOutlineDepth", () => {
    it("should return correct depth", () => {
      expect(getOutlineDepth(testNodes)).toBe(3);
    });

    it("should return 1 for flat nodes", () => {
      const flatNodes: OutlineNode[] = [
        { id: "s1", title: "S1", level: 1 },
        { id: "s2", title: "S2", level: 1 },
      ];
      expect(getOutlineDepth(flatNodes)).toBe(1);
    });

    it("should return 1 for empty array", () => {
      expect(getOutlineDepth([])).toBe(1);
    });
  });

  describe("createEmptyOutline", () => {
    it("should create empty outline with default title", () => {
      const outline = createEmptyOutline();
      expect(outline.title).toBe("Untitled");
      expect(outline.nodes).toEqual([]);
    });

    it("should create empty outline with custom title", () => {
      const outline = createEmptyOutline("My Outline");
      expect(outline.title).toBe("My Outline");
    });
  });

  describe("isOutlineEmpty", () => {
    it("should return true for empty outline", () => {
      expect(isOutlineEmpty(createEmptyOutline())).toBe(true);
    });

    it("should return false for outline with nodes", () => {
      const outline: BlueprintOutline = {
        title: "Test",
        summary: "Test",
        nodes: [{ id: "s1", title: "S1", level: 1 }],
        totalEstimatedWords: 100,
        generatedBy: "test",
      };
      expect(isOutlineEmpty(outline)).toBe(false);
    });
  });
});
