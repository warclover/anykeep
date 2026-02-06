import { ruleRegistry } from "../prediction/rule-registry";
import { predictionEngine } from "../prediction/prediction-engine";
import { telemetryManager } from "../telemetry/telemetry-manager";
import type { Bookmark } from "@/types/bookmark";

// Mock telemetry
jest.mock("../telemetry/telemetry-manager", () => ({
  telemetryManager: {
    recordMatch: jest.fn().mockResolvedValue(undefined),
    recordDecision: jest.fn().mockResolvedValue(undefined),
  },
}));

describe("PredictionEngine", () => {
  beforeEach(() => {
    ruleRegistry.clear();
    jest.clearAllMocks();
  });

  it("should return empty array for empty selection", () => {
    const results = predictionEngine.predict([]);
    expect(results).toHaveLength(0);
  });

  it("should match rules and return sorted by priority", () => {
    // 注册测试规则
    ruleRegistry.registerMany([
      {
        id: "low_priority",
        name: "Low",
        icon: "📝",
        priority: 10,
        category: "content",
        enabled: true,
        condition: () => true,
        action: "low_action",
      },
      {
        id: "high_priority",
        name: "High",
        icon: "🔥",
        priority: 90,
        category: "content",
        enabled: true,
        condition: () => true,
        action: "high_action",
      },
    ]);

    const selection: Bookmark[] = [
      { id: "1", title: "Test", url: "https://example.com" } as Bookmark,
    ];

    const results = predictionEngine.predict(selection, 2);

    expect(results).toHaveLength(2);
    expect(results[0].ruleId).toBe("high_priority");
    expect(results[1].ruleId).toBe("low_priority");
  });

  it("should respect limit parameter", () => {
    ruleRegistry.registerMany([
      {
        id: "r1",
        name: "R1",
        icon: "1",
        priority: 90,
        category: "content",
        enabled: true,
        condition: () => true,
        action: "a1",
      },
      {
        id: "r2",
        name: "R2",
        icon: "2",
        priority: 80,
        category: "content",
        enabled: true,
        condition: () => true,
        action: "a2",
      },
      {
        id: "r3",
        name: "R3",
        icon: "3",
        priority: 70,
        category: "content",
        enabled: true,
        condition: () => true,
        action: "a3",
      },
    ]);

    const selection: Bookmark[] = [{ id: "1", title: "Test" } as Bookmark];
    const results = predictionEngine.predict(selection, 2);

    expect(results).toHaveLength(2);
  });

  it("should record telemetry for matched rules", async () => {
    ruleRegistry.register({
      id: "test_rule",
      name: "Test",
      icon: "📝",
      priority: 50,
      category: "content",
      enabled: true,
      condition: () => true,
      action: "test_action",
    });

    const selection: Bookmark[] = [{ id: "1", title: "Test" } as Bookmark];
    predictionEngine.predict(selection);

    // 等待异步操作
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(telemetryManager.recordMatch).toHaveBeenCalledWith("test_rule", 1);
  });

  it("should skip disabled rules", () => {
    ruleRegistry.register({
      id: "disabled_rule",
      name: "Disabled",
      icon: "❌",
      priority: 100,
      category: "content",
      enabled: false,
      condition: () => true,
      action: "disabled_action",
    });

    const selection: Bookmark[] = [{ id: "1", title: "Test" } as Bookmark];
    const results = predictionEngine.predict(selection);

    expect(results).toHaveLength(0);
  });

  it("should handle rule condition errors gracefully", () => {
    ruleRegistry.registerMany([
      {
        id: "error_rule",
        name: "Error",
        icon: "❌",
        priority: 100,
        category: "content",
        enabled: true,
        condition: () => {
          throw new Error("Test error");
        },
        action: "error_action",
      },
      {
        id: "normal_rule",
        name: "Normal",
        icon: "✅",
        priority: 50,
        category: "content",
        enabled: true,
        condition: () => true,
        action: "normal_action",
      },
    ]);

    const selection: Bookmark[] = [{ id: "1", title: "Test" } as Bookmark];
    const results = predictionEngine.predict(selection);

    // 应该跳过错误规则，返回正常规则
    expect(results).toHaveLength(1);
    expect(results[0].ruleId).toBe("normal_rule");
  });
});
