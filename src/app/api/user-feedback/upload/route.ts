import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import { nanoid } from "nanoid";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

export async function POST(request: Request) {
  const supabase = await createClient();

  // 认证检查
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return Response.json({ success: false, error: "未登录" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return Response.json(
        { success: false, error: "未找到文件" },
        { status: 400 },
      );
    }

    // 校验文件大小
    if (file.size > MAX_FILE_SIZE) {
      return Response.json(
        { success: false, error: "文件大小不能超过 5MB" },
        { status: 400 },
      );
    }

    // 校验文件类型
    if (!ALLOWED_TYPES.includes(file.type)) {
      return Response.json(
        { success: false, error: "仅支持图片格式 (JPG, PNG, GIF, WEBP)" },
        { status: 400 },
      );
    }

    // 生成文件名: userId/timestamp_random.ext
    const ext = file.name.split(".").pop();
    const fileName = `${user.id}/${Date.now()}_${nanoid(6)}.${ext}`;

    const { data, error } = await supabase.storage
      .from("feedback-attachments") // 确保这个 bucket 存在
      .upload(fileName, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (error) {
      logger.error("[UserFeedback] 上传文件失败", { error });
      return Response.json(
        { success: false, error: "上传失败" },
        { status: 500 },
      );
    }

    // 获取公开访问链接 (如果 bucket 是 public 的)
    // 或者返回 path，前端展示时用 getPublicUrl
    const {
      data: { publicUrl },
    } = supabase.storage.from("feedback-attachments").getPublicUrl(data.path);

    return Response.json({
      success: true,
      data: {
        path: data.path,
        url: publicUrl,
      },
    });
  } catch (error) {
    logger.error("[UserFeedback] 上传处理异常", { error });
    return Response.json(
      { success: false, error: "服务器内部错误" },
      { status: 500 },
    );
  }
}
