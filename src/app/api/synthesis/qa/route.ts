/**
 * 综述问答 API 端点
 *
 * 基于综述内容回答用户问题
 *
 * @version 1.0.0
 * @since 2026-01-01 [S3]
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateText } from "ai";
import { deepseek } from "@ai-sdk/deepseek";

// ============================================================================
// 类型定义
// ============================================================================

interface QARequestBody {
  reportId: string;
  question: string;
  context?: {
    title?: string;
    overview?: string;
  };
}

interface ConsensusPoint {
  point: string;
  confidence: number;
}

interface DivergencePoint {
  topic: string;
  point_a: string;
  point_b: string;
  analysis: string;
}

interface BlindSpot {
  topic: string;
  suggestion: string;
}

// ============================================================================
// 处理函数
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // 验证用户
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 解析请求
    const body: QARequestBody = await request.json();
    const { reportId, question, context } = body;

    if (!reportId || !question) {
      return NextResponse.json(
        { error: "Missing reportId or question" },
        { status: 400 },
      );
    }

    // 获取综述详情
    const { data: report, error: reportError } = await supabase
      .from("synthesis_reports")
      .select(
        `
        id,
        title,
        overview,
        consensus,
        divergence,
        blind_spots,
        source_count,
        depth_mode
      `,
      )
      .eq("id", reportId)
      .eq("user_id", user.id)
      .single();

    if (reportError || !report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    // 类型转换（Supabase 返回 Json 类型）
    const typedReport = {
      title: report.title,
      overview: report.overview,
      consensus: report.consensus as ConsensusPoint[] | null,
      divergence: report.divergence as DivergencePoint[] | null,
      blind_spots: report.blind_spots as BlindSpot[] | null,
      source_count: report.source_count,
      depth_mode: report.depth_mode,
    };

    // 构建上下文
    const synthesisContext = buildContext(typedReport, context);

    // 生成回答
    const answer = await generateAnswer(question, synthesisContext);

    return NextResponse.json({ answer });
  } catch (error) {
    console.error("Synthesis QA error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 构建综述上下文
 */
function buildContext(
  report: {
    title: string;
    overview: string | null;
    consensus: ConsensusPoint[] | null;
    divergence: DivergencePoint[] | null;
    blind_spots: BlindSpot[] | null;
    source_count: number;
    depth_mode: string;
  },
  additionalContext?: { title?: string; overview?: string },
): string {
  const parts: string[] = [];

  // 标题
  parts.push(
    `## 综述标题\n${report.title || additionalContext?.title || "未命名综述"}`,
  );

  // 概述
  if (report.overview || additionalContext?.overview) {
    parts.push(`## 概述\n${report.overview || additionalContext?.overview}`);
  }

  // 共识点
  if (report.consensus && report.consensus.length > 0) {
    const consensusText = report.consensus
      .map(
        (c, i) =>
          `${i + 1}. ${c.point} (置信度: ${Math.round(c.confidence * 100)}%)`,
      )
      .join("\n");
    parts.push(`## 核心共识\n${consensusText}`);
  }

  // 分歧点
  if (report.divergence && report.divergence.length > 0) {
    const divergenceText = report.divergence
      .map(
        (d, i) =>
          `${i + 1}. **${d.topic}**\n   - 观点A: ${d.point_a}\n   - 观点B: ${d.point_b}\n   - 分析: ${d.analysis}`,
      )
      .join("\n\n");
    parts.push(`## 观点分歧\n${divergenceText}`);
  }

  // 盲区
  if (report.blind_spots && report.blind_spots.length > 0) {
    const blindSpotText = report.blind_spots
      .map((b, i) => `${i + 1}. **${b.topic}**: ${b.suggestion}`)
      .join("\n");
    parts.push(`## 知识盲区\n${blindSpotText}`);
  }

  // 元信息
  parts.push(
    `## 元信息\n- 来源数量: ${report.source_count} 篇\n- 深度模式: ${report.depth_mode}`,
  );

  return parts.join("\n\n");
}

/**
 * 生成回答
 */
async function generateAnswer(
  question: string,
  context: string,
): Promise<string> {
  const systemPrompt = `你是一个智能综述助手，基于用户的综述内容回答问题。

## 回答原则
1. 只基于提供的综述内容回答，不要编造信息
2. 如果综述中没有相关信息，诚实说明
3. 回答要简洁明了，有条理
4. 可以适当引用综述中的具体观点
5. 如果用户问的是通用解释，用通俗易懂的语言

## 综述内容
${context}`;

  const { text } = await generateText({
    model: deepseek("deepseek-chat"),
    system: systemPrompt,
    prompt: question,
    maxOutputTokens: 1000,
    temperature: 0.7,
  });

  return text;
}
