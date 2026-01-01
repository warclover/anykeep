/**
 * 分发模块类型测试
 *
 * @description 测试类型定义和类型守卫函数
 */

import {
  isDistributionTargetType,
  isTriggerMode,
  isDistributionStatus,
  type DistributionTarget,
  type DistributionRecord,
  type DistributionResult,
  type DistributionEvent,
  type DistributionFilters,
  type ObsidianTargetConfig,
  type NotionTargetConfig,
  type WebhookTargetConfig,
  type RssTargetConfig,
  type ManualExportTargetConfig,
} from "../types";

describe("distribution/types", () => {
  describe("isDistributionTargetType", () => {
    it("should return true for valid target types", () => {
      expect(isDistributionTargetType("obsidian")).toBe(true);
      expect(isDistributionTargetType("notion")).toBe(true);
      expect(isDistributionTargetType("webhook")).toBe(true);
      expect(isDistributionTargetType("rss")).toBe(true);
      expect(isDistributionTargetType("manual_export")).toBe(true);
    });

    it("should return false for invalid target types", () => {
      expect(isDistributionTargetType("invalid")).toBe(false);
      expect(isDistributionTargetType("")).toBe(false);
      expect(isDistributionTargetType(null)).toBe(false);
      expect(isDistributionTargetType(undefined)).toBe(false);
      expect(isDistributionTargetType(123)).toBe(false);
      expect(isDistributionTargetType({})).toBe(false);
    });
  });

  describe("isTriggerMode", () => {
    it("should return true for valid trigger modes", () => {
      expect(isTriggerMode("realtime")).toBe(true);
      expect(isTriggerMode("scheduled")).toBe(true);
      expect(isTriggerMode("manual")).toBe(true);
    });

    it("should return false for invalid trigger modes", () => {
      expect(isTriggerMode("invalid")).toBe(false);
      expect(isTriggerMode("")).toBe(false);
      expect(isTriggerMode(null)).toBe(false);
      expect(isTriggerMode(undefined)).toBe(false);
    });
  });

  describe("isDistributionStatus", () => {
    it("should return true for valid statuses", () => {
      expect(isDistributionStatus("idle")).toBe(true);
      expect(isDistributionStatus("syncing")).toBe(true);
      expect(isDistributionStatus("error")).toBe(true);
    });

    it("should return false for invalid statuses", () => {
      expect(isDistributionStatus("invalid")).toBe(false);
      expect(isDistributionStatus("")).toBe(false);
      expect(isDistributionStatus(null)).toBe(false);
      expect(isDistributionStatus(undefined)).toBe(false);
    });
  });

  describe("Type structures", () => {
    it("should allow creating DistributionTarget", () => {
      const target: DistributionTarget = {
        id: "target-1",
        userId: "user-1",
        targetType: "obsidian",
        name: "我的 Obsidian",
        enabled: true,
        trigger: {
          mode: "realtime",
        },
        filters: {
          platforms: ["wechat"],
          tags: ["技术"],
        },
        targetConfig: {
          vaultPath: "/path/to/vault",
          folderName: "AnyKeep",
        },
        status: "idle",
        syncedCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(target.id).toBe("target-1");
      expect(target.targetType).toBe("obsidian");
      expect(target.trigger.mode).toBe("realtime");
    });

    it("should allow creating DistributionRecord", () => {
      const record: DistributionRecord = {
        id: "record-1",
        targetId: "target-1",
        bookmarkId: "bookmark-1",
        status: "success",
        distributedAt: new Date(),
        externalId: "/path/to/file.md",
        retryCount: 0,
        createdAt: new Date(),
      };

      expect(record.id).toBe("record-1");
      expect(record.status).toBe("success");
    });

    it("should allow creating DistributionResult", () => {
      const result: DistributionResult = {
        success: true,
        distributedCount: 10,
        failedCount: 0,
        records: [],
      };

      expect(result.success).toBe(true);
      expect(result.distributedCount).toBe(10);
    });

    it("should allow creating DistributionEvent", () => {
      const event1: DistributionEvent = {
        type: "bookmark_created",
        bookmarkId: "bookmark-1",
        userId: "user-1",
      };

      const event2: DistributionEvent = {
        type: "manual_trigger",
        targetId: "target-1",
        userId: "user-1",
        bookmarkIds: ["b1", "b2"],
      };

      expect(event1.type).toBe("bookmark_created");
      expect(event2.type).toBe("manual_trigger");
    });

    it("should allow creating DistributionFilters", () => {
      const filters: DistributionFilters = {
        platforms: ["wechat", "bilibili"],
        folders: ["folder-1"],
        tags: ["技术", "设计"],
        includeAiSummary: true,
      };

      expect(filters.platforms).toHaveLength(2);
      expect(filters.includeAiSummary).toBe(true);
    });
  });

  describe("Target config types", () => {
    it("should allow creating ObsidianTargetConfig", () => {
      const config: ObsidianTargetConfig = {
        vaultPath: "/Users/test/Obsidian",
        folderName: "AnyKeep",
        filenamePattern: "{{title}}-{{date}}",
        useYamlFrontmatter: true,
      };

      expect(config.vaultPath).toBe("/Users/test/Obsidian");
      expect(config.useYamlFrontmatter).toBe(true);
    });

    it("should allow creating NotionTargetConfig", () => {
      const config: NotionTargetConfig = {
        databaseId: "db-123",
        propertyMapping: {
          title: "Name",
          url: "URL",
          tags: "Tags",
        },
        workspaceName: "My Workspace",
      };

      expect(config.databaseId).toBe("db-123");
      expect(config.propertyMapping.title).toBe("Name");
    });

    it("should allow creating WebhookTargetConfig", () => {
      const config: WebhookTargetConfig = {
        url: "https://example.com/webhook",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        secretKey: "secret-123",
        retryCount: 3,
      };

      expect(config.url).toBe("https://example.com/webhook");
      expect(config.method).toBe("POST");
      expect(config.retryCount).toBe(3);
    });

    it("should allow creating RssTargetConfig", () => {
      const config: RssTargetConfig = {
        feedFormat: "rss2",
        itemCount: 50,
        includeContent: true,
        feedToken: "abc123",
      };

      expect(config.feedFormat).toBe("rss2");
      expect(config.itemCount).toBe(50);
    });

    it("should allow creating ManualExportTargetConfig", () => {
      const config: ManualExportTargetConfig = {
        format: "obsidian",
        fields: ["title", "url", "tags"],
        options: {
          includeAiSummary: true,
          zipMultipleFiles: true,
        },
      };

      expect(config.format).toBe("obsidian");
      expect(config.options?.zipMultipleFiles).toBe(true);
    });
  });
});
