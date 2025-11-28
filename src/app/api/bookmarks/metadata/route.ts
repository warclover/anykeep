/**
 * 网页元数据 API 路由
 * GET /api/bookmarks/metadata - 获取网页元数据
 */

import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getWebMetadata } from "@/lib/utils/metadata-parser";
import {
  successResponse,
  badRequestError,
  unauthorizedError,
  internalError,
} from "@/lib/utils/api-response";
import { logger } from "@/lib/logger";

/**
 * GET /api/bookmarks/metadata
 * 获取网页元数据（标题、描述、封面等）
 *
 * Query params:
 * - url: 要获取元数据的网页 URL
 */
export async function GET(request: NextRequest) {
  try {
    // 1. 验证用户身份（需要登录才能使用）
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthorizedError();
    }

    // 2. 获取并验证 URL 参数
    const { searchParams } = new URL(request.url);
    const url = searchParams.get("url");

    if (!url) {
      return badRequestError("缺少 url 参数");
    }

    // 验证 URL 格式
    try {
      new URL(url);
    } catch {
      return badRequestError("无效的 URL 格式");
    }

    // 3. 获取网页元数据
    logger.info(
      { userId: user.id, url, action: "fetch_metadata_request" },
      "Metadata API: request received",
    );

    const metadata = await getWebMetadata(url);

    // 4. 返回元数据
    return successResponse({
      title: metadata.title,
      description: metadata.description,
      coverUrl: metadata.coverUrl,
      sourceName: metadata.sourceName, // 来源名称（公众号名称等）
      author: metadata.author, // 文章作者
      platform: metadata.platform,
      siteName: metadata.siteName,
      wordCount: metadata.wordCount,
      imageCount: metadata.imageCount,
    });
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : "Unknown error",
        action: "fetch_metadata_error",
      },
      "Metadata API: failed",
    );

    if (error instanceof Error) {
      // 返回用户友好的错误消息
      return internalError(error.message);
    }
    return internalError("获取网页信息失败");
  }
}
