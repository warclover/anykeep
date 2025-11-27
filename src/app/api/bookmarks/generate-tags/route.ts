/**
 * POST /api/bookmarks/generate-tags
 * 仅生成标签（不创建收藏）
 * 用于创建收藏对话框中实时预览 AI 生成的标签
 */

import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateAIContent } from "@/lib/utils/ai-generator";
import {
  successResponse,
  unauthorizedError,
  internalError,
  handleValidationError,
} from "@/lib/utils/api-response";
import { z } from "zod";
import { logger } from "@/lib/logger";

// 验证schema
const generateTagsSchema = z.object({
  title: z.string().min(1, "标题不能为空").max(500, "标题过长"),
  description: z.string().max(5000, "描述过长").optional(),
});

export async function POST(request: NextRequest) {
  try {
    // 1. 验证用户身份
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthorizedError();
    }

    // 2. 解析并验证请求体
    const body = await request.json();
    const validation = generateTagsSchema.safeParse(body);

    if (!validation.success) {
      return handleValidationError(validation.error);
    }

    const { title, description } = validation.data;

    // 3. 获取用户现有文件夹（用于标签参考）
    const { data: folders } = await supabase
      .from("folders")
      .select("name")
      .eq("user_id", user.id)
      .eq("is_system", false)
      .is("deleted_at", null);

    const folderNames = folders?.map((f) => f.name) || [];

    // 4. 生成 AI 标签
    logger.info(
      {
        title,
        folderCount: folderNames.length,
        action: "generate_tags_start",
      },
      "API: Generating tags for preview",
    );

    const result = await generateAIContent({
      title,
      description,
      existingFolderNames: folderNames,
    });

    logger.info(
      {
        tagCount: result.tags.length,
        tags: result.tags,
        action: "generate_tags_success",
      },
      "API: Tags generated successfully",
    );

    return successResponse({
      tags: result.tags,
      summary: result.summary, // 也返回摘要，可选用
    });
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        action: "generate_tags_failed",
      },
      "API: Generate tags failed",
    );
    return internalError("生成标签失败");
  }
}
