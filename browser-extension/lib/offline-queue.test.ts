/**
 * Offline Queue Module Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { OfflineQueue } from "./offline-queue";
import type { Platform } from "@/types";

// Mock navigator.onLine
const originalNavigator = global.navigator;
Object.defineProperty(global, "navigator", {
  value: {
    ...originalNavigator,
    onLine: true,
  },
  writable: true,
  configurable: true,
});

// Mock the api module
vi.mock("./api", () => ({
  api: {
    saveBookmark: vi.fn().mockResolvedValue({ success: true, data: { id: 1 } }),
  },
  ApiError: class ApiError extends Error {
    constructor(
      public code: string,
      message: string,
    ) {
      super(message);
    }
  },
}));

describe("OfflineQueue", () => {
  let queue: OfflineQueue;

  beforeEach(async () => {
    // Clear IndexedDB before each test
    const databases = await indexedDB.databases();
    for (const db of databases) {
      if (db.name) {
        indexedDB.deleteDatabase(db.name);
      }
    }

    // Create new queue instance
    queue = new OfflineQueue();
    await queue.init();
  });

  afterEach(() => {
    queue.close();
  });

  describe("init", () => {
    it("should initialize database", async () => {
      const newQueue = new OfflineQueue();
      await expect(newQueue.init()).resolves.not.toThrow();
      newQueue.close();
    });

    it("should not reinitialize if already initialized", async () => {
      // Queue already initialized in beforeEach
      await expect(queue.init()).resolves.not.toThrow();
    });
  });

  describe("add", () => {
    it("should add bookmark to queue", async () => {
      const id = await queue.add({
        url: "https://example.com",
        title: "Test Page",
        platform: "OTHER" as Platform,
      });

      expect(id).toBeDefined();
      expect(typeof id).toBe("string");
    });

    it("should generate unique IDs", async () => {
      const id1 = await queue.add({
        url: "https://example1.com",
        title: "Page 1",
        platform: "OTHER" as Platform,
      });

      const id2 = await queue.add({
        url: "https://example2.com",
        title: "Page 2",
        platform: "OTHER" as Platform,
      });

      expect(id1).not.toBe(id2);
    });

    it("should store metadata", async () => {
      const id = await queue.add({
        url: "https://example.com",
        title: "Test Page",
        platform: "ZHIHU" as Platform,
        metadata: {
          description: "Test description",
          author: "Test Author",
        },
      });

      const item = await queue.get(id);
      expect(item).not.toBeNull();
      expect(item!.metadata).toEqual({
        description: "Test description",
        author: "Test Author",
      });
    });
  });

  describe("getAll", () => {
    it("should return empty array when queue is empty", async () => {
      const items = await queue.getAll();
      expect(items).toEqual([]);
    });

    it("should return all bookmarks", async () => {
      await queue.add({
        url: "https://example1.com",
        title: "Page 1",
        platform: "OTHER" as Platform,
      });

      await queue.add({
        url: "https://example2.com",
        title: "Page 2",
        platform: "OTHER" as Platform,
      });

      const items = await queue.getAll();
      expect(items).toHaveLength(2);
    });
  });

  describe("getCount", () => {
    it("should return 0 when queue is empty", async () => {
      const count = await queue.getCount();
      expect(count).toBe(0);
    });

    it("should return correct count", async () => {
      await queue.add({
        url: "https://example1.com",
        title: "Page 1",
        platform: "OTHER" as Platform,
      });

      await queue.add({
        url: "https://example2.com",
        title: "Page 2",
        platform: "OTHER" as Platform,
      });

      const count = await queue.getCount();
      expect(count).toBe(2);
    });
  });

  describe("get", () => {
    it("should return null for non-existent id", async () => {
      const item = await queue.get("non-existent-id");
      expect(item).toBeNull();
    });

    it("should return bookmark by id", async () => {
      const id = await queue.add({
        url: "https://example.com",
        title: "Test Page",
        platform: "BILIBILI" as Platform,
      });

      const item = await queue.get(id);
      expect(item).not.toBeNull();
      expect(item!.url).toBe("https://example.com");
      expect(item!.title).toBe("Test Page");
      expect(item!.platform).toBe("BILIBILI");
    });
  });

  describe("remove", () => {
    it("should remove bookmark", async () => {
      const id = await queue.add({
        url: "https://example.com",
        title: "Test Page",
        platform: "OTHER" as Platform,
      });

      await queue.remove(id);

      const item = await queue.get(id);
      expect(item).toBeNull();
    });

    it("should not throw for non-existent id", async () => {
      await expect(queue.remove("non-existent-id")).resolves.not.toThrow();
    });
  });

  describe("update", () => {
    it("should update bookmark", async () => {
      const id = await queue.add({
        url: "https://example.com",
        title: "Original Title",
        platform: "OTHER" as Platform,
      });

      await queue.update(id, { title: "Updated Title" });

      const item = await queue.get(id);
      expect(item!.title).toBe("Updated Title");
    });

    it("should throw for non-existent id", async () => {
      await expect(
        queue.update("non-existent-id", { title: "Test" }),
      ).rejects.toThrow("Bookmark not found");
    });
  });

  describe("incrementRetryCount", () => {
    it("should increment retry count", async () => {
      const id = await queue.add({
        url: "https://example.com",
        title: "Test Page",
        platform: "OTHER" as Platform,
      });

      const before = await queue.get(id);
      expect(before!.retryCount).toBe(0);

      await queue.incrementRetryCount(id);

      const after = await queue.get(id);
      expect(after!.retryCount).toBe(1);
    });

    it("should store error message", async () => {
      const id = await queue.add({
        url: "https://example.com",
        title: "Test Page",
        platform: "OTHER" as Platform,
      });

      await queue.incrementRetryCount(id, "Network error");

      const item = await queue.get(id);
      expect(item!.lastError).toBe("Network error");
    });
  });

  describe("clear", () => {
    it("should clear all bookmarks", async () => {
      await queue.add({
        url: "https://example1.com",
        title: "Page 1",
        platform: "OTHER" as Platform,
      });

      await queue.add({
        url: "https://example2.com",
        title: "Page 2",
        platform: "OTHER" as Platform,
      });

      await queue.clear();

      const count = await queue.getCount();
      expect(count).toBe(0);
    });
  });

  describe("syncAll", () => {
    it("should skip sync when offline", async () => {
      // Set navigator to offline
      Object.defineProperty(global.navigator, "onLine", {
        value: false,
        writable: true,
      });

      await queue.add({
        url: "https://example.com",
        title: "Test Page",
        platform: "OTHER" as Platform,
      });

      const result = await queue.syncAll();

      expect(result.synced).toBe(0);
      expect(result.failed).toBe(0);

      // Reset to online
      Object.defineProperty(global.navigator, "onLine", {
        value: true,
        writable: true,
      });
    });

    it("should return empty result when queue is empty", async () => {
      const result = await queue.syncAll();

      expect(result).toEqual({
        synced: 0,
        failed: 0,
        errors: [],
      });
    });

    it("should sync bookmarks successfully", async () => {
      await queue.add({
        url: "https://example.com",
        title: "Test Page",
        platform: "OTHER" as Platform,
      });

      const result = await queue.syncAll();

      expect(result.synced).toBe(1);
      expect(result.failed).toBe(0);

      // Bookmark should be removed after sync
      const count = await queue.getCount();
      expect(count).toBe(0);
    });

    it("should skip items exceeding max retries", async () => {
      const id = await queue.add({
        url: "https://example.com",
        title: "Test Page",
        platform: "OTHER" as Platform,
      });

      // Set retry count to max (3)
      await queue.update(id, { retryCount: 3 });

      const result = await queue.syncAll();

      expect(result.synced).toBe(0);
      expect(result.failed).toBe(1);
      expect(result.errors[0].error).toContain("Exceeded max retries");
    });
  });
});
