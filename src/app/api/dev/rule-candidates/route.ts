/**
 * 候选规则管理 API
 *
 * GET: 获取候选规则列表
 * PATCH: 更新候选规则状态
 *
 * @version 1.0.0
 * @since 2026-01-13
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import {
  verifyInternalRequest,
  internalUnauthorizedResponse,
} from "@/lib/auth/internal-auth";

/**
 * 候选规则状态
 */
type CandidateStatus = "pending_review" | "approved" | "rejected" | "merged";

/**
 * 候选规则记录
 */
interface CandidateRuleRecord {
  id: number;
  type: string;
  subtype: string | null;
  pattern: string;
  weight: number;
  sample_inputs: string[];
  discovery_confidence: number;
  discovery_method: string;
  status: CandidateStatus;
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
}

/**
 * GET /api/dev/rule-candidates
 * 获取候选规则列表
 *
 * @security 使用 internal auth 保护（dev 工具路由）
 */
export async function GET(request: NextRequest) {
  const auth = verifyInternalRequest(request);
  if (!auth.authorized) {
    return internalUnauthorizedResponse(auth.error);
  }

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") as CandidateStatus | null;
    const limit = Math.min(
      parseInt(searchParams.get("limit") || "50", 10),
      100,
    );
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    const supabase = await createServiceClient();

    let query = supabase
      .from("ai_intent_pattern_suggestions")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq("status", status);
    }

    const { data, error, count } = await query;

    if (error) {
      logger.error({ error: error.message }, "Failed to fetch rule candidates");
      return NextResponse.json(
        { error: "Failed to fetch candidates" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      candidates: (data ?? []) as unknown as CandidateRuleRecord[],
      total: count ?? 0,
      limit,
      offset,
    });
  } catch (err) {
    logger.error(
      { error: err instanceof Error ? err.message : String(err) },
      "Rule candidates API error",
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/dev/rule-candidates
 * 更新候选规则状态
 */
export async function PATCH(request: NextRequest) {
  const auth = verifyInternalRequest(request);
  if (!auth.authorized) {
    return internalUnauthorizedResponse(auth.error);
  }

  try {
    const body = await request.json();
    const { id, status, reviewedBy } = body as {
      id: number;
      status: CandidateStatus;
      reviewedBy?: string;
    };

    if (!id || !status) {
      return NextResponse.json(
        { error: "Missing required fields: id, status" },
        { status: 400 },
      );
    }

    const validStatuses: CandidateStatus[] = [
      "pending_review",
      "approved",
      "rejected",
      "merged",
    ];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        {
          error: `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
        },
        { status: 400 },
      );
    }

    const supabase = await createServiceClient();

    const { data, error } = await supabase
      .from("ai_intent_pattern_suggestions")
      .update({
        status,
        reviewed_at: new Date().toISOString(),
        reviewed_by: reviewedBy || "dev-console",
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      logger.error(
        { error: error.message, id, status },
        "Failed to update rule candidate",
      );
      return NextResponse.json(
        { error: "Failed to update candidate" },
        { status: 500 },
      );
    }

    logger.info({ id, status, reviewedBy }, "Rule candidate status updated");

    return NextResponse.json({
      success: true,
      candidate: data,
    });
  } catch (err) {
    logger.error(
      { error: err instanceof Error ? err.message : String(err) },
      "Rule candidates PATCH API error",
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/dev/rule-candidates
 * 删除候选规则
 */
export async function DELETE(request: NextRequest) {
  const auth = verifyInternalRequest(request);
  if (!auth.authorized) {
    return internalUnauthorizedResponse(auth.error);
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Missing required parameter: id" },
        { status: 400 },
      );
    }

    const supabase = await createServiceClient();

    const { error } = await supabase
      .from("ai_intent_pattern_suggestions")
      .delete()
      .eq("id", parseInt(id, 10));

    if (error) {
      logger.error(
        { error: error.message, id },
        "Failed to delete rule candidate",
      );
      return NextResponse.json(
        { error: "Failed to delete candidate" },
        { status: 500 },
      );
    }

    logger.info({ id }, "Rule candidate deleted");

    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error(
      { error: err instanceof Error ? err.message : String(err) },
      "Rule candidates DELETE API error",
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
