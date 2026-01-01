/**
 * ObsidianAdapter 单元测试
 */

import {
  ObsidianAdapter,
  type FileSystemInterface,
  type PathInterface,
} from "../adapters/obsidian.adapter";
import type { DistributionTarget, DistributionBookmark } from "../types";

describe("ObsidianAdapter", () => {
  let adapter: ObsidianAdapter;
  let mockFs: jest.Mocked<FileSystemInterface>;
  let mockPath: jest.Mocked<PathInterface>;

  const mockTarget: DistributionTarget = {
    id: "target-1",
    userId: "user-1",
    targetType: "obsidian",
    name: "My Obsidian Vault",
    enabled: true,
    trigger: { mode: "manual" },
    targetConfig: {
      vaultPath: "/Users/test/Documents/Obsidian",
      folderName: "AnyKeep",
      filenamePattern: "{{title}}-{{date}}",
      useYamlFrontmatter: true,
    } as Record<string, unknown>,
    status: "idle",
    syncedCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockBookmarks: DistributionBookmark[] = [
    {
      id: "bookmark-1",
      title: "Test Article 1",
      url: "https://example.com/article1",
      platform: "wechat",
      description: "This is a test description",
      aiSummary: "AI generated summary",
      tags: ["tech", "ai"],
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-01"),
    },
    {
      id: "bookmark-2",
      title: "Test Article 2",
      url: "https://example.com/article2",
      platform: "bilibili",
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-01"),
    },
  ];

  beforeEach(() => {
    // 创建 mock
    mockFs = {
      mkdir: jest.fn().mockResolvedValue(undefined),
      writeFile: jest.fn().mockResolvedValue(undefined),
      access: jest.fn().mockRejectedValue(new Error("ENOENT")), // 默认文件不存在
      unlink: jest.fn().mockResolvedValue(undefined),
    };

    mockPath = {
      join: jest.fn((...parts: string[]) => parts.join("/")),
    };

    // 使用依赖注入创建适配器
    adapter = new ObsidianAdapter(mockFs, mockPath);
  });

  describe("metadata", () => {
    it("should have correct type", () => {
      expect(adapter.type).toBe("obsidian");
    });

    it("should have correct display name", () => {
      expect(adapter.displayName).toBe("Obsidian 本地同步");
    });

    it("should only support desktop platform", () => {
      expect(adapter.supportedPlatforms).toEqual(["desktop"]);
      expect(adapter.supportedPlatforms).not.toContain("web");
      expect(adapter.supportedPlatforms).not.toContain("mobile");
    });
  });

  describe("initialize", () => {
    it("should resolve without error on desktop", async () => {
      await expect(adapter.initialize(mockTarget)).resolves.not.toThrow();
    });
  });

  describe("validateConfig", () => {
    it("should return valid for correct config", async () => {
      mockFs.access.mockResolvedValueOnce(undefined); // 路径存在

      const result = await adapter.validateConfig(mockTarget);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should return invalid when vaultPath is missing", async () => {
      const invalidTarget = {
        ...mockTarget,
        targetConfig: {
          folderName: "AnyKeep",
        },
      };

      const result = await adapter.validateConfig(invalidTarget);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Vault 路径不能为空");
    });

    it("should return invalid when vaultPath does not exist", async () => {
      mockFs.access.mockRejectedValueOnce(new Error("ENOENT"));

      const result = await adapter.validateConfig(mockTarget);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Vault 路径不存在或无访问权限");
    });

    it("should return invalid when folderName is missing", async () => {
      mockFs.access.mockResolvedValueOnce(undefined);

      const invalidTarget = {
        ...mockTarget,
        targetConfig: {
          vaultPath: "/Users/test/Documents/Obsidian",
        },
      };

      const result = await adapter.validateConfig(invalidTarget);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("保存目录不能为空");
    });

    it("should return warning for invalid filename pattern", async () => {
      mockFs.access.mockResolvedValueOnce(undefined);

      const targetWithInvalidPattern = {
        ...mockTarget,
        targetConfig: {
          ...mockTarget.targetConfig,
          filenamePattern: "invalid-pattern",
        },
      };

      const result = await adapter.validateConfig(targetWithInvalidPattern);

      expect(result.valid).toBe(true);
      expect(result.warnings).toBeDefined();
      expect(result.warnings?.[0]).toContain("不支持的文件名模式");
    });
  });

  describe("testConnection", () => {
    it("should return success when path is writable", async () => {
      mockFs.access.mockResolvedValue(undefined); // 路径存在
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);
      mockFs.unlink.mockResolvedValue(undefined);

      const result = await adapter.testConnection(mockTarget);

      expect(result.success).toBe(true);
      expect(result.details?.vaultPath).toBe("/Users/test/Documents/Obsidian");
      expect(mockFs.unlink).toHaveBeenCalled(); // 测试文件应该被删除
    });

    it("should return failure when write fails", async () => {
      mockFs.access.mockResolvedValue(undefined);
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockRejectedValue(new Error("Permission denied"));

      const result = await adapter.testConnection(mockTarget);

      expect(result.success).toBe(false);
      expect(result.error).toContain("无法写入测试文件");
    });
  });

  describe("distribute", () => {
    beforeEach(() => {
      // 模拟：文件不存在（需要创建）
      mockFs.access.mockRejectedValue(new Error("ENOENT"));
    });

    it("should create directory and write files", async () => {
      const result = await adapter.distribute(mockBookmarks, mockTarget);

      expect(mockFs.mkdir).toHaveBeenCalledWith(
        "/Users/test/Documents/Obsidian/AnyKeep",
        { recursive: true },
      );
      expect(mockFs.writeFile).toHaveBeenCalledTimes(2);
      expect(result.success).toBe(true);
      expect(result.distributedCount).toBe(2);
      expect(result.failedCount).toBe(0);
    });

    it("should create markdown files with correct content", async () => {
      await adapter.distribute([mockBookmarks[0]], mockTarget);

      expect(mockFs.writeFile).toHaveBeenCalledTimes(1);

      // 验证写入的内容
      const writeCall = mockFs.writeFile.mock.calls[0];
      const content = writeCall[1] as string;

      // 验证 frontmatter
      expect(content).toContain("---");
      expect(content).toContain('title: "Test Article 1"');
      expect(content).toContain('url: "https://example.com/article1"');
      expect(content).toContain('platform: "wechat"');
      expect(content).toContain("tags:");
      expect(content).toContain("  - tech");
      expect(content).toContain("  - ai");

      // 验证正文内容
      expect(content).toContain("# Test Article 1");
      expect(content).toContain("**链接**：[https://example.com/article1]");
      expect(content).toContain("## 摘要");
      expect(content).toContain("AI generated summary");
      expect(content).toContain("## 描述");
      expect(content).toContain("This is a test description");
      expect(content).toContain("#tech");
      expect(content).toContain("#ai");
    });

    it("should skip existing files (idempotency)", async () => {
      // 第一个文件存在，第二个不存在
      mockFs.access
        .mockResolvedValueOnce(undefined) // 第一个文件存在
        .mockRejectedValueOnce(new Error("ENOENT")); // 第二个文件不存在

      const result = await adapter.distribute(mockBookmarks, mockTarget);

      expect(mockFs.writeFile).toHaveBeenCalledTimes(1); // 只写入一个文件
      expect(result.success).toBe(true);
      expect(result.distributedCount).toBe(2); // 两个都算成功
    });

    it("should handle filename conflicts", async () => {
      const sameNameBookmarks: DistributionBookmark[] = [
        {
          id: "bookmark-1",
          title: "Same Title",
          url: "https://example.com/1",
          createdAt: new Date("2026-01-01"),
          updatedAt: new Date("2026-01-01"),
        },
        {
          id: "bookmark-2",
          title: "Same Title",
          url: "https://example.com/2",
          createdAt: new Date("2026-01-01"),
          updatedAt: new Date("2026-01-01"),
        },
      ];

      await adapter.distribute(sameNameBookmarks, mockTarget);

      expect(mockFs.writeFile).toHaveBeenCalledTimes(2);

      // 验证第二个文件有序号后缀
      const firstPath = mockFs.writeFile.mock.calls[0][0] as string;
      const secondPath = mockFs.writeFile.mock.calls[1][0] as string;

      expect(firstPath).toContain("Same_Title");
      // 文件名格式: Same_Title-2026-01-01.md, Same_Title-2026-01-01_1.md
      expect(secondPath).toContain("_1.md");
    });

    it("should return distribution records", async () => {
      const result = await adapter.distribute(mockBookmarks, mockTarget);

      expect(result.records).toHaveLength(2);
      expect(result.records[0].bookmarkId).toBe("bookmark-1");
      expect(result.records[0].status).toBe("success");
      expect(result.records[0].externalId).toContain("AnyKeep");
      expect(result.records[1].bookmarkId).toBe("bookmark-2");
      expect(result.records[1].status).toBe("success");
    });

    it("should handle write failures gracefully", async () => {
      mockFs.writeFile
        .mockResolvedValueOnce(undefined) // 第一个成功
        .mockRejectedValueOnce(new Error("Disk full")); // 第二个失败

      const result = await adapter.distribute(mockBookmarks, mockTarget);

      expect(result.success).toBe(false);
      expect(result.distributedCount).toBe(1);
      expect(result.failedCount).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors?.[0].message).toContain("Disk full");
    });

    it("should handle directory creation failure", async () => {
      mockFs.mkdir.mockRejectedValue(new Error("Permission denied"));

      const result = await adapter.distribute(mockBookmarks, mockTarget);

      expect(result.success).toBe(false);
      expect(result.distributedCount).toBe(0);
      expect(result.failedCount).toBe(2);
      expect(result.errors?.[0].code).toBe("DIRECTORY_CREATE_FAILED");
    });

    it("should sanitize filename with special characters", async () => {
      const bookmarkWithSpecialChars: DistributionBookmark[] = [
        {
          id: "bookmark-special",
          title: 'Title: with <special> "characters" | and/more?',
          url: "https://example.com/special",
          createdAt: new Date("2026-01-01"),
          updatedAt: new Date("2026-01-01"),
        },
      ];

      await adapter.distribute(bookmarkWithSpecialChars, mockTarget);

      const writtenPath = mockFs.writeFile.mock.calls[0][0] as string;
      expect(writtenPath).not.toContain(":");
      expect(writtenPath).not.toContain("<");
      expect(writtenPath).not.toContain(">");
      expect(writtenPath).not.toContain('"');
      expect(writtenPath).not.toContain("|");
      expect(writtenPath).not.toContain("?");
    });

    it("should generate correct filename from pattern", async () => {
      await adapter.distribute([mockBookmarks[0]], mockTarget);

      const writtenPath = mockFs.writeFile.mock.calls[0][0] as string;
      // Pattern: {{title}}-{{date}}
      expect(writtenPath).toContain("Test_Article_1");
      expect(writtenPath).toContain("2026-01-01");
      expect(writtenPath.endsWith(".md")).toBe(true);
    });
  });

  describe("getDefaultConfig", () => {
    it("should return sensible defaults", () => {
      const config = adapter.getDefaultConfig();

      expect(config.vaultPath).toBe("");
      expect(config.folderName).toBe("AnyKeep");
      expect(config.filenamePattern).toBe("{{title}}-{{date}}");
      expect(config.useYamlFrontmatter).toBe(true);
    });
  });

  describe("dispose", () => {
    it("should resolve without error", async () => {
      await expect(adapter.dispose()).resolves.not.toThrow();
    });
  });
});
