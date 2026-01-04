/**
 * Knowledge Studio v2 - Blueprint List API
 * @route GET /api/knowledge-studio/v2/blueprints
 * @description Returns all blueprints with user access permissions
 */

import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createLogger } from "@/lib/logger";
import { getBlueprintRegistry } from "@/lib/knowledge-studio/blueprint/blueprint-registry";
import type {
  BlueprintTier,
  EnhancedBlueprintMetadata,
} from "@/lib/knowledge-studio/blueprint/types";
import type { Database } from "@/types/supabase";

const logger = createLogger("api:knowledge-studio:v2:blueprints");

/**
 * Blueprint list item with access info
 */
interface BlueprintListItem {
  blueprintId: string;
  displayName: string;
  description: string;
  icon: string;
  tier: BlueprintTier;
  category: EnhancedBlueprintMetadata["category"];
  isNew?: boolean;
  tags?: string[];
  canAccess: boolean;
  upgradeMessage?: string;
  creditsCost: number;
  briefingEnabled: boolean;
  supportsOutline: boolean;
}

/**
 * Blueprint list response
 */
interface BlueprintListResponse {
  blueprints: BlueprintListItem[];
  userTier: BlueprintTier;
}

/**
 * GET /api/knowledge-studio/v2/blueprints
 * Returns all blueprints with user access permissions
 */
export async function GET(_request: NextRequest) {
  const requestId = crypto.randomUUID();
  logger.info({ requestId }, "Blueprint list request received");

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

    // 2. Get user tier from profile
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

    // 3. Get all blueprints with access info
    const registry = getBlueprintRegistry();
    const blueprintsWithAccess = registry.getAllWithAccessInfo(userTier);

    // 4. Map to response format
    const blueprints: BlueprintListItem[] = blueprintsWithAccess.map(
      ({ blueprint, accessInfo }) => {
        const metadata = blueprint.getBlueprintMetadata();
        return {
          blueprintId: metadata.blueprintId,
          displayName: metadata.displayName,
          description: metadata.description,
          icon: metadata.icon,
          tier: metadata.tier,
          category: metadata.category,
          isNew: metadata.isNew,
          tags: metadata.tags,
          canAccess: accessInfo.canAccess,
          upgradeMessage: accessInfo.upgradeMessage,
          creditsCost: metadata.creditsCost,
          briefingEnabled: metadata.briefingEnabled,
          supportsOutline: metadata.supportsOutline,
        };
      },
    );

    const response: BlueprintListResponse = {
      blueprints,
      userTier,
    };

    logger.info(
      { requestId, count: blueprints.length, userTier },
      "Blueprint list returned",
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
      "Blueprint list request failed",
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
