/**
 * Knowledge Studio 报告导出服务
 *
 * 支持 Markdown、HTML、JSON 格式导出
 *
 * @module knowledge-studio/export
 * @version 1.0.0
 * @since 2026-01-05
 */

import type { SynthesisReport } from "./types";

// ============================================================================
// 导出格式配置
// ============================================================================

export type KSExportFormat = "markdown" | "html" | "json";

export const KS_EXPORT_FORMATS: Array<{
  id: KSExportFormat;
  name: string;
  description: string;
  extension: string;
  mimeType: string;
}> = [
  {
    id: "markdown",
    name: "Markdown",
    description: "通用 Markdown 格式",
    extension: ".md",
    mimeType: "text/markdown",
  },
  {
    id: "html",
    name: "HTML",
    description: "网页格式，可直接在浏览器中查看",
    extension: ".html",
    mimeType: "text/html",
  },
  {
    id: "json",
    name: "JSON",
    description: "结构化数据格式",
    extension: ".json",
    mimeType: "application/json",
  },
];

// ============================================================================
// 导出选项
// ============================================================================

export interface KSExportOptions {
  includeCitations?: boolean;
  includeMetadata?: boolean;
}

// ============================================================================
// Markdown 导出
// ============================================================================

function exportToMarkdown(
  report: SynthesisReport,
  options: KSExportOptions,
): string {
  const lines: string[] = [];

  // 元数据
  if (options.includeMetadata) {
    lines.push(`---`);
    lines.push(
      `title: "${(report.title || "未命名报告").replace(/"/g, '\\"')}"`,
    );
    lines.push(`blueprint: ${report.blueprintType}`);
    lines.push(`version: ${report.version}`);
    lines.push(`created: ${report.createdAt.toISOString()}`);
    lines.push(`updated: ${report.updatedAt.toISOString()}`);
    lines.push(`---`);
    lines.push("");
  }

  // 内容（已是 Markdown 格式）
  lines.push(report.content);

  // 引用
  if (options.includeCitations && report.citations.length > 0) {
    lines.push("");
    lines.push("---");
    lines.push("");
    lines.push("## 引用来源");
    lines.push("");
    report.citations.forEach((citation, index) => {
      lines.push(
        `${index + 1}. [${citation.title}](${citation.url})${citation.excerpt ? ` - ${citation.excerpt}` : ""}`,
      );
    });
  }

  return lines.join("\n");
}

// ============================================================================
// HTML 导出
// ============================================================================

function exportToHtml(
  report: SynthesisReport,
  options: KSExportOptions,
): string {
  const escapeHtml = (text: string): string => {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  };

  const lines: string[] = [];

  lines.push("<!DOCTYPE html>");
  lines.push('<html lang="zh-CN">');
  lines.push("<head>");
  lines.push('  <meta charset="UTF-8">');
  lines.push(
    '  <meta name="viewport" content="width=device-width, initial-scale=1.0">',
  );
  lines.push(`  <title>${escapeHtml(report.title || "知识工坊报告")}</title>`);
  lines.push("  <style>");
  lines.push(`
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
      line-height: 1.8;
      color: #1f2937;
      background: #fafafa;
    }
    article {
      background: white;
      padding: 40px;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    h1 { color: #111827; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px; }
    h2 { color: #374151; margin-top: 2em; }
    h3 { color: #4b5563; }
    p { margin: 1em 0; text-align: justify; }
    ul, ol { padding-left: 2em; }
    li { margin: 0.5em 0; }
    blockquote {
      border-left: 4px solid #3b82f6;
      margin: 1.5em 0;
      padding: 0.5em 1em;
      background: #eff6ff;
      border-radius: 0 4px 4px 0;
    }
    code {
      background: #f3f4f6;
      padding: 2px 6px;
      border-radius: 4px;
      font-family: 'SF Mono', Menlo, monospace;
      font-size: 0.9em;
    }
    pre {
      background: #1f2937;
      color: #f9fafb;
      padding: 1em;
      border-radius: 8px;
      overflow-x: auto;
    }
    pre code { background: transparent; padding: 0; color: inherit; }
    .meta {
      color: #6b7280;
      font-size: 14px;
      margin-bottom: 20px;
      padding: 10px;
      background: #f9fafb;
      border-radius: 4px;
    }
    .citations {
      margin-top: 3em;
      padding-top: 1em;
      border-top: 1px solid #e5e7eb;
    }
    .citation {
      margin: 0.5em 0;
      padding: 8px 12px;
      background: #f9fafb;
      border-radius: 4px;
    }
    .citation a { color: #3b82f6; text-decoration: none; }
    .citation a:hover { text-decoration: underline; }
  `);
  lines.push("  </style>");
  lines.push("</head>");
  lines.push("<body>");
  lines.push("  <article>");

  // 元数据
  if (options.includeMetadata) {
    lines.push(`    <div class="meta">`);
    lines.push(`      <strong>蓝图：</strong>${report.blueprintType} | `);
    lines.push(`      <strong>版本：</strong>${report.version} | `);
    lines.push(
      `      <strong>创建时间：</strong>${report.createdAt.toLocaleString()}`,
    );
    lines.push(`    </div>`);
  }

  // 内容 - 简单的 Markdown 转 HTML
  const htmlContent = convertMarkdownToHtml(report.content);
  lines.push(htmlContent);

  // 引用
  if (options.includeCitations && report.citations.length > 0) {
    lines.push(`    <section class="citations">`);
    lines.push(`      <h2>引用来源</h2>`);
    report.citations.forEach((citation, index) => {
      lines.push(`      <div class="citation">`);
      lines.push(
        `        ${index + 1}. <a href="${escapeHtml(citation.url)}" target="_blank">${escapeHtml(citation.title)}</a>`,
      );
      if (citation.excerpt) {
        lines.push(
          `        <br><small>${escapeHtml(citation.excerpt)}</small>`,
        );
      }
      lines.push(`      </div>`);
    });
    lines.push(`    </section>`);
  }

  lines.push("  </article>");
  lines.push("</body>");
  lines.push("</html>");

  return lines.join("\n");
}

/**
 * 简单的 Markdown 转 HTML
 */
function convertMarkdownToHtml(markdown: string): string {
  let html = markdown
    // 代码块
    .replace(/```(\w*)\n([\s\S]*?)```/g, "<pre><code>$2</code></pre>")
    // 标题
    .replace(/^###### (.*)$/gm, "<h6>$1</h6>")
    .replace(/^##### (.*)$/gm, "<h5>$1</h5>")
    .replace(/^#### (.*)$/gm, "<h4>$1</h4>")
    .replace(/^### (.*)$/gm, "<h3>$1</h3>")
    .replace(/^## (.*)$/gm, "<h2>$1</h2>")
    .replace(/^# (.*)$/gm, "<h1>$1</h1>")
    // 粗体和斜体
    .replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    // 链接
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    // 行内代码
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    // 引用块
    .replace(/^> (.*)$/gm, "<blockquote>$1</blockquote>")
    // 列表
    .replace(/^- (.*)$/gm, "<li>$1</li>")
    .replace(/^\d+\. (.*)$/gm, "<li>$1</li>")
    // 段落
    .replace(/\n\n/g, "</p><p>")
    // 换行
    .replace(/\n/g, "<br>");

  // 包装列表项
  html = html.replace(/(<li>.*<\/li>)\s*(<li>)/g, "$1$2");
  html = html.replace(/(<li>[\s\S]*?<\/li>)+/g, "<ul>$&</ul>");

  // 清理引用块
  html = html.replace(
    /(<blockquote>.*?<\/blockquote>)\s*(<blockquote>)/g,
    "$1$2",
  );
  html = html.replace(
    /(<blockquote>[\s\S]*?<\/blockquote>)+/g,
    "<blockquote>$&</blockquote>",
  );
  html = html.replace(/<blockquote><blockquote>/g, "<blockquote>");
  html = html.replace(/<\/blockquote><\/blockquote>/g, "</blockquote>");

  return `<p>${html}</p>`;
}

// ============================================================================
// JSON 导出
// ============================================================================

function exportToJson(
  report: SynthesisReport,
  options: KSExportOptions,
): string {
  const data: Record<string, unknown> = {
    title: report.title,
    blueprintType: report.blueprintType,
    content: report.content,
    version: report.version,
  };

  if (options.includeCitations) {
    data.citations = report.citations;
  }

  if (options.includeMetadata) {
    data.metadata = {
      id: report.id,
      userId: report.userId,
      createdAt: report.createdAt.toISOString(),
      updatedAt: report.updatedAt.toISOString(),
      generationMetadata: report.generationMetadata,
    };
  }

  return JSON.stringify(data, null, 2);
}

// ============================================================================
// 主导出函数
// ============================================================================

export interface KSExportResult {
  content: string;
  filename: string;
  mimeType: string;
}

export function exportKSReport(
  report: SynthesisReport,
  format: KSExportFormat,
  options: KSExportOptions = {},
): KSExportResult {
  const formatConfig = KS_EXPORT_FORMATS.find((f) => f.id === format);
  if (!formatConfig) {
    throw new Error(`Unsupported format: ${format}`);
  }

  // 设置默认选项
  const opts: KSExportOptions = {
    includeCitations: options.includeCitations ?? true,
    includeMetadata: options.includeMetadata ?? true,
  };

  let content: string;

  switch (format) {
    case "markdown":
      content = exportToMarkdown(report, opts);
      break;
    case "html":
      content = exportToHtml(report, opts);
      break;
    case "json":
      content = exportToJson(report, opts);
      break;
    default:
      throw new Error(`Unsupported format: ${format}`);
  }

  // 生成安全的文件名
  const safeTitle = (report.title || "知识工坊报告")
    .replace(/[<>:"/\\|?*]/g, "")
    .replace(/\s+/g, "_")
    .slice(0, 50);

  return {
    content,
    filename: `${safeTitle}${formatConfig.extension}`,
    mimeType: formatConfig.mimeType,
  };
}

/**
 * 下载导出的报告
 */
export function downloadKSReport(
  report: SynthesisReport,
  format: KSExportFormat,
  options?: KSExportOptions,
): void {
  const { content, filename, mimeType } = exportKSReport(
    report,
    format,
    options,
  );

  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
