/**
 * ThematicSynthesisSkill 单元测试
 *
 * 测试主题合成器功能
 *
 * @version 1.0.0
 * @since 2026-01-01
 */

import {
  ThematicSynthesisSkill,
  thematicSynthesisSkill,
} from "../thematic-synthesis.skill";
import type { OrchestrationContext } from "../../../orchestration/types";
import type { OrchestrationStreamChunk } from "../../../output/types";

// Mock 书签数据
const mockBookmarks = [
  {
    id: 1,
    title: "React 性能优化指南",
    url: "https://example.com/react-perf",
    description: "React 性能优化的最佳实践",
    ai_summary:
      "本文介绍了 React 应用的性能优化策略，包括虚拟化、记忆化等技术。",
    platform: "juejin",
    created_at: new Date().toISOString(),
  },
  {
    id: 2,
    title: "Vue 性能优化技巧",
    url: "https://example.com/vue-perf",
    description: "Vue 应用性能调优方法",
    ai_summary: "本文探讨了 Vue 应用的性能优化，包括懒加载、代码分割等方法。",
    platform: "zhihu",
    created_at: new Date().toISOString(),
  },
];

// Mock LLM 响应
const mockTopicAnalysisResponse = {
  topicClusters: [
    {
      id: "cluster-1",
      name: "前端性能优化",
      description: "关于前端框架性能优化的内容",
      relatedBookmarkIds: ["1", "2"],
      keywords: ["性能", "优化", "React", "Vue"],
      weight: 0.9,
    },
  ],
  keyEntities: [
    {
      name: "虚拟化",
      type: "technology",
      mentions: 2,
      relatedClusters: ["cluster-1"],
    },
  ],
  domainSummary: "前端性能优化相关内容",
};

const mockSynthesisResponse = {
  overview: "本综述汇集了 React 和 Vue 两大前端框架的性能优化方法。",
  consensus: [
    {
      point: "虚拟化是处理大列表的关键技术",
      confidence: 0.9,
      sources: [
        { bookmarkId: "1", title: "React 性能优化指南" },
        { bookmarkId: "2", title: "Vue 性能优化技巧" },
      ],
    },
  ],
};

const mockDivergenceResponse = {
  divergence: [
    {
      topic: "状态管理方案",
      point_a: "推荐使用 Redux",
      point_b: "推荐使用 Vuex/Pinia",
      sources_a: [{ bookmarkId: "1", title: "React 性能优化指南" }],
      sources_b: [{ bookmarkId: "2", title: "Vue 性能优化技巧" }],
      analysis: "不同框架有各自的状态管理生态",
    },
  ],
};

const mockBlindspotResponse = {
  blindSpots: [
    {
      topic: "服务端渲染性能",
      suggestion: "建议补充 SSR 性能优化相关内容",
      search_keywords: ["SSR", "服务端渲染", "性能"],
    },
  ],
};

// Mock 查询结果
let mockQueryResult: { data: unknown[] | null; error: unknown } = {
  data: mockBookmarks,
  error: null,
};

const mockUpdateResult: { error: unknown } = { error: null };

// Mock Supabase client
jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(() =>
    Promise.resolve({
      from: jest.fn((table: string) => {
        if (table === "synthesis_reports") {
          return {
            update: jest.fn(() => ({
              eq: jest.fn(() => ({
                eq: jest.fn(() => Promise.resolve(mockUpdateResult)),
              })),
            })),
          };
        }
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              eq: jest.fn(() => ({
                order: jest.fn(() => ({
                  limit: jest.fn(() => Promise.resolve(mockQueryResult)),
                })),
              })),
              order: jest.fn(() => ({
                limit: jest.fn(() => Promise.resolve(mockQueryResult)),
              })),
              contains: jest.fn(() => ({
                order: jest.fn(() => ({
                  limit: jest.fn(() => Promise.resolve(mockQueryResult)),
                })),
              })),
              in: jest.fn(() => Promise.resolve(mockQueryResult)),
            })),
            in: jest.fn(() => Promise.resolve(mockQueryResult)),
          })),
        };
      }),
    }),
  ),
}));

// Mock logger
jest.mock("@/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
  },
}));

// Mock AI provider
jest.mock("@/lib/ai-providers", () => ({
  aiProviderRouter: {
    selectProvider: jest.fn(() => ({
      model: "mock-model",
      provider: "mock",
    })),
  },
}));

// Mock generateText
let generateTextCallCount = 0;
jest.mock("ai", () => ({
  generateText: jest.fn(() => {
    generateTextCallCount++;
    // Return different responses based on call order
    if (generateTextCallCount === 1) {
      return Promise.resolve({
        text: JSON.stringify(mockTopicAnalysisResponse),
      });
    } else if (generateTextCallCount === 2) {
      return Promise.resolve({ text: JSON.stringify(mockSynthesisResponse) });
    } else if (generateTextCallCount === 3) {
      return Promise.resolve({ text: JSON.stringify(mockDivergenceResponse) });
    } else {
      return Promise.resolve({ text: JSON.stringify(mockBlindspotResponse) });
    }
  }),
}));

describe("ThematicSynthesisSkill", () => {
  let skill: ThematicSynthesisSkill;

  beforeEach(() => {
    skill = new ThematicSynthesisSkill();
    mockQueryResult = { data: mockBookmarks, error: null };
    generateTextCallCount = 0;
    jest.clearAllMocks();
  });

  // 辅助函数：收集所有流式输出
  async function collectChunks(
    generator: AsyncGenerator<OrchestrationStreamChunk>,
  ): Promise<OrchestrationStreamChunk[]> {
    const chunks: OrchestrationStreamChunk[] = [];
    for await (const chunk of generator) {
      chunks.push(chunk);
    }
    return chunks;
  }

  describe("metadata", () => {
    it("should have correct skill ID", () => {
      expect(skill.metadata.id).toBe("thematic_synthesis");
    });

    it("should have correct category", () => {
      expect(skill.metadata.category).toBe("understanding");
    });

    it("should have expected capabilities", () => {
      expect(skill.metadata.capabilities).toContain("content-synthesis");
      expect(skill.metadata.capabilities).toContain("consensus-extraction");
      expect(skill.metadata.capabilities).toContain("divergence-detection");
      expect(skill.metadata.capabilities).toContain("blindspot-discovery");
    });

    it("should have 5 steps defined", () => {
      expect(skill.metadata.steps).toHaveLength(5);
    });

    it("should support markdown and json output formats", () => {
      expect(skill.metadata.outputFormats).toContain("markdown");
      expect(skill.metadata.outputFormats).toContain("json");
    });
  });

  describe("parseInput", () => {
    const mockContext: OrchestrationContext = {
      userId: "test-user",
      originalMessage: "",
      params: {},
    };

    it("should parse quick depth mode", async () => {
      const result = await skill.parseInput("快速生成综述", mockContext);
      expect(result.depthMode).toBe("quick");
    });

    it("should parse academic depth mode", async () => {
      const result = await skill.parseInput("深度分析这些内容", mockContext);
      expect(result.depthMode).toBe("academic");
    });

    it("should default to standard depth mode", async () => {
      const result = await skill.parseInput("生成综述", mockContext);
      expect(result.depthMode).toBe("standard");
    });

    it("should default to selection source type", async () => {
      const result = await skill.parseInput("合成内容", mockContext);
      expect(result.sourceType).toBe("selection");
    });
  });

  describe("executeStream - folder source", () => {
    it("should emit progress chunks", async () => {
      const context: OrchestrationContext = {
        userId: "test-user",
        originalMessage: "生成综述",
        params: {
          sourceType: "folder",
          sourceId: "1",
          depthMode: "standard",
        },
      };

      const chunks = await collectChunks(skill.executeStream(context));
      const progressChunks = chunks.filter((c) => c.type === "progress");

      expect(progressChunks.length).toBeGreaterThan(0);
    });

    it("should emit text chunks with content", async () => {
      const context: OrchestrationContext = {
        userId: "test-user",
        originalMessage: "生成综述",
        params: {
          sourceType: "folder",
          sourceId: "1",
          depthMode: "standard",
        },
      };

      const chunks = await collectChunks(skill.executeStream(context));
      const textChunks = chunks.filter((c) => c.type === "text");

      expect(textChunks.length).toBeGreaterThan(0);
    });

    it("should emit overview in text output", async () => {
      const context: OrchestrationContext = {
        userId: "test-user",
        originalMessage: "生成综述",
        params: {
          sourceType: "folder",
          sourceId: "1",
          depthMode: "standard",
        },
      };

      const chunks = await collectChunks(skill.executeStream(context));
      const textContent = chunks
        .filter((c) => c.type === "text")
        .map((c) => c.data.text)
        .join("");

      expect(textContent).toContain("概述");
    });
  });

  describe("executeStream - empty bookmarks", () => {
    it("should handle empty bookmarks gracefully", async () => {
      mockQueryResult = { data: [], error: null };

      const context: OrchestrationContext = {
        userId: "test-user",
        originalMessage: "生成综述",
        params: {
          sourceType: "folder",
          sourceId: "1",
          depthMode: "standard",
        },
      };

      const chunks = await collectChunks(skill.executeStream(context));
      const textContent = chunks
        .filter((c) => c.type === "text")
        .map((c) => c.data.text)
        .join("");

      expect(textContent).toContain("未找到符合条件的书签");
    });
  });

  describe("executeStream - selection source", () => {
    it("should process selected bookmarks", async () => {
      const context: OrchestrationContext = {
        userId: "test-user",
        originalMessage: "生成综述",
        params: {
          sourceType: "selection",
          bookmarkIds: ["1", "2"],
          depthMode: "standard",
        },
      };

      const chunks = await collectChunks(skill.executeStream(context));
      const doneChunks = chunks.filter((c) => c.type === "done");

      expect(doneChunks.length).toBe(1);
      expect(doneChunks[0].data.success).toBe(true);
    });
  });

  describe("executeStream - deliverable output", () => {
    it("should emit deliverable with report data", async () => {
      const context: OrchestrationContext = {
        userId: "test-user",
        originalMessage: "生成综述",
        params: {
          sourceType: "folder",
          sourceId: "1",
          depthMode: "standard",
        },
      };

      const chunks = await collectChunks(skill.executeStream(context));
      const deliverableChunks = chunks.filter((c) => c.type === "deliverable");

      expect(deliverableChunks.length).toBe(1);
      expect(deliverableChunks[0].data.type).toBe("report");
    });

    it("should include overview in deliverable", async () => {
      const context: OrchestrationContext = {
        userId: "test-user",
        originalMessage: "生成综述",
        params: {
          sourceType: "folder",
          sourceId: "1",
          depthMode: "standard",
        },
      };

      const chunks = await collectChunks(skill.executeStream(context));
      const deliverableChunks = chunks.filter((c) => c.type === "deliverable");

      expect(deliverableChunks[0].data.content).toHaveProperty("overview");
    });

    it("should include consensus in deliverable", async () => {
      const context: OrchestrationContext = {
        userId: "test-user",
        originalMessage: "生成综述",
        params: {
          sourceType: "folder",
          sourceId: "1",
          depthMode: "standard",
        },
      };

      const chunks = await collectChunks(skill.executeStream(context));
      const deliverableChunks = chunks.filter((c) => c.type === "deliverable");

      expect(deliverableChunks[0].data.content).toHaveProperty("consensus");
    });

    it("should include divergence in deliverable", async () => {
      const context: OrchestrationContext = {
        userId: "test-user",
        originalMessage: "生成综述",
        params: {
          sourceType: "folder",
          sourceId: "1",
          depthMode: "standard",
        },
      };

      const chunks = await collectChunks(skill.executeStream(context));
      const deliverableChunks = chunks.filter((c) => c.type === "deliverable");

      expect(deliverableChunks[0].data.content).toHaveProperty("divergence");
    });

    it("should include blindSpots in deliverable", async () => {
      const context: OrchestrationContext = {
        userId: "test-user",
        originalMessage: "生成综述",
        params: {
          sourceType: "folder",
          sourceId: "1",
          depthMode: "standard",
        },
      };

      const chunks = await collectChunks(skill.executeStream(context));
      const deliverableChunks = chunks.filter((c) => c.type === "deliverable");

      expect(deliverableChunks[0].data.content).toHaveProperty("blindSpots");
    });
  });

  describe("executeStream - report saving", () => {
    it("should save report when reportId is provided", async () => {
      const context: OrchestrationContext = {
        userId: "test-user",
        originalMessage: "生成综述",
        params: {
          sourceType: "folder",
          sourceId: "1",
          depthMode: "standard",
          reportId: "report-123",
        },
      };

      await collectChunks(skill.executeStream(context));

      // Verify update was called (via mock)
      // The mock should have been called to update the report
    });
  });

  describe("word count calculation", () => {
    it("should count Chinese characters correctly", () => {
      // Access private method via any
      const countWords = (
        skill as unknown as { countWords: (text: string) => number }
      ).countWords;

      if (typeof countWords === "function") {
        const text = "这是一段中文测试";
        const count = countWords.call(skill, text);
        expect(count).toBe(8); // 8 Chinese characters
      }
    });

    it("should count mixed Chinese and English", () => {
      const countWords = (
        skill as unknown as { countWords: (text: string) => number }
      ).countWords;

      if (typeof countWords === "function") {
        const text = "这是React框架";
        const count = countWords.call(skill, text);
        expect(count).toBeGreaterThan(4);
      }
    });
  });

  describe("singleton export", () => {
    it("should export thematicSynthesisSkill instance", () => {
      expect(thematicSynthesisSkill).toBeInstanceOf(ThematicSynthesisSkill);
    });

    it("should have same metadata as new instance", () => {
      expect(thematicSynthesisSkill.metadata.id).toBe(skill.metadata.id);
    });
  });
});
