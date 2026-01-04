/**
 * Schema 验证器测试 (Story 3.1)
 * @module knowledge-studio/blueprint/__tests__
 */

import {
  validateOutput,
  validateOutputAuto,
  validateOutputBatch,
  isValidOutput,
  inferOutputType,
  createEmptyMeta,
  createFallbackMeta,
  getSupportedOutputTypes,
  isOutputTypeSupported,
} from "../structured-output";
import type {
  StructuredOutputType,
  FeatureMatrixOutput,
  SwotOutput,
  ScriptTimelineOutput,
  SectionsOutput,
  MarkdownOutput,
} from "../structured-output";

// ============================================================
// Test Data
// ============================================================

const createValidMeta = (type: StructuredOutputType) => ({
  type,
  version: "1.0.0",
  generatedAt: new Date().toISOString(),
  blueprintId: "test-blueprint",
  generationMode: "guided" as const,
  isFallback: false,
});

const validFeatureMatrix: FeatureMatrixOutput = {
  meta: createValidMeta("feature_matrix"),
  title: "功能对比",
  subjects: [
    { id: "a", name: "产品 A" },
    { id: "b", name: "产品 B" },
  ],
  rows: [
    {
      feature: "功能 1",
      support: { a: "full", b: "partial" },
    },
    {
      feature: "功能 2",
      category: "核心功能",
      support: { a: "none", b: "full" },
      notes: "备注",
    },
  ],
  summary: "产品 A 和 B 各有优势",
};

const validSwot: SwotOutput = {
  meta: createValidMeta("swot"),
  subject: "测试产品",
  overview: "综合分析",
  quadrants: {
    strengths: [{ title: "优势 1", description: "描述 1" }],
    weaknesses: [{ title: "劣势 1", description: "描述 1" }],
    opportunities: [{ title: "机会 1", description: "描述 1" }],
    threats: [{ title: "威胁 1", description: "描述 1" }],
  },
  recommendations: ["建议 1", "建议 2"],
};

const validScriptTimeline: ScriptTimelineOutput = {
  meta: createValidMeta("script_timeline"),
  title: "测试视频",
  videoType: "教程",
  targetDuration: 300,
  shots: [
    {
      id: "shot-1",
      sequence: 1,
      startTime: 0,
      duration: 10,
      visual: "开场画面",
      narration: "欢迎观看",
      shotType: "opening",
    },
    {
      id: "shot-2",
      sequence: 2,
      startTime: 10,
      duration: 290,
      visual: "主体内容",
      shotType: "content",
    },
  ],
  openingHook: "今天我们来学习...",
  closingCta: "记得点赞关注",
  totalDuration: 300,
};

const validSections: SectionsOutput = {
  meta: createValidMeta("sections"),
  title: "文档标题",
  summary: "文档摘要",
  sections: [
    {
      id: "s1",
      title: "章节 1",
      level: 1,
      content: "章节内容",
    },
    {
      id: "s2",
      title: "章节 2",
      level: 2,
      content: "子章节内容",
    },
  ],
  keywords: ["关键词1", "关键词2"],
};

const validMarkdown: MarkdownOutput = {
  meta: createValidMeta("markdown"),
  content: "# 标题\n\n这是内容",
  fallbackReason: "Schema 验证失败",
};

// ============================================================
// Tests
// ============================================================

describe("SchemaValidator", () => {
  describe("validateOutput", () => {
    it("should validate valid feature_matrix output", () => {
      const result = validateOutput(validFeatureMatrix, "feature_matrix");

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.outputType).toBe("feature_matrix");
      expect(result.data).toBeDefined();
    });

    it("should validate valid swot output", () => {
      const result = validateOutput(validSwot, "swot");

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.outputType).toBe("swot");
    });

    it("should validate valid script_timeline output", () => {
      const result = validateOutput(validScriptTimeline, "script_timeline");

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.outputType).toBe("script_timeline");
    });

    it("should validate valid sections output", () => {
      const result = validateOutput(validSections, "sections");

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.outputType).toBe("sections");
    });

    it("should validate valid markdown output", () => {
      const result = validateOutput(validMarkdown, "markdown");

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.outputType).toBe("markdown");
    });

    it("should validate JSON string input", () => {
      const jsonString = JSON.stringify(validFeatureMatrix);
      const result = validateOutput(jsonString, "feature_matrix");

      expect(result.valid).toBe(true);
    });

    it("should return error for invalid JSON string", () => {
      const result = validateOutput("{ invalid json", "feature_matrix");

      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toContain("Invalid JSON");
    });

    it("should return error for missing required fields", () => {
      const invalid = {
        meta: createValidMeta("feature_matrix"),
        // missing title, subjects, rows
      };

      const result = validateOutput(invalid, "feature_matrix");

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("should return error for wrong field type (non-coercible)", () => {
      const invalid = {
        ...validFeatureMatrix,
        subjects: "not an array", // should be array, cannot be coerced
      };

      const result = validateOutput(invalid, "feature_matrix");

      expect(result.valid).toBe(false);
    });
  });

  describe("inferOutputType", () => {
    it("should infer type from meta.type", () => {
      expect(inferOutputType(validFeatureMatrix)).toBe("feature_matrix");
      expect(inferOutputType(validSwot)).toBe("swot");
      expect(inferOutputType(validScriptTimeline)).toBe("script_timeline");
      expect(inferOutputType(validSections)).toBe("sections");
      expect(inferOutputType(validMarkdown)).toBe("markdown");
    });

    it("should infer type from structure when meta.type is missing", () => {
      const swotWithoutMeta = {
        subject: "test",
        quadrants: {
          strengths: [],
          weaknesses: [],
          opportunities: [],
          threats: [],
        },
      };
      expect(inferOutputType(swotWithoutMeta)).toBe("swot");

      const timelineWithoutMeta = {
        title: "test",
        shots: [
          { id: "1", sequence: 1, startTime: 0, duration: 10, visual: "test" },
        ],
      };
      expect(inferOutputType(timelineWithoutMeta)).toBe("script_timeline");

      const matrixWithoutMeta = {
        title: "test",
        subjects: [{ id: "a", name: "A" }],
        rows: [{ feature: "test", support: {} }],
      };
      expect(inferOutputType(matrixWithoutMeta)).toBe("feature_matrix");
    });

    it("should return undefined for invalid JSON string", () => {
      expect(inferOutputType("{ invalid")).toBeUndefined();
    });

    it("should return undefined for unknown structure", () => {
      expect(inferOutputType({ unknown: "structure" })).toBeUndefined();
    });
  });

  describe("validateOutputAuto", () => {
    it("should auto-validate with type inference", () => {
      const result = validateOutputAuto(validSwot);

      expect(result.valid).toBe(true);
      expect(result.outputType).toBe("swot");
    });

    it("should return error when type cannot be inferred", () => {
      const result = validateOutputAuto({ unknown: "data" });

      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toContain("Unable to infer");
    });
  });

  describe("validateOutputBatch", () => {
    it("should validate multiple outputs", () => {
      const results = validateOutputBatch([
        { content: validFeatureMatrix, type: "feature_matrix" },
        { content: validSwot, type: "swot" },
        { content: validMarkdown, type: "markdown" },
      ]);

      expect(results).toHaveLength(3);
      expect(results.every((r) => r.valid)).toBe(true);
    });

    it("should return individual validation results", () => {
      const results = validateOutputBatch([
        { content: validFeatureMatrix, type: "feature_matrix" },
        { content: { invalid: true }, type: "swot" },
      ]);

      expect(results[0].valid).toBe(true);
      expect(results[1].valid).toBe(false);
    });
  });

  describe("isValidOutput", () => {
    it("should return true for valid output", () => {
      expect(isValidOutput(validFeatureMatrix, "feature_matrix")).toBe(true);
    });

    it("should return false for invalid output", () => {
      expect(isValidOutput({ invalid: true }, "feature_matrix")).toBe(false);
    });
  });

  describe("createEmptyMeta", () => {
    it("should create valid meta object", () => {
      const meta = createEmptyMeta("swot", "test-blueprint", "guided");

      expect(meta.type).toBe("swot");
      expect(meta.blueprintId).toBe("test-blueprint");
      expect(meta.generationMode).toBe("guided");
      expect(meta.isFallback).toBe(false);
      expect(meta.version).toBe("1.0.0");
      expect(meta.generatedAt).toBeDefined();
    });

    it("should default to guided mode", () => {
      const meta = createEmptyMeta("swot", "test");
      expect(meta.generationMode).toBe("guided");
    });
  });

  describe("createFallbackMeta", () => {
    it("should create fallback meta with markdown type", () => {
      const meta = createFallbackMeta("swot", "test-blueprint");

      expect(meta.type).toBe("markdown");
      expect(meta.isFallback).toBe(true);
    });
  });

  describe("getSupportedOutputTypes", () => {
    it("should return all supported types", () => {
      const types = getSupportedOutputTypes();

      expect(types).toContain("feature_matrix");
      expect(types).toContain("swot");
      expect(types).toContain("script_timeline");
      expect(types).toContain("sections");
      expect(types).toContain("checklist");
      expect(types).toContain("markdown");
    });
  });

  describe("isOutputTypeSupported", () => {
    it("should return true for supported types", () => {
      expect(isOutputTypeSupported("swot")).toBe(true);
      expect(isOutputTypeSupported("feature_matrix")).toBe(true);
    });

    it("should return false for unsupported types", () => {
      expect(isOutputTypeSupported("unknown_type")).toBe(false);
    });
  });
});

describe("Schema Validation Edge Cases", () => {
  describe("SWOT Schema", () => {
    it("should accept optional importance field", () => {
      const swotWithImportance: SwotOutput = {
        ...validSwot,
        quadrants: {
          ...validSwot.quadrants,
          strengths: [{ title: "优势", description: "描述", importance: 5 }],
        },
      };

      const result = validateOutput(swotWithImportance, "swot");
      expect(result.valid).toBe(true);
    });

    it("should accept empty quadrant arrays", () => {
      const swotEmpty: SwotOutput = {
        meta: createValidMeta("swot"),
        subject: "测试",
        quadrants: {
          strengths: [],
          weaknesses: [],
          opportunities: [],
          threats: [],
        },
      };

      const result = validateOutput(swotEmpty, "swot");
      expect(result.valid).toBe(true);
    });
  });

  describe("ScriptTimeline Schema", () => {
    it("should accept all shot types", () => {
      const shotTypes = [
        "opening",
        "content",
        "transition",
        "closing",
        "b-roll",
      ];

      for (const shotType of shotTypes) {
        const timeline: ScriptTimelineOutput = {
          ...validScriptTimeline,
          shots: [
            {
              id: "shot-1",
              sequence: 1,
              startTime: 0,
              duration: 10,
              visual: "测试",
              shotType:
                shotType as ScriptTimelineOutput["shots"][0]["shotType"],
            },
          ],
        };

        const result = validateOutput(timeline, "script_timeline");
        expect(result.valid).toBe(true);
      }
    });
  });

  describe("FeatureMatrix Schema", () => {
    it("should accept support levels as strings", () => {
      const matrix: FeatureMatrixOutput = {
        ...validFeatureMatrix,
        rows: [
          {
            feature: "测试功能",
            support: {
              a: "full",
              b: "partial",
              c: "none",
              d: "unknown",
              e: "自定义支持说明",
            },
          },
        ],
      };

      const result = validateOutput(matrix, "feature_matrix");
      expect(result.valid).toBe(true);
    });
  });
});
