/**
 * ShareBundleSkill 单元测试
 *
 * @version 1.0.0
 * @since 2025-12-24
 */

import { ShareBundleSkill, shareBundleSkill } from "../share-bundle.skill";
import type { OrchestrationContext } from "../../../orchestration/types";
import {
  SHARE_FORMAT_CONFIG,
  DEFAULT_SHARE_CONFIG,
  generateShareId,
} from "../types";
import type { ShareBundleInput } from "../types";

// Mock Supabase client
jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          is: jest.fn(() => ({
            in: jest.fn(() => ({
              order: jest.fn(() => ({
                limit: jest.fn(() =>
                  Promise.resolve({
                    data: [],
                    error: null,
                  }),
                ),
              })),
            })),
            contains: jest.fn(() => ({
              order: jest.fn(() => ({
                limit: jest.fn(() =>
                  Promise.resolve({
                    data: [],
                    error: null,
                  }),
                ),
              })),
            })),
            order: jest.fn(() => ({
              limit: jest.fn(() =>
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

describe("ShareBundleSkill", () => {
  let skill: ShareBundleSkill;

  beforeEach(() => {
    skill = new ShareBundleSkill();
  });

  describe("metadata", () => {
    it("should have correct metadata", () => {
      expect(skill.metadata.id).toBe("share_bundle");
      expect(skill.metadata.name).toBe("分享包助手");
      expect(skill.metadata.category).toBe("utility");
      expect(skill.metadata.deliverableTypes).toContain("document");
      expect(skill.metadata.deliverableTypes).toContain("list");
    });

    it("should have valid steps definition", () => {
      expect(skill.metadata.steps).toBeDefined();
      expect(skill.metadata.steps!.length).toBe(4);
      expect(skill.metadata.steps![0].id).toBe("collect");
      expect(skill.metadata.steps![3].id).toBe("finalize");
    });

    it("should have required capabilities", () => {
      expect(skill.metadata.capabilities).toContain("share-link");
      expect(skill.metadata.capabilities).toContain("export-html");
      expect(skill.metadata.capabilities).toContain("export-markdown");
      expect(skill.metadata.capabilities).toContain("access-control");
    });

    it("should not require confirmation", () => {
      expect(skill.metadata.requiresConfirmation).toBe(false);
    });

    it("should support multiple output formats", () => {
      expect(skill.metadata.outputFormats).toContain("html");
      expect(skill.metadata.outputFormats).toContain("markdown");
      expect(skill.metadata.outputFormats).toContain("json");
    });
  });

  describe("parseInput", () => {
    const mockContext: OrchestrationContext = {
      userId: "test-user",
      params: null,
    };

    it("should parse format from message", async () => {
      const linkResult = await skill.parseInput("生成分享链接", mockContext);
      expect(linkResult.format).toBe("link");

      const htmlResult = await skill.parseInput("生成 HTML 页面", mockContext);
      expect(htmlResult.format).toBe("html");

      const mdResult = await skill.parseInput(
        "导出 markdown 格式",
        mockContext,
      );
      expect(mdResult.format).toBe("markdown");

      const jsonResult = await skill.parseInput("导出 json 数据", mockContext);
      expect(jsonResult.format).toBe("json");
    });

    it("should parse scope from message", async () => {
      const folderResult = await skill.parseInput(
        "分享整个文件夹",
        mockContext,
      );
      expect(folderResult.scope).toBe("folder");

      const tagResult = await skill.parseInput("分享标签内容", mockContext);
      expect(tagResult.scope).toBe("tag");

      const defaultResult = await skill.parseInput("分享书签", mockContext);
      expect(defaultResult.scope).toBe("bookmarks");
    });

    it("should parse visibility from message", async () => {
      const publicResult = await skill.parseInput("公开分享", mockContext);
      expect(publicResult.visibility).toBe("public");

      const passwordResult = await skill.parseInput(
        "使用密码保护",
        mockContext,
      );
      expect(passwordResult.visibility).toBe("password");

      const defaultResult = await skill.parseInput("分享书签", mockContext);
      expect(defaultResult.visibility).toBe("private");
    });

    it("should parse expiration from message", async () => {
      const daysResult = await skill.parseInput("分享 30 天", mockContext);
      expect(daysResult.expirationDays).toBe(30);

      const foreverResult = await skill.parseInput("永久分享", mockContext);
      expect(foreverResult.expirationDays).toBe(0);

      const noExpireResult = await skill.parseInput("不过期", mockContext);
      expect(noExpireResult.expirationDays).toBe(0);
    });

    it("should use default values when not specified", async () => {
      const result = await skill.parseInput("分享", mockContext);
      expect(result.format).toBe(DEFAULT_SHARE_CONFIG.format);
      expect(result.visibility).toBe(DEFAULT_SHARE_CONFIG.visibility);
      expect(result.expirationDays).toBe(DEFAULT_SHARE_CONFIG.expirationDays);
    });
  });

  describe("SHARE_FORMAT_CONFIG", () => {
    it("should have correct link config", () => {
      expect(SHARE_FORMAT_CONFIG.link.name).toBe("分享链接");
      expect(SHARE_FORMAT_CONFIG.link.icon).toBe("🔗");
      expect(SHARE_FORMAT_CONFIG.link.extension).toBeUndefined();
    });

    it("should have correct html config", () => {
      expect(SHARE_FORMAT_CONFIG.html.name).toBe("HTML 页面");
      expect(SHARE_FORMAT_CONFIG.html.icon).toBe("🌐");
      expect(SHARE_FORMAT_CONFIG.html.extension).toBe(".html");
      expect(SHARE_FORMAT_CONFIG.html.mimeType).toBe("text/html");
    });

    it("should have correct markdown config", () => {
      expect(SHARE_FORMAT_CONFIG.markdown.name).toBe("Markdown");
      expect(SHARE_FORMAT_CONFIG.markdown.icon).toBe("📝");
      expect(SHARE_FORMAT_CONFIG.markdown.extension).toBe(".md");
      expect(SHARE_FORMAT_CONFIG.markdown.mimeType).toBe("text/markdown");
    });

    it("should have correct json config", () => {
      expect(SHARE_FORMAT_CONFIG.json.name).toBe("JSON 数据");
      expect(SHARE_FORMAT_CONFIG.json.icon).toBe("📦");
      expect(SHARE_FORMAT_CONFIG.json.extension).toBe(".json");
      expect(SHARE_FORMAT_CONFIG.json.mimeType).toBe("application/json");
    });
  });

  describe("DEFAULT_SHARE_CONFIG", () => {
    it("should have correct default values", () => {
      expect(DEFAULT_SHARE_CONFIG.format).toBe("link");
      expect(DEFAULT_SHARE_CONFIG.visibility).toBe("private");
      expect(DEFAULT_SHARE_CONFIG.expirationDays).toBe(7);
      expect(DEFAULT_SHARE_CONFIG.options.includeSummary).toBe(true);
      expect(DEFAULT_SHARE_CONFIG.options.includeTags).toBe(true);
      expect(DEFAULT_SHARE_CONFIG.options.includeRating).toBe(false);
      expect(DEFAULT_SHARE_CONFIG.options.includeNotes).toBe(false);
      expect(DEFAULT_SHARE_CONFIG.options.theme).toBe("auto");
    });
  });

  describe("generateShareId", () => {
    it("should generate 8-character ID", () => {
      const id = generateShareId();
      expect(id.length).toBe(8);
    });

    it("should generate lowercase alphanumeric characters", () => {
      const id = generateShareId();
      expect(id).toMatch(/^[a-z0-9]+$/);
    });

    it("should generate unique IDs", () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ids.add(generateShareId());
      }
      // With 8 alphanumeric chars, collisions should be very rare
      expect(ids.size).toBe(100);
    });
  });

  describe("inputSchema", () => {
    it("should validate valid input", () => {
      const validInput: ShareBundleInput = {
        format: "html",
        scope: "folder",
        folderId: 123,
        title: "My Share",
        description: "Test description",
        visibility: "public",
        expirationDays: 30,
      };

      const result = skill.inputSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it("should apply default values", () => {
      const minimalInput = {};
      const result = skill.inputSchema.safeParse(minimalInput);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.format).toBe("link");
        expect(result.data.scope).toBe("bookmarks");
        expect(result.data.visibility).toBe("private");
        expect(result.data.expirationDays).toBe(7);
      }
    });

    it("should reject invalid format", () => {
      const invalidInput = { format: "pdf" };
      const result = skill.inputSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it("should reject invalid scope", () => {
      const invalidInput = { scope: "all" };
      const result = skill.inputSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it("should reject invalid visibility", () => {
      const invalidInput = { visibility: "protected" };
      const result = skill.inputSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it("should reject invalid expiration days", () => {
      const tooHigh = { expirationDays: 500 };
      expect(skill.inputSchema.safeParse(tooHigh).success).toBe(false);

      const negative = { expirationDays: -1 };
      expect(skill.inputSchema.safeParse(negative).success).toBe(false);
    });

    it("should accept valid options", () => {
      const inputWithOptions: ShareBundleInput = {
        format: "html",
        scope: "bookmarks",
        bookmarkIds: [1, 2, 3],
        options: {
          includeSummary: true,
          includeTags: false,
          includeRating: true,
          includeNotes: true,
          theme: "dark",
        },
      };

      const result = skill.inputSchema.safeParse(inputWithOptions);
      expect(result.success).toBe(true);
    });
  });

  describe("singleton export", () => {
    it("should export a singleton instance", () => {
      expect(shareBundleSkill).toBeInstanceOf(ShareBundleSkill);
      expect(shareBundleSkill.metadata.id).toBe("share_bundle");
    });
  });
});
