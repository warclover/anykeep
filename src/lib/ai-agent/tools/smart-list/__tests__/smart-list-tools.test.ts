/**
 * Smart List Tools 单元测试
 *
 * 测试智能列表管理工具
 *
 * @version 1.0.0
 * @since 2026-01-01
 */

import { listSmartListsTool } from "../list-smart-lists.tool";
import { getSmartListItemsTool } from "../get-smart-list-items.tool";
import { getSmartListCountTool } from "../get-smart-list-count.tool";
import { toggleSmartListPinTool } from "../toggle-smart-list-pin.tool";
import { updateSmartListTool } from "../update-smart-list.tool";
import { deleteSmartListTool } from "../delete-smart-list.tool";
import { createSmartListTool } from "../create-smart-list.tool";
import type { ToolContext } from "../../types";

// Mock 数据
const mockSmartList = {
  id: 1,
  name: "未读技术文章",
  description: "筛选未读的技术类文章",
  icon: "📋",
  color: "default",
  filters: {},
  sort_by: "created_desc",
  view_mode: "inherit",
  is_pinned: false,
  is_preset: false,
  sort_order: 1,
  bookmark_count: 15,
  user_id: "test-user-id",
  deleted_at: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const mockBookmark = {
  id: 1,
  title: "React 性能优化",
  url: "https://example.com/react",
  platform: "juejin",
  description: "React performance tips",
  ai_summary: "Summary",
  ai_tags: ["react"],
  user_tags: ["frontend"],
  rating: 4,
  is_read: false,
  is_starred: false,
  created_at: new Date().toISOString(),
};

// ============================================
// Chainable mock builder for Supabase queries
// ============================================

// Per-call result control
// Queue-based: if queue has items, shift from queue; otherwise use default.
let smartListSelectDefault: { data: unknown; error: unknown } = {
  data: mockSmartList,
  error: null,
};
let smartListSelectQueue: { data: unknown; error: unknown }[] = [];
let smartListInsertResult: { data: unknown; error: unknown } = {
  data: { id: 1, name: "未读技术文章", filters: {} },
  error: null,
};
let bookmarkQueryResult: { data: unknown; error: unknown; count?: number } = {
  data: [mockBookmark],
  error: null,
  count: 15,
};

function getSmartListSelectResult(): { data: unknown; error: unknown } {
  if (smartListSelectQueue.length > 0) {
    return smartListSelectQueue.shift()!;
  }
  return smartListSelectDefault;
}

/**
 * Creates a chainable Proxy mock that supports arbitrary method chaining.
 * Accessing `.then` makes it resolve as a promise with the given result.
 * `.single()` also returns a promise directly.
 */
function createChainMock(
  result: () => { data: unknown; error: unknown; count?: number },
): unknown {
  const makeChain = (): unknown => {
    return new Proxy(
      {},
      {
        get(_target, prop) {
          if (prop === "then") {
            const r = result();
            return (
              resolve: (v: unknown) => void,
              reject: (e: unknown) => void,
            ) => Promise.resolve(r).then(resolve, reject);
          }
          if (prop === "single") {
            return jest.fn(() => Promise.resolve(result()));
          }
          // All other methods return a new chainable proxy
          return jest.fn((..._args: unknown[]) => makeChain());
        },
      },
    );
  };
  return makeChain();
}

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(() =>
    Promise.resolve({
      from: jest.fn((table: string) => {
        if (table === "smart_lists") {
          return {
            // SELECT path - fully chainable, resolves via queue or default
            select: jest.fn((..._args: unknown[]) =>
              createChainMock(() => getSmartListSelectResult()),
            ),
            // INSERT path
            insert: jest.fn(() => ({
              select: jest.fn(() => ({
                single: jest.fn(() => Promise.resolve(smartListInsertResult)),
              })),
            })),
            // UPDATE path - fully chainable, resolves to { error: null }
            update: jest.fn(() =>
              createChainMock(() => ({ data: null, error: null })),
            ),
            // DELETE path - fully chainable, resolves to { error: null }
            delete: jest.fn(() =>
              createChainMock(() => ({ data: null, error: null })),
            ),
          };
        }
        if (table === "bookmarks") {
          return createChainMock(() => bookmarkQueryResult);
        }
        return {
          select: jest.fn(() =>
            createChainMock(() => ({ data: [], error: null })),
          ),
        };
      }),
      rpc: jest.fn((funcName: string) => {
        if (funcName === "get_smart_list_count") {
          return Promise.resolve({ data: { count: 15 }, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      }),
    }),
  ),
}));

// Mock toSmartListClient for listSmartListsTool
jest.mock("@/types/smart-list", () => ({
  toSmartListClient: jest.fn((list: Record<string, unknown>) => ({
    id: list.id,
    name: list.name,
    icon: list.icon || "📋",
    color: list.color || "default",
    description: list.description || "",
    isPreset: list.is_preset || false,
    isPinned: list.is_pinned || false,
    bookmarkCount: list.bookmark_count || 0,
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

describe("Smart List Tools", () => {
  const mockContext: ToolContext = {
    userId: "test-user-id",
    conversationId: "test-session",
  };

  beforeEach(() => {
    smartListSelectDefault = { data: mockSmartList, error: null };
    smartListSelectQueue = [];
    smartListInsertResult = {
      data: { id: 1, name: "未读技术文章", filters: {} },
      error: null,
    };
    bookmarkQueryResult = {
      data: [mockBookmark],
      error: null,
      count: 15,
    };
    jest.clearAllMocks();
  });

  // ============================================
  // listSmartListsTool Tests
  // ============================================
  describe("listSmartListsTool", () => {
    describe("definition", () => {
      it("should have correct tool name", () => {
        expect(listSmartListsTool.definition.name).toBe("list_smart_lists");
      });

      it("should be in query category", () => {
        expect(listSmartListsTool.definition.category).toBe("query");
      });

      it("should have valid definition", () => {
        expect(listSmartListsTool.definition.parameters).toBeDefined();
      });
    });

    describe("execute", () => {
      it("should list smart lists", async () => {
        // listSmartLists awaits the query chain (not .single()) so data should be an array
        smartListSelectDefault = {
          data: [mockSmartList],
          error: null,
        };

        const result = await listSmartListsTool.execute(
          { includePresets: false, pinnedOnly: false },
          mockContext,
        );

        expect(result.success).toBe(true);
        if (!result.success) return;
        expect(result.data).toBeDefined();
      });

      it("should filter by pinned status", async () => {
        smartListSelectDefault = {
          data: [mockSmartList],
          error: null,
        };

        const result = await listSmartListsTool.execute(
          { includePresets: false, pinnedOnly: true },
          mockContext,
        );

        expect(result.success).toBe(true);
      });
    });
  });

  // ============================================
  // getSmartListItemsTool Tests
  // ============================================
  describe("getSmartListItemsTool", () => {
    describe("definition", () => {
      it("should have correct tool name", () => {
        expect(getSmartListItemsTool.definition.name).toBe(
          "get_smart_list_items",
        );
      });

      it("should be in query category", () => {
        expect(getSmartListItemsTool.definition.category).toBe("query");
      });
    });

    describe("execute", () => {
      it("should get items from smart list", async () => {
        const result = await getSmartListItemsTool.execute(
          { smartListId: 1, limit: 10, offset: 0 },
          mockContext,
        );

        expect(result.success).toBe(true);
      });

      it("should respect page and limit params", async () => {
        const result = await getSmartListItemsTool.execute(
          { smartListId: 1, limit: 10, offset: 10 },
          mockContext,
        );

        expect(result.success).toBe(true);
      });

      it("should return error if list not found", async () => {
        smartListSelectDefault = {
          data: null,
          error: { message: "Not found" },
        };

        const result = await getSmartListItemsTool.execute(
          { smartListId: 999, limit: 10, offset: 0 },
          mockContext,
        );

        expect(result.success).toBe(false);
      });
    });
  });

  // ============================================
  // getSmartListCountTool Tests
  // ============================================
  describe("getSmartListCountTool", () => {
    describe("definition", () => {
      it("should have correct tool name", () => {
        expect(getSmartListCountTool.definition.name).toBe(
          "get_smart_list_count",
        );
      });

      it("should be in query category", () => {
        expect(getSmartListCountTool.definition.category).toBe("query");
      });
    });

    describe("execute", () => {
      it("should get smart list count", async () => {
        const result = await getSmartListCountTool.execute(
          { smartListId: 1 },
          mockContext,
        );

        expect(result.success).toBe(true);
      });

      it("should return error if list not found", async () => {
        smartListSelectDefault = {
          data: null,
          error: { message: "Not found" },
        };

        const result = await getSmartListCountTool.execute(
          { smartListId: 999 },
          mockContext,
        );

        expect(result.success).toBe(false);
      });
    });
  });

  // ============================================
  // toggleSmartListPinTool Tests
  // ============================================
  describe("toggleSmartListPinTool", () => {
    describe("definition", () => {
      it("should have correct tool name", () => {
        expect(toggleSmartListPinTool.definition.name).toBe(
          "toggle_smart_list_pin",
        );
      });

      it("should be in action category", () => {
        expect(toggleSmartListPinTool.definition.category).toBe("action");
      });

      it("should not require confirmation", () => {
        expect(toggleSmartListPinTool.definition.requiresConfirmation).toBe(
          false,
        );
      });
    });

    describe("execute", () => {
      it("should toggle pin status from false to true", async () => {
        smartListSelectDefault = {
          data: { ...mockSmartList, is_pinned: false },
          error: null,
        };

        const result = await toggleSmartListPinTool.execute(
          { smartListId: 1 },
          mockContext,
        );

        expect(result.success).toBe(true);
        if (!result.success) return;
        expect(result.data.isPinned).toBe(true);
      });

      it("should toggle pin status from true to false", async () => {
        smartListSelectDefault = {
          data: { ...mockSmartList, is_pinned: true },
          error: null,
        };

        const result = await toggleSmartListPinTool.execute(
          { smartListId: 1 },
          mockContext,
        );

        expect(result.success).toBe(true);
        if (!result.success) return;
        expect(result.data.isPinned).toBe(false);
      });

      it("should set explicit pin status when provided", async () => {
        smartListSelectDefault = {
          data: { ...mockSmartList, is_pinned: false },
          error: null,
        };

        const result = await toggleSmartListPinTool.execute(
          { smartListId: 1, isPinned: true },
          mockContext,
        );

        expect(result.success).toBe(true);
        if (!result.success) return;
        expect(result.data.isPinned).toBe(true);
      });

      it("should return error if list not found", async () => {
        smartListSelectDefault = {
          data: null,
          error: { message: "Not found" },
        };

        const result = await toggleSmartListPinTool.execute(
          { smartListId: 999 },
          mockContext,
        );

        expect(result.success).toBe(false);
      });
    });
  });

  // ============================================
  // updateSmartListTool Tests
  // ============================================
  describe("updateSmartListTool", () => {
    describe("definition", () => {
      it("should have correct tool name", () => {
        expect(updateSmartListTool.definition.name).toBe("update_smart_list");
      });

      it("should be in action category", () => {
        expect(updateSmartListTool.definition.category).toBe("action");
      });
    });

    describe("execute", () => {
      it("should update smart list name", async () => {
        // Queue: 1st → existence check (found), 2nd → name-duplicate check (not found)
        smartListSelectQueue = [
          { data: mockSmartList, error: null },
          { data: null, error: null },
        ];

        const result = await updateSmartListTool.execute(
          { smartListId: 1, name: "New Name" },
          mockContext,
        );

        expect(result.success).toBe(true);
      });

      it("should update smart list description", async () => {
        const result = await updateSmartListTool.execute(
          { smartListId: 1, description: "New description" },
          mockContext,
        );

        expect(result.success).toBe(true);
      });

      it("should return error if list not found", async () => {
        smartListSelectDefault = {
          data: null,
          error: { message: "Not found" },
        };

        const result = await updateSmartListTool.execute(
          { smartListId: 999, name: "New Name" },
          mockContext,
        );

        expect(result.success).toBe(false);
      });
    });
  });

  // ============================================
  // deleteSmartListTool Tests
  // ============================================
  describe("deleteSmartListTool", () => {
    describe("definition", () => {
      it("should have correct tool name", () => {
        expect(deleteSmartListTool.definition.name).toBe("delete_smart_list");
      });

      it("should be in action category", () => {
        expect(deleteSmartListTool.definition.category).toBe("action");
      });

      it("should require confirmation", () => {
        expect(deleteSmartListTool.definition.requiresConfirmation).toBe(true);
      });
    });

    describe("execute", () => {
      it("should have valid parameters schema", () => {
        expect(deleteSmartListTool.definition.parameters).toBeDefined();
      });
    });
  });

  // ============================================
  // createSmartListTool Tests
  // ============================================
  describe("createSmartListTool", () => {
    describe("definition", () => {
      it("should have correct tool name", () => {
        expect(createSmartListTool.definition.name).toBe("create_smart_list");
      });

      it("should be in action category", () => {
        expect(createSmartListTool.definition.category).toBe("action");
      });

      it("should not require confirmation", () => {
        expect(createSmartListTool.definition.requiresConfirmation).toBe(false);
      });
    });

    describe("execute", () => {
      it("should create smart list with name", async () => {
        // Name check and max order queries both use select path -> smartListSelectDefault
        // data: null means name doesn't exist (good) and maxOrderData is null (sort_order defaults to 1)
        smartListSelectDefault = { data: null, error: null };
        smartListInsertResult = {
          data: { id: 2, name: "New Smart List", filters: {} },
          error: null,
        };

        const result = await createSmartListTool.execute(
          {
            name: "New Smart List",
            icon: "📋",
            color: "default",
            filters: {},
            sortBy: "created_desc",
            viewMode: "inherit",
          },
          mockContext,
        );

        expect(result.success).toBe(true);
      });

      it("should create smart list with filter config", async () => {
        smartListSelectDefault = { data: null, error: null };
        smartListInsertResult = {
          data: { id: 3, name: "Filtered List", filters: { isRead: false } },
          error: null,
        };

        const result = await createSmartListTool.execute(
          {
            name: "Filtered List",
            icon: "📋",
            color: "blue",
            filters: { isRead: false },
            sortBy: "created_desc",
            viewMode: "inherit",
          },
          mockContext,
        );

        expect(result.success).toBe(true);
      });
    });
  });
});
