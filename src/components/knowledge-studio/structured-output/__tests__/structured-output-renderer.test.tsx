/**
 * 结构化输出渲染器测试 (Story 3.2)
 * @module knowledge-studio/structured-output/__tests__
 */

import { render, screen } from "@testing-library/react";
import { StructuredOutputRenderer } from "../structured-output-renderer";
import { MarkdownRenderer } from "../markdown-renderer";
import { FeatureMatrixRenderer } from "../feature-matrix-renderer";
import { SwotRenderer } from "../swot-renderer";
import { ScriptTimelineRenderer } from "../script-timeline-renderer";
import { SectionsRenderer } from "../sections-renderer";
import { ChecklistRenderer } from "../checklist-renderer";
import type {
  FeatureMatrixOutput,
  SwotOutput,
  ScriptTimelineOutput,
  SectionsOutput,
  ChecklistOutput,
  MarkdownOutput,
  StructuredOutputType,
} from "../types";

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
    { feature: "功能 1", support: { a: "full", b: "partial" } },
    { feature: "功能 2", support: { a: "none", b: "full" } },
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
  totalDuration: 300,
};

const validSections: SectionsOutput = {
  meta: createValidMeta("sections"),
  title: "文档标题",
  summary: "文档摘要",
  sections: [
    { id: "s1", title: "章节 1", level: 1, content: "章节内容" },
    { id: "s2", title: "章节 2", level: 2, content: "子章节内容" },
  ],
  keywords: ["关键词1", "关键词2"],
};

const validChecklist: ChecklistOutput = {
  meta: createValidMeta("checklist"),
  title: "待办清单",
  description: "这是一个待办清单",
  items: [
    { id: "item-1", title: "任务 1", status: "pending" },
    { id: "item-2", title: "任务 2", status: "completed" },
    { id: "item-3", title: "任务 3", status: "pending", priority: "high" },
  ],
};

const validMarkdown: MarkdownOutput = {
  meta: createValidMeta("markdown"),
  content: "# 标题\n\n这是内容",
};

// ============================================================
// Tests
// ============================================================

describe("StructuredOutputRenderer", () => {
  describe("Type Routing", () => {
    it("should render FeatureMatrixRenderer for feature_matrix type", () => {
      render(<StructuredOutputRenderer data={validFeatureMatrix} />);
      expect(screen.getByText("功能对比")).toBeInTheDocument();
      // Subject names appear in both Badge (header) and TableHead (column)
      expect(screen.getAllByText("产品 A").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("产品 B").length).toBeGreaterThanOrEqual(1);
    });

    it("should render SwotRenderer for swot type", () => {
      render(<StructuredOutputRenderer data={validSwot} />);
      expect(screen.getByText("SWOT 分析：测试产品")).toBeInTheDocument();
    });

    it("should render ScriptTimelineRenderer for script_timeline type", () => {
      render(<StructuredOutputRenderer data={validScriptTimeline} />);
      expect(screen.getByText("测试视频")).toBeInTheDocument();
      expect(screen.getByText("教程")).toBeInTheDocument();
    });

    it("should render SectionsRenderer for sections type", () => {
      render(<StructuredOutputRenderer data={validSections} />);
      expect(screen.getByText("文档标题")).toBeInTheDocument();
      expect(screen.getByText("章节 1")).toBeInTheDocument();
    });

    it("should render ChecklistRenderer for checklist type", () => {
      render(<StructuredOutputRenderer data={validChecklist} />);
      expect(screen.getByText("待办清单")).toBeInTheDocument();
      expect(screen.getByText("任务 1")).toBeInTheDocument();
    });

    it("should render MarkdownRenderer for markdown type", () => {
      render(<StructuredOutputRenderer data={validMarkdown} />);
      // Mock renders raw markdown content with # heading marker
      expect(screen.getByText(/# 标题/)).toBeInTheDocument();
    });
  });

  describe("Explicit Type Override", () => {
    it("should use explicit outputType when provided", () => {
      const markdownData: MarkdownOutput = {
        meta: createValidMeta("markdown"),
        content: "# Test Content",
      };

      render(
        <StructuredOutputRenderer data={markdownData} outputType="markdown" />,
      );
      // Mock renders raw markdown content with # heading marker
      expect(screen.getByText(/# Test Content/)).toBeInTheDocument();
    });
  });

  describe("Fallback Behavior", () => {
    it("should fallback to markdown for invalid data", () => {
      const invalidData = {
        meta: createValidMeta("feature_matrix"),
        // Missing required fields
      };

      render(
        <StructuredOutputRenderer
          data={invalidData as FeatureMatrixOutput}
          outputType="feature_matrix"
        />,
      );

      // Should show fallback indicator
      expect(
        screen.getByText(/内容结构解析失败，已降级为 Markdown 显示/),
      ).toBeInTheDocument();
    });

    it("should display fallback reason when isFallback is true", () => {
      const fallbackData: MarkdownOutput = {
        meta: { ...createValidMeta("markdown"), isFallback: true },
        content: "Fallback content",
        fallbackReason: "Schema validation failed",
      };

      render(<StructuredOutputRenderer data={fallbackData} />);
      expect(screen.getByText("Schema validation failed")).toBeInTheDocument();
    });
  });

  describe("Props Passing", () => {
    it("should pass className to container", () => {
      const { container } = render(
        <StructuredOutputRenderer
          data={validMarkdown}
          className="custom-class"
        />,
      );
      expect(
        container.querySelector(".structured-output-renderer.custom-class"),
      ).toBeInTheDocument();
    });
  });
});

describe("Individual Renderers", () => {
  describe("MarkdownRenderer", () => {
    it("should render markdown content", () => {
      render(<MarkdownRenderer data={validMarkdown} />);
      // Mock renders raw markdown content with # heading marker
      expect(screen.getByText(/# 标题/)).toBeInTheDocument();
    });

    it("should show fallback warning when isFallback is true", () => {
      const fallbackData: MarkdownOutput = {
        meta: { ...createValidMeta("markdown"), isFallback: true },
        content: "Content",
        fallbackReason: "Test reason",
      };

      render(<MarkdownRenderer data={fallbackData} />);
      expect(screen.getByText("Test reason")).toBeInTheDocument();
    });
  });

  describe("FeatureMatrixRenderer", () => {
    it("should display title and subjects", () => {
      render(<FeatureMatrixRenderer data={validFeatureMatrix} />);
      expect(screen.getByText("功能对比")).toBeInTheDocument();
      // Subject names appear in both Badge (header) and TableHead (column)
      expect(screen.getAllByText("产品 A").length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText("共 2 项功能对比")).toBeInTheDocument();
    });

    it("should display summary when provided", () => {
      render(<FeatureMatrixRenderer data={validFeatureMatrix} />);
      expect(screen.getByText("产品 A 和 B 各有优势")).toBeInTheDocument();
    });
  });

  describe("SwotRenderer", () => {
    it("should display subject and quadrant labels", () => {
      render(<SwotRenderer data={validSwot} />);
      expect(screen.getByText("SWOT 分析：测试产品")).toBeInTheDocument();
      // Quadrant labels are separate from count badges now
      expect(screen.getByText("优势")).toBeInTheDocument();
      expect(screen.getByText("劣势")).toBeInTheDocument();
      expect(screen.getByText("机会")).toBeInTheDocument();
      expect(screen.getByText("威胁")).toBeInTheDocument();
    });

    it("should display recommendations", () => {
      render(<SwotRenderer data={validSwot} />);
      expect(screen.getByText("建议 1")).toBeInTheDocument();
    });

    it("should display item titles", () => {
      render(<SwotRenderer data={validSwot} />);
      expect(screen.getByText("优势 1")).toBeInTheDocument();
      expect(screen.getByText("劣势 1")).toBeInTheDocument();
    });
  });

  describe("ScriptTimelineRenderer", () => {
    it("should display title and video type", () => {
      render(<ScriptTimelineRenderer data={validScriptTimeline} />);
      expect(screen.getByText("测试视频")).toBeInTheDocument();
      expect(screen.getByText("教程")).toBeInTheDocument();
    });

    it("should display shot count", () => {
      render(<ScriptTimelineRenderer data={validScriptTimeline} />);
      expect(screen.getByText("共 2 个分镜")).toBeInTheDocument();
    });
  });

  describe("SectionsRenderer", () => {
    it("should display title and sections", () => {
      render(<SectionsRenderer data={validSections} />);
      expect(screen.getByText("文档标题")).toBeInTheDocument();
      expect(screen.getByText("章节 1")).toBeInTheDocument();
      expect(screen.getByText("章节 2")).toBeInTheDocument();
    });

    it("should display keywords", () => {
      render(<SectionsRenderer data={validSections} />);
      expect(screen.getByText("关键词1")).toBeInTheDocument();
      expect(screen.getByText("关键词2")).toBeInTheDocument();
    });
  });

  describe("ChecklistRenderer", () => {
    it("should display title and items", () => {
      render(<ChecklistRenderer data={validChecklist} />);
      expect(screen.getByText("待办清单")).toBeInTheDocument();
      expect(screen.getByText("任务 1")).toBeInTheDocument();
      expect(screen.getByText("任务 2")).toBeInTheDocument();
    });

    it("should calculate progress correctly", () => {
      render(<ChecklistRenderer data={validChecklist} />);
      // 1 out of 3 is done = 33%
      expect(screen.getByText("33%")).toBeInTheDocument();
      expect(screen.getByText("已完成 1/3")).toBeInTheDocument();
    });

    it("should show high priority badge", () => {
      render(<ChecklistRenderer data={validChecklist} />);
      expect(screen.getByText("高优")).toBeInTheDocument();
    });
  });
});
