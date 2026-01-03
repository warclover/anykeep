/**
 * 综述导出 API
 *
 * GET /api/synthesis/[id]/export - 导出综述为指定格式
 *
 * @version 1.0.0
 * @since 2025-12-29
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import {
  type SynthesisReport,
  type SynthesisReportRow,
  mapRowToReport,
  SynthesisErrorCode,
} from "@/lib/synthesis";

interface RouteParams {
  params: Promise<{ id: string }>;
}

type ExportFormat = "markdown" | "html" | "json";

/**
 * 生成 Markdown 格式导出内容
 */
function generateMarkdown(report: SynthesisReport): string {
  const lines: string[] = [];

  // 标题
  lines.push(`# ${report.title}`);
  lines.push("");
  lines.push(`> 生成于 ${new Date(report.createdAt).toLocaleString("zh-CN")}`);
  lines.push(`> 来源：${report.sourceCount} 篇收藏`);
  lines.push("");

  // 概述
  lines.push("## 📋 概述");
  lines.push("");
  lines.push(report.overview || "暂无概述");
  lines.push("");

  // 共识
  if (report.consensus && report.consensus.length > 0) {
    lines.push("## ✅ 共识观点");
    lines.push("");
    for (const point of report.consensus) {
      lines.push(`### ${point.point}`);
      lines.push("");
      lines.push(`**置信度**: ${Math.round(point.confidence * 100)}%`);
      lines.push("");
      if (point.sources && point.sources.length > 0) {
        lines.push("**来源**:");
        for (const source of point.sources) {
          const quote = source.quote ? ` - "${source.quote}"` : "";
          lines.push(`- ${source.title}${quote}`);
        }
        lines.push("");
      }
    }
  }

  // 分歧
  if (report.divergence && report.divergence.length > 0) {
    lines.push("## ⚖️ 分歧观点");
    lines.push("");
    for (const point of report.divergence) {
      lines.push(`### ${point.topic}`);
      lines.push("");

      // 观点 A
      lines.push("**观点 A**:");
      lines.push(`> ${point.point_a}`);
      lines.push("");
      if (point.sources_a && point.sources_a.length > 0) {
        lines.push("来源: " + point.sources_a.map((s) => s.title).join(", "));
        lines.push("");
      }

      // 观点 B
      lines.push("**观点 B**:");
      lines.push(`> ${point.point_b}`);
      lines.push("");
      if (point.sources_b && point.sources_b.length > 0) {
        lines.push("来源: " + point.sources_b.map((s) => s.title).join(", "));
        lines.push("");
      }

      // AI 分析
      if (point.analysis) {
        lines.push("**分析**:");
        lines.push(point.analysis);
        lines.push("");
      }
    }
  }

  // 盲区
  if (report.blindSpots && report.blindSpots.length > 0) {
    lines.push("## 🔍 盲区提示");
    lines.push("");
    for (const spot of report.blindSpots) {
      lines.push(`### ${spot.topic}`);
      lines.push("");
      lines.push(`**建议**: ${spot.suggestion}`);
      lines.push("");
      if (spot.search_keywords && spot.search_keywords.length > 0) {
        lines.push(`**推荐搜索**: ${spot.search_keywords.join(", ")}`);
        lines.push("");
      }
    }
  }

  return lines.join("\n");
}

/**
 * 生成 HTML 格式导出内容
 */
function generateHTML(report: SynthesisReport): string {
  const markdown = generateMarkdown(report);

  // 简单的 Markdown 到 HTML 转换（实际项目可用 marked 等库）
  const htmlContent = markdown
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/^\> (.+)$/gm, "<blockquote>$1</blockquote>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>')
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    .replace(/\n\n/g, "</p><p>")
    .replace(/\n/g, "<br>");

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${report.title}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 2rem;
      line-height: 1.6;
      color: #333;
    }
    h1 { color: #1a1a1a; border-bottom: 2px solid #e5e5e5; padding-bottom: 0.5rem; }
    h2 { color: #2a2a2a; margin-top: 2rem; }
    h3 { color: #3a3a3a; }
    blockquote {
      color: #666;
      border-left: 4px solid #ddd;
      margin: 1rem 0;
      padding-left: 1rem;
    }
    a { color: #0066cc; text-decoration: none; }
    a:hover { text-decoration: underline; }
    table { border-collapse: collapse; width: 100%; margin: 1rem 0; }
    th, td { border: 1px solid #ddd; padding: 0.5rem; text-align: left; }
    th { background: #f5f5f5; }
  </style>
</head>
<body>
  <p>${htmlContent}</p>
</body>
</html>`;
}

/**
 * GET /api/synthesis/[id]/export - 导出综述
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // 验证用户
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized", code: SynthesisErrorCode.UNAUTHORIZED },
        { status: 401 },
      );
    }

    // 解析导出格式
    const searchParams = request.nextUrl.searchParams;
    const format = (searchParams.get("format") || "markdown") as ExportFormat;

    if (!["markdown", "html", "json"].includes(format)) {
      return NextResponse.json(
        {
          error: "Invalid export format",
          code: SynthesisErrorCode.INVALID_PARAMS,
        },
        { status: 400 },
      );
    }

    // 获取综述详情
    // 类型断言: 手动维护类型文件时需要此断言
    type SynthesisReportSelectRow = {
      status: string;
      [key: string]: unknown;
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from("synthesis_reports") as any)
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single() as { data: SynthesisReportSelectRow | null; error: { message: string } | null };

    if (error || !data) {
      return NextResponse.json(
        { error: "Report not found", code: SynthesisErrorCode.NOT_FOUND },
        { status: 404 },
      );
    }

    // 检查是否已完成
    if (data.status !== "completed") {
      return NextResponse.json(
        { error: "Report not yet completed", code: "NOT_COMPLETED" },
        { status: 400 },
      );
    }

    const report = mapRowToReport(data as unknown as SynthesisReportRow);
    const filename = `${report.title.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, "_")}`;

    // 根据格式生成内容
    let content: string;
    let contentType: string;
    let extension: string;

    switch (format) {
      case "markdown":
        content = generateMarkdown(report);
        contentType = "text/markdown; charset=utf-8";
        extension = "md";
        break;

      case "html":
        content = generateHTML(report);
        contentType = "text/html; charset=utf-8";
        extension = "html";
        break;

      case "json":
        content = JSON.stringify(report, null, 2);
        contentType = "application/json; charset=utf-8";
        extension = "json";
        break;

      default:
        content = generateMarkdown(report);
        contentType = "text/markdown; charset=utf-8";
        extension = "md";
    }

    logger.info(
      { reportId: id, userId: user.id, format },
      "Synthesis report exported",
    );

    return new Response(content, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filename}.${extension}"`,
      },
    });
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "Synthesis export API error",
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
