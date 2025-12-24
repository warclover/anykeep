/**
 * 文件上传工具函数
 * 注意：此文件在前端运行，使用 clientLogger
 */

import { UPLOAD } from "@/lib/constants/messages";
import { clientLogger } from "@/lib/client-logger";

export interface UploadResult {
  url: string;
  path: string;
  size: number;
  type: string;
  bucket: string;
}

export interface UploadOptions {
  bucket: "covers" | "avatars";
  onProgress?: (progress: number) => void;
}

/**
 * 上传文件到 Supabase Storage
 */
export async function uploadFile(
  file: File,
  options: UploadOptions,
): Promise<UploadResult> {
  const { bucket, onProgress } = options;

  // 验证文件类型
  const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  if (!allowedTypes.includes(file.type)) {
    throw new Error(UPLOAD.INVALID_FILE_TYPE("JPG、PNG、WebP、GIF"));
  }

  // 验证文件大小（5MB）
  const maxSize = 5 * 1024 * 1024;
  if (file.size > maxSize) {
    throw new Error(UPLOAD.FILE_TOO_LARGE(maxSize / 1024 / 1024));
  }

  // 创建表单数据
  const formData = new FormData();
  formData.append("file", file);
  formData.append("bucket", bucket);

  // 上传文件
  try {
    // 模拟上传进度（实际可以使用 XMLHttpRequest 获取真实进度）
    if (onProgress) {
      onProgress(0);
    }

    const response = await fetch("/api/upload", {
      method: "POST",
      body: formData,
    });

    if (onProgress) {
      onProgress(100);
    }

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || UPLOAD.UPLOAD_ERROR);
    }

    const data = await response.json();

    if (!data.success || !data.data) {
      throw new Error(UPLOAD.UPLOAD_ERROR);
    }

    return data.data as UploadResult;
  } catch (error) {
    // 前端环境，仅在开发模式记录
    if (process.env.NODE_ENV === "development") {
      clientLogger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          bucket: options.bucket,
          fileSize: file.size,
          fileType: file.type,
        },
        "Upload file error",
      );
    }
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(UPLOAD.UPLOAD_ERROR);
  }
}

/**
 * 删除已上传的文件
 */
export async function deleteFile(path: string, bucket: string): Promise<void> {
  try {
    const response = await fetch("/api/upload", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ path, bucket }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || UPLOAD.UPLOAD_ERROR);
    }
  } catch (error) {
    // 前端环境，仅在开发模式记录
    if (process.env.NODE_ENV === "development") {
      clientLogger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          path,
          bucket,
        },
        "Delete file error",
      );
    }
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(UPLOAD.UPLOAD_ERROR);
  }
}

/**
 * 压缩图片
 */
export async function compressImage(
  file: File,
  maxWidth: number = 1200,
  maxHeight: number = 1200,
  quality: number = 0.8,
): Promise<File> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const img = new Image();

      img.onload = () => {
        const canvas = document.createElement("canvas");
        let { width, height } = img;

        // 计算缩放比例
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = width * ratio;
          height = height * ratio;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas context creation failed"));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error("Image compression failed"));
              return;
            }

            const compressedFile = new File([blob], file.name, {
              type: file.type,
              lastModified: Date.now(),
            });

            resolve(compressedFile);
          },
          file.type,
          quality,
        );
      };

      img.onerror = () => {
        reject(new Error("Image load failed"));
      };

      img.src = e.target?.result as string;
    };

    reader.onerror = () => {
      reject(new Error("File read failed"));
    };

    reader.readAsDataURL(file);
  });
}

/**
 * 验证图片文件
 */
export function validateImageFile(file: File): {
  valid: boolean;
  error?: string;
} {
  // 验证文件类型
  const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: UPLOAD.INVALID_FILE_TYPE("JPG、PNG、WebP、GIF"),
    };
  }

  // 验证文件大小（5MB）
  const maxSize = 5 * 1024 * 1024;
  if (file.size > maxSize) {
    return {
      valid: false,
      error: UPLOAD.FILE_TOO_LARGE(maxSize / 1024 / 1024),
    };
  }

  return { valid: true };
}
