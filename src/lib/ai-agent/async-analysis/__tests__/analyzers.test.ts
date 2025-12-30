/**
 * 分析器单元测试
 *
 * @module ai-agent/async-analysis/__tests__
 */

import {
  TopicClusteringAnalyzer,
  PatternDetectionAnalyzer,
  LinkHealthCheckAnalyzer,
} from "../analyzers";
import type { AsyncAnalysisTask } from "../types";

// Mock logger
jest.mock("@/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock fetch for link health checker
global.fetch = jest.fn();

describe("TopicClusteringAnalyzer", () => {
  let analyzer: TopicClusteringAnalyzer;

  beforeEach(() => {
    jest.clearAllMocks();
    analyzer = new TopicClusteringAnalyzer();
  });

  describe("type", () => {
    it("should have correct type", () => {
      expect(analyzer.type).toBe("topic_clustering");
    });
  });

  describe("canExecute", () => {
    it("should return true by default", async () => {
      const task = createMockTask("topic_clustering");
      const canExecute = await analyzer.canExecute(task);
      expect(canExecute).toBe(true);
    });
  });

  describe("analyze", () => {
    it("should return empty result when no bookmarks", async () => {
      const task = createMockTask("topic_clustering");
      const result = await analyzer.analyze(task);

      expect(result.data).toEqual({ clusters: [], uncategorized: [] });
      expect(result.insights).toEqual([]);
      expect(result.suggestedActions).toEqual([]);
    });

    it("should not throw on analysis", async () => {
      const task = createMockTask("topic_clustering");

      await expect(analyzer.analyze(task)).resolves.not.toThrow();
    });
  });
});

describe("PatternDetectionAnalyzer", () => {
  let analyzer: PatternDetectionAnalyzer;

  beforeEach(() => {
    jest.clearAllMocks();
    analyzer = new PatternDetectionAnalyzer();
  });

  describe("type", () => {
    it("should have correct type", () => {
      expect(analyzer.type).toBe("pattern_detection");
    });
  });

  describe("canExecute", () => {
    it("should return true by default", async () => {
      const task = createMockTask("pattern_detection");
      const canExecute = await analyzer.canExecute(task);
      expect(canExecute).toBe(true);
    });
  });

  describe("analyze", () => {
    it("should return empty patterns when no history", async () => {
      const task = createMockTask("pattern_detection");
      const result = await analyzer.analyze(task);

      // Result contains patterns array (may be empty)
      expect(result.data).toHaveProperty("patterns");
      expect(
        Array.isArray((result.data as { patterns: unknown[] }).patterns),
      ).toBe(true);
    });

    it("should not throw on analysis", async () => {
      const task = createMockTask("pattern_detection");

      await expect(analyzer.analyze(task)).resolves.not.toThrow();
    });
  });
});

describe("LinkHealthCheckAnalyzer", () => {
  let analyzer: LinkHealthCheckAnalyzer;

  beforeEach(() => {
    jest.clearAllMocks();
    analyzer = new LinkHealthCheckAnalyzer();
    (global.fetch as jest.Mock).mockReset();
  });

  describe("type", () => {
    it("should have correct type", () => {
      expect(analyzer.type).toBe("link_health_check");
    });
  });

  describe("canExecute", () => {
    it("should return true by default", async () => {
      const task = createMockTask("link_health_check");
      const canExecute = await analyzer.canExecute(task);
      expect(canExecute).toBe(true);
    });
  });

  describe("analyze", () => {
    it("should return empty result when no bookmarks to check", async () => {
      const task = createMockTask("link_health_check");
      const result = await analyzer.analyze(task);

      expect(result.data).toEqual({
        totalChecked: 0,
        healthyCount: 0,
        issues: [],
      });
    });

    it("should not throw on analysis", async () => {
      const task = createMockTask("link_health_check");

      await expect(analyzer.analyze(task)).resolves.not.toThrow();
    });
  });
});

// =============================================================================
// Test Helpers
// =============================================================================

function createMockTask(
  type: "topic_clustering" | "pattern_detection" | "link_health_check",
): AsyncAnalysisTask {
  return {
    id: `task_${Date.now()}`,
    userId: "test-user",
    type,
    priority: "medium",
    status: "running",
    trigger: "manual",
    createdAt: new Date().toISOString(),
    startedAt: new Date().toISOString(),
  };
}
