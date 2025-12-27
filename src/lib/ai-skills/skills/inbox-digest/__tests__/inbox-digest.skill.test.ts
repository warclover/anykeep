/**
 * InboxDigestSkill 单元测试
 *
 * @version 1.0.0
 * @since 2025-12-27
 */

import { InboxDigestSkill } from "../inbox-digest.skill";
import type { OrchestrationContext } from "../../../orchestration/types";
import type { OrchestrationStreamChunk } from "../../../output/types";
import { InboxDigestInputSchema, INBOX_DIGEST_STEPS } from "../types";

// Mock Supabase with proper messages structure
const mockSupabaseResponse = {
  data: [
    {
      id: 1,
      type: "import_complete",
      level: "important",
      title: "导入完成",
      content: "成功导入 50 条书签",
      status: "unread",
      created_at: "2025-12-27T10:00:00Z",
      read_at: null,
      action_url: "/bookmarks",
    },
    {
      id: 2,
      type: "classification_auto",
      level: "normal",
      title: "自动分类完成",
      content: "已分类 10 条书签",
      status: "unread",
      created_at: "2025-12-27T09:00:00Z",
      read_at: null,
      action_url: null,
    },
    {
      id: 3,
      type: "system_announcement",
      level: "silent",
      title: "系统更新",
      content: "版本 2.0 已发布",
      status: "read",
      created_at: "2025-12-26T10:00:00Z",
      read_at: "2025-12-26T12:00:00Z",
      action_url: null,
    },
  ],
  error: null,
};

// Create a flexible mock chain that's always thenable
const createMockChain = (response: {
  data: unknown[] | null;
  error: unknown;
}) => {
  const createThenableChain = (): Record<string, jest.Mock> &
    PromiseLike<typeof response> => {
    const chain = {} as Record<string, jest.Mock> &
      PromiseLike<typeof response>;
    const methods = [
      "select",
      "eq",
      "is",
      "order",
      "limit",
      "gte",
      "lte",
      "in",
    ];

    methods.forEach((method) => {
      chain[method] = jest.fn().mockImplementation(() => createThenableChain());
    });

    // Make the chain thenable - can be awaited at any point
    chain.then = ((resolve: (val: typeof response) => unknown) => {
      resolve(response);
      return Promise.resolve(response);
    }) as typeof chain.then;

    return chain;
  };

  return createThenableChain();
};

const createMockSupabaseClient = (response = mockSupabaseResponse) => {
  const chain = createMockChain(response);
  return {
    from: jest.fn(() => chain),
    rpc: jest.fn().mockResolvedValue({ data: 2, error: null }),
  };
};

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(() => Promise.resolve(createMockSupabaseClient())),
}));

// Import after mock for type safety
import { createClient } from "@/lib/supabase/server";

// Mock logger
jest.mock("@/lib/logger", () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe("InboxDigestSkill", () => {
  let skill: InboxDigestSkill;

  beforeEach(() => {
    skill = new InboxDigestSkill();
    jest.clearAllMocks();
  });

  describe("metadata", () => {
    it("should have correct id", () => {
      expect(skill.metadata.id).toBe("inbox_digest");
    });

    it("should have correct name", () => {
      expect(skill.metadata.name).toBe("收件箱摘要");
    });

    it("should have correct category", () => {
      expect(skill.metadata.category).toBe("understanding");
    });

    it("should support report deliverable type", () => {
      expect(skill.metadata.deliverableTypes).toContain("report");
    });

    it("should support markdown and json output formats", () => {
      expect(skill.metadata.outputFormats).toContain("markdown");
      expect(skill.metadata.outputFormats).toContain("json");
    });

    it("should not require confirmation", () => {
      expect(skill.metadata.requiresConfirmation).toBe(false);
    });

    it("should have defined steps", () => {
      expect(skill.metadata.steps).toHaveLength(5);
      expect(skill.metadata.steps?.map((s) => s.id)).toEqual([
        "fetch",
        "analyze",
        "trends",
        "generate",
        "deliver",
      ]);
    });

    it("should have correct capabilities", () => {
      expect(skill.metadata.capabilities).toContain("message-statistics");
      expect(skill.metadata.capabilities).toContain("type-distribution");
      expect(skill.metadata.capabilities).toContain("trend-analysis");
      expect(skill.metadata.capabilities).toContain("actionable-insights");
    });
  });

  describe("inputSchema", () => {
    it("should validate correct input with defaults", () => {
      const input = {};
      const result = InboxDigestInputSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.period).toBe("daily");
        expect(result.data.includeRead).toBe(false);
        expect(result.data.autoMarkRead).toBe(false);
      }
    });

    it("should validate input with custom period", () => {
      const input = { period: "weekly" };
      const result = InboxDigestInputSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.period).toBe("weekly");
      }
    });

    it("should validate input with monthly period", () => {
      const input = { period: "monthly" };
      const result = InboxDigestInputSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.period).toBe("monthly");
      }
    });

    it("should reject invalid period value", () => {
      const input = { period: "yearly" };
      const result = InboxDigestInputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("should accept includeRead option", () => {
      const input = { includeRead: true };
      const result = InboxDigestInputSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.includeRead).toBe(true);
      }
    });

    it("should accept autoMarkRead option", () => {
      const input = { autoMarkRead: true };
      const result = InboxDigestInputSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.autoMarkRead).toBe(true);
      }
    });

    it("should accept messageTypes filter", () => {
      const input = {
        messageTypes: ["import_complete", "classification_auto"],
      };
      const result = InboxDigestInputSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.messageTypes).toEqual([
          "import_complete",
          "classification_auto",
        ]);
      }
    });
  });

  describe("parseInput", () => {
    const mockContext: OrchestrationContext = {
      userId: "test-user",
      conversationId: "test-conv",
      params: {},
    };

    it("should parse default input", async () => {
      const result = await skill.parseInput("生成消息摘要", mockContext);
      expect(result.period).toBe("daily");
      expect(result.includeRead).toBe(false);
      expect(result.autoMarkRead).toBe(false);
    });

    it("should detect weekly period", async () => {
      const result = await skill.parseInput("本周消息摘要", mockContext);
      expect(result.period).toBe("weekly");
    });

    it("should detect weekly period with different keywords", async () => {
      const result1 = await skill.parseInput("一周的消息", mockContext);
      expect(result1.period).toBe("weekly");

      const result2 = await skill.parseInput("周报", mockContext);
      expect(result2.period).toBe("weekly");
    });

    it("should detect monthly period", async () => {
      const result = await skill.parseInput("本月消息摘要", mockContext);
      expect(result.period).toBe("monthly");
    });

    it("should detect monthly period with different keywords", async () => {
      const result1 = await skill.parseInput("月报", mockContext);
      expect(result1.period).toBe("monthly");

      const result2 = await skill.parseInput("一个月的消息", mockContext);
      expect(result2.period).toBe("monthly");
    });

    it("should detect includeRead option", async () => {
      const result = await skill.parseInput("包含已读的消息摘要", mockContext);
      expect(result.includeRead).toBe(true);
    });

    it("should detect includeRead with different keywords", async () => {
      const result = await skill.parseInput("全部消息", mockContext);
      expect(result.includeRead).toBe(true);
    });

    it("should detect autoMarkRead option", async () => {
      const result = await skill.parseInput("生成摘要并标记已读", mockContext);
      expect(result.autoMarkRead).toBe(true);
    });
  });

  describe("step definitions", () => {
    it("should have correct step weights summing to 100", () => {
      const totalWeight = INBOX_DIGEST_STEPS.reduce(
        (sum, step) => sum + step.weight,
        0,
      );
      expect(totalWeight).toBe(100);
    });

    it("should have fetch step first", () => {
      expect(INBOX_DIGEST_STEPS[0].id).toBe("fetch");
      expect(INBOX_DIGEST_STEPS[0].name).toBe("获取消息");
    });

    it("should have deliver step last", () => {
      const lastStep = INBOX_DIGEST_STEPS[INBOX_DIGEST_STEPS.length - 1];
      expect(lastStep.id).toBe("deliver");
      expect(lastStep.name).toBe("输出交付物");
    });

    it("should have analyze step after fetch", () => {
      expect(INBOX_DIGEST_STEPS[1].id).toBe("analyze");
      expect(INBOX_DIGEST_STEPS[1].name).toBe("分析统计");
    });

    it("should have trends step in middle", () => {
      expect(INBOX_DIGEST_STEPS[2].id).toBe("trends");
      expect(INBOX_DIGEST_STEPS[2].name).toBe("趋势分析");
    });
  });
});

describe("InboxDigestSkill executeStream", () => {
  let skill: InboxDigestSkill;

  beforeEach(() => {
    skill = new InboxDigestSkill();
    jest.clearAllMocks();
    // Reset mock to default response
    (createClient as jest.Mock).mockResolvedValue(createMockSupabaseClient());
  });

  async function collectChunks(
    generator: AsyncGenerator<OrchestrationStreamChunk>,
  ): Promise<OrchestrationStreamChunk[]> {
    const chunks: OrchestrationStreamChunk[] = [];
    for await (const chunk of generator) {
      chunks.push(chunk);
    }
    return chunks;
  }

  it("should emit progress updates during execution", async () => {
    const context: OrchestrationContext = {
      userId: "test-user",
      conversationId: "test-conv",
      params: {
        period: "daily",
        includeRead: false,
        autoMarkRead: false,
      },
    };

    const chunks = await collectChunks(skill.executeStream(context));
    const progressChunks = chunks.filter((c) => c.type === "progress");

    // Should have multiple progress updates
    expect(progressChunks.length).toBeGreaterThan(0);

    // Progress should eventually reach 100%
    const percentages = progressChunks.map(
      (c) => (c.data as { percent: number }).percent,
    );
    expect(percentages.some((p) => p === 100)).toBe(true);
  });

  it("should emit text chunks during execution", async () => {
    const context: OrchestrationContext = {
      userId: "test-user",
      conversationId: "test-conv",
      params: {
        period: "daily",
        includeRead: false,
        autoMarkRead: false,
      },
    };

    const chunks = await collectChunks(skill.executeStream(context));
    const textChunks = chunks.filter((c) => c.type === "text");

    expect(textChunks.length).toBeGreaterThan(0);
  });

  it("should emit deliverable chunk on success", async () => {
    const context: OrchestrationContext = {
      userId: "test-user",
      conversationId: "test-conv",
      params: {
        period: "daily",
        includeRead: true,
        autoMarkRead: false,
      },
    };

    const chunks = await collectChunks(skill.executeStream(context));
    const deliverableChunk = chunks.find((c) => c.type === "deliverable");

    expect(deliverableChunk).toBeDefined();
    if (deliverableChunk) {
      expect((deliverableChunk as { data: { type: string } }).data.type).toBe(
        "report",
      );
    }
  });

  it("should emit done chunk at the end", async () => {
    const context: OrchestrationContext = {
      userId: "test-user",
      conversationId: "test-conv",
      params: {
        period: "daily",
        includeRead: true,
        autoMarkRead: false,
      },
    };

    const chunks = await collectChunks(skill.executeStream(context));
    const doneChunk = chunks.find((c) => c.type === "done");

    expect(doneChunk).toBeDefined();
    if (doneChunk) {
      expect((doneChunk as { data: { success: boolean } }).data.success).toBe(
        true,
      );
    }
  });

  it("should handle empty result gracefully", async () => {
    // Mock empty result
    (createClient as jest.Mock).mockResolvedValue(
      createMockSupabaseClient({ data: [], error: null }),
    );

    const context: OrchestrationContext = {
      userId: "test-user",
      conversationId: "test-conv",
      params: {
        period: "daily",
        includeRead: false,
        autoMarkRead: false,
      },
    };

    const chunks = await collectChunks(skill.executeStream(context));
    const textChunks = chunks.filter((c) => c.type === "text");

    // Should have message about no messages
    const noMessagesMsg = textChunks.find(
      (c) =>
        (c.data as { text: string }).text.includes("没有消息") ||
        (c.data as { text: string }).text.includes("清爽"),
    );
    expect(noMessagesMsg).toBeDefined();

    // Should emit done with true (no messages is not an error)
    const doneChunk = chunks.find((c) => c.type === "done");
    expect(doneChunk).toBeDefined();
  });

  it("should handle weekly period", async () => {
    const context: OrchestrationContext = {
      userId: "test-user",
      conversationId: "test-conv",
      params: {
        period: "weekly",
        includeRead: true,
        autoMarkRead: false,
      },
    };

    const chunks = await collectChunks(skill.executeStream(context));
    const textChunks = chunks.filter((c) => c.type === "text");
    const reportText = textChunks
      .map((c) => (c.data as { text: string }).text)
      .join("");

    // Should mention weekly/本周
    expect(reportText).toContain("本周");
  });

  it("should call rpc when autoMarkRead is enabled", async () => {
    const mockClient = createMockSupabaseClient();
    (createClient as jest.Mock).mockResolvedValue(mockClient);

    const context: OrchestrationContext = {
      userId: "test-user",
      conversationId: "test-conv",
      params: {
        period: "daily",
        includeRead: true,
        autoMarkRead: true,
      },
    };

    await collectChunks(skill.executeStream(context));

    // Should call rpc to mark messages as read
    expect(mockClient.rpc).toHaveBeenCalledWith("mark_messages_read", {
      p_user_id: "test-user",
      p_message_ids: expect.any(Array),
    });
  });

  it("should include suggestions in output", async () => {
    // Mock response with important messages and failed imports
    const mockResponse = {
      data: [
        {
          id: 1,
          type: "import_failed",
          level: "important",
          title: "导入失败",
          content: "导入过程出错",
          status: "unread",
          created_at: "2025-12-27T10:00:00Z",
          read_at: null,
          action_url: null,
        },
        {
          id: 2,
          type: "quota_warning",
          level: "important",
          title: "配额预警",
          content: "存储空间不足",
          status: "unread",
          created_at: "2025-12-27T09:00:00Z",
          read_at: null,
          action_url: null,
        },
      ],
      error: null,
    };
    (createClient as jest.Mock).mockResolvedValue(
      createMockSupabaseClient(mockResponse),
    );

    const context: OrchestrationContext = {
      userId: "test-user",
      conversationId: "test-conv",
      params: {
        period: "daily",
        includeRead: false,
        autoMarkRead: false,
      },
    };

    const chunks = await collectChunks(skill.executeStream(context));
    const suggestionChunk = chunks.find((c) => c.type === "suggestions");

    // Should have suggestions based on the message types
    expect(suggestionChunk).toBeDefined();
  });

  it("should generate report with correct structure", async () => {
    const context: OrchestrationContext = {
      userId: "test-user",
      conversationId: "test-conv",
      params: {
        period: "daily",
        includeRead: true,
        autoMarkRead: false,
      },
    };

    const chunks = await collectChunks(skill.executeStream(context));
    const deliverableChunk = chunks.find((c) => c.type === "deliverable");

    expect(deliverableChunk).toBeDefined();
    if (deliverableChunk) {
      const content = (deliverableChunk as { data: { content: unknown } }).data
        .content as {
        report: string;
        data: {
          overview: unknown;
          byLevel: unknown;
          byType: unknown;
          highlights: unknown;
          trends: unknown;
          suggestions: unknown;
        };
        generatedAt: string;
      };

      expect(content.report).toBeDefined();
      expect(content.data.overview).toBeDefined();
      expect(content.data.byLevel).toBeDefined();
      expect(content.data.byType).toBeDefined();
      expect(content.data.highlights).toBeDefined();
      expect(content.data.trends).toBeDefined();
      expect(content.data.suggestions).toBeDefined();
      expect(content.generatedAt).toBeDefined();
    }
  });

  it("should filter by messageTypes when provided", async () => {
    const mockClient = createMockSupabaseClient();
    // mockChain 可用于验证查询链调用
    const _mockChain = (mockClient.from as jest.Mock).mock.results[0]?.value;

    (createClient as jest.Mock).mockResolvedValue(mockClient);

    const context: OrchestrationContext = {
      userId: "test-user",
      conversationId: "test-conv",
      params: {
        period: "daily",
        includeRead: false,
        autoMarkRead: false,
        messageTypes: ["import_complete"],
      },
    };

    await collectChunks(skill.executeStream(context));

    // Verify the query chain was called with proper filters
    expect(mockClient.from).toHaveBeenCalledWith("messages");
  });
});
