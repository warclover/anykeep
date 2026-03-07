/**
 * Knowledge Studio v2 - Briefing Questions API
 * @route POST /api/knowledge-studio/v2/briefing
 * @description Get briefing questions for a specified blueprint
 */

import type { NextResponse } from "next/server";
import { withAuthMiddleware } from "@/lib/api/middleware";
import { createClient } from "@/lib/supabase/server";
import { createLogger } from "@/lib/logger";
import { z } from "zod";
import { getBlueprintRegistry } from "@/lib/knowledge-studio/blueprint/blueprint-registry";
import type {
  BlueprintTier,
  BriefingQuestion,
} from "@/lib/knowledge-studio/blueprint/types";
import type { Database } from "@/types/supabase";

const logger = createLogger("api:knowledge-studio:v2:briefing");

/**
 * Request schema
 */
const BriefingRequestSchema = z.object({
  blueprintId: z.string().min(1, "Blueprint ID is required"),
  materials: z
    .array(
      z.object({
        bookmarkId: z.string(),
        title: z.string(),
        content: z.string(),
      }),
    )
    .optional(),
});

/**
 * Briefing response
 */
interface BriefingResponse {
  enabled: boolean;
  questions: BriefingQuestion[];
  skipAllowed: boolean;
  blueprintId: string;
  blueprintName: string;
}

/**
 * POST /api/knowledge-studio/v2/briefing
 * Get briefing questions for a specified blueprint
 */
export const POST = withAuthMiddleware(async (request, { userId }) => {
  const requestId = crypto.randomUUID();
  const supabase = await createClient();
  logger.info({ requestId }, "Briefing request received");

  // 1. Parse request body
  const body = await request.json();
  const parseResult = BriefingRequestSchema.safeParse(body);

  if (!parseResult.success) {
    return new Response(
      JSON.stringify({
        error: {
          code: "INVALID_REQUEST",
          message: "请求参数无效",
          details: parseResult.error.flatten(),
        },
      }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    ) as unknown as NextResponse;
  }

  const { blueprintId } = parseResult.data;

  // 2. Get blueprint from registry
  const registry = getBlueprintRegistry();
  const blueprint = registry.getById(blueprintId);

  if (!blueprint) {
    return new Response(
      JSON.stringify({
        error: {
          code: "BLUEPRINT_NOT_FOUND",
          message: `模板 "${blueprintId}" 不存在`,
        },
      }),
      { status: 404, headers: { "Content-Type": "application/json" } },
    ) as unknown as NextResponse;
  }

  // 3. Check access permission
  const { data: profile } = await supabase
    .from("profiles")
    .select("membership_type")
    .eq("id", userId)
    .single<Database["public"]["Tables"]["profiles"]["Row"]>();

  const membershipType = profile?.membership_type?.toLowerCase() || "free";
  const userTier: BlueprintTier =
    membershipType === "enterprise"
      ? "enterprise"
      : membershipType === "pro"
        ? "pro"
        : "free";

  if (!registry.canAccess(blueprintId, userTier)) {
    const accessInfo = registry.getAccessInfo(blueprintId, userTier);
    return new Response(
      JSON.stringify({
        error: {
          code: "ACCESS_DENIED",
          message: accessInfo?.upgradeMessage || "您没有权限使用此模板",
        },
      }),
      { status: 403, headers: { "Content-Type": "application/json" } },
    ) as unknown as NextResponse;
  }

  // 4. Get briefing questions
  const metadata = blueprint.getBlueprintMetadata();
  const questions = blueprint.getBriefingQuestions();

  const response: BriefingResponse = {
    enabled: metadata.briefingEnabled,
    questions,
    skipAllowed: true, // All blueprints allow skipping briefing for quick mode
    blueprintId: metadata.blueprintId,
    blueprintName: metadata.displayName,
  };

  logger.info(
    { requestId, blueprintId, questionCount: questions.length },
    "Briefing questions returned",
  );

  return new Response(JSON.stringify(response), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  }) as unknown as NextResponse;
});
