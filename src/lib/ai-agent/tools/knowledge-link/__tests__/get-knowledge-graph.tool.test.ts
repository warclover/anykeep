/**
 * get-knowledge-graph.tool.ts 单元测试
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

import type { ToolContext } from "../../types";

// Mock GraphBuilderService
const mockGetGraphData = jest.fn();

jest.mock("@/lib/knowledge-link/services/graph-builder.service", () => ({
  getGraphBuilderService: jest.fn(() => ({
    getGraphData: mockGetGraphData,
  })),
}));

// Mock logger
jest.mock("@/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

import { getKnowledgeGraphTool } from "../get-knowledge-graph.tool";

describe("getKnowledgeGraphTool", () => {
  const mockContext: ToolContext = {
    userId: "test-user-123",
    conversationId: "test-conv-456",
  };

  // 创建 Mock 图数据
  const createMockGraphData = (
    nodeCount: number,
    edgeCount: number,
    options?: {
      strongLinks?: number;
      linkTypes?: Record<string, number>;
    },
  ) => ({
    nodes: Array.from({ length: nodeCount }, (_, i) => ({
      id: i + 1,
      title: `书签 ${i + 1}`,
      url: `https://example.com/${i + 1}`,
      platform: i % 2 === 0 ? "wechat" : "browser",
      connectionCount: Math.floor(Math.random() * 5),
      avgStrength: Math.random(),
    })),
    edges: Array.from({ length: edgeCount }, (_, i) => ({
      source: (i % nodeCount) + 1,
      target: ((i + 1) % nodeCount) + 1,
      type: "semantic" as const,
      strength: 0.5 + Math.random() * 0.5,
    })),
    stats: {
      totalBookmarks: nodeCount,
      totalLinks: edgeCount,
      avgLinksPerBookmark: edgeCount > 0 ? (edgeCount * 2) / nodeCount : 0,
      linksByType: options?.linkTypes || {
        semantic: edgeCount,
        entity: 0,
        tag: 0,
        topic: 0,
      },
      linksByStrength: {
        weak: 0,
        medium: edgeCount - (options?.strongLinks || 0),
        strong: options?.strongLinks || 0,
      },
    },
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("definition", () => {
    it("should have correct metadata", () => {
      expect(getKnowledgeGraphTool.definition.name).toBe("get_knowledge_graph");
      expect(getKnowledgeGraphTool.definition.category).toBe("query");
      expect(getKnowledgeGraphTool.definition.requiresConfirmation).toBe(false);
      expect(getKnowledgeGraphTool.definition.estimatedDurationMs).toBe(500);
    });

    it("should have no required parameters", () => {
      const schema = getKnowledgeGraphTool.definition.parameters;
      expect(() => schema.parse({})).not.toThrow();
    });

    it("should validate minStrength range", () => {
      const schema = getKnowledgeGraphTool.definition.parameters;
      // Valid values
      expect(() => schema.parse({ minStrength: 0 })).not.toThrow();
      expect(() => schema.parse({ minStrength: 0.5 })).not.toThrow();
      expect(() => schema.parse({ minStrength: 1 })).not.toThrow();
      // Invalid values
      expect(() => schema.parse({ minStrength: -0.1 })).toThrow();
      expect(() => schema.parse({ minStrength: 1.1 })).toThrow();
    });

    it("should validate maxNodes range", () => {
      const schema = getKnowledgeGraphTool.definition.parameters;
      // Valid values
      expect(() => schema.parse({ maxNodes: 10 })).not.toThrow();
      expect(() => schema.parse({ maxNodes: 200 })).not.toThrow();
      expect(() => schema.parse({ maxNodes: 500 })).not.toThrow();
      // Invalid values
      expect(() => schema.parse({ maxNodes: 5 })).toThrow();
      expect(() => schema.parse({ maxNodes: 501 })).toThrow();
    });

    it("should validate linkTypes enum", () => {
      const schema = getKnowledgeGraphTool.definition.parameters;
      // Valid values
      expect(() =>
        schema.parse({ linkTypes: ["semantic", "entity"] }),
      ).not.toThrow();
      expect(() => schema.parse({ linkTypes: ["tag", "topic"] })).not.toThrow();
      // Invalid values
      expect(() => schema.parse({ linkTypes: ["invalid"] })).toThrow();
    });
  });

  describe("execute - empty state", () => {
    it("should return empty graph when no data", async () => {
      mockGetGraphData.mockResolvedValue(createMockGraphData(0, 0));

      const result = await getKnowledgeGraphTool.execute({}, mockContext);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.nodes).toHaveLength(0);
        expect(result.data.edges).toHaveLength(0);
        expect(result.data.message).toContain("还没有数据");
      }
    });

    it("should return nodes without edges message", async () => {
      mockGetGraphData.mockResolvedValue(createMockGraphData(5, 0));

      const result = await getKnowledgeGraphTool.execute({}, mockContext);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.nodes).toHaveLength(5);
        expect(result.data.edges).toHaveLength(0);
        expect(result.data.message).toContain("5 个书签");
        expect(result.data.message).toContain("尚未建立关联");
      }
    });
  });

  describe("execute - with data", () => {
    it("should return graph with nodes and edges", async () => {
      mockGetGraphData.mockResolvedValue(
        createMockGraphData(10, 15, { strongLinks: 3 }),
      );

      const result = await getKnowledgeGraphTool.execute({}, mockContext);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.nodes).toHaveLength(10);
        expect(result.data.edges).toHaveLength(15);
        expect(result.data.stats.totalBookmarks).toBe(10);
        expect(result.data.stats.totalLinks).toBe(15);
        expect(result.data.message).toContain("10 个书签");
        expect(result.data.message).toContain("15 条关联");
        expect(result.data.message).toContain("3 条是强关联");
      }
    });

    it("should transform nodes correctly", async () => {
      const graphData = createMockGraphData(1, 0);
      graphData.nodes[0] = {
        id: 42,
        title: "测试书签",
        url: "https://test.com",
        platform: "wechat",
        connectionCount: 3,
        avgStrength: 0.85,
      };
      mockGetGraphData.mockResolvedValue(graphData);

      const result = await getKnowledgeGraphTool.execute({}, mockContext);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.nodes[0]).toEqual({
          id: 42,
          title: "测试书签",
          url: "https://test.com",
          platform: "wechat",
          connectionCount: 3,
          avgStrength: 0.85,
        });
      }
    });

    it("should include link types in message (Chinese names)", async () => {
      const graphData = createMockGraphData(5, 10, {
        linkTypes: {
          semantic: 5,
          entity: 3,
          tag: 2,
          topic: 0,
        },
      });
      mockGetGraphData.mockResolvedValue(graphData);

      const result = await getKnowledgeGraphTool.execute({}, mockContext);

      expect(result.success).toBe(true);
      if (result.success) {
        // 类型名称被转换为中文
        expect(result.data.message).toContain("语义相似");
        expect(result.data.message).toContain("共享实体");
        expect(result.data.message).toContain("共享标签");
      }
    });

    it("should pass parameters to service", async () => {
      mockGetGraphData.mockResolvedValue(createMockGraphData(5, 5));

      await getKnowledgeGraphTool.execute(
        {
          minStrength: 0.5,
          maxNodes: 100,
          linkTypes: ["semantic", "entity"],
          includeIsolated: true,
        },
        mockContext,
      );

      expect(mockGetGraphData).toHaveBeenCalledWith(mockContext.userId, {
        minStrength: 0.5,
        maxNodes: 100,
        linkTypes: ["semantic", "entity"],
        includeIsolated: true,
      });
    });
  });

  describe("execute - error handling", () => {
    it("should handle service errors gracefully", async () => {
      mockGetGraphData.mockRejectedValue(new Error("Service unavailable"));

      const result = await getKnowledgeGraphTool.execute({}, mockContext);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("获取知识图谱失败");
        expect(result.errorCode).toBe("EXECUTION_ERROR");
      }
    });

    it("should handle unknown errors", async () => {
      mockGetGraphData.mockRejectedValue("Unknown error string");

      const result = await getKnowledgeGraphTool.execute({}, mockContext);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("获取知识图谱失败");
      }
    });
  });

  describe("execute - metadata", () => {
    it("should include execution time in metadata", async () => {
      mockGetGraphData.mockResolvedValue(createMockGraphData(0, 0));

      const result = await getKnowledgeGraphTool.execute({}, mockContext);

      expect(result.success).toBe(true);
      expect(result.metadata?.executionTimeMs).toBeDefined();
      expect(result.metadata?.executionTimeMs).toBeGreaterThanOrEqual(0);
    });

    it("should include affectedCount in metadata", async () => {
      mockGetGraphData.mockResolvedValue(createMockGraphData(10, 5));

      const result = await getKnowledgeGraphTool.execute({}, mockContext);

      expect(result.success).toBe(true);
      expect(result.metadata?.affectedCount).toBe(10);
    });
  });
});
