/**
 * 文件上传 API 路由
 * POST /api/upload - 上传文件到 Supabase Storage
 */

import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  successResponse,
  badRequestError,
  quotaExceededError,
} from "@/lib/utils/api-response";
import { withAuthMiddleware } from "@/lib/api/middleware";
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
export const POST = withAuthMiddleware(
  async (request: NextRequest, { userId }) => {
    const supabase = await createClient();

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
    // 类型断言: 手动维护类型文件时需要此断言
    type ProfileStorageRow = {
      storage_quota: number | null;
      storage_used: number | null;
    };
    const { data: profile, error: profileError } = (await supabase
      .from("profiles")
      .select("storage_quota, storage_used")
      .eq("id", userId)
      .single()) as {
      data: ProfileStorageRow | null;
      error: { message: string } | null;
    };

    if (profileError) {
      logger.error(
        {
          error: profileError,
          userId,
          operation: "get_profile",
        },
        "Get profile error",
      );
      throw new Error("获取用户信息失败");
    }

    if (!profile) {
      throw new Error("用户配置不存在");
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
    const filePath = `${userId}/${fileName}`;

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
          userId,
          bucket,
          fileName,
          operation: "upload_file",
        },
        "Upload error",
      );
      throw new Error("文件上传失败");
    }

    // 8. 获取公开访问 URL
    const { data: urlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(filePath);

    // 9. 更新用户存储使用量
    const { error: updateError } = (await supabase
      .from("profiles")
      .update({
        storage_used: (profile?.storage_used ?? 0) + fileSizeInMB,
      })
      .eq("id", userId)) as { error: { message: string } | null };

    if (updateError) {
      logger.error(
        {
          error: updateError,
          userId,
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
  },
);

/**
 * DELETE /api/upload
 * 删除已上传的文件
 */
export const DELETE = withAuthMiddleware(
  async (request: NextRequest, { userId }) => {
    const supabase = await createClient();

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
    if (!path.startsWith(`${userId}/`)) {
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
          userId,
          bucket,
          path,
          operation: "delete_file",
        },
        "Delete file error",
      );
      throw new Error("删除文件失败");
    }

    return successResponse({ deleted: true, path });
  },
);
