/**
 * 大纲版本管理器测试 (Story 2.5)
 * @module knowledge-studio/blueprint/__tests__
 */

import {
  OutlineVersionManager,
  createOutlineVersionManager,
  formatVersionTimestamp,
  MAX_VERSIONS,
} from "../outline-version-manager";
import type { BlueprintOutline } from "../types";

// ============================================================
// Mocks
// ============================================================

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string) => store[key] ?? null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
    }),
    clear: jest.fn(() => {
      store = {};
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
  };
})();

Object.defineProperty(window, "localStorage", { value: localStorageMock });

// Mock logger
jest.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

// ============================================================
// Test Data
// ============================================================

const createMockOutline = (title: string): BlueprintOutline => ({
  title,
  summary: `Summary for ${title}`,
  nodes: [
    {
      id: "section-1",
      title: "第一章",
      level: 1,
      estimatedWords: 500,
    },
    {
      id: "section-2",
      title: "第二章",
      level: 1,
      estimatedWords: 800,
    },
  ],
  totalEstimatedWords: 1300,
  generatedBy: "deepseek",
});

// ============================================================
// Tests
// ============================================================

describe("OutlineVersionManager", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.clear();
  });

  describe("saveVersion", () => {
    it("should save a new version", () => {
      const manager = new OutlineVersionManager({ sessionId: "test-session" });
      const outline = createMockOutline("Test Outline");

      const version = manager.saveVersion(outline, "Initial version");

      expect(version).toBeDefined();
      expect(version.version).toBe(1);
      expect(version.outline.title).toBe("Test Outline");
      expect(version.description).toBe("Initial version");
      expect(manager.getVersionCount()).toBe(1);
    });

    it("should increment version numbers", () => {
      const manager = new OutlineVersionManager({ sessionId: "test-session" });

      const v1 = manager.saveVersion(createMockOutline("V1"));
      const v2 = manager.saveVersion(createMockOutline("V2"));
      const v3 = manager.saveVersion(createMockOutline("V3"));

      expect(v1.version).toBe(1);
      expect(v2.version).toBe(2);
      expect(v3.version).toBe(3);
    });

    it("should limit versions to MAX_VERSIONS", () => {
      const manager = new OutlineVersionManager({
        sessionId: "test-session",
        maxVersions: 3,
      });

      for (let i = 1; i <= 5; i++) {
        manager.saveVersion(createMockOutline(`Outline ${i}`));
      }

      expect(manager.getVersionCount()).toBe(3);

      const history = manager.getVersionHistory();
      expect(history[0].outline.title).toBe("Outline 5"); // Most recent
      expect(history[2].outline.title).toBe("Outline 3"); // Oldest kept
    });

    it("should deep clone the outline to avoid reference issues", () => {
      const manager = new OutlineVersionManager({ sessionId: "test-session" });
      const outline = createMockOutline("Test");

      manager.saveVersion(outline);
      outline.title = "Modified"; // Modify original

      const saved = manager.getCurrentVersion();
      expect(saved?.outline.title).toBe("Test"); // Should remain unchanged
    });

    it("should persist to localStorage", () => {
      const manager = new OutlineVersionManager({ sessionId: "test-session" });
      manager.saveVersion(createMockOutline("Test"));

      expect(localStorageMock.setItem).toHaveBeenCalled();
    });
  });

  describe("getVersionHistory", () => {
    it("should return versions in reverse chronological order", () => {
      const manager = new OutlineVersionManager({ sessionId: "test-session" });

      manager.saveVersion(createMockOutline("First"));
      manager.saveVersion(createMockOutline("Second"));
      manager.saveVersion(createMockOutline("Third"));

      const history = manager.getVersionHistory();

      expect(history[0].outline.title).toBe("Third");
      expect(history[1].outline.title).toBe("Second");
      expect(history[2].outline.title).toBe("First");
    });

    it("should return empty array when no versions", () => {
      const manager = new OutlineVersionManager({ sessionId: "test-session" });

      expect(manager.getVersionHistory()).toEqual([]);
    });
  });

  describe("getCurrentVersion", () => {
    it("should return the most recent version", () => {
      const manager = new OutlineVersionManager({ sessionId: "test-session" });

      manager.saveVersion(createMockOutline("Old"));
      manager.saveVersion(createMockOutline("Current"));

      const current = manager.getCurrentVersion();
      expect(current?.outline.title).toBe("Current");
    });

    it("should return undefined when no versions", () => {
      const manager = new OutlineVersionManager({ sessionId: "test-session" });

      expect(manager.getCurrentVersion()).toBeUndefined();
    });
  });

  describe("getVersion", () => {
    it("should return version by ID", () => {
      const manager = new OutlineVersionManager({ sessionId: "test-session" });
      const version = manager.saveVersion(createMockOutline("Test"));

      const found = manager.getVersion(version.id);
      expect(found?.id).toBe(version.id);
    });

    it("should return undefined for non-existent ID", () => {
      const manager = new OutlineVersionManager({ sessionId: "test-session" });

      expect(manager.getVersion("non-existent")).toBeUndefined();
    });
  });

  describe("restoreVersion", () => {
    it("should restore to specified version", () => {
      const manager = new OutlineVersionManager({ sessionId: "test-session" });

      const v1 = manager.saveVersion(createMockOutline("Version 1"));
      manager.saveVersion(createMockOutline("Version 2"));
      manager.saveVersion(createMockOutline("Version 3"));

      const restored = manager.restoreVersion(v1.id);

      expect(restored?.title).toBe("Version 1");
      expect(manager.getCurrentVersion()?.id).toBe(v1.id);
    });

    it("should return undefined for non-existent version", () => {
      const manager = new OutlineVersionManager({ sessionId: "test-session" });

      expect(manager.restoreVersion("non-existent")).toBeUndefined();
    });

    it("should deep clone on restore", () => {
      const manager = new OutlineVersionManager({ sessionId: "test-session" });
      const version = manager.saveVersion(createMockOutline("Test"));

      const restored = manager.restoreVersion(version.id);
      if (restored) {
        restored.title = "Modified";
      }

      // Original should remain unchanged
      expect(manager.getVersion(version.id)?.outline.title).toBe("Test");
    });
  });

  describe("hasVersions", () => {
    it("should return false when no versions", () => {
      const manager = new OutlineVersionManager({ sessionId: "test-session" });

      expect(manager.hasVersions()).toBe(false);
    });

    it("should return true when versions exist", () => {
      const manager = new OutlineVersionManager({ sessionId: "test-session" });
      manager.saveVersion(createMockOutline("Test"));

      expect(manager.hasVersions()).toBe(true);
    });
  });

  describe("clearHistory", () => {
    it("should clear all versions", () => {
      const manager = new OutlineVersionManager({ sessionId: "test-session" });

      manager.saveVersion(createMockOutline("V1"));
      manager.saveVersion(createMockOutline("V2"));
      expect(manager.getVersionCount()).toBe(2);

      manager.clearHistory();

      expect(manager.getVersionCount()).toBe(0);
      expect(manager.hasVersions()).toBe(false);
    });
  });

  describe("compareVersions", () => {
    it("should compare two versions", () => {
      const manager = new OutlineVersionManager({ sessionId: "test-session" });

      const outline1 = createMockOutline("First");
      outline1.totalEstimatedWords = 1000;

      const outline2 = createMockOutline("Second");
      outline2.totalEstimatedWords = 1500;
      outline2.nodes.push({
        id: "section-3",
        title: "第三章",
        level: 1,
        estimatedWords: 500,
      });

      const v1 = manager.saveVersion(outline1);
      const v2 = manager.saveVersion(outline2);

      const diff = manager.compareVersions(v1.id, v2.id);

      expect(diff).toBeDefined();
      expect(diff?.titleChanged).toBe(true);
      expect(diff?.nodeCountDiff).toBe(1);
      expect(diff?.totalWordsDiff).toBe(500);
    });

    it("should return undefined for non-existent versions", () => {
      const manager = new OutlineVersionManager({ sessionId: "test-session" });

      expect(manager.compareVersions("a", "b")).toBeUndefined();
    });
  });

  describe("session isolation", () => {
    it("should isolate versions by session ID", () => {
      const manager1 = new OutlineVersionManager({ sessionId: "session-1" });
      const manager2 = new OutlineVersionManager({ sessionId: "session-2" });

      manager1.saveVersion(createMockOutline("Session 1 Outline"));
      manager2.saveVersion(createMockOutline("Session 2 Outline"));

      expect(manager1.getVersionCount()).toBe(1);
      expect(manager2.getVersionCount()).toBe(1);
      expect(manager1.getCurrentVersion()?.outline.title).toBe(
        "Session 1 Outline",
      );
      expect(manager2.getCurrentVersion()?.outline.title).toBe(
        "Session 2 Outline",
      );
    });
  });

  describe("persistence", () => {
    it("should load state from localStorage on init", () => {
      // First manager saves data
      const manager1 = new OutlineVersionManager({ sessionId: "persist-test" });
      manager1.saveVersion(createMockOutline("Persisted"));

      // Clear mock call history
      localStorageMock.getItem.mockClear();

      // Second manager should load existing data
      const manager2 = new OutlineVersionManager({ sessionId: "persist-test" });

      expect(localStorageMock.getItem).toHaveBeenCalled();
      expect(manager2.getVersionCount()).toBe(1);
      expect(manager2.getCurrentVersion()?.outline.title).toBe("Persisted");
    });
  });
});

describe("formatVersionTimestamp", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-01-04T12:00:00.000Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should return "刚刚" for very recent timestamps', () => {
    const now = Date.now();
    expect(formatVersionTimestamp(now - 30 * 1000)).toBe("刚刚");
  });

  it("should return minutes ago for recent timestamps", () => {
    const now = Date.now();
    expect(formatVersionTimestamp(now - 5 * 60 * 1000)).toBe("5 分钟前");
    expect(formatVersionTimestamp(now - 30 * 60 * 1000)).toBe("30 分钟前");
  });

  it("should return hours ago for same-day timestamps", () => {
    const now = Date.now();
    expect(formatVersionTimestamp(now - 2 * 60 * 60 * 1000)).toBe("2 小时前");
  });

  it("should return days ago for recent dates", () => {
    const now = Date.now();
    expect(formatVersionTimestamp(now - 2 * 24 * 60 * 60 * 1000)).toBe(
      "2 天前",
    );
  });

  it("should return formatted date for older timestamps", () => {
    const now = Date.now();
    const result = formatVersionTimestamp(now - 10 * 24 * 60 * 60 * 1000);
    expect(result).toMatch(/\d+月\d+日/);
  });
});

describe("createOutlineVersionManager", () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  it("should create a new manager instance", () => {
    const manager = createOutlineVersionManager("test-session");
    expect(manager).toBeInstanceOf(OutlineVersionManager);
  });

  it("should work without session ID", () => {
    const manager = createOutlineVersionManager();
    expect(manager).toBeInstanceOf(OutlineVersionManager);
  });
});

describe("MAX_VERSIONS constant", () => {
  it("should be 5", () => {
    expect(MAX_VERSIONS).toBe(5);
  });
});
