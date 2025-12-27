/**
 * WechatDigestSkill 单元测试
 *
 * @version 1.0.0
 * @since 2025-12-27
 */

import { WechatDigestSkill } from "../wechat-digest.skill";
import type { OrchestrationContext } from "../../../orchestration/types";
import type { OrchestrationStreamChunk } from "../../../output/types";
import { WechatDigestInputSchema, WECHAT_DIGEST_STEPS } from "../types";

// Mock Supabase with proper bookmark_snapshots structure
const mockSupabaseResponse = {
  data: [
    {
      id: 1,
      title: "微信公众号文章1",
      url: "https://mp.weixin.qq.com/s/abc123?__biz=test1",
      platform: "WECHAT_OFFICIAL_ACCOUNT",
      user_tags: ["技术", "编程"],
      created_at: "2025-12-20T10:00:00Z",
      bookmark_snapshots: [
        {
          id: 1,
          readable_text_content: "这是一篇关于技术的文章内容",
          readable_word_count: 1500,
          readable_excerpt: "这是一篇关于技术的文章",
          readable_byline: "技术公众号",
        },
      ],
    },
    {
      id: 2,
      title: "微信公众号文章2",
      url: "https://mp.weixin.qq.com/s/def456?__biz=test2",
      platform: "WECHAT_OFFICIAL_ACCOUNT",
      user_tags: ["设计", "UI"],
      created_at: "2025-12-21T10:00:00Z",
      bookmark_snapshots: [
        {
          id: 2,
          readable_text_content: "这是一篇关于设计的文章内容",
          readable_word_count: 2000,
          readable_excerpt: "这是一篇关于设计的文章",
          readable_byline: "设计公众号",
        },
      ],
    },
  ],
  error: null,
};

// Create a flexible mock chain that handles any method call
const createMockChain = (response: {
  data: unknown[] | null;
  error: unknown;
}) => {
  const chain: Record<string, jest.Mock> = {};
  const methods = ["select", "eq", "is", "order", "limit", "gte", "lte"];

  methods.forEach((method) => {
    chain[method] = jest.fn().mockImplementation(() => chain);
  });

  // Last method in chain should resolve with response
  chain.limit = jest.fn().mockImplementation(() => ({
    ...chain,
    gte: jest.fn().mockImplementation(() => ({
      ...chain,
      lte: jest.fn().mockResolvedValue(response),
    })),
  }));

  // Also handle case without date range (direct resolve from limit)
  const originalLimit = chain.limit;
  chain.limit = jest.fn().mockImplementation(() => {
    const result = originalLimit();
    return {
      ...result,
      then: (resolve: (value: unknown) => void) => resolve(response),
    };
  });

  return chain;
};

const createMockSupabaseClient = (response = mockSupabaseResponse) => {
  const chain = createMockChain(response);
  return {
    from: jest.fn(() => chain),
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

describe("WechatDigestSkill", () => {
  let skill: WechatDigestSkill;

  beforeEach(() => {
    skill = new WechatDigestSkill();
    jest.clearAllMocks();
  });

  describe("metadata", () => {
    it("should have correct id", () => {
      expect(skill.metadata.id).toBe("wechat_digest");
    });

    it("should have correct name", () => {
      expect(skill.metadata.name).toBe("微信阅读摘要");
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
        "analyze",
        "extract",
        "group",
        "summarize",
        "compile",
      ]);
    });
  });

  describe("inputSchema", () => {
    it("should validate correct input with defaults", () => {
      const input = {};
      const result = WechatDigestInputSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.groupBy).toBe("account");
        expect(result.data.depth).toBe("standard");
        expect(result.data.maxArticles).toBe(50);
      }
    });

    it("should validate input with custom values", () => {
      const input = {
        groupBy: "topic",
        depth: "detailed",
        maxArticles: 30,
        dateRange: {
          start: "2025-12-01",
          end: "2025-12-27",
        },
      };
      const result = WechatDigestInputSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it("should reject invalid groupBy value", () => {
      const input = {
        groupBy: "invalid",
      };
      const result = WechatDigestInputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("should reject invalid depth value", () => {
      const input = {
        depth: "invalid",
      };
      const result = WechatDigestInputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("should enforce maxArticles range", () => {
      const inputTooLow = { maxArticles: 0 };
      const inputTooHigh = { maxArticles: 200 };

      expect(WechatDigestInputSchema.safeParse(inputTooLow).success).toBe(
        false,
      );
      expect(WechatDigestInputSchema.safeParse(inputTooHigh).success).toBe(
        false,
      );
    });

    it("should accept filter options", () => {
      const input = {
        filter: {
          accountName: "技术公众号",
          tags: ["技术", "编程"],
        },
      };
      const result = WechatDigestInputSchema.safeParse(input);
      expect(result.success).toBe(true);
    });
  });

  describe("parseInput", () => {
    const mockContext: OrchestrationContext = {
      userId: "test-user",
      conversationId: "test-conv",
      params: {},
    };

    it("should parse default input", async () => {
      const result = await skill.parseInput("生成微信摘要", mockContext);
      expect(result.groupBy).toBe("account");
      expect(result.depth).toBe("standard");
    });

    it("should detect topic grouping", async () => {
      const result = await skill.parseInput("按主题整理微信文章", mockContext);
      expect(result.groupBy).toBe("topic");
    });

    it("should detect date grouping", async () => {
      const result = await skill.parseInput("按日期整理微信收藏", mockContext);
      expect(result.groupBy).toBe("date");
    });

    it("should detect brief depth", async () => {
      const result = await skill.parseInput("简要总结微信文章", mockContext);
      expect(result.depth).toBe("brief");
    });

    it("should detect detailed depth", async () => {
      const result = await skill.parseInput("详细分析微信收藏", mockContext);
      expect(result.depth).toBe("detailed");
    });

    it("should extract account name filter when in quotes", async () => {
      const result = await skill.parseInput(
        "总结「技术公众号」的文章",
        mockContext,
      );
      expect(result.filter?.accountName).toBe("技术公众号");
    });
  });

  describe("step definitions", () => {
    it("should have correct step weights summing to 100", () => {
      const totalWeight = WECHAT_DIGEST_STEPS.reduce(
        (sum, step) => sum + step.weight,
        0,
      );
      expect(totalWeight).toBe(100);
    });

    it("should have analyze step first", () => {
      expect(WECHAT_DIGEST_STEPS[0].id).toBe("analyze");
      expect(WECHAT_DIGEST_STEPS[0].name).toBe("分析收藏集合");
    });

    it("should have compile step last", () => {
      const lastStep = WECHAT_DIGEST_STEPS[WECHAT_DIGEST_STEPS.length - 1];
      expect(lastStep.id).toBe("compile");
      expect(lastStep.name).toBe("编译摘要报告");
    });
  });
});

describe("WechatDigestSkill executeStream", () => {
  let skill: WechatDigestSkill;

  beforeEach(() => {
    skill = new WechatDigestSkill();
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
        groupBy: "account",
        depth: "brief",
        maxArticles: 10,
      },
    };

    const chunks = await collectChunks(skill.executeStream(context));
    const progressChunks = chunks.filter((c) => c.type === "progress");

    // Should have multiple progress updates
    expect(progressChunks.length).toBeGreaterThan(0);

    // Progress should eventually reach 100% for at least one step
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
        groupBy: "account",
        depth: "standard",
        maxArticles: 50,
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
        groupBy: "account",
        depth: "standard",
        maxArticles: 50,
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
        groupBy: "account",
        depth: "standard",
        maxArticles: 50,
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
        groupBy: "account",
        depth: "standard",
        maxArticles: 50,
      },
    };

    const chunks = await collectChunks(skill.executeStream(context));
    const textChunks = chunks.filter((c) => c.type === "text");

    // Should have message about no articles (using "未找到" which matches implementation)
    const noArticlesMsg = textChunks.find((c) =>
      (c.data as { text: string }).text.includes("未找到"),
    );
    expect(noArticlesMsg).toBeDefined();

    // Should emit done with false
    const doneChunk = chunks.find((c) => c.type === "done");
    expect(doneChunk).toBeDefined();
    if (doneChunk) {
      expect((doneChunk as { data: { success: boolean } }).data.success).toBe(
        false,
      );
    }
  });
});
