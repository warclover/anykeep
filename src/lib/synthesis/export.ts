/**
 * 综述导出服务
 *
 * 支持多种导出格式：Markdown、Obsidian、JSON、HTML
 *
 * @version 1.0.0
 * @since 2025-12-29
 */

import type { SynthesisReport, SynthesisExportFormat } from "@/lib/synthesis";

// ============================================================================
// 导出格式配置
// ============================================================================

export const EXPORT_FORMATS: Array<{
  id: SynthesisExportFormat;
  name: string;
  description: string;
  extension: string;
  mimeType: string;
}> = [
  {
    id: "markdown",
    name: "Markdown",
    description: "通用 Markdown 格式，适合大多数笔记应用",
    extension: ".md",
    mimeType: "text/markdown",
  },
  {
    id: "obsidian",
    name: "Obsidian",
    description: "带双链和元数据的 Obsidian 格式",
    extension: ".md",
    mimeType: "text/markdown",
  },
  {
    id: "json",
    name: "JSON",
    description: "结构化数据格式，便于程序处理",
    extension: ".json",
    mimeType: "application/json",
  },
  {
    id: "html",
    name: "HTML",
    description: "网页格式，可直接在浏览器中查看",
    extension: ".html",
    mimeType: "text/html",
  },
];

// ============================================================================
// Markdown 导出
// ============================================================================

function exportToMarkdown(
  report: SynthesisReport,
  options: { includeSources?: boolean; includeMetadata?: boolean },
): string {
  const lines: string[] = [];

  // 标题
  lines.push(`# ${report.title}`);
  lines.push("");

  // 元数据
  if (options.includeMetadata) {
    lines.push(`> 生成时间：${new Date(report.createdAt).toLocaleString()}`);
    lines.push(`> 来源数量：${report.sourceCount} | 字数：${report.wordCount}`);
    lines.push(
      `> 模式：${report.depthMode === "quick" ? "快读" : report.depthMode === "standard" ? "标准" : "学术"}`,
    );
    lines.push("");
  }

  // 概述
  if (report.overview) {
    lines.push("## 📝 概述");
    lines.push("");
    lines.push(report.overview);
    lines.push("");
  }

  // 共识
  if (report.consensus.length > 0) {
    lines.push("## ✅ 核心共识");
    lines.push("");
    report.consensus.forEach((item, index) => {
      lines.push(`### ${index + 1}. ${item.point}`);
      lines.push(`- 置信度：${Math.round(item.confidence * 100)}%`);
      if (options.includeSources && item.sources.length > 0) {
        lines.push(`- 来源：${item.sources.map((s) => s.title).join("、")}`);
      }
      lines.push("");
    });
  }

  // 分歧
  if (report.divergence.length > 0) {
    lines.push("## ⚡ 观点分歧");
    lines.push("");
    report.divergence.forEach((item, index) => {
      lines.push(`### ${index + 1}. ${item.topic}`);
      lines.push("");
      lines.push(`**观点 A：** ${item.point_a}`);
      if (options.includeSources && item.sources_a.length > 0) {
        lines.push(`> 来源：${item.sources_a.map((s) => s.title).join("、")}`);
      }
      lines.push("");
      lines.push(`**观点 B：** ${item.point_b}`);
      if (options.includeSources && item.sources_b.length > 0) {
        lines.push(`> 来源：${item.sources_b.map((s) => s.title).join("、")}`);
      }
      lines.push("");
      lines.push(`**分析：** ${item.analysis}`);
      lines.push("");
    });
  }

  // 盲区
  if (report.blindSpots.length > 0) {
    lines.push("## 💡 知识盲区");
    lines.push("");
    report.blindSpots.forEach((item, index) => {
      lines.push(`### ${index + 1}. ${item.topic}`);
      lines.push(item.suggestion);
      if (item.search_keywords.length > 0) {
        lines.push(`- 建议搜索：${item.search_keywords.join("、")}`);
      }
      lines.push("");
    });
  }

  return lines.join("\n");
}

// ============================================================================
// Obsidian 导出
// ============================================================================

function exportToObsidian(
  report: SynthesisReport,
  options: { includeSources?: boolean; includeMetadata?: boolean },
): string {
  const lines: string[] = [];

  // YAML Frontmatter
  lines.push("---");
  lines.push(`title: "${report.title.replace(/"/g, '\\"')}"`);
  lines.push(`type: synthesis`);
  lines.push(`source_type: ${report.sourceType}`);
  lines.push(`depth_mode: ${report.depthMode}`);
  lines.push(`source_count: ${report.sourceCount}`);
  lines.push(`word_count: ${report.wordCount}`);
  lines.push(`created: ${report.createdAt}`);
  lines.push(`tags:`);
  lines.push(`  - synthesis`);
  lines.push(`  - ${report.depthMode}`);
  lines.push("---");
  lines.push("");

  // 标题
  lines.push(`# ${report.title}`);
  lines.push("");

  // 概述
  if (report.overview) {
    lines.push("## 📝 概述");
    lines.push("");
    lines.push(report.overview);
    lines.push("");
  }

  // 共识（带双链）
  if (report.consensus.length > 0) {
    lines.push("## ✅ 核心共识");
    lines.push("");
    report.consensus.forEach((item, index) => {
      lines.push(`### ${index + 1}. ${item.point}`);
      lines.push(`- 置信度：${Math.round(item.confidence * 100)}%`);
      if (options.includeSources && item.sources.length > 0) {
        lines.push(
          `- 来源：${item.sources.map((s) => `[[${s.title}]]`).join("、")}`,
        );
      }
      lines.push("");
    });
  }

  // 分歧（带双链）
  if (report.divergence.length > 0) {
    lines.push("## ⚡ 观点分歧");
    lines.push("");
    report.divergence.forEach((item, index) => {
      lines.push(`### ${index + 1}. ${item.topic}`);
      lines.push("");
      lines.push(`> [!note] 观点 A`);
      lines.push(`> ${item.point_a}`);
      if (options.includeSources && item.sources_a.length > 0) {
        lines.push(
          `> 来源：${item.sources_a.map((s) => `[[${s.title}]]`).join("、")}`,
        );
      }
      lines.push("");
      lines.push(`> [!note] 观点 B`);
      lines.push(`> ${item.point_b}`);
      if (options.includeSources && item.sources_b.length > 0) {
        lines.push(
          `> 来源：${item.sources_b.map((s) => `[[${s.title}]]`).join("、")}`,
        );
      }
      lines.push("");
      lines.push(`> [!tip] 分析`);
      lines.push(`> ${item.analysis}`);
      lines.push("");
    });
  }

  // 盲区
  if (report.blindSpots.length > 0) {
    lines.push("## 💡 知识盲区");
    lines.push("");
    report.blindSpots.forEach((item, index) => {
      lines.push(`### ${index + 1}. ${item.topic}`);
      lines.push(item.suggestion);
      if (item.search_keywords.length > 0) {
        lines.push(`- 建议搜索：\`${item.search_keywords.join("` `")}\``);
      }
      lines.push("");
    });
  }

  return lines.join("\n");
}

// ============================================================================
// JSON 导出
// ============================================================================

function exportToJson(
  report: SynthesisReport,
  options: { includeSources?: boolean; includeMetadata?: boolean },
): string {
  const data: Record<string, unknown> = {
    title: report.title,
    overview: report.overview,
    consensus: report.consensus,
    divergence: report.divergence,
    blindSpots: report.blindSpots,
  };

  if (options.includeMetadata) {
    data.metadata = {
      id: report.id,
      sourceType: report.sourceType,
      depthMode: report.depthMode,
      sourceCount: report.sourceCount,
      wordCount: report.wordCount,
      createdAt: report.createdAt,
      completedAt: report.completedAt,
    };
  }

  return JSON.stringify(data, null, 2);
}

// ============================================================================
// HTML 导出
// ============================================================================

function exportToHtml(
  report: SynthesisReport,
  options: { includeSources?: boolean; includeMetadata?: boolean },
): string {
  const lines: string[] = [];

  lines.push("<!DOCTYPE html>");
  lines.push('<html lang="zh-CN">');
  lines.push("<head>");
  lines.push('  <meta charset="UTF-8">');
  lines.push(
    '  <meta name="viewport" content="width=device-width, initial-scale=1.0">',
  );
  lines.push(`  <title>${escapeHtml(report.title)}</title>`);
  lines.push("  <style>");
  lines.push(`
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; line-height: 1.6; }
    h1 { color: #1f2937; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px; }
    h2 { color: #374151; margin-top: 30px; }
    h3 { color: #4b5563; }
    .meta { color: #6b7280; font-size: 14px; margin-bottom: 20px; }
    .section { margin-bottom: 30px; }
    .consensus-item, .divergence-item, .blindspot-item { border-left: 4px solid; padding-left: 15px; margin-bottom: 20px; }
    .consensus-item { border-color: #10b981; }
    .divergence-item { border-color: #f59e0b; }
    .blindspot-item { border-color: #8b5cf6; }
    .confidence { font-size: 14px; color: #6b7280; }
    .point { background: #f3f4f6; padding: 10px; border-radius: 5px; margin: 10px 0; }
    .analysis { font-style: italic; color: #4b5563; }
    .keywords { display: flex; gap: 8px; flex-wrap: wrap; }
    .keyword { background: #e5e7eb; padding: 2px 8px; border-radius: 12px; font-size: 12px; }
  `);
  lines.push("  </style>");
  lines.push("</head>");
  lines.push("<body>");

  // 标题
  lines.push(`  <h1>${escapeHtml(report.title)}</h1>`);

  // 元数据
  if (options.includeMetadata) {
    lines.push(`  <div class="meta">`);
    lines.push(
      `    <span>生成时间：${new Date(report.createdAt).toLocaleString()}</span> | `,
    );
    lines.push(`    <span>来源：${report.sourceCount} 篇</span> | `);
    lines.push(`    <span>字数：${report.wordCount}</span>`);
    lines.push(`  </div>`);
  }

  // 概述
  if (report.overview) {
    lines.push(`  <section class="section">`);
    lines.push(`    <h2>📝 概述</h2>`);
    lines.push(`    <p>${escapeHtml(report.overview)}</p>`);
    lines.push(`  </section>`);
  }

  // 共识
  if (report.consensus.length > 0) {
    lines.push(`  <section class="section">`);
    lines.push(`    <h2>✅ 核心共识</h2>`);
    report.consensus.forEach((item) => {
      lines.push(`    <div class="consensus-item">`);
      lines.push(`      <h3>${escapeHtml(item.point)}</h3>`);
      lines.push(
        `      <p class="confidence">置信度：${Math.round(item.confidence * 100)}%</p>`,
      );
      lines.push(`    </div>`);
    });
    lines.push(`  </section>`);
  }

  // 分歧
  if (report.divergence.length > 0) {
    lines.push(`  <section class="section">`);
    lines.push(`    <h2>⚡ 观点分歧</h2>`);
    report.divergence.forEach((item) => {
      lines.push(`    <div class="divergence-item">`);
      lines.push(`      <h3>${escapeHtml(item.topic)}</h3>`);
      lines.push(
        `      <div class="point"><strong>观点 A：</strong>${escapeHtml(item.point_a)}</div>`,
      );
      lines.push(
        `      <div class="point"><strong>观点 B：</strong>${escapeHtml(item.point_b)}</div>`,
      );
      lines.push(`      <p class="analysis">${escapeHtml(item.analysis)}</p>`);
      lines.push(`    </div>`);
    });
    lines.push(`  </section>`);
  }

  // 盲区
  if (report.blindSpots.length > 0) {
    lines.push(`  <section class="section">`);
    lines.push(`    <h2>💡 知识盲区</h2>`);
    report.blindSpots.forEach((item) => {
      lines.push(`    <div class="blindspot-item">`);
      lines.push(`      <h3>${escapeHtml(item.topic)}</h3>`);
      lines.push(`      <p>${escapeHtml(item.suggestion)}</p>`);
      if (item.search_keywords.length > 0) {
        lines.push(`      <div class="keywords">`);
        item.search_keywords.forEach((kw) => {
          lines.push(`        <span class="keyword">${escapeHtml(kw)}</span>`);
        });
        lines.push(`      </div>`);
      }
      lines.push(`    </div>`);
    });
    lines.push(`  </section>`);
  }

  lines.push("</body>");
  lines.push("</html>");

  return lines.join("\n");
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ============================================================================
// 主导出函数
// ============================================================================

export function exportSynthesis(
  report: SynthesisReport,
  format: SynthesisExportFormat,
  options: { includeSources?: boolean; includeMetadata?: boolean } = {},
): { content: string; filename: string; mimeType: string } {
  const formatConfig = EXPORT_FORMATS.find((f) => f.id === format);
  if (!formatConfig) {
    throw new Error(`Unsupported format: ${format}`);
  }

  let content: string;

  switch (format) {
    case "markdown":
      content = exportToMarkdown(report, options);
      break;
    case "obsidian":
      content = exportToObsidian(report, options);
      break;
    case "json":
      content = exportToJson(report, options);
      break;
    case "html":
      content = exportToHtml(report, options);
      break;
    default:
      throw new Error(`Unsupported format: ${format}`);
  }

  // 生成安全的文件名
  const safeTitle = report.title
    .replace(/[<>:"/\\|?*]/g, "")
    .replace(/\s+/g, "_")
    .slice(0, 50);

  return {
    content,
    filename: `${safeTitle}${formatConfig.extension}`,
    mimeType: formatConfig.mimeType,
  };
}
