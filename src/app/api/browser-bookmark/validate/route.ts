/**
 * 书签链接有效性检测 API
 * POST /api/browser-bookmark/validate - 批量检测链接有效性
 */

import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  successResponse,
  unauthorizedError,
  badRequestError,
} from "@/lib/utils/api-response";
import { logger } from "@/lib/logger";
import {
  validateUrls,
  type ValidationConfig,
} from "@/lib/browser-bookmark/link-validator";

/** 请求体类型 */
interface ValidateRequestBody {
  /** 要验证的书签列表 */
  bookmarks: Array<{
    id: string;
    url: string;
  }>;
  /** 配置选项 */
  options?: {
    /** 超时时间（毫秒） */
    timeout?: number;
    /** 最大并发数 */
    concurrency?: number;
  };
}

// 限制
const MAX_BOOKMARKS = 100;
const MAX_TIMEOUT = 10000;
const MAX_CONCURRENCY = 20;

/**
 * POST /api/browser-bookmark/validate
 * 批量检测书签链接有效性
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
      return unauthorizedError();
    }

    // 2. 解析请求体
    const body: ValidateRequestBody = await request.json();
    const { bookmarks, options = {} } = body;

    // 3. 参数验证
    if (!bookmarks || !Array.isArray(bookmarks)) {
      return badRequestError("缺少书签列表");
    }

    if (bookmarks.length === 0) {
      return successResponse({
        total: 0,
        valid: 0,
        invalid: 0,
        timeout: 0,
        error: 0,
        results: [],
        durationMs: 0,
      });
    }

    if (bookmarks.length > MAX_BOOKMARKS) {
      return badRequestError(`单次最多验证 ${MAX_BOOKMARKS} 个链接`);
    }

    // 验证书签数据格式
    for (const bookmark of bookmarks) {
      if (!bookmark.id || !bookmark.url) {
        return badRequestError("书签数据格式错误：缺少 id 或 url");
      }
    }

    // 4. 构建配置
    const config: ValidationConfig = {
      timeout: Math.min(options.timeout || 5000, MAX_TIMEOUT),
      concurrency: Math.min(options.concurrency || 10, MAX_CONCURRENCY),
      retries: 1,
    };

    logger.info(
      {
        userId: user.id,
        count: bookmarks.length,
        timeout: config.timeout,
        concurrency: config.concurrency,
      },
      "Starting link validation",
    );

    // 5. 执行验证
    const result = await validateUrls(bookmarks, config);

    logger.info(
      {
        userId: user.id,
        total: result.total,
        valid: result.valid,
        invalid: result.invalid,
        timeout: result.timeout,
        error: result.error,
        durationMs: result.durationMs,
      },
      "Link validation completed",
    );

    return successResponse(result);
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
      },
      "POST /api/browser-bookmark/validate error",
    );
    return badRequestError("验证失败，请稍后重试");
  }
}
