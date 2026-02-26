/**
 * 我的语音 API 路由
 *
 * GET /api/audio-library - 获取当前用户的 TTS 语音历史
 *
 * 数据来源：Supabase Storage tts-cache bucket
 * 路径结构：{userId}/{bookmarkId}/{contentType}_{voice}_{speed}.json
 *
 * @version 1.0.0
 * @since 2026-02-26
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

// ============================================
// 常量
// ============================================

const MODULE_NAME = "AudioLibraryAPI";
const CACHE_BUCKET = "tts-cache";

// ============================================
// 类型定义
// ============================================

export interface AudioHistoryItem {
  id: string;
  title: string;
  bookmarkId: number;
  duration: string;
  createdAt: string;
  audioPath: string;
  contentType: string;
  voice: string;
}

interface TTSMetadata {
  format: string;
  durationSec: number;
  charCount: number;
  bookmarkTitle: string;
  createdAt: string;
  originalRequestId: string;
}

// ============================================
// 辅助函数
// ============================================

/** 将秒数格式化为 m:ss */
function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** 从文件名解析 contentType 和 voice */
function parseFileName(fileName: string): {
  contentType: string;
  voice: string;
} {
  // 文件名格式：{contentType}_{voice}_{speed}.json
  const parts = fileName.replace(".json", "").split("_");
  const contentType = parts[0] ?? "summary";
  const voice = parts.slice(1, -1).join("_");
  return { contentType, voice };
}

// ============================================
// API 处理函数
// ============================================

/**
 * GET /api/audio-library
 *
 * 返回当前用户的语音历史列表（按创建时间倒序）
 */
export async function GET(_request: NextRequest) {
  try {
    // 1. 验证用户身份
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "请先登录" },
        { status: 401 },
      );
    }

    const userId = user.id;

    // 2. 列出该用户下的所有 bookmark 子目录
    const { data: bookmarkFolders, error: listError } = await supabase.storage
      .from(CACHE_BUCKET)
      .list(userId, { limit: 200 });

    if (listError) {
      logger.warn(
        { module: MODULE_NAME, userId, error: listError.message },
        "Failed to list bookmark folders",
      );
      return NextResponse.json({ success: true, data: [] });
    }

    if (!bookmarkFolders || bookmarkFolders.length === 0) {
      return NextResponse.json({ success: true, data: [] });
    }

    // 3. 为每个书签目录并发列出其中的 .json 元数据文件
    const folderListResults = await Promise.allSettled(
      bookmarkFolders.map(async (folder) => {
        const bookmarkId = parseInt(folder.name, 10);
        if (isNaN(bookmarkId)) return [];

        const { data: files, error: filesError } = await supabase.storage
          .from(CACHE_BUCKET)
          .list(`${userId}/${folder.name}`, { limit: 20 });

        if (filesError || !files) return [];

        // 只处理 .json 元数据文件
        const jsonFiles = files.filter((f) => f.name.endsWith(".json"));
        return jsonFiles.map((f) => ({
          bookmarkId,
          folderName: folder.name,
          fileName: f.name,
          metadataPath: `${userId}/${folder.name}/${f.name}`,
          audioPath: `${userId}/${folder.name}/${f.name.replace(".json", ".mp3")}`,
        }));
      }),
    );

    // 4. 收集所有元数据文件信息
    const allMetaFiles = folderListResults.flatMap((result) =>
      result.status === "fulfilled" ? result.value : [],
    );

    if (allMetaFiles.length === 0) {
      return NextResponse.json({ success: true, data: [] });
    }

    // 5. 并发下载所有元数据 JSON
    const metadataResults = await Promise.allSettled(
      allMetaFiles.map(async (item) => {
        const { data, error } = await supabase.storage
          .from(CACHE_BUCKET)
          .download(item.metadataPath);

        if (error || !data) return null;

        const text = await data.text();
        const metadata: TTSMetadata = JSON.parse(text);
        const { contentType, voice } = parseFileName(item.fileName);

        return {
          id: `${item.bookmarkId}_${item.fileName.replace(".json", "")}`,
          title: metadata.bookmarkTitle,
          bookmarkId: item.bookmarkId,
          duration: formatDuration(metadata.durationSec),
          createdAt: metadata.createdAt,
          audioPath: item.audioPath,
          contentType,
          voice,
        } satisfies AudioHistoryItem;
      }),
    );

    // 6. 过滤成功项并按时间倒序排列
    const items: AudioHistoryItem[] = metadataResults
      .map((r) => (r.status === "fulfilled" ? r.value : null))
      .filter((item): item is AudioHistoryItem => item !== null)
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );

    logger.info(
      { module: MODULE_NAME, userId, count: items.length },
      "Audio library fetched",
    );

    return NextResponse.json({ success: true, data: items });
  } catch (error) {
    logger.error(
      {
        module: MODULE_NAME,
        error: error instanceof Error ? error.message : String(error),
      },
      "Audio library unexpected error",
    );
    return NextResponse.json(
      { success: false, error: "获取语音历史失败，请稍后重试" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/audio-library
 *
 * 删除指定语音记录（音频 + 元数据）
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "请先登录" },
        { status: 401 },
      );
    }

    const { audioPath } = await request.json();
    if (!audioPath || typeof audioPath !== "string") {
      return NextResponse.json(
        { success: false, error: "缺少 audioPath 参数" },
        { status: 400 },
      );
    }

    // 安全校验：路径必须以当前用户 ID 开头，防止越权删除
    if (!audioPath.startsWith(`${user.id}/`)) {
      logger.warn(
        { module: MODULE_NAME, userId: user.id, audioPath },
        "Unauthorized delete attempt",
      );
      return NextResponse.json(
        { success: false, error: "无权删除该文件" },
        { status: 403 },
      );
    }

    const metadataPath = audioPath.replace(".mp3", ".json");

    // 并行删除音频和元数据文件
    const [audioResult, metaResult] = await Promise.allSettled([
      supabase.storage.from(CACHE_BUCKET).remove([audioPath]),
      supabase.storage.from(CACHE_BUCKET).remove([metadataPath]),
    ]);

    const audioError =
      audioResult.status === "rejected"
        ? audioResult.reason
        : audioResult.value.error;
    const metaError =
      metaResult.status === "rejected"
        ? metaResult.reason
        : metaResult.value.error;

    if (audioError || metaError) {
      logger.warn(
        {
          module: MODULE_NAME,
          userId: user.id,
          audioPath,
          audioError,
          metaError,
        },
        "Failed to delete audio files",
      );
      return NextResponse.json(
        { success: false, error: "删除失败，请稍后重试" },
        { status: 500 },
      );
    }

    logger.info(
      { module: MODULE_NAME, userId: user.id, audioPath },
      "Audio deleted",
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error(
      {
        module: MODULE_NAME,
        error: error instanceof Error ? error.message : String(error),
      },
      "Audio delete unexpected error",
    );
    return NextResponse.json(
      { success: false, error: "删除失败，请稍后重试" },
      { status: 500 },
    );
  }
}
