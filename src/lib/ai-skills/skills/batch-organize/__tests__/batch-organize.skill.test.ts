/**
 * BatchOrganizeSkill 单元测试
 *
 * @version 1.1.0 - 新增 executeStream 测试
 * @since 2025-12-24
 */

import {
  BatchOrganizeSkill,
  batchOrganizeSkill,
} from "../batch-organize.skill";
import type { OrchestrationContext } from "../../../orchestration/types";
import type { OrchestrationStreamChunk } from "../../../output/types";
import { ORGANIZE_ACTION_CONFIG, DEFAULT_ORGANIZE_CONFIG } from "../types";
import type { OrganizeAction } from "../types";

// Mock 书签数据
const mockBookmarks = [
  {
    id: 1,
    title: "React 入门教程",
    url: "https://example.com/react",
    platform: "juejin",
    ai_summary: "React 是一个用于构建用户界面的 JavaScript 库",
    ai_tags: ["React", "前端"],
    user_tags: [],
    created_at: new Date().toISOString(),
    folder_id: null,
  },
  {
    id: 2,
    title: "TypeScript 高级特性",
    url: "https://example.com/typescript",
    platform: "zhihu",
    ai_summary: "TypeScript 提供了强大的类型系统",
    ai_tags: ["TypeScript"],
    user_tags: ["编程"],
    created_at: new Date().toISOString(),
    folder_id: null,
  },
];

// Mock 文件夹数据
const mockFolders = [
  { id: 1, name: "技术文章" },
  { id: 2, name: "教程" },
];

// Mock Supabase - 支持动态结果
let mockBookmarksResult: {
  data: unknown[] | null;
  error: { message: string } | null;
} = {
  data: mockBookmarks,
  error: null,
};

let mockFoldersResult: {
  data: unknown[] | null;
  error: { message: string } | null;
} = {
  data: mockFolders,
  error: null,
};

// Mock Supabase client
jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(() =>
    Promise.resolve({
      from: jest.fn((tableName: string) => {
        if (tableName === "folders") {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                is: jest.fn(() => ({
                  order: jest.fn(() => Promise.resolve(mockFoldersResult)),
                })),
              })),
            })),
          };
        }
        // bookmarks table
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              is: jest.fn(() => ({
                order: jest.fn(() => Promise.resolve(mockBookmarksResult)),
              })),
            })),
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

// Mock step functions - 使用动态返回
let mockFetchBookmarksResult: unknown[] = [];
let mockFetchFoldersResult: unknown[] = [];

jest.mock("../steps", () => ({
  fetchBookmarks: jest.fn(() => Promise.resolve(mockFetchBookmarksResult)),
  fetchFolders: jest.fn(() => Promise.resolve(mockFetchFoldersResult)),
  generateCategorizeSuggestions: jest.fn(() => [
    {
      bookmarkId: 1,
      bookmarkTitle: "React 入门教程",
      suggestedFolderId: 1,
      suggestedFolder: "技术文章",
      confidence: 0.85,
      reason: "内容匹配",
    },
  ]),
  generateTagSuggestions: jest.fn(() => [
    {
      bookmarkId: 1,
      bookmarkTitle: "React 入门教程",
      suggestedTags: ["React", "前端开发"],
      confidence: 0.9,
    },
  ]),
  findDuplicates: jest.fn(() => []),
  findArchiveCandidates: jest.fn(() => []),
  generateSummary: jest.fn(() => "整理完成，共处理 2 条书签"),
  generateOrganizeSuggestions: jest.fn(() => ["建议定期整理书签"]),
  buildConfirmationMessage: jest.fn(() => "确认执行以下操作？"),
  executeCategorizeSuggestions: jest.fn(() =>
    Promise.resolve({ success: 1, failed: 0 }),
  ),
  executeTagSuggestions: jest.fn(() =>
    Promise.resolve({ success: 1, failed: 0 }),
  ),
  executeDuplicateCleanup: jest.fn(() =>
    Promise.resolve({ success: 0, failed: 0 }),
  ),
  executeArchive: jest.fn(() => Promise.resolve({ success: 0, failed: 0 })),
}));

describe("BatchOrganizeSkill", () => {
  let skill: BatchOrganizeSkill;

  beforeEach(() => {
    skill = new BatchOrganizeSkill();
    // 重置 mock 数据
    mockBookmarksResult = { data: mockBookmarks, error: null };
    mockFoldersResult = { data: mockFolders, error: null };
    // 重置 step mocks
    mockFetchBookmarksResult = mockBookmarks;
    mockFetchFoldersResult = mockFolders;
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

  // 创建测试上下文的辅助函数
  const createContext = (
    params: Record<string, unknown> = {},
  ): OrchestrationContext => ({
    userId: "test-user-id",
    conversationId: "test-conv-id",
    params: {
      actions: ["auto-categorize", "auto-tag"],
      scope: "all",
      requireConfirmation: false,
      autoExecute: false,
      ...params,
    },
  });

  describe("metadata", () => {
    it("should have correct id and name", () => {
      expect(skill.metadata.id).toBe("batch_organize");
      expect(skill.metadata.name).toBe("智能整理助手");
      expect(skill.metadata.category).toBe("utility");
    });

    it("should have deliverable types", () => {
      expect(skill.metadata.deliverableTypes).toBeDefined();
      expect(skill.metadata.deliverableTypes).toContain("list");
      expect(skill.metadata.deliverableTypes).toContain("report");
    });

    it("should have valid steps definition", () => {
      expect(skill.metadata.steps).toBeDefined();
      expect(skill.metadata.steps!.length).toBe(6);
      expect(skill.metadata.steps![0].id).toBe("collect");
    });

    it("should have capabilities", () => {
      expect(skill.metadata.capabilities).toBeDefined();
      expect(skill.metadata.capabilities).toContain("auto-categorize");
      expect(skill.metadata.capabilities).toContain("auto-tag");
      expect(skill.metadata.capabilities).toContain("duplicate-detection");
    });
  });

  describe("parseInput", () => {
    const mockContext: OrchestrationContext = {
      userId: "test-user",
      params: null,
    };

    it("should parse organize actions from message", async () => {
      const categorizeResult = await skill.parseInput(
        "帮我整理书签",
        mockContext,
      );
      expect(categorizeResult.actions).toContain("auto-categorize");

      const tagResult = await skill.parseInput("批量打标签", mockContext);
      expect(tagResult.actions).toContain("auto-tag");

      const duplicateResult = await skill.parseInput(
        "清理重复书签",
        mockContext,
      );
      expect(duplicateResult.actions).toContain("clean-duplicates");

      const archiveResult = await skill.parseInput("归档旧内容", mockContext);
      expect(archiveResult.actions).toContain("archive-old");
    });

    it("should have at least one action", async () => {
      const result = await skill.parseInput("整理我的书签", mockContext);
      expect(result.actions.length).toBeGreaterThan(0);
    });

    it("should include scope in result", async () => {
      const result = await skill.parseInput("整理书签", mockContext);
      expect(result.scope).toBeDefined();
    });

    it("should have confirmation requirement", async () => {
      const result = await skill.parseInput("整理书签", mockContext);
      expect(result.requireConfirmation).toBeDefined();
    });
  });

  describe("singleton instance", () => {
    it("should export a singleton instance", () => {
      expect(batchOrganizeSkill).toBeInstanceOf(BatchOrganizeSkill);
      expect(batchOrganizeSkill.metadata.id).toBe("batch_organize");
    });
  });

  describe("schemas", () => {
    it("should have valid input schema", () => {
      expect(skill.inputSchema).toBeDefined();
    });

    it("should have valid output schema", () => {
      expect(skill.outputSchema).toBeDefined();
    });
  });

  describe("executeStream", () => {
    it("should emit progress chunks during execution", async () => {
      const context = createContext();
      const chunks = await collectChunks(skill.executeStream(context));

      // 验证进度块存在
      const progressChunks = chunks.filter((c) => c.type === "progress");
      expect(progressChunks.length).toBeGreaterThan(0);

      // 验证进度递增
      const percentages = progressChunks
        .map((c) => c.data.percent)
        .filter((p): p is number => p !== undefined);

      for (let i = 1; i < percentages.length; i++) {
        expect(percentages[i]).toBeGreaterThanOrEqual(percentages[i - 1]);
      }
    });

    it("should emit text chunks with organize status", async () => {
      const context = createContext();
      const chunks = await collectChunks(skill.executeStream(context));

      // 验证文本块存在
      const textChunks = chunks.filter((c) => c.type === "text");
      expect(textChunks.length).toBeGreaterThan(0);

      // 验证包含整理信息
      const allText = textChunks.map((c) => c.data.text || "").join("");
      expect(allText).toContain("书签");
    });

    it("should emit deliverable with report type", async () => {
      const context = createContext();
      const chunks = await collectChunks(skill.executeStream(context));

      // 验证交付物块
      const deliverableChunk = chunks.find((c) => c.type === "deliverable");
      expect(deliverableChunk).toBeDefined();
      expect(deliverableChunk?.data.type).toBe("report");
      expect(deliverableChunk?.data.format).toBe("markdown");
      expect(deliverableChunk?.data.downloadable).toBe(true);
    });

    it("should emit done with success summary", async () => {
      const context = createContext();
      const chunks = await collectChunks(skill.executeStream(context));

      // 验证完成块
      const doneChunk = chunks.find((c) => c.type === "done");
      expect(doneChunk).toBeDefined();
      expect(doneChunk?.data.success).toBe(true);
      expect(doneChunk?.data.summary).toContain("整理完成");
    });

    it("should handle empty bookmarks gracefully", async () => {
      // 设置空数据
      mockFetchBookmarksResult = [];

      const context = createContext();
      const chunks = await collectChunks(skill.executeStream(context));

      // 验证正常完成
      const doneChunk = chunks.find((c) => c.type === "done");
      expect(doneChunk).toBeDefined();
      expect(doneChunk?.data.success).toBe(true);

      // 验证文本提示没有书签
      const textChunks = chunks.filter((c) => c.type === "text");
      const allText = textChunks.map((c) => c.data.text || "").join("");
      expect(allText).toContain("没有找到需要整理的书签");
    });

    it("should emit suggestions when applicable", async () => {
      const context = createContext();
      const chunks = await collectChunks(skill.executeStream(context));

      const suggestionsChunk = chunks.find((c) => c.type === "suggestions");
      expect(suggestionsChunk).toBeDefined();
      expect(Array.isArray(suggestionsChunk?.data.suggestions)).toBe(true);
    });

    it("should include categorization suggestions in output", async () => {
      const context = createContext({ actions: ["auto-categorize"] });
      const chunks = await collectChunks(skill.executeStream(context));

      // 验证文本块包含分类建议
      const textChunks = chunks.filter((c) => c.type === "text");
      const allText = textChunks.map((c) => c.data.text || "").join("");
      expect(allText).toContain("智能分类建议");
    });

    it("should include tag suggestions in output", async () => {
      const context = createContext({ actions: ["auto-tag"] });
      const chunks = await collectChunks(skill.executeStream(context));

      // 验证文本块包含标签建议
      const textChunks = chunks.filter((c) => c.type === "text");
      const allText = textChunks.map((c) => c.data.text || "").join("");
      expect(allText).toContain("智能标签建议");
    });

    it("should handle duplicate detection action", async () => {
      const context = createContext({ actions: ["clean-duplicates"] });
      const chunks = await collectChunks(skill.executeStream(context));

      // 验证文本块包含重复检测
      const textChunks = chunks.filter((c) => c.type === "text");
      const allText = textChunks.map((c) => c.data.text || "").join("");
      expect(allText).toContain("重复书签检测");
    });

    it("should include stats in deliverable content", async () => {
      const context = createContext();
      const chunks = await collectChunks(skill.executeStream(context));

      const deliverableChunk = chunks.find((c) => c.type === "deliverable");
      expect(deliverableChunk).toBeDefined();

      const output = deliverableChunk?.data.content as {
        stats?: { totalProcessed?: number };
      };
      expect(output).toBeDefined();
      expect(output?.stats?.totalProcessed).toBeDefined();
    });
  });
});

describe("ORGANIZE_ACTION_CONFIG", () => {
  it("should have all required actions", () => {
    const actions: OrganizeAction[] = [
      "auto-categorize",
      "auto-tag",
      "clean-duplicates",
      "archive-old",
      "validate-urls",
    ];
    actions.forEach((action) => {
      expect(ORGANIZE_ACTION_CONFIG[action]).toBeDefined();
      expect(ORGANIZE_ACTION_CONFIG[action].name).toBeDefined();
      expect(ORGANIZE_ACTION_CONFIG[action].description).toBeDefined();
    });
  });

  it("should have icons for each action", () => {
    const actions: OrganizeAction[] = [
      "auto-categorize",
      "auto-tag",
      "clean-duplicates",
      "archive-old",
      "validate-urls",
    ];
    actions.forEach((action) => {
      expect(ORGANIZE_ACTION_CONFIG[action].icon).toBeDefined();
    });
  });
});

describe("DEFAULT_ORGANIZE_CONFIG", () => {
  it("should have required fields", () => {
    expect(DEFAULT_ORGANIZE_CONFIG.requireConfirmation).toBeDefined();
    expect(DEFAULT_ORGANIZE_CONFIG.autoExecute).toBeDefined();
    expect(DEFAULT_ORGANIZE_CONFIG.scope).toBeDefined();
  });
});
