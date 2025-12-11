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
import { createClient } from "@/lib/supabase/server";
import { tagGraphService } from "@/lib/classification/services/tag-graph.service";
import { logger } from "@/lib/logger";
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
export async function GET() {
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

    // 2. 获取同义词映射
    const synonymMap = await tagGraphService.getUserSynonyms(user.id);

    // 转换为数组格式
    const synonyms: Array<{ tag: string; synonyms: string[] }> = [];
    for (const [tag, tagSynonyms] of synonymMap.entries()) {
      synonyms.push({ tag, synonyms: tagSynonyms });
    }

    return NextResponse.json({
      success: true,
      data: synonyms,
    });
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "Failed to get synonyms",
    );

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/tags/synonyms
 * 添加用户定义的同义词
 */
export async function POST(request: NextRequest) {
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

    // 2. 解析请求体
    const body = await request.json();
    const parsed = synonymSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parsed.error.issues },
        { status: 400 },
      );
    }

    const { sourceTag, targetTag } = parsed.data;

    // 3. 验证不能添加相同标签
    if (sourceTag.toLowerCase() === targetTag.toLowerCase()) {
      return NextResponse.json(
        { error: "Cannot create synonym for the same tag" },
        { status: 400 },
      );
    }

    // 4. 添加同义词
    const success = await tagGraphService.addUserSynonym(
      user.id,
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
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "Failed to add synonym",
    );

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/tags/synonyms
 * 删除用户定义的同义词
 */
export async function DELETE(request: NextRequest) {
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

    // 2. 解析请求体
    const body = await request.json();
    const parsed = synonymSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parsed.error.issues },
        { status: 400 },
      );
    }

    const { sourceTag, targetTag } = parsed.data;

    // 3. 删除同义词
    const success = await tagGraphService.removeUserSynonym(
      user.id,
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
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "Failed to remove synonym",
    );

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
