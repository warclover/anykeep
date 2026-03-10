/**
 * Tag Synonyms API
 * GET /api/tags/synonyms - 获取用户同义词列表
 * POST /api/tags/synonyms - 添加同义词
 * DELETE /api/tags/synonyms - 删除同义词
 *
 * @version 1.0.0
 * @since 2025-12-11
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { withAuthMiddleware } from "@/lib/api/middleware";
import { tagGraphService } from "@/lib/tag-graph";
import { z } from "zod";

// 请求验证
const synonymSchema = z.object({
  sourceTag: z.string().min(1).max(50),
  targetTag: z.string().min(1).max(50),
});

/**
 * GET /api/tags/synonyms
 * 获取用户的所有同义词映射
 */
export const GET = withAuthMiddleware(
  async (_request: NextRequest, { userId }) => {
    // 获取同义词映射
    const synonymMap = await tagGraphService.getUserSynonyms(userId);

    // 转换为数组格式
    const synonyms: Array<{ tag: string; synonyms: string[] }> = [];
    for (const [tag, tagSynonyms] of synonymMap.entries()) {
      synonyms.push({ tag, synonyms: tagSynonyms });
    }

    return NextResponse.json({
      success: true,
      data: synonyms,
    });
  },
);

/**
 * POST /api/tags/synonyms
 * 添加用户定义的同义词
 */
export const POST = withAuthMiddleware(
  async (request: NextRequest, { userId }) => {
    // 1. 解析请求体
    const body = await request.json();
    const parsed = synonymSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parsed.error.issues },
        { status: 400 },
      );
    }

    const { sourceTag, targetTag } = parsed.data;

    // 2. 验证不能添加相同标签
    if (sourceTag.toLowerCase() === targetTag.toLowerCase()) {
      return NextResponse.json(
        { error: "Cannot create synonym for the same tag" },
        { status: 400 },
      );
    }

    // 3. 添加同义词
    const success = await tagGraphService.addUserSynonym(
      userId,
      sourceTag,
      targetTag,
    );

    if (!success) {
      return NextResponse.json(
        { error: "Failed to add synonym" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      message: "Synonym added successfully",
    });
  },
);

/**
 * DELETE /api/tags/synonyms
 * 删除用户定义的同义词
 */
export const DELETE = withAuthMiddleware(
  async (request: NextRequest, { userId }) => {
    // 1. 解析请求体
    const body = await request.json();
    const parsed = synonymSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parsed.error.issues },
        { status: 400 },
      );
    }

    const { sourceTag, targetTag } = parsed.data;

    // 2. 删除同义词
    const success = await tagGraphService.removeUserSynonym(
      userId,
      sourceTag,
      targetTag,
    );

    if (!success) {
      return NextResponse.json(
        { error: "Failed to remove synonym" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      message: "Synonym removed successfully",
    });
  },
);
