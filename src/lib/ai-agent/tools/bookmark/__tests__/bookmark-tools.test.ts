/**
 * Bookmark Tools 单元测试
 *
 * 测试书签 CRUD 操作工具
 *
 * @version 1.0.0
 * @since 2026-01-01
 */

import { toggleBookmarkReadTool } from "../toggle-bookmark-read.tool";
import { toggleBookmarkStarredTool } from "../toggle-bookmark-starred.tool";
import { deleteBookmarkTool } from "../delete-bookmark.tool";
import { createBookmarkTool } from "../create-bookmark.tool";
import { updateBookmarkTool } from "../update-bookmark.tool";
import { batchDeleteBookmarksTool } from "../batch-delete-bookmarks.tool";
import { createSnapshotTool } from "../create-snapshot.tool";
import { createClient } from "@/lib/supabase/server";
import type { ToolContext } from "../../types";

// Mock 书签数据
const mockBookmark = {
  id: 1,
  title: "Test Bookmark",
  url: "https://example.com/test",
  is_read: false,
  is_starred: false,
  folder_id: null,
};

const _mockFolder = {
  id: 1,
  name: "Test Folder",
};

// Mock 结果存储
let mockSelectResult: { data: unknown; error: unknown } = {
  data: mockBookmark,
  error: null,
};
let mockUpdateResult: { error: unknown } = { error: null };
let mockInsertResult: { data: unknown; error: unknown } = {
  data: mockBookmark,
  error: null,
};
let mockDeleteResult: { error: unknown } = { error: null };

// Mock Supabase client
jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(() =>
    Promise.resolve({
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            eq: jest.fn(() => ({
              is: jest.fn(() => ({
                single: jest.fn(() => Promise.resolve(mockSelectResult)),
                in: jest.fn(() => Promise.resolve(mockSelectResult)),
              })),
              single: jest.fn(() => Promise.resolve(mockSelectResult)),
              in: jest.fn(() => Promise.resolve(mockSelectResult)),
            })),
            is: jest.fn(() => ({
              single: jest.fn(() => Promise.resolve(mockSelectResult)),
            })),
            single: jest.fn(() => Promise.resolve(mockSelectResult)),
          })),
          in: jest.fn(() =>
            Promise.resolve({ data: [mockBookmark], error: null }),
          ),
        })),
        update: jest.fn(() => ({
          eq: jest.fn(() => ({
            eq: jest.fn(() => Promise.resolve(mockUpdateResult)),
          })),
          in: jest.fn(() => ({
            eq: jest.fn(() => Promise.resolve(mockUpdateResult)),
          })),
        })),
        insert: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn(() => Promise.resolve(mockInsertResult)),
          })),
        })),
        delete: jest.fn(() => ({
          eq: jest.fn(() => ({
            eq: jest.fn(() => Promise.resolve(mockDeleteResult)),
          })),
        })),
      })),
    }),
  ),
}));

// Mock snapshot service
jest.mock("@/lib/snapshot/snapshot.service", () => ({
  snapshotService: {
    canCreateSnapshot: jest.fn(() => Promise.resolve(true)),
    getActiveSnapshot: jest.fn(() => Promise.resolve(null)),
    createSnapshot: jest.fn(() =>
      Promise.resolve({
        snapshotId: 1,
        jobId: "job-123",
        estimatedWaitTime: 30,
      }),
    ),
  },
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

describe("Bookmark Tools", () => {
  const mockContext: ToolContext = {
    userId: "test-user-id",
    conversationId: "test-session",
  };

  beforeEach(() => {
    mockSelectResult = { data: mockBookmark, error: null };
    mockUpdateResult = { error: null };
    mockInsertResult = { data: mockBookmark, error: null };
    mockDeleteResult = { error: null };
    jest.clearAllMocks();
  });

  // ============================================
  // toggleBookmarkReadTool Tests
  // ============================================
  describe("toggleBookmarkReadTool", () => {
    describe("definition", () => {
      it("should have correct tool name", () => {
        expect(toggleBookmarkReadTool.definition.name).toBe(
          "toggle_bookmark_read",
        );
      });

      it("should be in action category", () => {
        expect(toggleBookmarkReadTool.definition.category).toBe("action");
      });

      it("should not require confirmation", () => {
        expect(toggleBookmarkReadTool.definition.requiresConfirmation).toBe(
          false,
        );
      });
    });

    describe("execute", () => {
      it("should toggle read status from false to true", async () => {
        mockSelectResult = {
          data: { ...mockBookmark, is_read: false },
          error: null,
        };

        const result = await toggleBookmarkReadTool.execute(
          { bookmarkId: 1 },
          mockContext,
        );

        expect(result.success).toBe(true);
        if (!result.success) return;
        expect(result.data.isRead).toBe(true);
      });

      it("should toggle read status from true to false", async () => {
        mockSelectResult = {
          data: { ...mockBookmark, is_read: true },
          error: null,
        };

        const result = await toggleBookmarkReadTool.execute(
          { bookmarkId: 1 },
          mockContext,
        );

        expect(result.success).toBe(true);
        if (!result.success) return;
        expect(result.data.isRead).toBe(false);
      });

      it("should set explicit read status when provided", async () => {
        mockSelectResult = {
          data: { ...mockBookmark, is_read: false },
          error: null,
        };

        const result = await toggleBookmarkReadTool.execute(
          { bookmarkId: 1, isRead: true },
          mockContext,
        );

        expect(result.success).toBe(true);
        if (!result.success) return;
        expect(result.data.isRead).toBe(true);
      });

      it("should return success if already in target state", async () => {
        mockSelectResult = {
          data: { ...mockBookmark, is_read: true },
          error: null,
        };

        const result = await toggleBookmarkReadTool.execute(
          { bookmarkId: 1, isRead: true },
          mockContext,
        );

        expect(result.success).toBe(true);
        if (!result.success) return;
        expect(result.data.message).toContain("已是");
      });

      it("should return error if bookmark not found", async () => {
        mockSelectResult = { data: null, error: { message: "Not found" } };

        const result = await toggleBookmarkReadTool.execute(
          { bookmarkId: 999 },
          mockContext,
        );

        expect(result.success).toBe(false);
        if (result.success) return;
        expect(result.errorCode).toBe("NOT_FOUND");
      });

      it("should return error on update failure", async () => {
        mockUpdateResult = { error: { message: "Update failed" } };

        const result = await toggleBookmarkReadTool.execute(
          { bookmarkId: 1 },
          mockContext,
        );

        expect(result.success).toBe(false);
        if (result.success) return;
        expect(result.errorCode).toBe("EXECUTION_ERROR");
      });
    });
  });

  // ============================================
  // toggleBookmarkStarredTool Tests
  // ============================================
  describe("toggleBookmarkStarredTool", () => {
    describe("definition", () => {
      it("should have correct tool name", () => {
        expect(toggleBookmarkStarredTool.definition.name).toBe(
          "toggle_bookmark_starred",
        );
      });
    });

    describe("execute", () => {
      it("should toggle starred status", async () => {
        mockSelectResult = {
          data: { ...mockBookmark, is_starred: false },
          error: null,
        };

        const result = await toggleBookmarkStarredTool.execute(
          { bookmarkId: 1 },
          mockContext,
        );

        expect(result.success).toBe(true);
        if (!result.success) return;
        expect(result.data.isStarred).toBe(true);
      });

      it("should return error if bookmark not found", async () => {
        mockSelectResult = { data: null, error: { message: "Not found" } };

        const result = await toggleBookmarkStarredTool.execute(
          { bookmarkId: 999 },
          mockContext,
        );

        expect(result.success).toBe(false);
      });
    });
  });

  // ============================================
  // createBookmarkTool Tests
  // ============================================
  describe("createBookmarkTool", () => {
    describe("definition", () => {
      it("should have correct tool name", () => {
        expect(createBookmarkTool.definition.name).toBe("create_bookmark");
      });
    });

    describe("execute", () => {
      it("should create bookmark with URL only", async () => {
        mockSelectResult = { data: null, error: null }; // No duplicate
        mockInsertResult = { data: { ...mockBookmark, id: 2 }, error: null };

        const result = await createBookmarkTool.execute(
          { url: "https://example.com/new", isStarred: false },
          mockContext,
        );

        expect(result.success).toBe(true);
        if (!result.success) return;
        expect(result.data.url).toBeDefined();
      });

      it("should create bookmark with full data", async () => {
        // Need table-aware mock: bookmarks query returns null (no duplicate),
        // folders query returns folder data
        const mockInsertData = {
          id: 2,
          title: "New Bookmark",
          url: "https://example.com/new",
          folder_id: 1,
        };

        const makeSingleChain = (result: {
          data: unknown;
          error: unknown;
        }) => ({
          single: jest.fn(() => Promise.resolve(result)),
        });

        const mockedCreateClient = jest.mocked(createClient);
        mockedCreateClient.mockResolvedValueOnce({
          from: jest.fn((table: string) => {
            if (table === "bookmarks") {
              return {
                select: jest.fn(() => ({
                  eq: jest.fn(() => ({
                    eq: jest.fn(() => ({
                      is: jest.fn(() =>
                        makeSingleChain({ data: null, error: null }),
                      ),
                    })),
                  })),
                })),
                insert: jest.fn(() => ({
                  select: jest.fn(() =>
                    makeSingleChain({ data: mockInsertData, error: null }),
                  ),
                })),
              };
            }
            if (table === "folders") {
              return {
                select: jest.fn(() => ({
                  eq: jest.fn(() => ({
                    eq: jest.fn(() => ({
                      is: jest.fn(() =>
                        makeSingleChain({
                          data: { id: 1, name: "Test Folder" },
                          error: null,
                        }),
                      ),
                    })),
                  })),
                })),
              };
            }
            return {};
          }),
        } as never);

        const result = await createBookmarkTool.execute(
          {
            url: "https://example.com/new",
            isStarred: false,
            title: "New Bookmark",
            description: "Test description",
            folderId: 1,
            tags: ["test"],
          },
          mockContext,
        );

        expect(result.success).toBe(true);
        if (!result.success) return;
        expect(result.data.folderId).toBe(1);
        expect(result.data.folderName).toBe("Test Folder");
      });

      it("should detect duplicate URL", async () => {
        mockSelectResult = { data: { id: 1, title: "Existing" }, error: null };

        const result = await createBookmarkTool.execute(
          { url: "https://example.com/existing", isStarred: false },
          mockContext,
        );

        expect(result.success).toBe(false);
        if (result.success) return;
        expect(result.errorCode).toBe("DUPLICATE_URL");
      });

      it("should detect platform from URL", async () => {
        mockSelectResult = { data: null, error: null };
        mockInsertResult = { data: { ...mockBookmark, id: 2 }, error: null };

        const result = await createBookmarkTool.execute(
          { url: "https://mp.weixin.qq.com/s/abc123", isStarred: false },
          mockContext,
        );

        expect(result.success).toBe(true);
        if (!result.success) return;
        expect(result.data.platform).toBe("wechat");
      });

      it("should return error if folder not found", async () => {
        mockSelectResult = { data: null, error: null };

        const result = await createBookmarkTool.execute(
          { url: "https://example.com/new", isStarred: false, folderId: 999 },
          mockContext,
        );

        expect(result.success).toBe(false);
        if (result.success) return;
        expect(result.errorCode).toBe("FOLDER_NOT_FOUND");
      });
    });
  });

  // ============================================
  // updateBookmarkTool Tests
  // ============================================
  describe("updateBookmarkTool", () => {
    describe("definition", () => {
      it("should have correct tool name", () => {
        expect(updateBookmarkTool.definition.name).toBe("update_bookmark");
      });
    });

    describe("execute", () => {
      it("should update bookmark title", async () => {
        const result = await updateBookmarkTool.execute(
          { bookmarkId: 1, title: "Updated Title" },
          mockContext,
        );

        expect(result.success).toBe(true);
      });

      it("should update multiple fields", async () => {
        const result = await updateBookmarkTool.execute(
          {
            bookmarkId: 1,
            title: "Updated Title",
            description: "Updated description",
            tags: ["new-tag"],
          },
          mockContext,
        );

        expect(result.success).toBe(true);
      });

      it("should return error if bookmark not found", async () => {
        mockSelectResult = { data: null, error: { message: "Not found" } };

        const result = await updateBookmarkTool.execute(
          { bookmarkId: 999, title: "Test" },
          mockContext,
        );

        expect(result.success).toBe(false);
      });
    });
  });

  // ============================================
  // deleteBookmarkTool Tests
  // ============================================
  describe("deleteBookmarkTool", () => {
    describe("definition", () => {
      it("should have correct tool name", () => {
        expect(deleteBookmarkTool.definition.name).toBe("delete_bookmark");
      });

      it("should require confirmation", () => {
        expect(deleteBookmarkTool.definition.requiresConfirmation).toBe(true);
      });
    });

    describe("execute", () => {
      it("should soft delete bookmark", async () => {
        const result = await deleteBookmarkTool.execute(
          { bookmarkId: 1, permanent: false },
          mockContext,
        );

        expect(result.success).toBe(true);
      });

      it("should return error if bookmark not found", async () => {
        mockSelectResult = { data: null, error: { message: "Not found" } };

        const result = await deleteBookmarkTool.execute(
          { bookmarkId: 999, permanent: false },
          mockContext,
        );

        expect(result.success).toBe(false);
      });
    });
  });

  // ============================================
  // batchDeleteBookmarksTool Tests
  // ============================================
  describe("batchDeleteBookmarksTool", () => {
    describe("definition", () => {
      it("should have correct tool name", () => {
        expect(batchDeleteBookmarksTool.definition.name).toBe(
          "batch_delete_bookmarks",
        );
      });

      it("should require confirmation", () => {
        expect(batchDeleteBookmarksTool.definition.requiresConfirmation).toBe(
          true,
        );
      });
    });

    describe("execute", () => {
      it("should batch delete bookmarks", async () => {
        // Provide confirmed: true to skip confirmation flow
        const confirmedContext: ToolContext = {
          ...mockContext,
          confirmed: true,
        };

        // Mock: select→in→eq→is returns bookmark list, update→in→eq returns success
        const mockedCreateClient = jest.mocked(createClient);
        mockedCreateClient.mockResolvedValueOnce({
          from: jest.fn(() => ({
            select: jest.fn(() => ({
              in: jest.fn(() => ({
                eq: jest.fn(() => ({
                  is: jest.fn(() =>
                    Promise.resolve({
                      data: [
                        { id: 1, title: "B1" },
                        { id: 2, title: "B2" },
                        { id: 3, title: "B3" },
                      ],
                      error: null,
                    }),
                  ),
                })),
              })),
            })),
            update: jest.fn(() => ({
              in: jest.fn(() => ({
                eq: jest.fn(() => Promise.resolve({ error: null, count: 3 })),
              })),
            })),
          })),
        } as never);

        const result = await batchDeleteBookmarksTool.execute(
          { bookmarkIds: [1, 2, 3], permanent: false },
          confirmedContext,
        );

        expect(result.success).toBe(true);
        if (!result.success) return;
        expect(result.data.deletedCount).toBe(3);
      });

      it("should have valid parameters schema", () => {
        expect(batchDeleteBookmarksTool.definition.parameters).toBeDefined();
      });

      it("should handle empty array", async () => {
        const result = await batchDeleteBookmarksTool.execute(
          { bookmarkIds: [], permanent: false },
          mockContext,
        );

        expect(result.success).toBe(false);
      });
    });
  });

  // ============================================
  // createSnapshotTool Tests
  // ============================================
  describe("createSnapshotTool", () => {
    describe("definition", () => {
      it("should have correct tool name", () => {
        expect(createSnapshotTool.definition.name).toBe("create_snapshot");
      });
    });

    describe("execute", () => {
      it("should create snapshot for bookmark", async () => {
        // Supabase mock returns bookmark data for ownership check
        mockSelectResult = {
          data: {
            id: 1,
            title: "Test Bookmark",
            url: "https://example.com/test",
          },
          error: null,
        };

        const result = await createSnapshotTool.execute(
          { bookmarkId: 1, snapshotType: "basic", priority: "normal" },
          mockContext,
        );

        expect(result.success).toBe(true);
        if (!result.success) return;
        expect(result.data.snapshotId).toBe(1);
        expect(result.data.jobId).toBe("job-123");
        expect(result.data.status).toBe("pending");
      });

      it("should have valid parameters schema", () => {
        expect(createSnapshotTool.definition.parameters).toBeDefined();
      });

      it("should return error if bookmark not found", async () => {
        mockSelectResult = { data: null, error: { message: "Not found" } };

        const result = await createSnapshotTool.execute(
          { bookmarkId: 999, snapshotType: "basic", priority: "normal" },
          mockContext,
        );

        expect(result.success).toBe(false);
      });
    });
  });
});
