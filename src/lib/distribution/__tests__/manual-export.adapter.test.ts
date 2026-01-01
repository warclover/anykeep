/**
 * ManualExportAdapter 单元测试
 */

import { ManualExportAdapter } from "../adapters/manual-export.adapter";
import type { DistributionTarget, DistributionBookmark } from "../types";
import type { ExportResult } from "@/lib/export/types";

// Mock ExportService
const mockExport = jest.fn();
const mockCancel = jest.fn();

jest.mock("@/lib/export/services/export.service", () => ({
  ExportService: jest.fn().mockImplementation(() => ({
    export: mockExport,
    cancel: mockCancel,
  })),
  generateExportFilename: jest
    .fn()
    .mockReturnValue("anykeep_export_20260101_1200.csv"),
}));

jest.mock("@/lib/export/constants", () => ({
  EXPORT_FORMAT_CONFIG: {
    csv: { extension: "csv", mimeType: "text/csv" },
    json: { extension: "json", mimeType: "application/json" },
    markdown: { extension: "md", mimeType: "text/markdown" },
    obsidian: { extension: "md", mimeType: "text/markdown" },
    html: { extension: "html", mimeType: "text/html" },
  },
}));

describe("ManualExportAdapter", () => {
  let adapter: ManualExportAdapter;

  const mockTarget: DistributionTarget = {
    id: "target-1",
    userId: "user-1",
    targetType: "manual_export",
    name: "CSV 导出",
    enabled: true,
    trigger: { mode: "manual" },
    targetConfig: {
      format: "csv",
      fields: ["title", "url", "platform"],
    },
    status: "idle",
    syncedCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockBookmarks: DistributionBookmark[] = [
    {
      id: "bookmark-1",
      title: "Test Bookmark 1",
      url: "https://example.com/1",
      platform: "wechat",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "bookmark-2",
      title: "Test Bookmark 2",
      url: "https://example.com/2",
      platform: "bilibili",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    adapter = new ManualExportAdapter();
  });

  describe("metadata", () => {
    it("should have correct type", () => {
      expect(adapter.type).toBe("manual_export");
    });

    it("should have correct display name", () => {
      expect(adapter.displayName).toBe("手动导出");
    });

    it("should support all platforms", () => {
      expect(adapter.supportedPlatforms).toContain("web");
      expect(adapter.supportedPlatforms).toContain("mobile");
      expect(adapter.supportedPlatforms).toContain("desktop");
    });
  });

  describe("initialize", () => {
    it("should resolve without error", async () => {
      await expect(adapter.initialize(mockTarget)).resolves.not.toThrow();
    });
  });

  describe("validateConfig", () => {
    it("should return valid for correct config", async () => {
      const result = await adapter.validateConfig(mockTarget);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should return invalid when format is missing", async () => {
      const invalidTarget = {
        ...mockTarget,
        targetConfig: {},
      };

      const result = await adapter.validateConfig(invalidTarget);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("缺少导出格式配置");
    });

    it("should return invalid for unsupported format", async () => {
      const invalidTarget = {
        ...mockTarget,
        targetConfig: { format: "unsupported" },
      };

      const result = await adapter.validateConfig(invalidTarget);

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain("不支持的导出格式");
    });

    it("should return invalid when fields is not array", async () => {
      const invalidTarget = {
        ...mockTarget,
        targetConfig: { format: "csv", fields: "not-array" },
      };

      const result = await adapter.validateConfig(invalidTarget);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("fields 必须是数组");
    });

    it("should include warning for obsidian zip mode", async () => {
      const zipTarget = {
        ...mockTarget,
        targetConfig: {
          format: "obsidian",
          options: { zipMultipleFiles: true },
        },
      };

      const result = await adapter.validateConfig(zipTarget);

      expect(result.valid).toBe(true);
      expect(result.warnings).toBeDefined();
      expect(result.warnings?.[0]).toContain("ZIP");
    });
  });

  describe("testConnection", () => {
    it("should return success", async () => {
      const result = await adapter.testConnection(mockTarget);

      expect(result.success).toBe(true);
      expect(result.details?.supportedFormats).toBeDefined();
    });
  });

  describe("distribute", () => {
    it("should call export service with correct parameters", async () => {
      const exportResult: ExportResult = {
        success: true,
        filename: "anykeep_export_20260101_1200.csv",
        content: "title,url,platform\nTest,https://example.com,wechat",
        count: 2,
        format: "csv",
        size: 100,
        duration: 500,
      };

      mockExport.mockResolvedValueOnce(exportResult);

      const result = await adapter.distribute(mockBookmarks, mockTarget);

      expect(mockExport).toHaveBeenCalledTimes(1);
      expect(result.success).toBe(true);
      expect(result.distributedCount).toBe(2);
      expect(result.failedCount).toBe(0);
    });

    it("should return deliverable on success", async () => {
      const exportResult: ExportResult = {
        success: true,
        filename: "anykeep_export_20260101_1200.csv",
        content: "title,url,platform\nTest,https://example.com,wechat",
        count: 2,
        format: "csv",
        size: 100,
      };

      mockExport.mockResolvedValueOnce(exportResult);

      const result = await adapter.distribute(mockBookmarks, mockTarget);

      expect(result.deliverable).toBeDefined();
      expect(result.deliverable?.type).toBe("download");
      expect(result.deliverable?.filename).toBe(
        "anykeep_export_20260101_1200.csv",
      );
      expect(result.deliverable?.mimeType).toBe("text/csv");
    });

    it("should return error on failure", async () => {
      const exportResult: ExportResult = {
        success: false,
        filename: "",
        content: "",
        count: 0,
        format: "csv",
        error: "导出失败",
        errorCode: "UNKNOWN",
      };

      mockExport.mockResolvedValueOnce(exportResult);

      const result = await adapter.distribute(mockBookmarks, mockTarget);

      expect(result.success).toBe(false);
      expect(result.distributedCount).toBe(0);
      expect(result.failedCount).toBe(2);
      expect(result.errors).toBeDefined();
      expect(result.deliverable).toBeUndefined();
    });

    it("should create distribution records for each bookmark", async () => {
      const exportResult: ExportResult = {
        success: true,
        filename: "anykeep_export_20260101_1200.csv",
        content: "test",
        count: 2,
        format: "csv",
      };

      mockExport.mockResolvedValueOnce(exportResult);

      const result = await adapter.distribute(mockBookmarks, mockTarget);

      expect(result.records).toHaveLength(2);
      expect(result.records[0].bookmarkId).toBe("bookmark-1");
      expect(result.records[1].bookmarkId).toBe("bookmark-2");
      expect(result.records[0].status).toBe("success");
    });

    it("should handle json format", async () => {
      const jsonTarget = {
        ...mockTarget,
        targetConfig: { format: "json" },
      };

      const exportResult: ExportResult = {
        success: true,
        filename: "anykeep_export_20260101_1200.json",
        content: "[]",
        count: 2,
        format: "json",
      };

      mockExport.mockResolvedValueOnce(exportResult);

      const result = await adapter.distribute(mockBookmarks, jsonTarget);

      expect(result.success).toBe(true);
      expect(result.deliverable?.mimeType).toBe("application/json");
    });

    it("should handle markdown format", async () => {
      const mdTarget = {
        ...mockTarget,
        targetConfig: {
          format: "markdown",
          options: { includeAiSummary: true },
        },
      };

      const exportResult: ExportResult = {
        success: true,
        filename: "anykeep_export_20260101_1200.md",
        content: "# Bookmarks",
        count: 2,
        format: "markdown",
      };

      mockExport.mockResolvedValueOnce(exportResult);

      const result = await adapter.distribute(mockBookmarks, mdTarget);

      expect(result.success).toBe(true);
      expect(result.deliverable?.mimeType).toBe("text/markdown");
    });

    it("should handle obsidian format with zip option", async () => {
      const obsidianTarget = {
        ...mockTarget,
        targetConfig: {
          format: "obsidian",
          options: { zipMultipleFiles: true },
        },
      };

      const exportResult: ExportResult = {
        success: true,
        filename: "anykeep_export_20260101_1200.zip",
        content: new Blob(["test"]),
        count: 2,
        format: "obsidian-zip",
      };

      mockExport.mockResolvedValueOnce(exportResult);

      const result = await adapter.distribute(mockBookmarks, obsidianTarget);

      expect(result.success).toBe(true);
      // Blob content in test environment (no URL.createObjectURL) should result in undefined url
      expect(result.deliverable).toBeDefined();
      expect(result.deliverable?.filename).toBe(
        "anykeep_export_20260101_1200.zip",
      );
    });
  });
});
