/**
 * Knowledge Studio v2 - Briefing Questions API
 * @route POST /api/knowledge-studio/v2/briefing
 * @description Get briefing questions for a specified blueprint
 */

import type { NextRequest } from "next/server";
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
export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();
  logger.info({ requestId }, "Briefing request received");

  try {
    // 1. Auth check
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return new Response(
        JSON.stringify({
          error: { code: "UNAUTHORIZED", message: "请先登录" },
        }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      );
    }

    // 2. Parse request body
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
      );
    }

    const { blueprintId } = parseResult.data;

    // 3. Get blueprint from registry
    const registry = getBlueprintRegistry();
    const blueprint = registry.getById(blueprintId);

    if (!blueprint) {
      return new Response(
        JSON.stringify({
          error: {
            code: "BLUEPRINT_NOT_FOUND",
            message: `蓝图 "${blueprintId}" 不存在`,
          },
        }),
        { status: 404, headers: { "Content-Type": "application/json" } },
      );
    }

    // 4. Check access permission
    const { data: profile } = await supabase
      .from("profiles")
      .select("membership_type")
      .eq("id", user.id)
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
            message: accessInfo?.upgradeMessage || "您没有权限使用此蓝图",
          },
        }),
        { status: 403, headers: { "Content-Type": "application/json" } },
      );
    }

    // 5. Get briefing questions
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
    });
  } catch (error) {
    logger.error(
      {
        requestId,
        error: error instanceof Error ? error.message : String(error),
      },
      "Briefing request failed",
    );

    return new Response(
      JSON.stringify({
        error: {
          code: "INTERNAL_ERROR",
          message: "服务器内部错误",
        },
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
