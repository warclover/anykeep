import { describe, it, expect, beforeEach } from "vitest";
import { ruleRegistry } from "../prediction/rule-registry";
import { predictionEngine } from "../prediction/prediction-engine";
import type { Bookmark } from "@/types/bookmark";

describe("Performance", () => {
  beforeEach(() => {
    ruleRegistry.clear();
  });

  it("should match 100 rules within 10ms", () => {
    // 注册 100 条规则
    const rules = Array.from({ length: 100 }, (_, i) => ({
      id: `rule_${i}`,
      name: `Rule ${i}`,
      icon: "📝",
      priority: i,
      category: "content" as const,
      enabled: true,
      condition: () => Math.random() > 0.5,
      action: `action_${i}`,
    }));

    ruleRegistry.registerMany(rules);

    // 创建测试选择
    const selection: Bookmark[] = Array.from(
      { length: 10 },
      (_, i) =>
        ({
          id: `${i}`,
          title: `Bookmark ${i}`,
          url: `https://example.com/${i}`,
        }) as Bookmark,
    );

    // 计时
    const start = performance.now();
    predictionEngine.predict(selection, 3);
    const duration = performance.now() - start;

    console.log(`100 rules matching took ${duration.toFixed(2)}ms`);
    expect(duration).toBeLessThan(10);
  });

  it("should handle large selection (100 items) efficiently", () => {
    ruleRegistry.register({
      id: "test_rule",
      name: "Test",
      icon: "📝",
      priority: 50,
      category: "content",
      enabled: true,
      condition: (selection) => selection.length > 50,
      action: "test_action",
    });

    const selection: Bookmark[] = Array.from(
      { length: 100 },
      (_, i) =>
        ({
          id: `${i}`,
          title: `Bookmark ${i}`,
        }) as Bookmark,
    );

    const start = performance.now();
    predictionEngine.predict(selection);
    const duration = performance.now() - start;

    console.log(`Large selection (100 items) took ${duration.toFixed(2)}ms`);
    expect(duration).toBeLessThan(10);
  });
});
