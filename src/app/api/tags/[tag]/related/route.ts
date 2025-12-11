/**
 * Related Tags API
 * GET /api/tags/[tag]/related - 获取指定标签的相关标签
 *
 * @version 1.0.0
 * @since 2025-12-11
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { tagGraphService } from "@/lib/classification/services/tag-graph.service";
import { logger } from "@/lib/logger";

interface RouteParams {
  params: Promise<{
    tag: string;
  }>;
}

/**
 * GET /api/tags/[tag]/related
 * 获取指定标签的相关标签
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    // 1. 验证用户身份
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. 获取标签参数
    const { tag } = await params;
    const decodedTag = decodeURIComponent(tag);

    if (!decodedTag || decodedTag.length > 100) {
      return NextResponse.json({ error: "Invalid tag" }, { status: 400 });
    }

    // 3. 获取 limit 参数
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "10", 10), 50);

    // 4. 获取相关标签
    const relatedTags = await tagGraphService.getRelatedTags(
      user.id,
      decodedTag,
      limit,
    );

    // 5. 获取同义词
    const synonyms = await tagGraphService.getSynonyms(user.id, decodedTag);

    return NextResponse.json({
      success: true,
      data: {
        tag: decodedTag,
        synonyms,
        related: relatedTags,
      },
    });
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "Failed to get related tags",
    );

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
