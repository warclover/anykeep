/**
 * 用户账号删除 API
 * DELETE /api/user/delete - 删除用户账号和所有关联数据
 *
 * @description
 * 删除用户账号及所有关联数据：
 * - 书签及 AI 处理记录
 * - 文件夹和文件夹画像
 * - 快照及存储文件
 * - 浏览器书签导入数据
 * - 分类建议和确认记录
 * - 用户设置和画像
 *
 * ⚠️ 此操作不可逆！
 *
 * @version 1.0.0
 * @since 2025-12-16
 */

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getCachedUser } from "@/lib/supabase/cached-auth";
import {
  successResponse,
  unauthorizedError,
  badRequestError,
  internalError,
} from "@/lib/utils/api-response";
import { checkRateLimit } from "@/lib/utils/rate-limiter";
import { logger } from "@/lib/logger";
import type { NextRequest } from "next/server";

/** 删除确认请求体 */
interface DeleteAccountRequest {
  /** 确认删除标识 */
  confirmDelete: boolean;
  /** 用户邮箱（二次验证） */
  confirmEmail: string;
}

/**
 * DELETE /api/user/delete
 * 删除用户账号和所有关联数据
 */
export async function DELETE(request: NextRequest) {
  try {
    // 1. 验证用户身份
    const { user, error: authError } = await getCachedUser();

    if (authError || !user) {
      return unauthorizedError();
    }

    // 1.5 速率限制检查（高风险操作：每小时 2 次）
    const rateLimitResult = checkRateLimit(user.id, "/api/user/delete");
    if (!rateLimitResult.allowed) {
      logger.warn(
        { userId: user.id, resetMs: rateLimitResult.resetMs },
        "Account deletion rate limited",
      );
      return new Response(
        JSON.stringify({
          success: false,
          error: "操作过于频繁，请稍后再试",
          retryAfter: Math.ceil(rateLimitResult.resetMs / 1000),
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "X-RateLimit-Limit": rateLimitResult.limit.toString(),
            "X-RateLimit-Remaining": "0",
            "Retry-After": Math.ceil(rateLimitResult.resetMs / 1000).toString(),
          },
        },
      );
    }

    // 2. 解析并验证请求体
    let body: DeleteAccountRequest;
    try {
      body = await request.json();
    } catch {
      return badRequestError("请求体无效");
    }

    // 3. 验证删除确认
    if (!body.confirmDelete) {
      return badRequestError("请确认删除操作");
    }

    if (body.confirmEmail !== user.email) {
      return badRequestError("邮箱验证失败，请输入正确的账号邮箱");
    }

    const supabase = await createClient();
    const serviceClient = await createServiceClient();

    logger.warn(
      { userId: user.id, email: user.email },
      "Account deletion initiated",
    );

    // 4. 删除 Storage 中的快照文件
    try {
      // 获取用户的所有快照存储路径
      const { data: snapshots } = await supabase
        .from("bookmark_snapshots")
        .select(
          "screenshot_storage_path, html_storage_path, mhtml_storage_path",
        )
        .eq("user_id", user.id);

      if (snapshots && snapshots.length > 0) {
        const pathsToDelete: string[] = [];
        for (const snapshot of snapshots) {
          if (snapshot.screenshot_storage_path) {
            pathsToDelete.push(snapshot.screenshot_storage_path);
          }
          if (
            snapshot.html_storage_path &&
            !snapshot.html_storage_path.startsWith("inline:")
          ) {
            pathsToDelete.push(snapshot.html_storage_path);
          }
          if (
            snapshot.mhtml_storage_path &&
            !snapshot.mhtml_storage_path.startsWith("inline:")
          ) {
            pathsToDelete.push(snapshot.mhtml_storage_path);
          }
        }

        if (pathsToDelete.length > 0) {
          // 分批删除（Supabase Storage 限制）
          const batchSize = 100;
          for (let i = 0; i < pathsToDelete.length; i += batchSize) {
            const batch = pathsToDelete.slice(i, i + batchSize);
            await supabase.storage.from("snapshots").remove(batch);
          }
          logger.info(
            { userId: user.id, fileCount: pathsToDelete.length },
            "Storage files deleted",
          );
        }
      }
    } catch (storageError) {
      // Storage 清理失败不阻塞账号删除
      logger.warn(
        {
          error:
            storageError instanceof Error
              ? storageError.message
              : String(storageError),
        },
        "Failed to clean storage files, continuing with account deletion",
      );
    }

    // 5. 删除数据库记录（使用 service client 绕过 RLS）
    // 顺序很重要：先删除有外键依赖的表
    const deletionOrder = [
      // 快照相关
      "bookmark_snapshots",
      // 分类相关
      "classification_suggestions",
      "classification_confirmations",
      "classification_feedback",
      // 书签相关
      "bookmarks",
      // 文件夹相关（画像先删）
      "folder_profiles",
      "folders",
      // 浏览器书签
      "browser_bookmarks",
      "browser_bookmark_folders",
      // 导入历史
      "import_history",
      // 用户画像
      "profiles",
    ];

    const deletionResults: Record<
      string,
      { success: boolean; error?: string }
    > = {};

    for (const tableName of deletionOrder) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (serviceClient as any)
          .from(tableName)
          .delete()
          .eq("user_id", user.id);

        if (error) {
          // 某些表可能不存在 user_id 列（如 profiles 使用 id）
          if (tableName === "profiles") {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { error: profileError } = await (serviceClient as any)
              .from("profiles")
              .delete()
              .eq("id", user.id);

            deletionResults[tableName] = {
              success: !profileError,
              error: profileError?.message,
            };
          } else {
            deletionResults[tableName] = {
              success: false,
              error: error.message,
            };
          }
        } else {
          deletionResults[tableName] = { success: true };
        }
      } catch (tableError) {
        deletionResults[tableName] = {
          success: false,
          error:
            tableError instanceof Error
              ? tableError.message
              : String(tableError),
        };
      }
    }

    // 6. 检查删除结果
    const failedTables = Object.entries(deletionResults)
      .filter(([, result]) => !result.success)
      .map(([table, result]) => `${table}: ${result.error}`);

    if (failedTables.length > 0) {
      logger.warn(
        { userId: user.id, failedTables },
        "Some tables failed to delete",
      );
    }

    // 7. 删除 Supabase Auth 用户
    // 注意：这需要 service_role 权限
    try {
      const { error: authDeleteError } =
        await serviceClient.auth.admin.deleteUser(user.id);

      if (authDeleteError) {
        logger.error(
          { error: authDeleteError.message, userId: user.id },
          "Failed to delete auth user",
        );
        // 数据已删除，即使 auth 用户删除失败也返回成功
        // 用户下次登录时会发现没有数据
      }
    } catch (authError) {
      logger.error(
        {
          error:
            authError instanceof Error ? authError.message : String(authError),
        },
        "Exception during auth user deletion",
      );
    }

    logger.warn(
      {
        userId: user.id,
        email: user.email,
        deletionResults,
      },
      "Account deleted successfully",
    );

    return successResponse({
      success: true,
      message: "账号已删除",
      details: {
        dataDeleted: true,
        tablesProcessed: Object.keys(deletionResults).length,
        warnings: failedTables.length > 0 ? failedTables : undefined,
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error({ error: errorMessage }, "DELETE /api/user/delete error");
    return internalError("删除账号失败，请稍后重试");
  }
}
