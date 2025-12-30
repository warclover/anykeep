/**
 * Message Tools 单元测试
 *
 * @description 测试消息类 Tools 的核心功能
 * @version 1.0.0
 * @since 2025-12-27
 */

import type {
  ToolContext,
  ToolSuccessResult,
  ToolErrorResult,
} from "../../types";

// Mock 变量
let mockListResult: any = { data: [], count: 0, error: null };
let mockSummarizeResult: any = { data: [], error: null };
let mockCountResult: any = { count: 0, error: null };
let mockBatchSelectResult: any = { data: [], error: null };
const mockRpc = jest.fn();

// 创建 chainable mock
const createChainableMock = () => {
  const chain: any = {};
  const methods = ["eq", "is", "order", "range", "in", "lt", "gte", "lte"];
  methods.forEach((method) => {
    chain[method] = jest.fn().mockReturnValue(chain);
  });
  return chain;
};

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(() => {
    const listChain = createChainableMock();
    listChain.range.mockImplementation(() => Promise.resolve(mockListResult));
    listChain.order.mockImplementation(() => ({
      ...listChain,
      range: () => Promise.resolve(mockListResult),
    }));

    const summarizeChain = createChainableMock();
    summarizeChain.order.mockResolvedValue(mockSummarizeResult);

    // For count chain, we need proper chaining that eventually resolves
    const createCountChain = () => {
      const countChain: any = {};
      countChain.eq = jest.fn().mockImplementation(() => {
        // Return a new chain that can resolve or continue chaining
        const innerChain: any = {};
        innerChain.eq = jest.fn().mockResolvedValue(mockCountResult);
        innerChain.then = (resolve: (val: any) => void) => {
          resolve(mockCountResult);
          return Promise.resolve(mockCountResult);
        };
        return innerChain;
      });
      return countChain;
    };

    const batchChain = createChainableMock();
    // Make batch chain methods return thenable results
    // When .in() or .lt() is the last method, it should resolve to mockBatchSelectResult
    const createThenableResult = () => ({
      ...batchChain,
      lt: () => Promise.resolve(mockBatchSelectResult),
      in: () => createThenableResult(),
      then: (resolve: (val: any) => void) => {
        resolve(mockBatchSelectResult);
        return Promise.resolve(mockBatchSelectResult);
      },
    });
    batchChain.in.mockImplementation(() => createThenableResult());
    batchChain.lt.mockImplementation(() =>
      Promise.resolve(mockBatchSelectResult),
    );

    return Promise.resolve({
      from: jest.fn((_table: string) => ({
        select: jest.fn((fields: string, opts?: any) => {
          if (opts?.head) {
            return createCountChain();
          }
          // Return appropriate chain based on fields
          if (fields.includes("id, type, level, title, content, status")) {
            // list_messages query
            return listChain;
          }
          if (fields === "id") {
            // batch select for IDs
            return batchChain;
          }
          // summarize query
          return summarizeChain;
        }),
      })),
      rpc: mockRpc,
    });
  }),
}));

// Mock logger
jest.mock("@/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

// Import tools after mocking
import { listMessagesTool } from "../list-messages.tool";
import { summarizeUnreadMessagesTool } from "../summarize-unread.tool";
import { batchMarkReadTool } from "../batch-mark-read.tool";

describe("Message Tools", () => {
  const mockContext: ToolContext = {
    userId: "test-user-123",
    conversationId: "conv-456",
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockListResult = { data: [], count: 0, error: null };
    mockSummarizeResult = { data: [], error: null };
    mockCountResult = { count: 0, error: null };
    mockBatchSelectResult = { data: [], error: null };
    mockRpc.mockReset();
  });

  // ============================================
  // listMessagesTool Tests
  // ============================================

  describe("listMessagesTool", () => {
    describe("definition", () => {
      it("正确定义 Tool 元数据", () => {
        expect(listMessagesTool.definition.name).toBe("list_messages");
        expect(listMessagesTool.definition.category).toBe("query");
        expect(listMessagesTool.definition.requiresConfirmation).toBe(false);
        expect(listMessagesTool.definition.description).toContain("消息列表");
      });
    });

    describe("execute", () => {
      it("成功返回消息列表", async () => {
        const mockMessages = [
          {
            id: 1,
            type: "import_complete",
            level: "normal",
            title: "导入完成",
            content: "成功导入 50 条书签",
            status: "unread",
            created_at: "2025-12-27T10:00:00Z",
            read_at: null,
            action_url: null,
          },
          {
            id: 2,
            type: "classification_auto",
            level: "important",
            title: "自动分类完成",
            content: "已自动分类 10 条书签",
            status: "read",
            created_at: "2025-12-26T10:00:00Z",
            read_at: "2025-12-26T12:00:00Z",
            action_url: "/bookmarks",
          },
        ];

        mockListResult = { data: mockMessages, count: 50, error: null };
        mockCountResult = { count: 10, error: null };

        const result = await listMessagesTool.execute(
          { status: "all", limit: 20, page: 1 },
          mockContext,
        );

        expect(result.success).toBe(true);
        const successResult = result as ToolSuccessResult<any>;
        expect(successResult.data.messages).toHaveLength(2);
        expect(successResult.data.messages[0].title).toBe("导入完成");
        expect(successResult.data.pagination.total).toBe(50);
        expect(successResult.data.pagination.hasMore).toBe(true);
      });

      it("处理空结果", async () => {
        mockListResult = { data: [], count: 0, error: null };
        mockCountResult = { count: 0, error: null };

        const result = await listMessagesTool.execute(
          { status: "all", limit: 20, page: 1 },
          mockContext,
        );

        expect(result.success).toBe(true);
        const successResult = result as ToolSuccessResult<any>;
        expect(successResult.data.messages).toEqual([]);
        expect(successResult.data.pagination.total).toBe(0);
        expect(successResult.data.pagination.hasMore).toBe(false);
      });

      it("处理数据库错误", async () => {
        mockListResult = {
          data: null,
          error: { message: "Connection refused" },
        };

        const result = await listMessagesTool.execute(
          { status: "all", limit: 20, page: 1 },
          mockContext,
        );

        expect(result.success).toBe(false);
        const errorResult = result as ToolErrorResult;
        expect(errorResult.error).toBe("Connection refused");
        expect(errorResult.errorCode).toBe("DB_ERROR");
      });

      it("正确计算 dateGroup", async () => {
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const lastWeek = new Date(today);
        lastWeek.setDate(lastWeek.getDate() - 5);
        const earlier = new Date(today);
        earlier.setDate(earlier.getDate() - 30);

        const mockMessages = [
          {
            id: 1,
            type: "import_complete",
            level: "normal",
            title: "今天",
            content: null,
            status: "unread",
            created_at: today.toISOString(),
            read_at: null,
            action_url: null,
          },
          {
            id: 2,
            type: "import_complete",
            level: "normal",
            title: "昨天",
            content: null,
            status: "unread",
            created_at: yesterday.toISOString(),
            read_at: null,
            action_url: null,
          },
          {
            id: 3,
            type: "import_complete",
            level: "normal",
            title: "本周",
            content: null,
            status: "unread",
            created_at: lastWeek.toISOString(),
            read_at: null,
            action_url: null,
          },
          {
            id: 4,
            type: "import_complete",
            level: "normal",
            title: "更早",
            content: null,
            status: "unread",
            created_at: earlier.toISOString(),
            read_at: null,
            action_url: null,
          },
        ];

        mockListResult = { data: mockMessages, count: 4, error: null };
        mockCountResult = { count: 4, error: null };

        const result = await listMessagesTool.execute(
          { status: "all", limit: 20, page: 1 },
          mockContext,
        );

        expect(result.success).toBe(true);
        const successResult = result as ToolSuccessResult<any>;
        expect(successResult.data.messages[0].dateGroup).toBe("today");
        expect(successResult.data.messages[1].dateGroup).toBe("yesterday");
        expect(successResult.data.messages[2].dateGroup).toBe("this_week");
        expect(successResult.data.messages[3].dateGroup).toBe("earlier");
      });
    });
  });

  // ============================================
  // summarizeUnreadMessagesTool Tests
  // ============================================

  describe("summarizeUnreadMessagesTool", () => {
    describe("definition", () => {
      it("正确定义 Tool 元数据", () => {
        expect(summarizeUnreadMessagesTool.definition.name).toBe(
          "summarize_unread_messages",
        );
        expect(summarizeUnreadMessagesTool.definition.category).toBe("query");
        expect(
          summarizeUnreadMessagesTool.definition.requiresConfirmation,
        ).toBe(false);
        expect(summarizeUnreadMessagesTool.definition.description).toContain(
          "摘要",
        );
      });
    });

    describe("execute", () => {
      it("成功生成未读消息摘要", async () => {
        const mockMessages = [
          {
            id: 1,
            type: "import_complete",
            level: "important",
            title: "重要导入",
            content: "content",
            created_at: "2025-12-27T10:00:00Z",
          },
          {
            id: 2,
            type: "import_complete",
            level: "normal",
            title: "普通导入",
            content: "content",
            created_at: "2025-12-27T09:00:00Z",
          },
          {
            id: 3,
            type: "classification_auto",
            level: "normal",
            title: "自动分类",
            content: "content",
            created_at: "2025-12-27T08:00:00Z",
          },
        ];

        mockSummarizeResult = { data: mockMessages, error: null };

        const result = await summarizeUnreadMessagesTool.execute(
          { includeContent: false },
          mockContext,
        );

        expect(result.success).toBe(true);
        const successResult = result as ToolSuccessResult<any>;
        expect(successResult.data.totalUnread).toBe(3);
        expect(successResult.data.byLevel).toBeDefined();
        expect(successResult.data.byType).toBeDefined();
        expect(successResult.data.importantMessages).toHaveLength(1);
        expect(successResult.data.summary).toContain("3");
      });

      it("正确按级别分组统计", async () => {
        const mockMessages = [
          {
            id: 1,
            type: "import_complete",
            level: "important",
            title: "重要",
            content: null,
            created_at: "2025-12-27T10:00:00Z",
          },
          {
            id: 2,
            type: "import_complete",
            level: "important",
            title: "重要2",
            content: null,
            created_at: "2025-12-27T09:00:00Z",
          },
          {
            id: 3,
            type: "import_complete",
            level: "normal",
            title: "普通",
            content: null,
            created_at: "2025-12-27T08:00:00Z",
          },
          {
            id: 4,
            type: "import_complete",
            level: "silent",
            title: "静默",
            content: null,
            created_at: "2025-12-27T07:00:00Z",
          },
        ];

        mockSummarizeResult = { data: mockMessages, error: null };

        const result = await summarizeUnreadMessagesTool.execute(
          { includeContent: false },
          mockContext,
        );

        expect(result.success).toBe(true);
        const successResult = result as ToolSuccessResult<any>;
        const importantLevel = successResult.data.byLevel.find(
          (l: any) => l.level === "important",
        );
        const normalLevel = successResult.data.byLevel.find(
          (l: any) => l.level === "normal",
        );
        const silentLevel = successResult.data.byLevel.find(
          (l: any) => l.level === "silent",
        );

        expect(importantLevel?.count).toBe(2);
        expect(normalLevel?.count).toBe(1);
        expect(silentLevel?.count).toBe(1);
      });

      it("正确按类型分组统计", async () => {
        const mockMessages = [
          {
            id: 1,
            type: "import_complete",
            level: "normal",
            title: "导入1",
            content: null,
            created_at: "2025-12-27T10:00:00Z",
          },
          {
            id: 2,
            type: "import_complete",
            level: "normal",
            title: "导入2",
            content: null,
            created_at: "2025-12-27T09:00:00Z",
          },
          {
            id: 3,
            type: "classification_auto",
            level: "normal",
            title: "分类",
            content: null,
            created_at: "2025-12-27T08:00:00Z",
          },
        ];

        mockSummarizeResult = { data: mockMessages, error: null };

        const result = await summarizeUnreadMessagesTool.execute(
          { includeContent: false },
          mockContext,
        );

        expect(result.success).toBe(true);
        const successResult = result as ToolSuccessResult<any>;
        expect(successResult.data.byType).toHaveLength(2);
        expect(successResult.data.byType[0].type).toBe("import_complete");
        expect(successResult.data.byType[0].count).toBe(2);
      });

      it("生成适当的建议动作", async () => {
        const mockMessages = [
          {
            id: 1,
            type: "import_failed",
            level: "important",
            title: "导入失败",
            content: null,
            created_at: "2025-12-27T10:00:00Z",
          },
          {
            id: 2,
            type: "quota_warning",
            level: "important",
            title: "配额警告",
            content: null,
            created_at: "2025-12-27T09:00:00Z",
          },
        ];

        mockSummarizeResult = { data: mockMessages, error: null };

        const result = await summarizeUnreadMessagesTool.execute(
          { includeContent: false },
          mockContext,
        );

        expect(result.success).toBe(true);
        const successResult = result as ToolSuccessResult<any>;
        expect(successResult.data.suggestedActions).toContain(
          "建议优先查看重要通知",
        );
        expect(successResult.data.suggestedActions).toContain(
          "有导入失败的消息，请检查导入状态",
        );
        expect(successResult.data.suggestedActions).toContain(
          "配额预警，请关注存储空间",
        );
      });

      it("处理零未读消息", async () => {
        mockSummarizeResult = { data: [], error: null };

        const result = await summarizeUnreadMessagesTool.execute(
          { includeContent: false },
          mockContext,
        );

        expect(result.success).toBe(true);
        const successResult = result as ToolSuccessResult<any>;
        expect(successResult.data.totalUnread).toBe(0);
        expect(successResult.data.summary).toContain("没有未读消息");
        expect(successResult.data.suggestedActions).toEqual([]);
      });

      it("处理数据库错误", async () => {
        mockSummarizeResult = {
          data: null,
          error: { message: "Query timeout" },
        };

        const result = await summarizeUnreadMessagesTool.execute(
          { includeContent: false },
          mockContext,
        );

        expect(result.success).toBe(false);
        const errorResult = result as ToolErrorResult;
        expect(errorResult.error).toBe("Query timeout");
        expect(errorResult.errorCode).toBe("DB_ERROR");
      });
    });
  });

  // ============================================
  // batchMarkReadTool Tests
  // ============================================

  describe("batchMarkReadTool", () => {
    describe("definition", () => {
      it("正确定义 Tool 元数据", () => {
        expect(batchMarkReadTool.definition.name).toBe("batch_mark_read");
        expect(batchMarkReadTool.definition.category).toBe("action");
        expect(batchMarkReadTool.definition.requiresConfirmation).toBe(false);
        expect(batchMarkReadTool.definition.description).toContain("标记已读");
      });
    });

    describe("execute", () => {
      it("成功通过消息 ID 批量标记已读", async () => {
        mockCountResult = { count: 10, error: null };
        mockRpc.mockResolvedValue({ data: 5, error: null });

        const result = await batchMarkReadTool.execute(
          { messageIds: [1, 2, 3, 4, 5], markAll: false },
          mockContext,
        );

        expect(result.success).toBe(true);
        const successResult = result as ToolSuccessResult<any>;
        expect(successResult.data.markedCount).toBe(5);
        expect(mockRpc).toHaveBeenCalledWith("mark_messages_read", {
          p_user_id: "test-user-123",
          p_message_ids: [1, 2, 3, 4, 5],
        });
      });

      it("成功标记全部已读", async () => {
        mockCountResult = { count: 100, error: null };
        mockRpc.mockResolvedValue({ data: 100, error: null });

        const result = await batchMarkReadTool.execute(
          { markAll: true },
          mockContext,
        );

        expect(result.success).toBe(true);
        const successResult = result as ToolSuccessResult<any>;
        expect(successResult.data.markedCount).toBe(100);
        expect(mockRpc).toHaveBeenCalledWith("mark_messages_read", {
          p_user_id: "test-user-123",
          p_message_ids: undefined,
        });
      });

      it("按类型筛选批量标记已读", async () => {
        mockCountResult = { count: 20, error: null };
        mockBatchSelectResult = {
          data: [{ id: 1 }, { id: 2 }, { id: 3 }],
          error: null,
        };
        mockRpc.mockResolvedValue({ data: 3, error: null });

        const result = await batchMarkReadTool.execute(
          { types: ["import_complete"], markAll: false },
          mockContext,
        );

        expect(result.success).toBe(true);
        const successResult = result as ToolSuccessResult<any>;
        expect(successResult.data.markedCount).toBe(3);
      });

      it("按级别筛选批量标记已读", async () => {
        mockCountResult = { count: 20, error: null };
        mockBatchSelectResult = { data: [{ id: 1 }, { id: 2 }], error: null };
        mockRpc.mockResolvedValue({ data: 2, error: null });

        const result = await batchMarkReadTool.execute(
          { levels: ["silent"], markAll: false },
          mockContext,
        );

        expect(result.success).toBe(true);
        const successResult = result as ToolSuccessResult<any>;
        expect(successResult.data.markedCount).toBe(2);
      });

      it("无符合条件的消息", async () => {
        mockCountResult = { count: 10, error: null };
        mockBatchSelectResult = { data: [], error: null };

        const result = await batchMarkReadTool.execute(
          { types: ["import_complete"], markAll: false },
          mockContext,
        );

        expect(result.success).toBe(true);
        const successResult = result as ToolSuccessResult<any>;
        expect(successResult.data.markedCount).toBe(0);
      });

      it("处理数据库错误", async () => {
        mockCountResult = { count: 10, error: null };
        mockRpc.mockResolvedValue({
          data: null,
          error: { message: "RPC call failed" },
        });

        const result = await batchMarkReadTool.execute(
          { markAll: true },
          mockContext,
        );

        expect(result.success).toBe(false);
        const errorResult = result as ToolErrorResult;
        expect(errorResult.error).toBe("RPC call failed");
        expect(errorResult.errorCode).toBe("DB_ERROR");
      });
    });
  });
});
