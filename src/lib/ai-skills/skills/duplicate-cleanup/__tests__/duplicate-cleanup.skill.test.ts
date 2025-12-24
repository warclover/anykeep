/**
 * DuplicateCleanupSkill 单元测试
 */

import { UrlNormalizer, normalizeUrl, compareUrls } from "../url-normalizer";
import { DuplicateCleanupSkill } from "../duplicate-cleanup.skill";
import type { OrchestrationContext } from "../../../orchestration/types";

// Mock Supabase
jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(() =>
    Promise.resolve({
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            is: jest.fn(() => ({
              order: jest.fn(() => ({
                limit: jest.fn(() => ({
                  in: jest.fn(() =>
                    Promise.resolve({
                      data: [],
                      error: null,
                    }),
                  ),
                })),
              })),
            })),
          })),
        })),
      })),
    }),
  ),
}));

// Mock logger
jest.mock("@/lib/logger", () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe("UrlNormalizer", () => {
  let normalizer: UrlNormalizer;

  beforeEach(() => {
    normalizer = new UrlNormalizer();
  });

  describe("normalize", () => {
    it("should normalize basic URLs", () => {
      const result = normalizer.normalize("https://www.example.com/page/");
      expect(result.success).toBe(true);
      expect(result.normalized).toBe("example.com/page");
    });

    it("should remove tracking parameters", () => {
      const result = normalizer.normalize(
        "https://example.com/page?utm_source=google&utm_medium=cpc&id=123",
      );
      expect(result.success).toBe(true);
      expect(result.normalized).toBe("example.com/page?id=123");
      expect(result.removedParams).toContain("utm_source");
      expect(result.removedParams).toContain("utm_medium");
    });

    it("should remove www prefix", () => {
      const result = normalizer.normalize("https://www.example.com/");
      expect(result.normalized).toBe("example.com");
    });

    it("should remove trailing slash", () => {
      const result = normalizer.normalize("https://example.com/page/");
      expect(result.normalized).toBe("example.com/page");
    });

    it("should keep root path slash", () => {
      const result = normalizer.normalize("https://example.com/");
      expect(result.normalized).toBe("example.com");
    });

    it("should sort query parameters", () => {
      const result = normalizer.normalize(
        "https://example.com/page?z=1&a=2&m=3",
      );
      expect(result.normalized).toBe("example.com/page?a=2&m=3&z=1");
    });

    it("should handle URLs without protocol", () => {
      const result = normalizer.normalize("example.com/page");
      expect(result.success).toBe(true);
      expect(result.normalized).toBe("example.com/page");
    });

    it("should handle invalid URLs gracefully", () => {
      const result = normalizer.normalize("not-a-url");
      expect(result.success).toBe(true);
      // 应该尝试添加 https:// 前缀
    });

    it("should reject non-http protocols", () => {
      const result = normalizer.normalize("ftp://example.com/file");
      expect(result.success).toBe(false);
      expect(result.error).toContain("protocol");
    });

    it("should remove Facebook click tracking", () => {
      const result = normalizer.normalize(
        "https://example.com/page?fbclid=IwAR123456",
      );
      expect(result.normalized).toBe("example.com/page");
      expect(result.removedParams).toContain("fbclid");
    });

    it("should remove Google click tracking", () => {
      const result = normalizer.normalize(
        "https://example.com/page?gclid=Cj0KCQ123",
      );
      expect(result.normalized).toBe("example.com/page");
      expect(result.removedParams).toContain("gclid");
    });

    it("should remove WeChat tracking params", () => {
      const result = normalizer.normalize(
        "https://mp.weixin.qq.com/s/abc123?scene=123&subscene=456",
      );
      expect(result.removedParams).toContain("scene");
      expect(result.removedParams).toContain("subscene");
    });
  });

  describe("areEqual", () => {
    it("should detect identical URLs", () => {
      expect(
        normalizer.areEqual(
          "https://www.example.com/page",
          "https://example.com/page/",
        ),
      ).toBe(true);
    });

    it("should detect URLs with different tracking params as equal", () => {
      expect(
        normalizer.areEqual(
          "https://example.com/page?utm_source=google",
          "https://example.com/page?utm_source=facebook",
        ),
      ).toBe(true);
    });

    it("should detect different URLs as not equal", () => {
      expect(
        normalizer.areEqual(
          "https://example.com/page1",
          "https://example.com/page2",
        ),
      ).toBe(false);
    });
  });
});

describe("normalizeUrl helper", () => {
  it("should normalize URL using default normalizer", () => {
    const result = normalizeUrl(
      "https://www.example.com/page/?utm_source=test",
    );
    expect(result).toBe("example.com/page");
  });
});

describe("compareUrls helper", () => {
  it("should compare URLs using default normalizer", () => {
    expect(
      compareUrls("https://www.example.com/page", "https://example.com/page/"),
    ).toBe(true);
  });
});

describe("DuplicateCleanupSkill", () => {
  let skill: DuplicateCleanupSkill;

  beforeEach(() => {
    skill = new DuplicateCleanupSkill();
  });

  describe("metadata", () => {
    it("should have correct id", () => {
      expect(skill.metadata.id).toBe("duplicate_cleanup");
    });

    it("should have correct category", () => {
      expect(skill.metadata.category).toBe("organizing");
    });

    it("should require confirmation", () => {
      expect(skill.metadata.requiresConfirmation).toBe(true);
    });

    it("should have defined steps", () => {
      expect(skill.metadata.steps).toHaveLength(6);
      expect(skill.metadata.steps?.map((s) => s.id)).toEqual([
        "collect",
        "normalize",
        "detect",
        "analyze",
        "confirm",
        "execute",
      ]);
    });
  });

  describe("parseInput", () => {
    const mockContext: OrchestrationContext = {
      userId: "test-user",
      conversationId: "test-conv",
      params: {},
    };

    it("should parse default input", async () => {
      const result = await skill.parseInput("查找重复书签", mockContext);
      expect(result.strategy).toBe("normalized");
      expect(result.keepStrategy).toBe("most_complete");
      expect(result.autoCleanup).toBe(false);
    });

    it("should detect exact strategy", async () => {
      const result = await skill.parseInput("精确匹配查找重复", mockContext);
      expect(result.strategy).toBe("exact");
    });

    it("should detect semantic strategy", async () => {
      const result = await skill.parseInput("语义相似度检测", mockContext);
      expect(result.strategy).toBe("semantic");
    });

    it("should detect oldest keep strategy", async () => {
      const result = await skill.parseInput(
        "查找重复，保留最早的",
        mockContext,
      );
      expect(result.keepStrategy).toBe("oldest");
    });

    it("should detect newest keep strategy", async () => {
      const result = await skill.parseInput(
        "查找重复，保留最新的",
        mockContext,
      );
      expect(result.keepStrategy).toBe("newest");
    });

    it("should detect auto cleanup", async () => {
      const result = await skill.parseInput("自动清理重复书签", mockContext);
      expect(result.autoCleanup).toBe(true);
    });
  });

  describe("inputSchema", () => {
    it("should validate correct input", () => {
      const input = {
        scope: "all",
        strategy: "normalized",
        autoCleanup: false,
        keepStrategy: "most_complete",
      };
      const result = skill.inputSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it("should reject invalid scope", () => {
      const input = {
        scope: "invalid",
        strategy: "normalized",
      };
      const result = skill.inputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("should reject invalid strategy", () => {
      const input = {
        scope: "all",
        strategy: "invalid",
      };
      const result = skill.inputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("should enforce max bookmark IDs limit", () => {
      const input = {
        scope: "selected",
        strategy: "normalized",
        bookmarkIds: Array(101).fill(1),
      };
      const result = skill.inputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("should enforce semantic threshold range", () => {
      const input = {
        scope: "all",
        strategy: "semantic",
        semanticThreshold: 0.5, // Below minimum
      };
      const result = skill.inputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });
});

describe("URL Normalization Edge Cases", () => {
  const normalizer = new UrlNormalizer();

  it("should handle bilibili video URLs", () => {
    const url1 = "https://www.bilibili.com/video/BV1xx411c7mD?from=search";
    const url2 = "https://bilibili.com/video/BV1xx411c7mD";
    expect(normalizer.areEqual(url1, url2)).toBe(true);
  });

  it("should handle zhihu question URLs", () => {
    const url1 = "https://www.zhihu.com/question/123456?from=timeline";
    const url2 = "https://zhihu.com/question/123456";
    expect(normalizer.areEqual(url1, url2)).toBe(true);
  });

  it("should handle WeChat article URLs", () => {
    const url1 =
      "https://mp.weixin.qq.com/s/abc123?scene=123&subscene=456&clicktime=789";
    const url2 = "https://mp.weixin.qq.com/s/abc123";
    expect(normalizer.areEqual(url1, url2)).toBe(true);
  });

  it("should handle GitHub repo URLs", () => {
    const url1 = "https://github.com/user/repo?ref=readme";
    const url2 = "https://github.com/user/repo/";
    expect(normalizer.areEqual(url1, url2)).toBe(true);
  });

  it("should preserve important query params", () => {
    const result = normalizer.normalize(
      "https://example.com/search?q=test&page=2",
    );
    expect(result.normalized).toContain("q=test");
    expect(result.normalized).toContain("page=2");
  });
});
