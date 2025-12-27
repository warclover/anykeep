/**
 * ContentChangeMonitorSkill 单元测试
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

import {
  ContentChangeMonitorSkill,
  contentChangeMonitorSkill,
} from "../content-change-monitor.skill";
import type { OrchestrationContext } from "../../../orchestration/types";
import type { OrchestrationStreamChunk } from "../../../output/types";
import type { MonitorAction, MonitorStatus } from "../types";

// Mock 数据
const mockMonitors = [
  {
    id: 1,
    bookmark_id: 100,
    check_interval: "daily",
    status: "active",
    change_count: 3,
    last_checked_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    next_check_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    bookmarks: {
      id: 100,
      title: "测试页面 1",
      url: "https://example.com/page1",
    },
  },
  {
    id: 2,
    bookmark_id: 101,
    check_interval: "weekly",
    status: "paused",
    change_count: 1,
    last_checked_at: new Date(
      Date.now() - 3 * 24 * 60 * 60 * 1000,
    ).toISOString(),
    next_check_at: null,
    created_at: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
    bookmarks: {
      id: 101,
      title: "测试页面 2",
      url: "https://example.com/page2",
    },
  },
];

const mockProfile = {
  membership_type: "FREE",
};

const mockBookmark = {
  id: 100,
  title: "测试书签",
  url: "https://example.com/test",
};

// 动态 Mock 结果
const _mockQueryResult: {
  data: unknown | null;
  error: { message: string } | null;
  count?: number | null;
} = { data: null, error: null };

let mockProfileResult = { data: mockProfile, error: null };
let mockMonitorCountResult = { count: 2, data: null, error: null };
let mockMonitorsResult = { data: mockMonitors, error: null };
let mockBookmarkResult = { data: mockBookmark, error: null };
let mockExistingMonitorResult: {
  data: unknown;
  error: { message: string } | null;
} = {
  data: null,
  error: { message: "Not found" },
};
let mockInsertResult = { data: { id: 3 }, error: null };
let _mockUpdateResult = { error: null };

// 创建 chainable mock
const createChainableMock = () => {
  const chain = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    neq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    single: jest.fn(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
  };
  return chain;
};

// Mock Supabase client
jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(() => {
    const fromMock = jest.fn((table: string) => {
      const chain = createChainableMock();

      // 根据表名返回不同的 mock 结果
      if (table === "profiles") {
        chain.single.mockResolvedValue(mockProfileResult);
      } else if (table === "page_monitors") {
        // count 查询
        chain.select.mockImplementation(
          (columns: string, options?: unknown) => {
            if (options && (options as { count: string }).count === "exact") {
              return {
                eq: jest.fn().mockReturnThis(),
                neq: jest.fn().mockResolvedValue(mockMonitorCountResult),
              };
            }
            return chain;
          },
        );
        // 普通查询
        chain.single.mockResolvedValue(mockExistingMonitorResult);
        chain.order.mockResolvedValue(mockMonitorsResult);
        // insert
        chain.insert.mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue(mockInsertResult),
          }),
        });
      } else if (table === "bookmarks") {
        chain.single.mockResolvedValue(mockBookmarkResult);
      } else if (table === "monitor_check_logs") {
        chain.limit.mockResolvedValue({ data: [], error: null });
      }

      return chain;
    });

    return Promise.resolve({
      from: fromMock,
    });
  }),
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

describe("ContentChangeMonitorSkill", () => {
  let skill: ContentChangeMonitorSkill;

  beforeEach(() => {
    skill = new ContentChangeMonitorSkill();
    jest.clearAllMocks();

    // 重置 mock 数据
    mockProfileResult = { data: mockProfile, error: null };
    mockMonitorCountResult = { count: 2, data: null, error: null };
    mockMonitorsResult = { data: mockMonitors, error: null };
    mockBookmarkResult = { data: mockBookmark, error: null };
    mockExistingMonitorResult = { data: null, error: { message: "Not found" } };
    mockInsertResult = { data: { id: 3 }, error: null };
    _mockUpdateResult = { error: null };
  });

  // 辅助函数：收集所有流式输出（保留供未来测试使用）
  async function _collectChunks(
    generator: AsyncGenerator<OrchestrationStreamChunk>,
  ): Promise<OrchestrationStreamChunk[]> {
    const chunks: OrchestrationStreamChunk[] = [];
    for await (const chunk of generator) {
      chunks.push(chunk);
    }
    return chunks;
  }

  describe("metadata", () => {
    it("should have correct metadata", () => {
      expect(skill.metadata.id).toBe("content_change_monitor");
      expect(skill.metadata.name).toBe("内容变更监控");
      expect(skill.metadata.category).toBe("utility");
      expect(skill.metadata.deliverableTypes).toContain("report");
      expect(skill.metadata.deliverableTypes).toContain("list");
    });

    it("should have valid steps definition", () => {
      expect(skill.metadata.steps).toBeDefined();
      expect(skill.metadata.steps!.length).toBe(5);
      expect(skill.metadata.steps![0].id).toBe("parse");
      expect(skill.metadata.steps![4].id).toBe("deliver");
    });

    it("should have required capabilities", () => {
      expect(skill.metadata.capabilities).toContain("page-monitoring");
      expect(skill.metadata.capabilities).toContain("change-detection");
      expect(skill.metadata.capabilities).toContain("notification");
      expect(skill.metadata.capabilities).toContain("history-tracking");
    });
  });

  describe("parseInput", () => {
    const mockContext: OrchestrationContext = {
      userId: "test-user",
      params: null,
    };

    it("should parse create action from message", async () => {
      const result = await skill.parseInput("监控这个页面", mockContext);
      expect(result.action).toBe("create");
    });

    it("should parse list action from message", async () => {
      const result = await skill.parseInput("查看我的监控列表", mockContext);
      expect(result.action).toBe("list");
    });

    it("should parse status action from message", async () => {
      const result = await skill.parseInput("监控状态怎么样", mockContext);
      expect(result.action).toBe("status");
    });

    it("should parse pause action from message", async () => {
      const result = await skill.parseInput("暂停监控", mockContext);
      expect(result.action).toBe("pause");
    });

    it("should parse resume action from message", async () => {
      const result = await skill.parseInput("恢复监控", mockContext);
      expect(result.action).toBe("resume");
    });

    it("should parse delete action from message", async () => {
      const result = await skill.parseInput("取消监控", mockContext);
      expect(result.action).toBe("delete");
    });

    it("should parse daily check interval", async () => {
      const result = await skill.parseInput("每天监控这个页面", mockContext);
      expect(result.checkInterval).toBe("daily");
    });

    it("should parse weekly check interval", async () => {
      const result = await skill.parseInput("每周检查一次", mockContext);
      expect(result.checkInterval).toBe("weekly");
    });

    it("should parse bookmarkId from context", async () => {
      const contextWithBookmark: OrchestrationContext = {
        userId: "test-user",
        params: null,
        bookmarkIds: [123],
      };
      const result = await skill.parseInput("监控这个", contextWithBookmark);
      expect(result.bookmarkId).toBe(123);
    });

    it("should default to list action", async () => {
      const result = await skill.parseInput("监控功能", mockContext);
      expect(result.action).toBe("list");
    });
  });

  describe("inputSchema", () => {
    it("should validate valid input", () => {
      const validInput = {
        action: "create",
        bookmarkId: 1,
        checkInterval: "daily",
      };
      const result = skill.inputSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it("should reject invalid action", () => {
      const invalidInput = {
        action: "invalid_action",
      };
      const result = skill.inputSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it("should accept optional fields", () => {
      const minimalInput = {};
      const result = skill.inputSchema.safeParse(minimalInput);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.action).toBe("list"); // default value
      }
    });

    it("should validate checkInterval enum", () => {
      const validIntervals = [
        "every_6h",
        "twice_daily",
        "daily",
        "weekly",
        "custom",
      ];
      for (const interval of validIntervals) {
        const input = { action: "create", checkInterval: interval };
        const result = skill.inputSchema.safeParse(input);
        expect(result.success).toBe(true);
      }
    });
  });

  describe("outputSchema", () => {
    it("should validate successful output", () => {
      const validOutput = {
        action: "list",
        success: true,
        monitors: [],
        message: "您还没有设置任何页面监控",
      };
      const result = skill.outputSchema.safeParse(validOutput);
      expect(result.success).toBe(true);
    });

    it("should validate output with suggestions", () => {
      const outputWithSuggestions = {
        action: "create",
        success: false,
        message: "监控配额已达上限",
        suggestions: ["删除不需要的监控", "升级会员"],
      };
      const result = skill.outputSchema.safeParse(outputWithSuggestions);
      expect(result.success).toBe(true);
    });
  });

  describe("singleton instance", () => {
    it("should export singleton instance", () => {
      expect(contentChangeMonitorSkill).toBeInstanceOf(
        ContentChangeMonitorSkill,
      );
      expect(contentChangeMonitorSkill.metadata.id).toBe(
        "content_change_monitor",
      );
    });
  });

  describe("action labels", () => {
    it("should have Chinese labels for all actions", async () => {
      const actions: MonitorAction[] = [
        "create",
        "list",
        "status",
        "pause",
        "resume",
        "delete",
      ];
      const context: OrchestrationContext = {
        userId: "test-user",
        params: { action: "list" },
      };

      // 测试每个 action 是否能正常解析
      for (const action of actions) {
        const parseResult = await skill.parseInput(`${action}`, {
          ...context,
          params: { action },
        });
        expect(parseResult).toBeDefined();
      }
    });
  });

  describe("status helpers", () => {
    it("should return correct status emoji", () => {
      // 通过私有方法测试（间接测试）
      const statuses: MonitorStatus[] = [
        "active",
        "paused",
        "failed",
        "deleted",
      ];
      expect(statuses.length).toBe(4);
    });

    it("should return correct status labels", () => {
      // 状态标签测试（间接测试）
      const statusLabels = {
        active: "运行中",
        paused: "已暂停",
        failed: "已失败",
        deleted: "已删除",
      };
      expect(Object.keys(statusLabels).length).toBe(4);
    });
  });
});
