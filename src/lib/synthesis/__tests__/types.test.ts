/**
 * 综述类型转换函数单元测试
 *
 * @description 测试 mapRowToReport, mapRowToSummary 和 SynthesisError 类
 */

import {
  mapRowToReport,
  mapRowToSummary,
  SynthesisError,
  SynthesisErrorCode,
  type SynthesisReportRow,
  type ConsensusPoint,
  type DivergencePoint,
  type BlindSpot,
} from "../types";
import { OVERVIEW_PREVIEW_MAX_LENGTH } from "../constants";

// ============================================================================
// 测试数据工厂
// ============================================================================

function createMockReportRow(
  overrides?: Partial<SynthesisReportRow>,
): SynthesisReportRow {
  return {
    id: "report-123",
    user_id: "user-456",
    title: "测试综述",
    source_type: "folder",
    source_id: "folder-789",
    source_bookmark_ids: null,
    depth_mode: "standard",
    overview: "这是一段概述内容。",
    consensus: [
      {
        point: "共识点1",
        confidence: 0.9,
        sources: [{ id: "bm-1", title: "来源1" }],
      },
    ],
    divergence: [
      {
        topic: "分歧主题",
        point_a: "观点A",
        sources_a: [{ id: "bm-1", title: "来源1" }],
        point_b: "观点B",
        sources_b: [{ id: "bm-2", title: "来源2" }],
        analysis: "分析内容",
      },
    ],
    blind_spots: [
      {
        topic: "盲区主题",
        suggestion: "建议内容",
        search_keywords: ["关键词1", "关键词2"],
      },
    ],
    full_markdown: "# 完整 Markdown",
    embedding: null,
    status: "completed",
    error_message: null,
    source_count: 10,
    word_count: 500,
    created_at: "2025-12-29T10:00:00Z",
    updated_at: "2025-12-29T10:30:00Z",
    completed_at: "2025-12-29T10:30:00Z",
    ...overrides,
  };
}

// ============================================================================
// mapRowToReport 测试
// ============================================================================

describe("mapRowToReport", () => {
  describe("基本字段映射", () => {
    it("正确映射所有基本字段", () => {
      const row = createMockReportRow();
      const result = mapRowToReport(row);

      expect(result.id).toBe("report-123");
      expect(result.userId).toBe("user-456");
      expect(result.title).toBe("测试综述");
      expect(result.sourceType).toBe("folder");
      expect(result.sourceId).toBe("folder-789");
      expect(result.depthMode).toBe("standard");
      expect(result.status).toBe("completed");
      expect(result.sourceCount).toBe(10);
      expect(result.wordCount).toBe(500);
    });

    it("正确映射时间戳字段", () => {
      const row = createMockReportRow();
      const result = mapRowToReport(row);

      expect(result.createdAt).toBe("2025-12-29T10:00:00Z");
      expect(result.updatedAt).toBe("2025-12-29T10:30:00Z");
      expect(result.completedAt).toBe("2025-12-29T10:30:00Z");
    });
  });

  describe("四维结构数据映射", () => {
    it("正确映射概述内容", () => {
      const row = createMockReportRow({ overview: "详细概述内容" });
      const result = mapRowToReport(row);

      expect(result.overview).toBe("详细概述内容");
    });

    it("正确映射共识点数组", () => {
      const consensus: ConsensusPoint[] = [
        {
          point: "共识1",
          confidence: 0.95,
          sources: [{ id: "s1", title: "来源1" }],
        },
        { point: "共识2", confidence: 0.8, sources: [] },
      ];
      const row = createMockReportRow({ consensus });
      const result = mapRowToReport(row);

      expect(result.consensus).toEqual(consensus);
      expect(result.consensusCount).toBe(2);
    });

    it("正确映射分歧点数组", () => {
      const divergence: DivergencePoint[] = [
        {
          topic: "主题1",
          point_a: "观点A",
          sources_a: [],
          point_b: "观点B",
          sources_b: [],
          analysis: "分析",
        },
      ];
      const row = createMockReportRow({ divergence });
      const result = mapRowToReport(row);

      expect(result.divergence).toEqual(divergence);
      expect(result.divergenceCount).toBe(1);
    });

    it("正确映射知识盲区数组", () => {
      const blindSpots: BlindSpot[] = [
        { topic: "盲区1", suggestion: "建议1", search_keywords: ["kw1"] },
        { topic: "盲区2", suggestion: "建议2", search_keywords: [] },
      ];
      const row = createMockReportRow({ blind_spots: blindSpots });
      const result = mapRowToReport(row);

      expect(result.blindSpots).toEqual(blindSpots);
      expect(result.blindSpotCount).toBe(2);
    });
  });

  describe("空值处理", () => {
    it("overview 为 null 时返回空字符串", () => {
      const row = createMockReportRow({ overview: null });
      const result = mapRowToReport(row);

      expect(result.overview).toBe("");
    });

    it("consensus 为 null 时返回空数组", () => {
      const row = createMockReportRow({ consensus: null });
      const result = mapRowToReport(row);

      expect(result.consensus).toEqual([]);
      expect(result.consensusCount).toBe(0);
    });

    it("divergence 为 null 时返回空数组", () => {
      const row = createMockReportRow({ divergence: null });
      const result = mapRowToReport(row);

      expect(result.divergence).toEqual([]);
      expect(result.divergenceCount).toBe(0);
    });

    it("blind_spots 为 null 时返回空数组", () => {
      const row = createMockReportRow({ blind_spots: null });
      const result = mapRowToReport(row);

      expect(result.blindSpots).toEqual([]);
      expect(result.blindSpotCount).toBe(0);
    });

    it("full_markdown 为 null 时返回空字符串", () => {
      const row = createMockReportRow({ full_markdown: null });
      const result = mapRowToReport(row);

      expect(result.fullMarkdown).toBe("");
    });

    it("error_message 为 null 时保持 null", () => {
      const row = createMockReportRow({ error_message: null });
      const result = mapRowToReport(row);

      expect(result.errorMessage).toBeNull();
    });

    it("completed_at 为 null 时保持 null", () => {
      const row = createMockReportRow({
        status: "generating",
        completed_at: null,
      });
      const result = mapRowToReport(row);

      expect(result.completedAt).toBeNull();
    });
  });

  describe("概述预览截断", () => {
    it("概述短于最大长度时不截断", () => {
      const shortOverview = "短概述";
      const row = createMockReportRow({ overview: shortOverview });
      const result = mapRowToReport(row);

      expect(result.overviewPreview).toBe(shortOverview);
    });

    it("概述等于最大长度时不截断", () => {
      const exactLengthOverview = "a".repeat(OVERVIEW_PREVIEW_MAX_LENGTH);
      const row = createMockReportRow({ overview: exactLengthOverview });
      const result = mapRowToReport(row);

      expect(result.overviewPreview).toBe(exactLengthOverview);
      expect(result.overviewPreview.length).toBe(OVERVIEW_PREVIEW_MAX_LENGTH);
    });

    it("概述超过最大长度时截断", () => {
      const longOverview = "a".repeat(OVERVIEW_PREVIEW_MAX_LENGTH + 50);
      const row = createMockReportRow({ overview: longOverview });
      const result = mapRowToReport(row);

      expect(result.overviewPreview.length).toBe(OVERVIEW_PREVIEW_MAX_LENGTH);
      expect(result.overviewPreview).toBe(
        "a".repeat(OVERVIEW_PREVIEW_MAX_LENGTH),
      );
    });

    it("overview 为空时返回空字符串预览", () => {
      const row = createMockReportRow({ overview: null });
      const result = mapRowToReport(row);

      expect(result.overviewPreview).toBe("");
    });
  });

  describe("来源类型映射", () => {
    const sourceTypes = ["folder", "tag", "selection", "ai_recommend"] as const;

    sourceTypes.forEach((sourceType) => {
      it(`正确映射来源类型: ${sourceType}`, () => {
        const row = createMockReportRow({ source_type: sourceType });
        const result = mapRowToReport(row);

        expect(result.sourceType).toBe(sourceType);
      });
    });
  });

  describe("深度模式映射", () => {
    const depthModes = ["quick", "standard", "academic"] as const;

    depthModes.forEach((depthMode) => {
      it(`正确映射深度模式: ${depthMode}`, () => {
        const row = createMockReportRow({ depth_mode: depthMode });
        const result = mapRowToReport(row);

        expect(result.depthMode).toBe(depthMode);
      });
    });
  });

  describe("状态映射", () => {
    const statuses = [
      "pending",
      "generating",
      "completed",
      "failed",
      "cancelled",
    ] as const;

    statuses.forEach((status) => {
      it(`正确映射状态: ${status}`, () => {
        const row = createMockReportRow({ status });
        const result = mapRowToReport(row);

        expect(result.status).toBe(status);
      });
    });
  });
});

// ============================================================================
// mapRowToSummary 测试
// ============================================================================

describe("mapRowToSummary", () => {
  describe("基本字段映射", () => {
    it("正确映射摘要所需的基本字段", () => {
      const row = createMockReportRow();
      const result = mapRowToSummary(row);

      expect(result.id).toBe("report-123");
      expect(result.title).toBe("测试综述");
      expect(result.sourceType).toBe("folder");
      expect(result.depthMode).toBe("standard");
      expect(result.sourceCount).toBe(10);
      expect(result.wordCount).toBe(500);
      expect(result.status).toBe("completed");
      expect(result.createdAt).toBe("2025-12-29T10:00:00Z");
      expect(result.completedAt).toBe("2025-12-29T10:30:00Z");
    });

    it("不包含完整报告的详细字段", () => {
      const row = createMockReportRow();
      const result = mapRowToSummary(row);

      // 摘要不应包含 userId, overview, consensus 等详细字段
      expect("userId" in result).toBe(false);
      expect("overview" in result).toBe(false);
      expect("consensus" in result).toBe(false);
      expect("divergence" in result).toBe(false);
      expect("blindSpots" in result).toBe(false);
      expect("fullMarkdown" in result).toBe(false);
    });
  });

  describe("计数字段映射", () => {
    it("正确计算共识点数量", () => {
      const consensus: ConsensusPoint[] = [
        { point: "1", confidence: 0.9, sources: [] },
        { point: "2", confidence: 0.8, sources: [] },
        { point: "3", confidence: 0.7, sources: [] },
      ];
      const row = createMockReportRow({ consensus });
      const result = mapRowToSummary(row);

      expect(result.consensusCount).toBe(3);
    });

    it("正确计算分歧点数量", () => {
      const divergence: DivergencePoint[] = [
        {
          topic: "1",
          point_a: "a",
          sources_a: [],
          point_b: "b",
          sources_b: [],
          analysis: "",
        },
        {
          topic: "2",
          point_a: "a",
          sources_a: [],
          point_b: "b",
          sources_b: [],
          analysis: "",
        },
      ];
      const row = createMockReportRow({ divergence });
      const result = mapRowToSummary(row);

      expect(result.divergenceCount).toBe(2);
    });

    it("正确计算盲区数量", () => {
      const blindSpots: BlindSpot[] = [
        { topic: "1", suggestion: "", search_keywords: [] },
      ];
      const row = createMockReportRow({ blind_spots: blindSpots });
      const result = mapRowToSummary(row);

      expect(result.blindSpotCount).toBe(1);
    });

    it("数组为 null 时计数为 0", () => {
      const row = createMockReportRow({
        consensus: null,
        divergence: null,
        blind_spots: null,
      });
      const result = mapRowToSummary(row);

      expect(result.consensusCount).toBe(0);
      expect(result.divergenceCount).toBe(0);
      expect(result.blindSpotCount).toBe(0);
    });
  });

  describe("概述预览", () => {
    it("正确生成概述预览", () => {
      const overview = "这是一段较长的概述内容，用于测试预览截断功能。";
      const row = createMockReportRow({ overview });
      const result = mapRowToSummary(row);

      expect(result.overviewPreview).toBe(overview);
    });

    it("长概述被正确截断", () => {
      const longOverview = "字".repeat(OVERVIEW_PREVIEW_MAX_LENGTH + 100);
      const row = createMockReportRow({ overview: longOverview });
      const result = mapRowToSummary(row);

      expect(result.overviewPreview.length).toBe(OVERVIEW_PREVIEW_MAX_LENGTH);
    });
  });
});

// ============================================================================
// SynthesisError 测试
// ============================================================================

describe("SynthesisError", () => {
  describe("基本构造", () => {
    it("正确设置错误消息", () => {
      const error = new SynthesisError(
        "测试错误",
        SynthesisErrorCode.SOURCE_NOT_FOUND,
      );

      expect(error.message).toBe("测试错误");
    });

    it("正确设置错误代码", () => {
      const error = new SynthesisError(
        "测试错误",
        SynthesisErrorCode.INSUFFICIENT_CONTENT,
      );

      expect(error.code).toBe(SynthesisErrorCode.INSUFFICIENT_CONTENT);
    });

    it("正确设置错误名称", () => {
      const error = new SynthesisError(
        "测试错误",
        SynthesisErrorCode.LLM_ERROR,
      );

      expect(error.name).toBe("SynthesisError");
    });

    it("是 Error 的实例", () => {
      const error = new SynthesisError(
        "测试错误",
        SynthesisErrorCode.LLM_ERROR,
      );

      expect(error instanceof Error).toBe(true);
      expect(error instanceof SynthesisError).toBe(true);
    });
  });

  describe("详细信息", () => {
    it("可以携带额外的详细信息", () => {
      const details = { bookmarkCount: 2, requiredMinimum: 3 };
      const error = new SynthesisError(
        "书签数量不足",
        SynthesisErrorCode.INSUFFICIENT_CONTENT,
        details,
      );

      expect(error.details).toEqual(details);
    });

    it("details 未提供时为 undefined", () => {
      const error = new SynthesisError(
        "测试错误",
        SynthesisErrorCode.LLM_ERROR,
      );

      expect(error.details).toBeUndefined();
    });
  });

  describe("所有错误代码", () => {
    const errorCodes = [
      SynthesisErrorCode.SOURCE_NOT_FOUND,
      SynthesisErrorCode.INSUFFICIENT_CONTENT,
      SynthesisErrorCode.TOKEN_LIMIT_EXCEEDED,
      SynthesisErrorCode.LLM_ERROR,
      SynthesisErrorCode.GENERATION_TIMEOUT,
      SynthesisErrorCode.USER_CANCELLED,
      SynthesisErrorCode.INVALID_PARAMS,
      SynthesisErrorCode.UNAUTHORIZED,
      SynthesisErrorCode.REPORT_NOT_FOUND,
      SynthesisErrorCode.NOT_FOUND,
      SynthesisErrorCode.GENERATION_FAILED,
    ];

    errorCodes.forEach((code) => {
      it(`支持错误代码: ${code}`, () => {
        const error = new SynthesisError(`错误: ${code}`, code);

        expect(error.code).toBe(code);
      });
    });
  });
});
