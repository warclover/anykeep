/**
 * Related Tags API
 * GET /api/tags/[tag]/related - 获取指定标签的相关标签
 *
 * @version 1.0.0
 * @since 2025-12-11
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { withAuthMiddleware } from "@/lib/api/middleware";
import { tagGraphService } from "@/lib/classification/services/tag-graph.service";

/**
 * GET /api/tags/[tag]/related
 * 获取指定标签的相关标签
 */
export const GET = withAuthMiddleware<{ tag: string }>(
  async (request: NextRequest, { userId, params }) => {
    // 1. 获取标签参数
    const { tag } = await params;
    const decodedTag = decodeURIComponent(tag);

    if (!decodedTag || decodedTag.length > 100) {
      return NextResponse.json({ error: "Invalid tag" }, { status: 400 });
    }

    // 2. 获取 limit 参数
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "10", 10), 50);

    // 3. 获取相关标签
    const relatedTags = await tagGraphService.getRelatedTags(
      userId,
      decodedTag,
      limit,
    );

    // 4. 获取同义词
    const synonyms = await tagGraphService.getSynonyms(userId, decodedTag);

    return NextResponse.json({
      success: true,
      data: {
        tag: decodedTag,
        synonyms,
        related: relatedTags,
      },
    });
  },
);
