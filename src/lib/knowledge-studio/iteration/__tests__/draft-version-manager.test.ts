/**
 * DraftVersionManager Tests
 * @module knowledge-studio/iteration/__tests__
 */

import {
  DraftVersionManager,
  formatDraftVersionTimestamp,
  getDraftSourceLabel,
  createDraftVersionManager,
} from "../draft-version-manager";
import type { DraftVersion, DraftFeedback, DraftSource } from "../types";

// ============================================================
// Mock sessionStorage
// ============================================================

const mockStorage: Record<string, string> = {};

const mockSessionStorage = {
  getItem: jest.fn((key: string) => mockStorage[key] ?? null),
  setItem: jest.fn((key: string, value: string) => {
    mockStorage[key] = value;
  }),
  removeItem: jest.fn((key: string) => {
    delete mockStorage[key];
  }),
  clear: jest.fn(() => {
    Object.keys(mockStorage).forEach((key) => delete mockStorage[key]);
  }),
  key: jest.fn(),
  length: 0,
};

Object.defineProperty(global, "sessionStorage", {
  value: mockSessionStorage,
  writable: true,
});

// ============================================================
// Tests
// ============================================================

describe("DraftVersionManager", () => {
  beforeEach(() => {
    // Clear mock storage before each test
    Object.keys(mockStorage).forEach((key) => delete mockStorage[key]);
    jest.clearAllMocks();
  });

  describe("constructor", () => {
    it("should create manager with default config", () => {
      const manager = new DraftVersionManager();

      expect(manager.hasVersions()).toBe(false);
      expect(manager.getVersionCount()).toBe(0);
    });

    it("should create manager with custom sessionId", () => {
      const manager = new DraftVersionManager({ sessionId: "test-session" });

      expect(manager.hasVersions()).toBe(false);
    });

    it("should restore state from sessionStorage", () => {
      const existingState = {
        currentIndex: 0,
        versions: [
          {
            id: "existing-1",
            version: 1,
            timestamp: Date.now(),
            content: "Existing content",
            wordCount: 2,
            source: "initial" as DraftSource,
          },
        ],
      };

      mockStorage["ks-v2-draft-versions:test-session"] =
        JSON.stringify(existingState);

      const manager = new DraftVersionManager({ sessionId: "test-session" });

      expect(manager.hasVersions()).toBe(true);
      expect(manager.getVersionCount()).toBe(1);
    });
  });

  describe("saveVersion", () => {
    it("should save a new version", () => {
      const manager = new DraftVersionManager({ sessionId: "test" });
      const content = "Hello, 世界！This is a test.";

      const version = manager.saveVersion(content, "initial");

      expect(version).toBeDefined();
      expect(version.content).toBe(content);
      expect(version.source).toBe("initial");
      expect(version.version).toBe(1);
      expect(version.wordCount).toBeGreaterThan(0);
      expect(manager.getVersionCount()).toBe(1);
    });

    it("should save version with source description", () => {
      const manager = new DraftVersionManager({ sessionId: "test" });

      const version = manager.saveVersion(
        "Condensed content",
        "condense",
        "精简到 1500 字",
      );

      expect(version.source).toBe("condense");
      expect(version.sourceDescription).toBe("精简到 1500 字");
    });

    it("should save version with feedback", () => {
      const manager = new DraftVersionManager({ sessionId: "test" });
      const feedback: DraftFeedback = {
        rating: 4,
        type: "style_issue",
        comment: "Too formal",
        timestamp: Date.now(),
      };

      const version = manager.saveVersion(
        "Iterated content",
        "iteration",
        undefined,
        feedback,
      );

      expect(version.feedback).toEqual(feedback);
    });

    it("should increment version numbers", () => {
      const manager = new DraftVersionManager({ sessionId: "test" });

      const v1 = manager.saveVersion("Content 1", "initial");
      const v2 = manager.saveVersion("Content 2", "condense");
      const v3 = manager.saveVersion("Content 3", "iteration");

      expect(v1.version).toBe(1);
      expect(v2.version).toBe(2);
      expect(v3.version).toBe(3);
    });

    it("should limit versions to maxVersions (default 3)", () => {
      const manager = new DraftVersionManager({ sessionId: "test" });

      manager.saveVersion("Content 1", "initial");
      manager.saveVersion("Content 2", "condense");
      manager.saveVersion("Content 3", "iteration");
      manager.saveVersion("Content 4", "iteration");

      expect(manager.getVersionCount()).toBe(3);

      // Latest version should be Content 4
      const current = manager.getCurrentVersion();
      expect(current?.content).toBe("Content 4");
    });

    it("should respect custom maxVersions", () => {
      const manager = new DraftVersionManager({
        sessionId: "test",
        maxVersions: 2,
      });

      manager.saveVersion("Content 1", "initial");
      manager.saveVersion("Content 2", "condense");
      manager.saveVersion("Content 3", "iteration");

      expect(manager.getVersionCount()).toBe(2);
    });

    it("should persist state to sessionStorage", () => {
      const manager = new DraftVersionManager({ sessionId: "persist-test" });

      manager.saveVersion("Test content", "initial");

      expect(mockSessionStorage.setItem).toHaveBeenCalled();
      expect(mockStorage["ks-v2-draft-versions:persist-test"]).toBeDefined();
    });
  });

  describe("getVersionHistory", () => {
    it("should return empty array when no versions", () => {
      const manager = new DraftVersionManager({ sessionId: "test" });

      expect(manager.getVersionHistory()).toEqual([]);
    });

    it("should return versions in reverse chronological order", () => {
      const manager = new DraftVersionManager({ sessionId: "test" });

      manager.saveVersion("First", "initial");
      manager.saveVersion("Second", "condense");
      manager.saveVersion("Third", "iteration");

      const history = manager.getVersionHistory();

      expect(history).toHaveLength(3);
      expect(history[0].content).toBe("Third");
      expect(history[1].content).toBe("Second");
      expect(history[2].content).toBe("First");
    });

    it("should return a copy (not reference)", () => {
      const manager = new DraftVersionManager({ sessionId: "test" });
      manager.saveVersion("Test", "initial");

      const history1 = manager.getVersionHistory();
      const history2 = manager.getVersionHistory();

      expect(history1).not.toBe(history2);
    });
  });

  describe("getCurrentVersion", () => {
    it("should return undefined when no versions", () => {
      const manager = new DraftVersionManager({ sessionId: "test" });

      expect(manager.getCurrentVersion()).toBeUndefined();
    });

    it("should return the latest saved version", () => {
      const manager = new DraftVersionManager({ sessionId: "test" });

      manager.saveVersion("First", "initial");
      manager.saveVersion("Second", "condense");

      const current = manager.getCurrentVersion();

      expect(current?.content).toBe("Second");
    });
  });

  describe("getVersion", () => {
    it("should return undefined for non-existent version", () => {
      const manager = new DraftVersionManager({ sessionId: "test" });

      expect(manager.getVersion("non-existent")).toBeUndefined();
    });

    it("should return the specified version", () => {
      const manager = new DraftVersionManager({ sessionId: "test" });

      const saved = manager.saveVersion("Test content", "initial");
      const retrieved = manager.getVersion(saved.id);

      expect(retrieved).toEqual(saved);
    });
  });

  describe("restoreVersion", () => {
    it("should return undefined for non-existent version", () => {
      const manager = new DraftVersionManager({ sessionId: "test" });

      expect(manager.restoreVersion("non-existent")).toBeUndefined();
    });

    it("should restore and return content of specified version", () => {
      const manager = new DraftVersionManager({ sessionId: "test" });

      const v1 = manager.saveVersion("First", "initial");
      manager.saveVersion("Second", "condense");

      const restored = manager.restoreVersion(v1.id);

      expect(restored).toBe("First");
    });

    it("should update current version after restore", () => {
      const manager = new DraftVersionManager({ sessionId: "test" });

      const v1 = manager.saveVersion("First", "initial");
      manager.saveVersion("Second", "condense");

      manager.restoreVersion(v1.id);

      const current = manager.getCurrentVersion();
      expect(current?.id).toBe(v1.id);
    });
  });

  describe("clearHistory", () => {
    it("should remove all versions", () => {
      const manager = new DraftVersionManager({ sessionId: "test" });

      manager.saveVersion("First", "initial");
      manager.saveVersion("Second", "condense");

      expect(manager.getVersionCount()).toBe(2);

      manager.clearHistory();

      expect(manager.getVersionCount()).toBe(0);
      expect(manager.hasVersions()).toBe(false);
    });
  });

  describe("compareVersions", () => {
    it("should return undefined if either version not found", () => {
      const manager = new DraftVersionManager({ sessionId: "test" });

      manager.saveVersion("Test", "initial");

      expect(manager.compareVersions("v1", "v2")).toBeUndefined();
    });

    it("should return correct diff statistics", () => {
      const manager = new DraftVersionManager({ sessionId: "test" });

      const v1 = manager.saveVersion("Short content", "initial");
      const v2 = manager.saveVersion(
        "Much longer content with more words",
        "iteration",
      );

      const diff = manager.compareVersions(v1.id, v2.id);

      expect(diff).toBeDefined();
      expect(diff!.wordCountDiff).toBeGreaterThan(0);
      expect(diff!.timeDiff).toBeGreaterThanOrEqual(0);
    });
  });

  describe("addFeedbackToCurrentVersion", () => {
    it("should do nothing if no current version", () => {
      const manager = new DraftVersionManager({ sessionId: "test" });

      const feedback: DraftFeedback = {
        rating: 3,
        type: "too_long",
        timestamp: Date.now(),
      };

      // Should not throw
      expect(() => manager.addFeedbackToCurrentVersion(feedback)).not.toThrow();
    });

    it("should add feedback to current version", () => {
      const manager = new DraftVersionManager({ sessionId: "test" });

      manager.saveVersion("Test content", "initial");

      const feedback: DraftFeedback = {
        rating: 4,
        type: "style_issue",
        comment: "Needs adjustment",
        timestamp: Date.now(),
      };

      manager.addFeedbackToCurrentVersion(feedback);

      const current = manager.getCurrentVersion();
      expect(current?.feedback).toEqual(feedback);
    });
  });

  describe("word counting", () => {
    it("should count Chinese characters correctly", () => {
      const manager = new DraftVersionManager({ sessionId: "test" });

      const version = manager.saveVersion("这是一个中文测试", "initial");

      expect(version.wordCount).toBe(8);
    });

    it("should count English words correctly", () => {
      const manager = new DraftVersionManager({ sessionId: "test" });

      const version = manager.saveVersion("This is an English test", "initial");

      expect(version.wordCount).toBe(5);
    });

    it("should count mixed content correctly", () => {
      const manager = new DraftVersionManager({ sessionId: "test" });

      const version = manager.saveVersion("Hello 世界 this is 测试", "initial");

      // 世界 = 2 chars, 测试 = 2 chars, Hello/this/is = 3 words
      expect(version.wordCount).toBe(7);
    });

    it("should handle empty content", () => {
      const manager = new DraftVersionManager({ sessionId: "test" });

      const version = manager.saveVersion("", "initial");

      expect(version.wordCount).toBe(0);
    });
  });
});

describe("formatDraftVersionTimestamp", () => {
  it('should return "刚刚" for recent timestamps', () => {
    const now = Date.now();
    expect(formatDraftVersionTimestamp(now)).toBe("刚刚");
  });

  it("should return minutes ago for timestamps within an hour", () => {
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    expect(formatDraftVersionTimestamp(fiveMinutesAgo)).toBe("5 分钟前");
  });

  it("should return hours ago for timestamps within a day", () => {
    const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
    expect(formatDraftVersionTimestamp(twoHoursAgo)).toBe("2 小时前");
  });
});

describe("getDraftSourceLabel", () => {
  it('should return "首次生成" for initial source', () => {
    const version: DraftVersion = {
      id: "test",
      version: 1,
      timestamp: Date.now(),
      content: "Test",
      wordCount: 1,
      source: "initial",
    };

    expect(getDraftSourceLabel(version)).toBe("首次生成");
  });

  it("should return source description for condense source", () => {
    const version: DraftVersion = {
      id: "test",
      version: 1,
      timestamp: Date.now(),
      content: "Test",
      wordCount: 1,
      source: "condense",
      sourceDescription: "精简到 1500 字",
    };

    expect(getDraftSourceLabel(version)).toBe("精简到 1500 字");
  });

  it("should return default label when no description for condense", () => {
    const version: DraftVersion = {
      id: "test",
      version: 1,
      timestamp: Date.now(),
      content: "Test",
      wordCount: 1,
      source: "condense",
    };

    expect(getDraftSourceLabel(version)).toBe("精简版本");
  });
});

describe("createDraftVersionManager", () => {
  it("should create manager with provided sessionId", () => {
    const manager = createDraftVersionManager("custom-session");

    expect(manager).toBeInstanceOf(DraftVersionManager);
  });

  it("should create manager with default sessionId when not provided", () => {
    const manager = createDraftVersionManager();

    expect(manager).toBeInstanceOf(DraftVersionManager);
  });
});
