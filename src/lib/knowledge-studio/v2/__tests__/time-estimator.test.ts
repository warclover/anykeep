/**
 * Time Estimator Tests
 * @module knowledge-studio/v2/__tests__
 */

import {
  countSections,
  estimateOutputWords,
  estimateGenerationTime,
  getGenerationEstimate,
  formatWordsDisplay,
} from "../time-estimator";
import type { BlueprintOutline, OutlineNode } from "../../blueprint/types";

// ============================================================
// Test Data Fixtures
// ============================================================

function createOutline(options: {
  title?: string;
  nodes?: OutlineNode[];
  totalEstimatedWords?: number;
}): BlueprintOutline {
  return {
    title: options.title ?? "Test Outline",
    summary: "Test summary",
    nodes: options.nodes ?? [],
    totalEstimatedWords: options.totalEstimatedWords ?? 0,
    generatedBy: "test",
  };
}

function createNode(options: {
  id?: string;
  title?: string;
  level?: 1 | 2 | 3;
  children?: OutlineNode[];
  estimatedWords?: number;
}): OutlineNode {
  return {
    id: options.id ?? `node-${Math.random().toString(36).slice(2, 8)}`,
    title: options.title ?? "Test Node",
    level: options.level ?? 1,
    children: options.children,
    estimatedWords: options.estimatedWords,
  };
}

// ============================================================
// Tests
// ============================================================

describe("countSections", () => {
  it("should return 0 for empty outline", () => {
    const outline = createOutline({ nodes: [] });

    expect(countSections(outline)).toBe(0);
  });

  it("should count flat nodes correctly", () => {
    const outline = createOutline({
      nodes: [
        createNode({ title: "Section 1" }),
        createNode({ title: "Section 2" }),
        createNode({ title: "Section 3" }),
      ],
    });

    expect(countSections(outline)).toBe(3);
  });

  it("should count nested nodes correctly", () => {
    const outline = createOutline({
      nodes: [
        createNode({
          title: "Section 1",
          level: 1,
          children: [
            createNode({ title: "Section 1.1", level: 2 }),
            createNode({ title: "Section 1.2", level: 2 }),
          ],
        }),
        createNode({ title: "Section 2", level: 1 }),
      ],
    });

    // 2 top-level + 2 nested = 4
    expect(countSections(outline)).toBe(4);
  });

  it("should count deeply nested nodes", () => {
    const outline = createOutline({
      nodes: [
        createNode({
          title: "Section 1",
          level: 1,
          children: [
            createNode({
              title: "Section 1.1",
              level: 2,
              children: [
                createNode({ title: "Section 1.1.1", level: 3 }),
                createNode({ title: "Section 1.1.2", level: 3 }),
              ],
            }),
          ],
        }),
      ],
    });

    // 1 top + 1 nested + 2 deeply nested = 4
    expect(countSections(outline)).toBe(4);
  });
});

describe("estimateOutputWords", () => {
  it("should use outline totalEstimatedWords when available", () => {
    const outline = createOutline({
      nodes: [createNode({})],
      totalEstimatedWords: 2000,
    });

    const result = estimateOutputWords(outline, "medium");

    expect(result.estimated).toBe(2000);
    expect(result.min).toBeLessThanOrEqual(result.estimated);
    expect(result.max).toBeGreaterThanOrEqual(result.estimated);
  });

  it("should calculate from node estimatedWords when totalEstimatedWords is 0", () => {
    const outline = createOutline({
      nodes: [
        createNode({ estimatedWords: 500 }),
        createNode({ estimatedWords: 500 }),
      ],
      totalEstimatedWords: 0,
    });

    const result = estimateOutputWords(outline, "medium");

    // Should use sum of node estimates (1000) or section-based estimate
    expect(result.estimated).toBeGreaterThan(0);
  });

  it("should respect LENGTH_MODE_CONFIG constraints", () => {
    const outline = createOutline({
      nodes: [createNode({})],
      totalEstimatedWords: 100, // Very low
    });

    const result = estimateOutputWords(outline, "medium");

    // Min should be at least LENGTH_MODE_CONFIG.medium.minWords (2000)
    expect(result.min).toBeGreaterThanOrEqual(2000);
  });

  it("should estimate based on section count for short mode", () => {
    // Use 6 sections to ensure estimate is within config range
    // 6 sections * 300 words/section = 1800
    const outline = createOutline({
      nodes: [
        createNode({}),
        createNode({}),
        createNode({}),
        createNode({}),
        createNode({}),
        createNode({}),
      ],
    });

    const result = estimateOutputWords(outline, "short");

    expect(result.estimated).toBeGreaterThan(0);
    // Estimated should be around config midpoint (1500) for short mode
    expect(result.estimated).toBeGreaterThanOrEqual(1200);
  });

  it("should estimate based on section count for long mode", () => {
    // Use 8 sections to ensure estimate is within config range
    // 8 sections * 600 words/section = 4800
    const outline = createOutline({
      nodes: [
        createNode({}),
        createNode({}),
        createNode({}),
        createNode({}),
        createNode({}),
        createNode({}),
        createNode({}),
        createNode({}),
      ],
    });

    const result = estimateOutputWords(outline, "long");

    expect(result.estimated).toBeGreaterThan(0);
    // Estimated should be around config midpoint (4250) for long mode
    expect(result.estimated).toBeGreaterThanOrEqual(3500);
  });
});

describe("estimateGenerationTime", () => {
  it("should return time in seconds", () => {
    const result = estimateGenerationTime(1000, 2);

    expect(result.min).toBeGreaterThan(0);
    expect(result.max).toBeGreaterThan(result.min);
  });

  it("should display in seconds for short times", () => {
    // Use very low word count to keep max < 60 seconds
    // baseTime = 30 + (100/1000)*20 + 1*5 = 30 + 2 + 5 = 37
    // max = ceil(37 * 1.5) = 56 < 60
    const result = estimateGenerationTime(100, 1);

    expect(result.display).toContain("秒");
  });

  it("should display in minutes for longer times", () => {
    const result = estimateGenerationTime(5000, 10);

    expect(result.display).toContain("分钟");
  });

  it("should increase time with more words", () => {
    const shortResult = estimateGenerationTime(500, 1);
    const longResult = estimateGenerationTime(5000, 1);

    expect(longResult.max).toBeGreaterThan(shortResult.max);
  });

  it("should increase time with more materials", () => {
    const fewMaterials = estimateGenerationTime(1000, 1);
    const manyMaterials = estimateGenerationTime(1000, 10);

    expect(manyMaterials.max).toBeGreaterThan(fewMaterials.max);
  });
});

describe("getGenerationEstimate", () => {
  it("should return complete estimate object", () => {
    const outline = createOutline({
      nodes: [createNode({}), createNode({})],
      totalEstimatedWords: 1500,
    });

    const result = getGenerationEstimate(outline, "medium", 3);

    expect(result).toHaveProperty("words");
    expect(result).toHaveProperty("time");
    expect(result).toHaveProperty("materialCount", 3);
    expect(result).toHaveProperty("sectionCount", 2);
    expect(result).toHaveProperty("lengthMode", "medium");
    expect(result).toHaveProperty("lengthModeLabel");
  });

  it("should have correct section count", () => {
    const outline = createOutline({
      nodes: [
        createNode({
          children: [createNode({}), createNode({})],
        }),
      ],
    });

    const result = getGenerationEstimate(outline, "short", 1);

    expect(result.sectionCount).toBe(3);
  });

  it("should pass material count through", () => {
    const outline = createOutline({ nodes: [createNode({})] });

    const result = getGenerationEstimate(outline, "medium", 5);

    expect(result.materialCount).toBe(5);
  });

  it("should have proper lengthModeLabel", () => {
    const outline = createOutline({ nodes: [createNode({})] });

    // Labels from LENGTH_MODE_CONFIG
    expect(getGenerationEstimate(outline, "short", 1).lengthModeLabel).toBe(
      "简洁",
    );
    expect(getGenerationEstimate(outline, "medium", 1).lengthModeLabel).toBe(
      "标准",
    );
    expect(getGenerationEstimate(outline, "long", 1).lengthModeLabel).toBe(
      "详细",
    );
  });
});

describe("formatWordsDisplay", () => {
  it("should format words with locale separators", () => {
    const result = formatWordsDisplay({ min: 1000, max: 2000 });

    expect(result).toContain("约");
    expect(result).toContain("字");
    expect(result).toContain("-");
  });

  it("should format small numbers correctly", () => {
    const result = formatWordsDisplay({ min: 500, max: 800 });

    expect(result).toBe("约 500-800 字");
  });

  it("should use locale formatting for large numbers", () => {
    const result = formatWordsDisplay({ min: 10000, max: 15000 });

    // Should contain comma separators (locale dependent)
    expect(result).toContain("10");
    expect(result).toContain("15");
  });
});
