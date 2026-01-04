/**
 * 内容生成器测试 (Story 2.4)
 * @module knowledge-studio/blueprint/__tests__
 */

/* eslint-disable @typescript-eslint/no-require-imports */

import {
  generateContent,
  generateContentStream,
  validateContentStructure,
  extractHeadingsFromContent,
} from "../content-generator";
import type {
  MaterialInput,
  BlueprintOutline,
  BriefingContext,
} from "../types";
import type { OrchestrationStreamChunk } from "../../../ai-skills/output/types";

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
  streamText: jest.fn(),
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

const mockOutline: BlueprintOutline = {
  title: "AI 技术入门指南",
  summary: "这是一份关于人工智能技术的入门指南",
  nodes: [
    {
      id: "section-1",
      title: "什么是人工智能",
      level: 1,
      estimatedWords: 500,
      children: [
        {
          id: "section-1-1",
          title: "AI 的定义",
          level: 2,
          estimatedWords: 200,
        },
        {
          id: "section-1-2",
          title: "AI 的历史",
          level: 2,
          estimatedWords: 300,
        },
      ],
    },
    {
      id: "section-2",
      title: "机器学习基础",
      level: 1,
      estimatedWords: 800,
    },
  ],
  totalEstimatedWords: 1300,
  generatedBy: "deepseek",
};

const mockGeneratedContent = `# AI 技术入门指南

这是一份关于人工智能技术的入门指南。

## 什么是人工智能

人工智能是计算机科学的一个分支...

### AI 的定义

人工智能可以被定义为...

### AI 的历史

人工智能的发展可以追溯到...

## 机器学习基础

机器学习是人工智能的一个重要子领域...
`;

// Helper function to create async iterable from array
async function* createAsyncIterable(
  chunks: string[],
): AsyncGenerator<string, void, unknown> {
  for (const chunk of chunks) {
    yield chunk;
  }
}

// ============================================================
// Tests
// ============================================================

describe("ContentGenerator", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock implementation for streamText
    const { streamText } = require("ai");
    streamText.mockImplementation(() =>
      Promise.resolve({
        textStream: createAsyncIterable(["# AI", " 技术", "入门", "指南"]),
        usage: Promise.resolve({ totalTokens: 1000 }),
      }),
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("generateContentStream", () => {
    it("should yield progress and text chunks", async () => {
      // Arrange
      const { streamText } = require("ai");
      streamText.mockImplementation(() =>
        Promise.resolve({
          textStream: createAsyncIterable(
            mockGeneratedContent.split(/(?<=\n)/),
          ),
          usage: Promise.resolve({ totalTokens: 1000 }),
        }),
      );

      // Act
      const generator = generateContentStream(mockMaterials, {
        blueprintId: "test-blueprint",
        blueprintName: "Test Blueprint",
        outline: mockOutline,
        targetLength: "medium",
      });

      const chunks: OrchestrationStreamChunk[] = [];
      let result = await generator.next();

      while (!result.done) {
        chunks.push(result.value);
        result = await generator.next();
      }

      // Assert
      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks.some((c) => c.type === "progress")).toBe(true);
      expect(chunks.some((c) => c.type === "text")).toBe(true);

      // Check final result
      expect(result.value).toBeDefined();
      expect(result.value.content.length).toBeGreaterThan(0);
      expect(result.value.modelUsed).toBe("deepseek-chat");
      expect(result.value.outline).toEqual(mockOutline);
    });

    it("should include progress updates at key stages", async () => {
      // Arrange
      const { streamText } = require("ai");
      streamText.mockImplementation(() =>
        Promise.resolve({
          textStream: createAsyncIterable(["Hello", " World"]),
          usage: Promise.resolve({ totalTokens: 100 }),
        }),
      );

      // Act
      const generator = generateContentStream(mockMaterials, {
        blueprintId: "test-blueprint",
        blueprintName: "Test Blueprint",
        outline: mockOutline,
        targetLength: "medium",
      });

      const progressChunks: OrchestrationStreamChunk[] = [];
      let result = await generator.next();

      while (!result.done) {
        if (result.value.type === "progress") {
          progressChunks.push(result.value);
        }
        result = await generator.next();
      }

      // Assert - should have initial and final progress updates
      expect(progressChunks.length).toBeGreaterThanOrEqual(3); // Start, end, final
      const firstProgress = progressChunks[0];
      expect(firstProgress.type).toBe("progress");
      if (firstProgress.type === "progress") {
        expect(firstProgress.data.percent).toBe(5); // Initial
      }
    });

    it("should use briefing context when provided", async () => {
      // Arrange
      const briefingContext: BriefingContext = {
        answers: {
          audience: "beginner",
          tone: "casual",
        },
        answeredAt: new Date(),
      };

      const { streamText } = require("ai");
      streamText.mockImplementation(() =>
        Promise.resolve({
          textStream: createAsyncIterable(["Content with briefing context"]),
          usage: Promise.resolve({ totalTokens: 100 }),
        }),
      );

      // Act
      const generator = generateContentStream(
        mockMaterials,
        {
          blueprintId: "test-blueprint",
          blueprintName: "Test Blueprint",
          outline: mockOutline,
          targetLength: "medium",
        },
        briefingContext,
      );

      let result = await generator.next();
      while (!result.done) {
        result = await generator.next();
      }

      // Assert
      expect(result.value.content).toBe("Content with briefing context");
    });

    it("should yield error chunk on failure", async () => {
      // Arrange
      const { streamText } = require("ai");
      streamText.mockRejectedValue(new Error("API Error"));

      // Act
      const generator = generateContentStream(mockMaterials, {
        blueprintId: "test-blueprint",
        blueprintName: "Test Blueprint",
        outline: mockOutline,
        targetLength: "medium",
      });

      const chunks: OrchestrationStreamChunk[] = [];

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
      const { aiProviderRouter } = require("@/lib/ai-providers");
      expect(aiProviderRouter.recordFailure).toHaveBeenCalledWith(
        "deepseek",
        "API Error",
      );
    });

    it("should yield error chunk when no provider available", async () => {
      // Arrange
      const { aiProviderRouter } = require("@/lib/ai-providers");
      aiProviderRouter.selectProvider.mockReturnValue(null);

      // Act
      const generator = generateContentStream(mockMaterials, {
        blueprintId: "test-blueprint",
        blueprintName: "Test Blueprint",
        outline: mockOutline,
        targetLength: "medium",
      });

      const chunks: OrchestrationStreamChunk[] = [];

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

      // Restore mock
      aiProviderRouter.selectProvider.mockReturnValue({
        provider: {
          name: "deepseek",
          defaultModel: "deepseek-chat",
        },
        model: {},
        reason: "test",
      });
    });

    it("should respect writing style option", async () => {
      // Arrange
      const { streamText } = require("ai");
      streamText.mockImplementation(() =>
        Promise.resolve({
          textStream: createAsyncIterable(["Academic content"]),
          usage: Promise.resolve({ totalTokens: 100 }),
        }),
      );

      // Act
      const generator = generateContentStream(mockMaterials, {
        blueprintId: "test-blueprint",
        blueprintName: "Test Blueprint",
        outline: mockOutline,
        targetLength: "long",
        writingStyle: "academic",
      });

      let result = await generator.next();
      while (!result.done) {
        result = await generator.next();
      }

      // Assert
      expect(result.value.content).toBe("Academic content");
    });
  });

  describe("generateContent", () => {
    it("should return complete content result", async () => {
      // Arrange
      const { streamText } = require("ai");
      streamText.mockImplementation(() =>
        Promise.resolve({
          textStream: createAsyncIterable(
            mockGeneratedContent.split(/(?<=\n)/),
          ),
          usage: Promise.resolve({ totalTokens: 1000 }),
        }),
      );

      // Act
      const result = await generateContent(mockMaterials, {
        blueprintId: "test-blueprint",
        blueprintName: "Test Blueprint",
        outline: mockOutline,
        targetLength: "medium",
      });

      // Assert
      expect(result.content).toContain("AI 技术入门指南");
      expect(typeof result.durationMs).toBe("number");
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
      expect(result.modelUsed).toBe("deepseek-chat");
      expect(result.outline).toEqual(mockOutline);
    });

    it("should throw error on failure", async () => {
      // Arrange
      const { streamText } = require("ai");
      streamText.mockRejectedValue(new Error("API Error"));

      // Act & Assert
      await expect(
        generateContent(mockMaterials, {
          blueprintId: "test-blueprint",
          blueprintName: "Test Blueprint",
          outline: mockOutline,
          targetLength: "medium",
        }),
      ).rejects.toThrow("API Error");
    });
  });
});

describe("Content Validation Utilities", () => {
  describe("validateContentStructure", () => {
    const testOutline: BlueprintOutline = {
      title: "Test Outline",
      summary: "Test summary",
      nodes: [
        {
          id: "s1",
          title: "Introduction",
          level: 1,
          children: [
            {
              id: "s1-1",
              title: "Background",
              level: 2,
            },
          ],
        },
        {
          id: "s2",
          title: "Conclusion",
          level: 1,
        },
      ],
      totalEstimatedWords: 1000,
      generatedBy: "test",
    };

    it("should validate content with all headings present", () => {
      // Arrange
      const content = `# Introduction

Some introduction text...

## Background

Background information...

# Conclusion

Final thoughts...
`;

      // Act
      const result = validateContentStructure(content, testOutline);

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.missingTitles).toHaveLength(0);
      expect(result.matchedTitles).toContain("Introduction");
      expect(result.matchedTitles).toContain("Background");
      expect(result.matchedTitles).toContain("Conclusion");
    });

    it("should detect missing headings", () => {
      // Arrange
      const content = `# Introduction

Some introduction text...

# Conclusion

Final thoughts...
`;

      // Act
      const result = validateContentStructure(content, testOutline);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.missingTitles).toContain("Background");
      expect(result.matchedTitles).toContain("Introduction");
      expect(result.matchedTitles).toContain("Conclusion");
    });

    it("should handle empty content", () => {
      // Act
      const result = validateContentStructure("", testOutline);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.missingTitles).toHaveLength(3);
    });

    it("should match headings with different levels", () => {
      // Arrange
      const content = `## Introduction

Some text...

### Background

More text...

## Conclusion

End.
`;

      // Act
      const result = validateContentStructure(content, testOutline);

      // Assert
      expect(result.isValid).toBe(true);
    });
  });

  describe("extractHeadingsFromContent", () => {
    it("should extract all headings with levels", () => {
      // Arrange
      const content = `# Main Title

Some text...

## Section 1

Content...

### Subsection 1.1

More content...

## Section 2

Final content...
`;

      // Act
      const headings = extractHeadingsFromContent(content);

      // Assert
      expect(headings).toHaveLength(4);
      expect(headings[0]).toEqual({
        level: 1,
        title: "Main Title",
        position: expect.any(Number),
      });
      expect(headings[1]).toEqual({
        level: 2,
        title: "Section 1",
        position: expect.any(Number),
      });
      expect(headings[2]).toEqual({
        level: 3,
        title: "Subsection 1.1",
        position: expect.any(Number),
      });
      expect(headings[3]).toEqual({
        level: 2,
        title: "Section 2",
        position: expect.any(Number),
      });
    });

    it("should return empty array for content without headings", () => {
      // Arrange
      const content = "Just some text without any headings.";

      // Act
      const headings = extractHeadingsFromContent(content);

      // Assert
      expect(headings).toHaveLength(0);
    });

    it("should handle headings at start and end of content", () => {
      // Arrange
      const content = `# First Heading
Some content
# Last Heading`;

      // Act
      const headings = extractHeadingsFromContent(content);

      // Assert
      expect(headings).toHaveLength(2);
      expect(headings[0].title).toBe("First Heading");
      expect(headings[1].title).toBe("Last Heading");
    });

    it("should ignore H4+ headings", () => {
      // Arrange
      const content = `# H1
## H2
### H3
#### H4
##### H5
`;

      // Act
      const headings = extractHeadingsFromContent(content);

      // Assert
      expect(headings).toHaveLength(3);
      expect(headings.map((h) => h.level)).toEqual([1, 2, 3]);
    });
  });
});
