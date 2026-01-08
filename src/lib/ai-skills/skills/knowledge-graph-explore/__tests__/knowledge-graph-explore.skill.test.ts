/**
 * KnowledgeGraphExploreSkill 单元测试
 *
 * @version 1.0.0
 * @since 2025-01-08
 */

import {
  KnowledgeGraphExploreSkill,
  knowledgeGraphExploreSkill,
} from "../knowledge-graph-explore.skill";
import type { OrchestrationContext } from "../../../orchestration/types";

// Mock GraphBuilderService
const mockGetGraphData = jest.fn();
const mockGetCentralNodes = jest.fn();
const mockDetectCommunities = jest.fn();

jest.mock("@/lib/knowledge-link/services/graph-builder.service", () => ({
  getGraphBuilderService: jest.fn(() => ({
    getGraphData: mockGetGraphData,
    getCentralNodes: mockGetCentralNodes,
    detectCommunities: mockDetectCommunities,
  })),
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

describe("KnowledgeGraphExploreSkill", () => {
  let skill: KnowledgeGraphExploreSkill;

  beforeEach(() => {
    skill = new KnowledgeGraphExploreSkill();
    jest.clearAllMocks();

    // 默认 mock 返回值
    mockGetGraphData.mockResolvedValue({
      nodes: [
        { id: 1, title: "React", type: "tag" },
        { id: 2, title: "TypeScript", type: "tag" },
      ],
      edges: [{ source: 1, target: 2, strength: 0.8 }],
      stats: { totalNodes: 2, totalLinks: 1, avgDegree: 1 },
    });

    mockGetCentralNodes.mockResolvedValue([
      { id: 1, title: "React", connectionCount: 10 },
      { id: 2, title: "TypeScript", connectionCount: 8 },
    ]);

    mockDetectCommunities.mockResolvedValue(
      new Map([
        [0, [1, 2]],
        [1, [3, 4]],
      ]),
    );
  });

  describe("metadata", () => {
    it("should have correct id", () => {
      expect(skill.metadata.id).toBe("knowledge_graph_explore");
    });

    it("should have correct name", () => {
      expect(skill.metadata.name).toBe("知识图谱探索");
    });

    it("should have correct category", () => {
      expect(skill.metadata.category).toBe("understanding");
    });

    it("should have correct version", () => {
      expect(skill.metadata.version).toBe("1.0.0");
    });

    it("should have capabilities", () => {
      expect(skill.metadata.capabilities).toContain("visualize");
      expect(skill.metadata.capabilities).toContain("analyze");
      expect(skill.metadata.capabilities).toContain("recommend");
    });

    it("should have defined steps", () => {
      expect(skill.metadata.steps).toHaveLength(3);
      expect(skill.metadata.steps?.map((s) => s.id)).toEqual([
        "build",
        "analyze",
        "insight",
      ]);
    });
  });

  describe("inputSchema", () => {
    it("should validate correct input", () => {
      const input = { depth: 2, maxNodes: 100 };
      const result = skill.inputSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it("should use default values", () => {
      const input = {};
      const result = skill.inputSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.depth).toBe(2);
        expect(result.data.maxNodes).toBe(100);
      }
    });

    it("should reject depth below 1", () => {
      const input = { depth: 0 };
      const result = skill.inputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("should reject depth above 3", () => {
      const input = { depth: 4 };
      const result = skill.inputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("should reject maxNodes below 10", () => {
      const input = { maxNodes: 5 };
      const result = skill.inputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("should reject maxNodes above 200", () => {
      const input = { maxNodes: 300 };
      const result = skill.inputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe("outputSchema", () => {
    it("should validate correct output", () => {
      const output = {
        nodeCount: 50,
        edgeCount: 100,
        communityCount: 5,
        centralNodes: [{ id: 1, title: "React", connectionCount: 10 }],
      };
      const result = skill.outputSchema.safeParse(output);
      expect(result.success).toBe(true);
    });
  });

  describe("parseInput", () => {
    const mockContext: OrchestrationContext = {
      userId: "test-user",
      conversationId: "test-conv",
      params: {},
    };

    it("should return default values", async () => {
      const result = await skill.parseInput("探索知识图谱", mockContext);
      expect(result.depth).toBe(2);
      expect(result.maxNodes).toBe(100);
    });
  });

  describe("executeStream", () => {
    const mockContext: OrchestrationContext = {
      userId: "test-user-id",
      conversationId: "test-conv",
      params: { depth: 2, maxNodes: 100 },
    };

    it("should yield progress chunks", async () => {
      const chunks: unknown[] = [];

      for await (const chunk of skill.executeStream(mockContext)) {
        chunks.push(chunk);
      }

      const progressChunks = chunks.filter((c: any) => c.type === "progress");
      expect(progressChunks.length).toBeGreaterThan(0);
    });

    it("should yield deliverable chunk with graph data", async () => {
      const chunks: unknown[] = [];

      for await (const chunk of skill.executeStream(mockContext)) {
        chunks.push(chunk);
      }

      const deliverableChunks = chunks.filter(
        (c: any) => c.type === "deliverable",
      );
      expect(deliverableChunks.length).toBeGreaterThan(0);

      const deliverable = deliverableChunks[0] as any;
      expect(deliverable.data.content.nodes).toBeDefined();
      expect(deliverable.data.content.edges).toBeDefined();
    });

    it("should yield text chunk with insights", async () => {
      const chunks: unknown[] = [];

      for await (const chunk of skill.executeStream(mockContext)) {
        chunks.push(chunk);
      }

      const textChunks = chunks.filter((c: any) => c.type === "text");
      expect(textChunks.length).toBeGreaterThan(0);

      const textContent = (textChunks[0] as any).data.text;
      expect(textContent).toContain("知识图谱分析结果");
    });

    it("should yield done chunk", async () => {
      const chunks: unknown[] = [];

      for await (const chunk of skill.executeStream(mockContext)) {
        chunks.push(chunk);
      }

      const lastChunk = chunks[chunks.length - 1] as any;
      expect(lastChunk.type).toBe("done");
    });

    it("should call graph service methods", async () => {
      const chunks: unknown[] = [];

      for await (const chunk of skill.executeStream(mockContext)) {
        chunks.push(chunk);
      }

      expect(mockGetGraphData).toHaveBeenCalledWith("test-user-id", {
        maxNodes: 100,
        minStrength: 0.3,
      });
      expect(mockGetCentralNodes).toHaveBeenCalledWith("test-user-id", 5);
      expect(mockDetectCommunities).toHaveBeenCalledWith("test-user-id");
    });
  });

  describe("singleton instance", () => {
    it("should export a singleton instance", () => {
      expect(knowledgeGraphExploreSkill).toBeInstanceOf(
        KnowledgeGraphExploreSkill,
      );
      expect(knowledgeGraphExploreSkill.metadata.id).toBe(
        "knowledge_graph_explore",
      );
    });
  });
});
