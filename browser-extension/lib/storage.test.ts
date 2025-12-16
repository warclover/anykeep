/**
 * Storage Module Tests
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { storage } from "./storage";
import { DEFAULT_STORAGE } from "@/types";
import {
  setMockStorageData,
  getMockStorageData,
  resetMockStorage,
} from "../test/mocks/browser";

describe("storage", () => {
  beforeEach(() => {
    resetMockStorage();
    vi.clearAllMocks();
  });

  describe("get", () => {
    it("should return default value when key not set", async () => {
      const result = await storage.get("apiUrl");
      expect(result).toBe(DEFAULT_STORAGE.apiUrl);
    });

    it("should return stored value", async () => {
      setMockStorageData({ authToken: "test-token-123" });

      const result = await storage.get("authToken");
      expect(result).toBe("test-token-123");
    });

    it("should return null for null default values", async () => {
      const result = await storage.get("authToken");
      expect(result).toBeNull();
    });
  });

  describe("getMultiple", () => {
    it("should return multiple values", async () => {
      setMockStorageData({
        authToken: "token-abc",
        userId: "user-123",
      });

      const result = await storage.getMultiple(["authToken", "userId"]);
      expect(result).toEqual({
        authToken: "token-abc",
        userId: "user-123",
      });
    });

    it("should use default values for missing keys", async () => {
      setMockStorageData({ authToken: "token-abc" });

      const result = await storage.getMultiple([
        "authToken",
        "userId",
        "apiUrl",
      ]);
      expect(result).toEqual({
        authToken: "token-abc",
        userId: DEFAULT_STORAGE.userId,
        apiUrl: DEFAULT_STORAGE.apiUrl,
      });
    });
  });

  describe("getAll", () => {
    it("should return all storage values with defaults", async () => {
      setMockStorageData({
        authToken: "my-token",
        userId: "my-user",
      });

      const result = await storage.getAll();
      expect(result).toEqual({
        authToken: "my-token",
        userId: "my-user",
        apiUrl: DEFAULT_STORAGE.apiUrl,
        tokenExpiresAt: DEFAULT_STORAGE.tokenExpiresAt,
      });
    });
  });

  describe("set", () => {
    it("should set single value", async () => {
      await storage.set("authToken", "new-token");

      expect(browser.storage.local.set).toHaveBeenCalledWith({
        authToken: "new-token",
      });
    });

    it("should persist value", async () => {
      await storage.set("authToken", "persisted-token");

      const stored = getMockStorageData();
      expect(stored.authToken).toBe("persisted-token");
    });
  });

  describe("setMultiple", () => {
    it("should set multiple values", async () => {
      await storage.setMultiple({
        authToken: "multi-token",
        userId: "multi-user",
      });

      expect(browser.storage.local.set).toHaveBeenCalledWith({
        authToken: "multi-token",
        userId: "multi-user",
      });
    });

    it("should persist multiple values", async () => {
      await storage.setMultiple({
        authToken: "token-1",
        userId: "user-1",
        apiUrl: "https://custom.api",
      });

      const stored = getMockStorageData();
      expect(stored).toMatchObject({
        authToken: "token-1",
        userId: "user-1",
        apiUrl: "https://custom.api",
      });
    });
  });

  describe("remove", () => {
    it("should remove single key", async () => {
      setMockStorageData({ authToken: "to-remove" });

      await storage.remove("authToken");

      expect(browser.storage.local.remove).toHaveBeenCalledWith(["authToken"]);
      expect(getMockStorageData().authToken).toBeUndefined();
    });

    it("should remove multiple keys", async () => {
      setMockStorageData({
        authToken: "token",
        userId: "user",
      });

      await storage.remove(["authToken", "userId"]);

      expect(browser.storage.local.remove).toHaveBeenCalledWith([
        "authToken",
        "userId",
      ]);
      const stored = getMockStorageData();
      expect(stored.authToken).toBeUndefined();
      expect(stored.userId).toBeUndefined();
    });
  });

  describe("clear", () => {
    it("should clear all storage", async () => {
      setMockStorageData({
        authToken: "token",
        userId: "user",
        apiUrl: "https://api",
      });

      await storage.clear();

      expect(browser.storage.local.clear).toHaveBeenCalled();
      expect(getMockStorageData()).toEqual({});
    });
  });

  describe("reset", () => {
    it("should reset to default values", async () => {
      await storage.reset();

      expect(browser.storage.local.set).toHaveBeenCalledWith(DEFAULT_STORAGE);
    });
  });

  describe("onChange", () => {
    it("should register change listener", () => {
      const callback = vi.fn();

      storage.onChange(callback);

      expect(browser.storage.onChanged.addListener).toHaveBeenCalled();
    });

    it("should return unsubscribe function", () => {
      const callback = vi.fn();

      const unsubscribe = storage.onChange(callback);
      unsubscribe();

      expect(browser.storage.onChanged.removeListener).toHaveBeenCalled();
    });
  });
});
