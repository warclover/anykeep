/**
 * 综述导出功能单元测试
 *
 * @description 测试 exportSynthesis 函数及各格式导出
 */

import { exportSynthesis, EXPORT_FORMATS } from "../export";
import type { SynthesisReport } from "../types";

// ============================================================================
// 测试数据工厂
// ============================================================================

function createMockReport(
  overrides?: Partial<SynthesisReport>,
): SynthesisReport {
  return {
    id: "report-123",
    userId: "user-456",
    title: "AI 技术发展综述",
    sourceType: "folder",
    sourceId: "folder-789",
    sourceBookmarkIds: null,
    depthMode: "standard",
    outputStyle: "narrative", // [S1] 添加默认风格
    overview:
      "本报告综合分析了多篇关于 AI 技术发展的文章，涵盖了机器学习、深度学习和大语言模型等领域。",
    consensus: [
      {
        point: "深度学习是当前 AI 发展的核心驱动力",
        confidence: 0.95,
        sources: [
          { id: "bm-1", title: "深度学习入门" },
          { id: "bm-2", title: "AI 趋势报告" },
        ],
      },
      {
        point: "大模型需要大量计算资源",
        confidence: 0.88,
        sources: [{ id: "bm-3", title: "GPU 计算指南" }],
      },
    ],
    divergence: [
      {
        topic: "AI 是否会取代人类工作",
        point_a: "AI 将创造更多新的工作机会",
        sources_a: [{ id: "bm-4", title: "乐观派观点" }],
        point_b: "AI 将导致大规模失业",
        sources_b: [{ id: "bm-5", title: "悲观派观点" }],
        analysis: "这一争议反映了技术变革对就业市场的复杂影响，需要综合考虑。",
      },
    ],
    blindSpots: [
      {
        topic: "AI 伦理问题",
        suggestion: "建议补充关于 AI 伦理和安全方面的内容",
        search_keywords: ["AI 伦理", "AI 安全", "负责任 AI"],
      },
    ],
    fullMarkdown: "# AI 技术发展综述\n...",
    status: "completed",
    errorMessage: null,
    sourceCount: 10,
    wordCount: 1500,
    createdAt: "2025-12-29T10:00:00Z",
    updatedAt: "2025-12-29T10:30:00Z",
    completedAt: "2025-12-29T10:30:00Z",
    overviewPreview: "本报告综合分析了多篇关于 AI 技术发展的文章...",
    consensusCount: 2,
    divergenceCount: 1,
    blindSpotCount: 1,
    ...overrides,
  };
}

// ============================================================================
// EXPORT_FORMATS 常量测试
// ============================================================================

describe("EXPORT_FORMATS", () => {
  it("包含四种导出格式", () => {
    expect(EXPORT_FORMATS).toHaveLength(4);
  });

  it("每种格式有完整的配置", () => {
    EXPORT_FORMATS.forEach((format) => {
      expect(format.id).toBeDefined();
      expect(format.name).toBeDefined();
      expect(format.description).toBeDefined();
      expect(format.extension).toBeDefined();
      expect(format.mimeType).toBeDefined();
    });
  });

  it("markdown 格式配置正确", () => {
    const markdown = EXPORT_FORMATS.find((f) => f.id === "markdown");
    expect(markdown).toBeDefined();
    expect(markdown?.extension).toBe(".md");
    expect(markdown?.mimeType).toBe("text/markdown");
  });

  it("obsidian 格式配置正确", () => {
    const obsidian = EXPORT_FORMATS.find((f) => f.id === "obsidian");
    expect(obsidian).toBeDefined();
    expect(obsidian?.extension).toBe(".md");
    expect(obsidian?.mimeType).toBe("text/markdown");
  });

  it("json 格式配置正确", () => {
    const json = EXPORT_FORMATS.find((f) => f.id === "json");
    expect(json).toBeDefined();
    expect(json?.extension).toBe(".json");
    expect(json?.mimeType).toBe("application/json");
  });

  it("html 格式配置正确", () => {
    const html = EXPORT_FORMATS.find((f) => f.id === "html");
    expect(html).toBeDefined();
    expect(html?.extension).toBe(".html");
    expect(html?.mimeType).toBe("text/html");
  });
});

// ============================================================================
// exportSynthesis 主函数测试
// ============================================================================

describe("exportSynthesis", () => {
  describe("基本功能", () => {
    it("返回正确的结构", () => {
      const report = createMockReport();
      const result = exportSynthesis(report, "markdown");

      expect(result).toHaveProperty("content");
      expect(result).toHaveProperty("filename");
      expect(result).toHaveProperty("mimeType");
    });

    it("不支持的格式抛出错误", () => {
      const report = createMockReport();

      expect(() => {
        exportSynthesis(report, "invalid" as "markdown");
      }).toThrow("Unsupported format: invalid");
    });
  });

  describe("文件名生成", () => {
    it("使用报告标题生成文件名", () => {
      const report = createMockReport({ title: "测试报告" });
      const result = exportSynthesis(report, "markdown");

      expect(result.filename).toContain("测试报告");
      expect(result.filename.endsWith(".md")).toBe(true);
    });

    it("移除文件名中的非法字符", () => {
      const report = createMockReport({ title: 'Test<>:"/\\|?*Title' });
      const result = exportSynthesis(report, "markdown");

      expect(result.filename).not.toContain("<");
      expect(result.filename).not.toContain(">");
      expect(result.filename).not.toContain(":");
      expect(result.filename).not.toContain('"');
      expect(result.filename).not.toContain("/");
      expect(result.filename).not.toContain("\\");
      expect(result.filename).not.toContain("|");
      expect(result.filename).not.toContain("?");
      expect(result.filename).not.toContain("*");
    });

    it("空格转换为下划线", () => {
      const report = createMockReport({ title: "Test Report Title" });
      const result = exportSynthesis(report, "markdown");

      expect(result.filename).toContain("Test_Report_Title");
    });

    it("长标题截断为 50 字符", () => {
      const longTitle = "a".repeat(100);
      const report = createMockReport({ title: longTitle });
      const result = exportSynthesis(report, "markdown");

      // 文件名 = 标题(最长50) + 扩展名(.md = 3)
      expect(result.filename.length).toBeLessThanOrEqual(50 + 3);
    });
  });

  describe("MIME 类型", () => {
    const formatMimeTypes = [
      { format: "markdown", mimeType: "text/markdown" },
      { format: "obsidian", mimeType: "text/markdown" },
      { format: "json", mimeType: "application/json" },
      { format: "html", mimeType: "text/html" },
    ] as const;

    formatMimeTypes.forEach(({ format, mimeType }) => {
      it(`${format} 格式返回正确的 MIME 类型`, () => {
        const report = createMockReport();
        const result = exportSynthesis(report, format);

        expect(result.mimeType).toBe(mimeType);
      });
    });
  });
});

// ============================================================================
// Markdown 导出测试
// ============================================================================

describe("Markdown 导出", () => {
  describe("基本结构", () => {
    it("包含一级标题", () => {
      const report = createMockReport({ title: "测试综述" });
      const result = exportSynthesis(report, "markdown");

      expect(result.content).toContain("# 测试综述");
    });

    it("包含概述章节", () => {
      const report = createMockReport({ overview: "概述内容" });
      const result = exportSynthesis(report, "markdown");

      expect(result.content).toContain("## 📝 概述");
      expect(result.content).toContain("概述内容");
    });

    it("包含共识章节", () => {
      const report = createMockReport();
      const result = exportSynthesis(report, "markdown");

      expect(result.content).toContain("## ✅ 核心共识");
    });

    it("包含分歧章节", () => {
      const report = createMockReport();
      const result = exportSynthesis(report, "markdown");

      expect(result.content).toContain("## ⚡ 观点分歧");
    });

    it("包含盲区章节", () => {
      const report = createMockReport();
      const result = exportSynthesis(report, "markdown");

      expect(result.content).toContain("## 💡 知识盲区");
    });
  });

  describe("元数据选项", () => {
    it("includeMetadata 为 true 时包含元数据", () => {
      const report = createMockReport();
      const result = exportSynthesis(report, "markdown", {
        includeMetadata: true,
      });

      expect(result.content).toContain("生成时间");
      expect(result.content).toContain("来源数量");
      expect(result.content).toContain("字数");
    });

    it("includeMetadata 为 false 时不包含元数据", () => {
      const report = createMockReport();
      const result = exportSynthesis(report, "markdown", {
        includeMetadata: false,
      });

      expect(result.content).not.toContain("生成时间：");
    });
  });

  describe("来源选项", () => {
    it("includeSources 为 true 时包含来源", () => {
      const report = createMockReport();
      const result = exportSynthesis(report, "markdown", {
        includeSources: true,
      });

      expect(result.content).toContain("来源：");
      expect(result.content).toContain("深度学习入门");
    });
  });

  describe("空内容处理", () => {
    it("无概述时不显示概述章节", () => {
      const report = createMockReport({ overview: "" });
      const result = exportSynthesis(report, "markdown");

      expect(result.content).not.toContain("## 📝 概述");
    });

    it("无共识时不显示共识章节", () => {
      const report = createMockReport({ consensus: [] });
      const result = exportSynthesis(report, "markdown");

      expect(result.content).not.toContain("## ✅ 核心共识");
    });

    it("无分歧时不显示分歧章节", () => {
      const report = createMockReport({ divergence: [] });
      const result = exportSynthesis(report, "markdown");

      expect(result.content).not.toContain("## ⚡ 观点分歧");
    });

    it("无盲区时不显示盲区章节", () => {
      const report = createMockReport({ blindSpots: [] });
      const result = exportSynthesis(report, "markdown");

      expect(result.content).not.toContain("## 💡 知识盲区");
    });
  });
});

// ============================================================================
// Obsidian 导出测试
// ============================================================================

describe("Obsidian 导出", () => {
  describe("YAML Frontmatter", () => {
    it("包含 YAML 前置内容", () => {
      const report = createMockReport();
      const result = exportSynthesis(report, "obsidian");

      expect(result.content.startsWith("---")).toBe(true);
      expect(result.content).toContain("title:");
      expect(result.content).toContain("type: synthesis");
    });

    it("包含来源类型", () => {
      const report = createMockReport({ sourceType: "folder" });
      const result = exportSynthesis(report, "obsidian");

      expect(result.content).toContain("source_type: folder");
    });

    it("包含深度模式", () => {
      const report = createMockReport({ depthMode: "academic" });
      const result = exportSynthesis(report, "obsidian");

      expect(result.content).toContain("depth_mode: academic");
    });

    it("包含标签", () => {
      const report = createMockReport();
      const result = exportSynthesis(report, "obsidian");

      expect(result.content).toContain("tags:");
      expect(result.content).toContain("- synthesis");
    });
  });

  describe("双链语法", () => {
    it("来源使用双链格式", () => {
      const report = createMockReport();
      const result = exportSynthesis(report, "obsidian", {
        includeSources: true,
      });

      expect(result.content).toContain("[[深度学习入门]]");
    });
  });

  describe("Callout 语法", () => {
    it("分歧使用 Obsidian Callout 格式", () => {
      const report = createMockReport();
      const result = exportSynthesis(report, "obsidian");

      expect(result.content).toContain("> [!note] 观点 A");
      expect(result.content).toContain("> [!note] 观点 B");
      expect(result.content).toContain("> [!tip] 分析");
    });
  });

  describe("搜索关键词", () => {
    it("搜索关键词使用代码格式", () => {
      const report = createMockReport();
      const result = exportSynthesis(report, "obsidian");

      expect(result.content).toContain("`AI 伦理`");
      expect(result.content).toContain("`AI 安全`");
    });
  });
});

// ============================================================================
// JSON 导出测试
// ============================================================================

describe("JSON 导出", () => {
  describe("基本结构", () => {
    it("返回有效的 JSON", () => {
      const report = createMockReport();
      const result = exportSynthesis(report, "json");

      expect(() => JSON.parse(result.content)).not.toThrow();
    });

    it("包含核心字段", () => {
      const report = createMockReport();
      const result = exportSynthesis(report, "json");
      const parsed = JSON.parse(result.content);

      expect(parsed.title).toBe("AI 技术发展综述");
      expect(parsed.overview).toBeDefined();
      expect(parsed.consensus).toBeInstanceOf(Array);
      expect(parsed.divergence).toBeInstanceOf(Array);
      expect(parsed.blindSpots).toBeInstanceOf(Array);
    });
  });

  describe("元数据选项", () => {
    it("includeMetadata 为 true 时包含元数据", () => {
      const report = createMockReport();
      const result = exportSynthesis(report, "json", { includeMetadata: true });
      const parsed = JSON.parse(result.content);

      expect(parsed.metadata).toBeDefined();
      expect(parsed.metadata.id).toBe("report-123");
      expect(parsed.metadata.sourceType).toBe("folder");
      expect(parsed.metadata.depthMode).toBe("standard");
    });

    it("includeMetadata 为 false 时不包含元数据", () => {
      const report = createMockReport();
      const result = exportSynthesis(report, "json", {
        includeMetadata: false,
      });
      const parsed = JSON.parse(result.content);

      expect(parsed.metadata).toBeUndefined();
    });
  });

  describe("格式化", () => {
    it("输出格式化的 JSON（缩进 2 空格）", () => {
      const report = createMockReport();
      const result = exportSynthesis(report, "json");

      // 检查是否有缩进（格式化的 JSON 应该有换行和空格）
      expect(result.content).toContain("\n");
      expect(result.content).toContain("  ");
    });
  });
});

// ============================================================================
// HTML 导出测试
// ============================================================================

describe("HTML 导出", () => {
  describe("基本结构", () => {
    it("包含 DOCTYPE 声明", () => {
      const report = createMockReport();
      const result = exportSynthesis(report, "html");

      expect(result.content.startsWith("<!DOCTYPE html>")).toBe(true);
    });

    it("包含中文语言声明", () => {
      const report = createMockReport();
      const result = exportSynthesis(report, "html");

      expect(result.content).toContain('lang="zh-CN"');
    });

    it("包含 UTF-8 编码", () => {
      const report = createMockReport();
      const result = exportSynthesis(report, "html");

      expect(result.content).toContain('charset="UTF-8"');
    });

    it("包含 viewport meta 标签", () => {
      const report = createMockReport();
      const result = exportSynthesis(report, "html");

      expect(result.content).toContain("viewport");
    });

    it("包含内联样式", () => {
      const report = createMockReport();
      const result = exportSynthesis(report, "html");

      expect(result.content).toContain("<style>");
      expect(result.content).toContain("</style>");
    });
  });

  describe("内容区块", () => {
    it("包含标题", () => {
      const report = createMockReport({ title: "测试标题" });
      const result = exportSynthesis(report, "html");

      expect(result.content).toContain("<h1>测试标题</h1>");
      expect(result.content).toContain("<title>测试标题</title>");
    });

    it("包含各区块的正确 CSS 类", () => {
      const report = createMockReport();
      const result = exportSynthesis(report, "html");

      expect(result.content).toContain('class="consensus-item"');
      expect(result.content).toContain('class="divergence-item"');
      expect(result.content).toContain('class="blindspot-item"');
    });
  });

  describe("XSS 防护", () => {
    it("HTML 特殊字符被转义", () => {
      const report = createMockReport({
        title: "<script>alert('xss')</script>",
        overview: "Test & <b>bold</b>",
      });
      const result = exportSynthesis(report, "html");

      expect(result.content).not.toContain("<script>alert");
      expect(result.content).toContain("&lt;script&gt;");
      expect(result.content).toContain("&amp;");
    });

    it("引号被转义", () => {
      const report = createMockReport({
        title: 'Test "quoted" title',
        overview: "It's a test",
      });
      const result = exportSynthesis(report, "html");

      expect(result.content).toContain("&quot;");
      expect(result.content).toContain("&#039;");
    });
  });

  describe("元数据选项", () => {
    it("includeMetadata 为 true 时显示元数据", () => {
      const report = createMockReport();
      const result = exportSynthesis(report, "html", { includeMetadata: true });

      expect(result.content).toContain('class="meta"');
      expect(result.content).toContain("生成时间");
      expect(result.content).toContain("来源");
      expect(result.content).toContain("字数");
    });
  });

  describe("关键词显示", () => {
    it("搜索关键词使用 keyword 类", () => {
      const report = createMockReport();
      const result = exportSynthesis(report, "html");

      expect(result.content).toContain('class="keyword"');
      expect(result.content).toContain('class="keywords"');
    });
  });
});

// ============================================================================
// 边界条件测试
// ============================================================================

describe("边界条件", () => {
  describe("空报告处理", () => {
    it("处理所有字段为空的报告", () => {
      const emptyReport = createMockReport({
        overview: "",
        consensus: [],
        divergence: [],
        blindSpots: [],
      });

      const formats = ["markdown", "obsidian", "json", "html"] as const;

      formats.forEach((format) => {
        expect(() => exportSynthesis(emptyReport, format)).not.toThrow();
      });
    });
  });

  describe("特殊字符处理", () => {
    it("正确处理 Unicode 字符", () => {
      const report = createMockReport({
        title: "测试 🎉 表情符号 ✅",
        overview: "包含各种 Unicode：中文、日本語、한국어",
      });

      const result = exportSynthesis(report, "markdown");

      expect(result.content).toContain("🎉");
      expect(result.content).toContain("中文");
    });

    it("正确处理换行符", () => {
      const report = createMockReport({
        overview: "第一行\n第二行\n第三行",
      });

      const result = exportSynthesis(report, "markdown");

      expect(result.content).toContain("第一行");
      expect(result.content).toContain("第二行");
    });
  });
});
