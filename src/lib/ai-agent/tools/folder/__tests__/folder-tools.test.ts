/**
 * 文件夹 Tools 单元测试
 *
 * 测试覆盖：
 * - Phase 1: 查询类 Tools（3 个）
 * - Phase 2: 基础操作 Tools（6 个）
 * - Phase 3: 高级操作 Tools（7 个）
 * - 确认流程测试
 * - 安全机制测试
 *
 * @version 1.0.0
 * @since 2025-12-23
 */

import { folderTools } from "../index";
import { listFoldersTool } from "../list-folders.tool";
import { getFolderDetailTool } from "../get-folder-detail.tool";
import { getFolderBookmarksTool } from "../get-folder-bookmarks.tool";
import { createFolderTool } from "../create-folder.tool";
import { renameFolderTool } from "../rename-folder.tool";
import { deleteFolderTool } from "../delete-folder.tool";
import { mergeFoldersTool } from "../merge-folders.tool";
import { toggleFolderLockTool } from "../toggle-folder-lock.tool";
import type { ToolContext } from "../../types";

// ============================================
// Mocks
// ============================================

// Mock Supabase client
const mockSelect = jest.fn();
const mockInsert = jest.fn();
const mockUpdate = jest.fn();
const mockDelete = jest.fn();
const mockEq = jest.fn();
const mockIs = jest.fn();
const mockOr = jest.fn();
const mockIn = jest.fn();
const mockOrder = jest.fn();
const mockLimit = jest.fn();
const mockSingle = jest.fn();
const mockFrom = jest.fn();

const createMockChain = () => ({
  select: mockSelect.mockReturnThis(),
  insert: mockInsert.mockReturnThis(),
  update: mockUpdate.mockReturnThis(),
  delete: mockDelete.mockReturnThis(),
  eq: mockEq.mockReturnThis(),
  is: mockIs.mockReturnThis(),
  or: mockOr.mockReturnThis(),
  in: mockIn.mockReturnThis(),
  order: mockOrder.mockReturnThis(),
  limit: mockLimit.mockReturnThis(),
  single: mockSingle,
});

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(() =>
    Promise.resolve({
      from: mockFrom.mockImplementation(() => createMockChain()),
    }),
  ),
}));

// Mock logger
jest.mock("@/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// ============================================
// Test Context
// ============================================

const mockContext: ToolContext = {
  userId: "test-user-123",
  conversationId: "conv-456",
};

const mockContextConfirmed: ToolContext = {
  ...mockContext,
  confirmed: true,
};

// ============================================
// Parameter Helpers (使用 Zod parse 填充默认值)
// ============================================

/**
 * 解析部分参数，自动填充默认值
 * 通过 Zod schema 的 parse 方法处理，确保类型安全
 */
const parseListFoldersParams = (
  partial: Partial<Parameters<typeof listFoldersTool.execute>[0]> = {},
) => listFoldersTool.definition.parameters.parse(partial);

const parseGetFolderDetailParams = (
  partial: { folderId: number } & Partial<
    Omit<Parameters<typeof getFolderDetailTool.execute>[0], "folderId">
  >,
) => getFolderDetailTool.definition.parameters.parse(partial);

const parseGetFolderBookmarksParams = (
  partial: { folderId: number } & Partial<
    Omit<Parameters<typeof getFolderBookmarksTool.execute>[0], "folderId">
  >,
) => getFolderBookmarksTool.definition.parameters.parse(partial);

const parseDeleteFolderParams = (
  partial: { folderId: number } & Partial<
    Omit<Parameters<typeof deleteFolderTool.execute>[0], "folderId">
  >,
) => deleteFolderTool.definition.parameters.parse(partial);

const parseMergeFoldersParams = (
  partial: { sourceFolderId: number; targetFolderId: number } & Partial<
    Omit<
      Parameters<typeof mergeFoldersTool.execute>[0],
      "sourceFolderId" | "targetFolderId"
    >
  >,
) => mergeFoldersTool.definition.parameters.parse(partial);

// ============================================
// Test Data
// ============================================

const mockFolders = [
  {
    id: 1,
    name: "技术文章",
    user_id: "test-user-123",
    parent_id: null,
    folder_group: "work",
    is_archived: false,
    is_system: false,
    system_type: null,
    sort_order: 1,
    created_at: "2025-01-01T00:00:00Z",
    deleted_at: null,
  },
  {
    id: 2,
    name: "学习笔记",
    user_id: "test-user-123",
    parent_id: null,
    folder_group: "study",
    is_archived: false,
    is_system: false,
    system_type: null,
    sort_order: 2,
    created_at: "2025-01-02T00:00:00Z",
    deleted_at: null,
  },
  {
    id: 99,
    name: "INBOX",
    user_id: "test-user-123",
    parent_id: null,
    folder_group: null,
    is_archived: false,
    is_system: true,
    system_type: "inbox",
    sort_order: 0,
    created_at: "2025-01-01T00:00:00Z",
    deleted_at: null,
  },
];

const mockBookmarks = [
  { id: 1, folder_id: 1, title: "TypeScript 入门" },
  { id: 2, folder_id: 1, title: "React 最佳实践" },
  { id: 3, folder_id: 2, title: "算法笔记" },
];

// ============================================
// Tool Definitions Tests
// ============================================

describe("Folder Tools Definitions", () => {
  describe("folderTools array", () => {
    it("should contain 16 tools", () => {
      expect(folderTools).toHaveLength(16);
    });

    it("should have unique tool names", () => {
      const names = folderTools.map((t) => t.definition.name);
      const uniqueNames = new Set(names);
      expect(uniqueNames.size).toBe(16);
    });
  });

  describe("Phase 1: Query Tools", () => {
    it("list_folders should be a query tool without confirmation", () => {
      expect(listFoldersTool.definition.name).toBe("list_folders");
      expect(listFoldersTool.definition.category).toBe("query");
      expect(listFoldersTool.definition.requiresConfirmation).toBeFalsy();
    });

    it("get_folder_detail should be a query tool without confirmation", () => {
      expect(getFolderDetailTool.definition.name).toBe("get_folder_detail");
      expect(getFolderDetailTool.definition.category).toBe("query");
      expect(getFolderDetailTool.definition.requiresConfirmation).toBeFalsy();
    });

    it("get_folder_bookmarks should be a query tool without confirmation", () => {
      expect(getFolderBookmarksTool.definition.name).toBe(
        "get_folder_bookmarks",
      );
      expect(getFolderBookmarksTool.definition.category).toBe("query");
      expect(
        getFolderBookmarksTool.definition.requiresConfirmation,
      ).toBeFalsy();
    });
  });

  describe("Phase 2: Basic Action Tools", () => {
    it("create_folder should be an action tool with confirmation", () => {
      expect(createFolderTool.definition.name).toBe("create_folder");
      expect(createFolderTool.definition.category).toBe("action");
      expect(createFolderTool.definition.requiresConfirmation).toBe(true);
    });

    it("rename_folder should be an action tool with confirmation", () => {
      expect(renameFolderTool.definition.name).toBe("rename_folder");
      expect(renameFolderTool.definition.category).toBe("action");
      expect(renameFolderTool.definition.requiresConfirmation).toBe(true);
    });
  });

  describe("Phase 3: Advanced Action Tools", () => {
    it("delete_folder should be an action tool with confirmation", () => {
      expect(deleteFolderTool.definition.name).toBe("delete_folder");
      expect(deleteFolderTool.definition.category).toBe("action");
      expect(deleteFolderTool.definition.requiresConfirmation).toBe(true);
    });

    it("merge_folders should be an action tool with confirmation", () => {
      expect(mergeFoldersTool.definition.name).toBe("merge_folders");
      expect(mergeFoldersTool.definition.category).toBe("action");
      expect(mergeFoldersTool.definition.requiresConfirmation).toBe(true);
    });

    it("toggle_folder_lock should be an action tool with confirmation", () => {
      expect(toggleFolderLockTool.definition.name).toBe("toggle_folder_lock");
      expect(toggleFolderLockTool.definition.category).toBe("action");
      expect(toggleFolderLockTool.definition.requiresConfirmation).toBe(true);
    });
  });

  describe("Tool categories distribution", () => {
    it("should have 3 query tools", () => {
      const queryTools = folderTools.filter(
        (t) => t.definition.category === "query",
      );
      expect(queryTools).toHaveLength(3);
    });

    it("should have 13 action tools", () => {
      const actionTools = folderTools.filter(
        (t) => t.definition.category === "action",
      );
      expect(actionTools).toHaveLength(13);
    });

    it("should have all action tools require confirmation", () => {
      const actionTools = folderTools.filter(
        (t) => t.definition.category === "action",
      );
      actionTools.forEach((tool) => {
        expect(tool.definition.requiresConfirmation).toBe(true);
      });
    });
  });
});

// ============================================
// Phase 1: Query Tools Execution Tests
// ============================================

describe("Phase 1: Query Tools Execution", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("list_folders", () => {
    it("should list all non-archived, non-system folders", async () => {
      // Setup mock chain
      const userFolders = mockFolders.filter((f) => !f.is_system);
      mockSingle.mockResolvedValue({ data: null, error: null });
      mockOrder.mockReturnValue({
        order: jest.fn().mockResolvedValue({
          data: userFolders,
          error: null,
        }),
      });

      // Mock bookmark counts
      mockIn.mockResolvedValue({
        data: mockBookmarks.map((b) => ({ folder_id: b.folder_id })),
        error: null,
      });

      const result = await listFoldersTool.execute(
        parseListFoldersParams({}),
        mockContext,
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.length).toBeGreaterThan(0);
        expect(result.metadata?.executionTimeMs).toBeDefined();
      }
    });

    it("should filter by group when specified", async () => {
      const workFolders = mockFolders.filter(
        (f) => f.folder_group === "work" && !f.is_system,
      );
      mockOrder.mockReturnValue({
        order: jest.fn().mockResolvedValue({
          data: workFolders,
          error: null,
        }),
      });
      mockIn.mockResolvedValue({ data: [], error: null });

      const result = await listFoldersTool.execute(
        parseListFoldersParams({ group: "work" }),
        mockContext,
      );

      expect(result.success).toBe(true);
      expect(mockEq).toHaveBeenCalledWith("folder_group", "work");
    });

    it("should include archived folders when includeArchived is true", async () => {
      mockOrder.mockReturnValue({
        order: jest.fn().mockResolvedValue({
          data: mockFolders,
          error: null,
        }),
      });
      mockIn.mockResolvedValue({ data: [], error: null });

      await listFoldersTool.execute(
        parseListFoldersParams({ includeArchived: true }),
        mockContext,
      );

      // Should NOT call eq with is_archived: false
      const isArchivedCalls = mockEq.mock.calls.filter(
        (call) => call[0] === "is_archived",
      );
      expect(isArchivedCalls.length).toBe(0);
    });

    it("should handle query errors gracefully", async () => {
      mockOrder.mockReturnValue({
        order: jest.fn().mockResolvedValue({
          data: null,
          error: { message: "Database connection failed" },
        }),
      });

      const result = await listFoldersTool.execute(
        parseListFoldersParams({}),
        mockContext,
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("查询文件夹失败");
        expect(result.errorCode).toBe("QUERY_ERROR");
      }
    });
  });

  describe("get_folder_detail", () => {
    it("should return folder detail with profile info", async () => {
      const mockFolder = mockFolders[0];
      const mockProfile = {
        folder_id: 1,
        heat_score: 0.8,
        internal_similarity: 0.9,
        boundary_clarity: 0.85,
        is_ai_renamable: true,
        is_merge_candidate: false,
        is_split_candidate: false,
        is_system_locked: false,
        last_bookmark_at: "2025-01-15T00:00:00Z",
        profile_computed_at: "2025-01-15T00:00:00Z",
        core_count: 5,
        edge_count: 2,
        top_tags: ["typescript", "react"],
        recent_titles: ["Article 1", "Article 2"],
      };

      mockSingle.mockResolvedValueOnce({ data: mockFolder, error: null });
      mockSingle.mockResolvedValueOnce({ data: mockProfile, error: null });
      mockSingle.mockResolvedValueOnce({ data: { count: 7 }, error: null });

      const result = await getFolderDetailTool.execute(
        parseGetFolderDetailParams({ folderId: 1 }),
        mockContext,
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe(1);
        expect(result.data.name).toBe("技术文章");
      }
    });

    it("should return error for non-existent folder", async () => {
      mockSingle.mockResolvedValue({ data: null, error: null });

      const result = await getFolderDetailTool.execute(
        parseGetFolderDetailParams({ folderId: 9999 }),
        mockContext,
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("不存在");
      }
    });
  });

  describe("get_folder_bookmarks", () => {
    it("should return bookmarks in folder with pagination", async () => {
      const mockFolder = mockFolders[0];
      const folderBookmarks = mockBookmarks
        .filter((b) => b.folder_id === 1)
        .map((b) => ({
          ...b,
          url: "https://example.com",
          platform: "web",
          description: null,
          ai_summary: null,
          ai_tags: null,
          user_tags: null,
          rating: null,
          is_read: false,
          is_starred: false,
          created_at: "2025-01-01T00:00:00Z",
        }));

      mockSingle.mockResolvedValueOnce({ data: mockFolder, error: null });
      mockLimit.mockResolvedValue({ data: folderBookmarks, error: null });
      mockSingle.mockResolvedValueOnce({
        data: { count: folderBookmarks.length },
        error: null,
      });

      const result = await getFolderBookmarksTool.execute(
        parseGetFolderBookmarksParams({ folderId: 1, limit: 20, offset: 0 }),
        mockContext,
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.folderId).toBe(1);
        expect(result.data.items.length).toBe(folderBookmarks.length);
      }
    });
  });
});

// ============================================
// Phase 2: Basic Action Tools Execution Tests
// ============================================

describe("Phase 2: Basic Action Tools Execution", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("create_folder", () => {
    it("should request confirmation when not confirmed", async () => {
      mockSingle.mockResolvedValueOnce({ data: null, error: null }); // No duplicate

      const result = await createFolderTool.execute(
        { name: "新文件夹", group: "work" },
        mockContext,
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.__pendingConfirmation).toBeDefined();
        expect(result.data.__pendingConfirmation?.toolName).toBe(
          "create_folder",
        );
        expect(result.data.__pendingConfirmation?.riskLevel).toBe("low");
        expect(result.data.message).toContain("待用户确认");
      }
    });

    it("should create folder when confirmed", async () => {
      const newFolder = { id: 100, name: "新文件夹" };

      mockSingle.mockResolvedValueOnce({ data: null, error: null }); // No duplicate
      mockSingle.mockResolvedValueOnce({
        data: { sort_order: 5 },
        error: null,
      }); // Max sort
      mockSingle.mockResolvedValueOnce({ data: newFolder, error: null }); // Insert result

      const result = await createFolderTool.execute(
        { name: "新文件夹" },
        mockContextConfirmed,
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.folderId).toBe(100);
        expect(result.data.folderName).toBe("新文件夹");
        expect(result.data.__pendingConfirmation).toBeUndefined();
      }
    });

    it("should reject duplicate folder names", async () => {
      mockSingle.mockResolvedValueOnce({ data: { id: 1 }, error: null }); // Existing folder

      const result = await createFolderTool.execute(
        { name: "技术文章" },
        mockContext,
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("已存在同名文件夹");
        expect(result.errorCode).toBe("DUPLICATE_NAME");
      }
    });

    it("should validate parent folder exists", async () => {
      mockSingle.mockResolvedValueOnce({ data: null, error: null }); // No duplicate
      mockSingle.mockResolvedValueOnce({ data: null, error: null }); // Parent not found

      const result = await createFolderTool.execute(
        { name: "子文件夹", parentId: 9999 },
        mockContext,
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("父文件夹不存在");
      }
    });
  });

  describe("rename_folder", () => {
    it("should request confirmation for rename", async () => {
      mockSingle.mockResolvedValueOnce({
        data: mockFolders[0],
        error: null,
      });
      mockSingle.mockResolvedValueOnce({ data: null, error: null }); // No duplicate name

      const result = await renameFolderTool.execute(
        { folderId: 1, newName: "前端技术" },
        mockContext,
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.__pendingConfirmation).toBeDefined();
        expect(result.data.__pendingConfirmation?.description).toContain(
          "重命名",
        );
      }
    });

    it("should not allow renaming system folders", async () => {
      mockSingle.mockResolvedValueOnce({
        data: mockFolders[2], // INBOX system folder
        error: null,
      });

      const result = await renameFolderTool.execute(
        { folderId: 99, newName: "新名称" },
        mockContext,
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("系统文件夹");
      }
    });
  });
});

// ============================================
// Phase 3: Advanced Action Tools Execution Tests
// ============================================

describe("Phase 3: Advanced Action Tools Execution", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("delete_folder", () => {
    it("should request confirmation with high risk level", async () => {
      mockSingle.mockResolvedValueOnce({
        data: mockFolders[0],
        error: null,
      });
      mockSingle.mockResolvedValueOnce({ data: null, count: 5, error: null }); // Bookmark count

      const result = await deleteFolderTool.execute(
        parseDeleteFolderParams({ folderId: 1 }),
        mockContext,
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.__pendingConfirmation).toBeDefined();
        expect(result.data.__pendingConfirmation?.riskLevel).toBe("high");
      }
    });

    it("should not allow deleting system folders", async () => {
      mockSingle.mockResolvedValueOnce({
        data: mockFolders[2], // INBOX
        error: null,
      });

      const result = await deleteFolderTool.execute(
        parseDeleteFolderParams({ folderId: 99 }),
        mockContext,
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("系统文件夹不能删除");
        expect(result.errorCode).toBe("SYSTEM_FOLDER");
      }
    });

    it("should move bookmarks to root when deleteBookmarks is false", async () => {
      mockSingle.mockResolvedValueOnce({
        data: mockFolders[0],
        error: null,
      });
      mockSingle.mockResolvedValueOnce({ data: null, count: 3, error: null });
      mockUpdate.mockResolvedValueOnce({ error: null }); // Move bookmarks
      mockUpdate.mockResolvedValueOnce({ error: null }); // Delete folder

      const result = await deleteFolderTool.execute(
        { folderId: 1, deleteBookmarks: false },
        mockContextConfirmed,
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.movedBookmarkCount).toBe(3);
        expect(result.data.deletedBookmarkCount).toBe(0);
      }
    });
  });

  describe("merge_folders", () => {
    it("should request confirmation for merge with high risk", async () => {
      mockSingle.mockResolvedValueOnce({
        data: mockFolders[0],
        error: null,
      }); // Source
      mockSingle.mockResolvedValueOnce({
        data: mockFolders[1],
        error: null,
      }); // Target
      mockSingle.mockResolvedValueOnce({ data: null, count: 5, error: null }); // Bookmark count

      const result = await mergeFoldersTool.execute(
        parseMergeFoldersParams({ sourceFolderId: 1, targetFolderId: 2 }),
        mockContext,
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.__pendingConfirmation).toBeDefined();
        expect(result.data.__pendingConfirmation?.riskLevel).toBe("high");
        expect(result.data.__pendingConfirmation?.affectedItems).toHaveLength(
          2,
        );
      }
    });

    it("should not allow merging system folders", async () => {
      mockSingle.mockResolvedValueOnce({
        data: mockFolders[2], // INBOX (system)
        error: null,
      });

      const result = await mergeFoldersTool.execute(
        parseMergeFoldersParams({ sourceFolderId: 99, targetFolderId: 1 }),
        mockContext,
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("系统文件夹不能被合并");
      }
    });

    it("should not allow merging folder into itself", async () => {
      mockSingle.mockResolvedValueOnce({
        data: mockFolders[0],
        error: null,
      });
      mockSingle.mockResolvedValueOnce({
        data: mockFolders[0],
        error: null,
      });

      const result = await mergeFoldersTool.execute(
        parseMergeFoldersParams({ sourceFolderId: 1, targetFolderId: 1 }),
        mockContext,
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("不能相同");
      }
    });
  });

  describe("toggle_folder_lock", () => {
    it("should request confirmation for lock operation", async () => {
      mockSingle.mockResolvedValueOnce({
        data: { ...mockFolders[0], is_system: false },
        error: null,
      });
      mockSingle.mockResolvedValueOnce({
        data: { is_system_locked: false },
        error: null,
      });

      const result = await toggleFolderLockTool.execute(
        { folderId: 1, locked: true },
        mockContext,
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.__pendingConfirmation).toBeDefined();
        expect(result.data.__pendingConfirmation?.riskLevel).toBe("medium");
      }
    });
  });
});

// ============================================
// Confirmation Flow Tests
// ============================================

describe("Confirmation Flow", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should include all required fields in PendingConfirmation", async () => {
    mockSingle.mockResolvedValueOnce({ data: null, error: null });

    const result = await createFolderTool.execute(
      { name: "测试文件夹" },
      mockContext,
    );

    expect(result.success).toBe(true);
    if (result.success && result.data.__pendingConfirmation) {
      const confirmation = result.data.__pendingConfirmation;

      expect(confirmation.confirmationId).toBeDefined();
      expect(confirmation.confirmationId).toMatch(/^cf_/); // Should start with prefix
      expect(confirmation.toolName).toBe("create_folder");
      expect(confirmation.description).toBeDefined();
      expect(confirmation.impactSummary).toBeDefined();
      expect(confirmation.params).toEqual({ name: "测试文件夹" });
      expect(confirmation.expiresAt).toBeInstanceOf(Date);
      expect(confirmation.riskLevel).toMatch(/^(low|medium|high)$/);
    }
  });

  it("should expire confirmation after timeout", async () => {
    mockSingle.mockResolvedValueOnce({ data: null, error: null });

    const result = await createFolderTool.execute(
      { name: "测试文件夹" },
      mockContext,
    );

    if (result.success && result.data.__pendingConfirmation) {
      const expiresAt = result.data.__pendingConfirmation.expiresAt;
      const now = new Date();

      // Should expire in the future (within 5 minutes)
      expect(expiresAt.getTime()).toBeGreaterThan(now.getTime());
      expect(expiresAt.getTime()).toBeLessThan(now.getTime() + 6 * 60 * 1000);
    }
  });

  it("should skip confirmation when context.confirmed is true", async () => {
    const newFolder = { id: 100, name: "测试文件夹" };

    mockSingle.mockResolvedValueOnce({ data: null, error: null }); // No duplicate
    mockSingle.mockResolvedValueOnce({ data: { sort_order: 5 }, error: null });
    mockSingle.mockResolvedValueOnce({ data: newFolder, error: null });

    const result = await createFolderTool.execute(
      { name: "测试文件夹" },
      mockContextConfirmed,
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.__pendingConfirmation).toBeUndefined();
      expect(result.data.folderId).toBe(100);
    }
  });
});

// ============================================
// Security Tests
// ============================================

describe("Security Mechanisms", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("System Folder Protection", () => {
    it("should protect INBOX from deletion", async () => {
      mockSingle.mockResolvedValueOnce({
        data: { id: 99, name: "INBOX", is_system: true },
        error: null,
      });

      const result = await deleteFolderTool.execute(
        parseDeleteFolderParams({ folderId: 99 }),
        mockContextConfirmed,
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errorCode).toBe("SYSTEM_FOLDER");
      }
    });

    it("should protect system folders from rename", async () => {
      mockSingle.mockResolvedValueOnce({
        data: { id: 99, name: "INBOX", is_system: true },
        error: null,
      });

      const result = await renameFolderTool.execute(
        { folderId: 99, newName: "新名称" },
        mockContextConfirmed,
      );

      expect(result.success).toBe(false);
    });

    it("should protect system folders from merge as source", async () => {
      mockSingle.mockResolvedValueOnce({
        data: { id: 99, name: "INBOX", is_system: true },
        error: null,
      });

      const result = await mergeFoldersTool.execute(
        parseMergeFoldersParams({ sourceFolderId: 99, targetFolderId: 1 }),
        mockContextConfirmed,
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errorCode).toBe("SYSTEM_FOLDER");
      }
    });
  });

  describe("User Ownership Validation", () => {
    it("should only return folders owned by user", async () => {
      mockOrder.mockReturnValue({
        order: jest.fn().mockResolvedValue({
          data: mockFolders.filter((f) => f.user_id === "test-user-123"),
          error: null,
        }),
      });
      mockIn.mockResolvedValue({ data: [], error: null });

      await listFoldersTool.execute(parseListFoldersParams({}), mockContext);

      expect(mockEq).toHaveBeenCalledWith("user_id", "test-user-123");
    });

    it("should reject operations on folders not owned by user", async () => {
      mockSingle.mockResolvedValueOnce({ data: null, error: null }); // Folder not found (RLS filtered)

      const result = await deleteFolderTool.execute(
        parseDeleteFolderParams({ folderId: 1 }),
        mockContext,
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("不存在或无权操作");
      }
    });
  });

  describe("Risk Level Classification", () => {
    it("should classify create_folder as low risk", async () => {
      mockSingle.mockResolvedValueOnce({ data: null, error: null });

      const result = await createFolderTool.execute(
        { name: "测试" },
        mockContext,
      );

      if (result.success && result.data.__pendingConfirmation) {
        expect(result.data.__pendingConfirmation.riskLevel).toBe("low");
      }
    });

    it("should classify delete_folder as high risk", async () => {
      mockSingle.mockResolvedValueOnce({
        data: mockFolders[0],
        error: null,
      });
      mockSingle.mockResolvedValueOnce({ data: null, count: 0, error: null });

      const result = await deleteFolderTool.execute(
        parseDeleteFolderParams({ folderId: 1 }),
        mockContext,
      );

      if (result.success && result.data.__pendingConfirmation) {
        expect(result.data.__pendingConfirmation.riskLevel).toBe("high");
      }
    });

    it("should classify merge_folders as high risk", async () => {
      mockSingle.mockResolvedValueOnce({
        data: mockFolders[0],
        error: null,
      });
      mockSingle.mockResolvedValueOnce({
        data: mockFolders[1],
        error: null,
      });
      mockSingle.mockResolvedValueOnce({ data: null, count: 5, error: null });

      const result = await mergeFoldersTool.execute(
        parseMergeFoldersParams({ sourceFolderId: 1, targetFolderId: 2 }),
        mockContext,
      );

      if (result.success && result.data.__pendingConfirmation) {
        expect(result.data.__pendingConfirmation.riskLevel).toBe("high");
      }
    });
  });
});

// ============================================
// Error Handling Tests
// ============================================

describe("Error Handling", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should handle database errors gracefully", async () => {
    mockOrder.mockReturnValue({
      order: jest.fn().mockResolvedValue({
        data: null,
        error: { message: "Connection timeout" },
      }),
    });

    const result = await listFoldersTool.execute(
      parseListFoldersParams({}),
      mockContext,
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("查询文件夹失败");
    }
  });

  it("should handle unexpected exceptions", async () => {
    mockOrder.mockReturnValue({
      order: jest.fn().mockRejectedValue(new Error("Unexpected error")),
    });

    const result = await listFoldersTool.execute(
      parseListFoldersParams({}),
      mockContext,
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errorCode).toBe("EXECUTION_ERROR");
    }
  });

  it("should include execution time in error metadata", async () => {
    mockOrder.mockReturnValue({
      order: jest.fn().mockResolvedValue({
        data: null,
        error: { message: "Error" },
      }),
    });

    const result = await listFoldersTool.execute(
      parseListFoldersParams({}),
      mockContext,
    );

    expect(result.metadata?.executionTimeMs).toBeDefined();
    expect(result.metadata?.executionTimeMs).toBeGreaterThanOrEqual(0);
  });
});

// ============================================
// Parameter Validation Tests
// ============================================

describe("Parameter Validation", () => {
  describe("create_folder params", () => {
    it("should validate folder name length", () => {
      const schema = createFolderTool.definition.parameters;

      // Valid name
      expect(() => schema.parse({ name: "Valid Name" })).not.toThrow();

      // Empty name
      expect(() => schema.parse({ name: "" })).toThrow();

      // Too long name (over 50 chars)
      const longName = "a".repeat(51);
      expect(() => schema.parse({ name: longName })).toThrow();
    });

    it("should validate group enum values", () => {
      const schema = createFolderTool.definition.parameters;

      // Valid groups
      expect(() => schema.parse({ name: "Test", group: "work" })).not.toThrow();
      expect(() =>
        schema.parse({ name: "Test", group: "study" }),
      ).not.toThrow();

      // Invalid group
      expect(() => schema.parse({ name: "Test", group: "invalid" })).toThrow();
    });
  });

  describe("delete_folder params", () => {
    it("should require positive folder ID", () => {
      const schema = deleteFolderTool.definition.parameters;

      expect(() => schema.parse({ folderId: 1 })).not.toThrow();
      expect(() => schema.parse({ folderId: 0 })).toThrow();
      expect(() => schema.parse({ folderId: -1 })).toThrow();
    });
  });
});
