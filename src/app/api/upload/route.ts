/**
 * 文件上传 API 路由
 * POST /api/upload - 上传文件到 Supabase Storage
 */

import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  successResponse,
  unauthorizedError,
  badRequestError,
  quotaExceededError,
  internalError,
} from "@/lib/utils/api-response";
import { logger } from "@/lib/logger";
import { UPLOAD, STORAGE } from "@/lib/constants/messages";

/**
 * 允许的文件类型
 */
const ALLOWED_FILE_TYPES = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
} as const;

/**
 * 最大文件大小（5MB）
 */
const MAX_FILE_SIZE = 5 * 1024 * 1024;

/**
 * POST /api/upload
 * 上传文件到 Supabase Storage
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

    // 2. 解析表单数据
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const bucket = formData.get("bucket") as string | null;

    if (!file) {
      return badRequestError("请选择要上传的文件");
    }

    if (!bucket || !["covers", "avatars"].includes(bucket)) {
      return badRequestError("无效的存储桶类型");
    }

    // 3. 验证文件类型
    if (!Object.keys(ALLOWED_FILE_TYPES).includes(file.type)) {
      return badRequestError(
        UPLOAD.INVALID_FILE_TYPE(Object.values(ALLOWED_FILE_TYPES).join(", ")),
      );
    }

    // 4. 验证文件大小
    if (file.size > MAX_FILE_SIZE) {
      return badRequestError(
        UPLOAD.FILE_TOO_LARGE(MAX_FILE_SIZE / 1024 / 1024),
      );
    }

    // 5. 检查用户存储配额
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("storage_quota, storage_used")
      .eq("id", user.id)
      .single();

    if (profileError) {
      logger.error(
        {
          error: profileError,
          userId: user.id,
          operation: "get_profile",
        },
        "Get profile error",
      );
      return internalError("获取用户信息失败");
    }

    // 计算文件大小（字节转为 MB）
    const fileSizeInMB = Math.ceil(file.size / (1024 * 1024));

    if (
      (profile.storage_used ?? 0) + fileSizeInMB >
      (profile.storage_quota ?? 0)
    ) {
      return quotaExceededError(STORAGE.QUOTA_EXCEEDED);
    }

    // 6. 生成唯一文件名
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    const ext =
      ALLOWED_FILE_TYPES[file.type as keyof typeof ALLOWED_FILE_TYPES];
    const fileName = `${timestamp}-${randomStr}${ext}`;
    const filePath = `${user.id}/${fileName}`;

    // 7. 上传文件到 Supabase Storage
    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = new Uint8Array(arrayBuffer);

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(filePath, fileBuffer, {
        contentType: file.type,
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      logger.error(
        {
          error: uploadError,
          userId: user.id,
          bucket,
          fileName,
          operation: "upload_file",
        },
        "Upload error",
      );
      return internalError("文件上传失败");
    }

    // 8. 获取公开访问 URL
    const { data: urlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(filePath);

    // 9. 更新用户存储使用量
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        storage_used: (profile.storage_used ?? 0) + fileSizeInMB,
      })
      .eq("id", user.id);

    if (updateError) {
      logger.error(
        {
          error: updateError,
          userId: user.id,
          operation: "update_storage_used",
        },
        "Update storage used error",
      );
      // 不影响上传成功，仅记录错误
    }

    // 10. 返回上传结果
    return successResponse({
      url: urlData.publicUrl,
      path: uploadData.path,
      size: file.size,
      type: file.type,
      bucket,
    });
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        operation: "upload",
      },
      "POST /api/upload error",
    );
    return internalError(UPLOAD.UPLOAD_ERROR);
  }
}

/**
 * DELETE /api/upload
 * 删除已上传的文件
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
      return unauthorizedError();
    }

    // 2. 解析请求体
    const body = await request.json();
    const { path, bucket } = body;

    if (!path || !bucket) {
      return badRequestError("缺少必要参数");
    }

    if (!["covers", "avatars"].includes(bucket)) {
      return badRequestError("无效的存储桶类型");
    }

    // 3. 验证文件所有权（文件路径应以用户 ID 开头）
    if (!path.startsWith(`${user.id}/`)) {
      return badRequestError("无权删除此文件");
    }

    // 4. 删除文件
    const { error: deleteError } = await supabase.storage
      .from(bucket)
      .remove([path]);

    if (deleteError) {
      logger.error(
        {
          error: deleteError,
          userId: user.id,
          bucket,
          path,
          operation: "delete_file",
        },
        "Delete file error",
      );
      return internalError("删除文件失败");
    }

    // 5. 更新用户存储使用量（需要先获取文件大小）
    // 注意：这里简化处理，实际应该记录文件大小
    // 可以在上传时将文件信息存储到数据库中

    return successResponse({ deleted: true, path });
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        operation: "delete_upload",
      },
      "DELETE /api/upload error",
    );
    return internalError(UPLOAD.UPLOAD_ERROR);
  }
}
