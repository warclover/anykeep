/**
 * B站 API 封装
 *
 * API 调用流程：
 * 1. GET /x/player/pagelist?bvid=xxx → 获取分P列表和 CID
 * 2. GET /x/web-interface/view?bvid=xxx → 获取视频详情
 * 3. GET /x/player/v2?bvid=xxx&cid=xxx → 获取字幕列表
 * 4. GET 字幕 URL → 下载字幕内容
 *
 * @version 1.0.0
 */

import { logger } from "@/lib/logger";
import type {
  PagelistResponse,
  PlayerV2Response,
  VideoViewResponse,
  SubtitleContentResponse,
} from "./types";
import type { VideoInfo, SubtitleInfo, SubtitleSegment } from "../types";

const BILIBILI_API_BASE = "https://api.bilibili.com";
const DEFAULT_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Referer: "https://www.bilibili.com",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
};

export interface BilibiliApiOptions {
  /** Cookie（用于获取需要登录的内容） */
  cookie?: string;
  /** 超时时间（毫秒） */
  timeout?: number;
}

export class BilibiliApi {
  private options: BilibiliApiOptions;

  constructor(options: BilibiliApiOptions = {}) {
    this.options = {
      timeout: 15000,
      ...options,
    };
  }

  /**
   * 获取视频分P列表（获取 CID）
   */
  async getPagelist(
    bvid: string,
  ): Promise<{ cid: number; page: number; part: string; duration: number }[]> {
    const url = `${BILIBILI_API_BASE}/x/player/pagelist?bvid=${bvid}`;

    const response = await this.fetch<PagelistResponse>(url);

    if (response.code !== 0) {
      throw new Error(`获取分P列表失败: ${response.message}`);
    }

    return response.data.map((p) => ({
      cid: p.cid,
      page: p.page,
      part: p.part,
      duration: p.duration,
    }));
  }

  /**
   * 获取视频详情
   */
  async getVideoInfo(bvid: string): Promise<VideoInfo> {
    const url = `${BILIBILI_API_BASE}/x/web-interface/view?bvid=${bvid}`;

    const response = await this.fetch<VideoViewResponse>(url);

    if (response.code !== 0) {
      throw new Error(`获取视频信息失败: ${response.message}`);
    }

    const data = response.data;
    return {
      bvid: data.bvid,
      aid: data.aid,
      cid: data.pages[0]?.cid || 0,
      title: data.title,
      description: data.desc,
      duration: data.duration,
      coverUrl: data.pic,
      uploader: data.owner.name,
      uploaderMid: data.owner.mid,
      publishDate: new Date(data.pubdate * 1000).toISOString(),
    };
  }

  /**
   * 获取字幕列表
   */
  async getSubtitleList(bvid: string, cid: number): Promise<SubtitleInfo[]> {
    const url = `${BILIBILI_API_BASE}/x/player/v2?bvid=${bvid}&cid=${cid}`;

    const response = await this.fetch<PlayerV2Response>(url);

    if (response.code !== 0) {
      throw new Error(`获取字幕列表失败: ${response.message}`);
    }

    const subtitles = response.data.subtitle?.subtitles || [];

    return subtitles.map((s) => ({
      id: s.id,
      language: s.lan,
      languageLabel: s.lan_doc,
      isLock: s.is_lock,
      subtitleUrl: s.subtitle_url.startsWith("//")
        ? `https:${s.subtitle_url}`
        : s.subtitle_url,
      aiType: s.ai_type,
      aiStatus: s.ai_status,
    }));
  }

  /**
   * 下载字幕内容
   */
  async downloadSubtitle(subtitleUrl: string): Promise<SubtitleSegment[]> {
    // 字幕 URL 可能是相对路径
    const fullUrl = subtitleUrl.startsWith("http")
      ? subtitleUrl
      : `https:${subtitleUrl}`;

    const response = await this.fetch<SubtitleContentResponse>(fullUrl);

    if (!response.body || !Array.isArray(response.body)) {
      throw new Error("字幕内容格式无效");
    }

    return response.body.map((item) => ({
      from: item.from,
      to: item.to,
      content: item.content,
      sid: item.sid,
      location: item.location,
    }));
  }

  /**
   * 完整流程：获取视频字幕
   */
  async getVideoTranscript(
    bvid: string,
    page: number = 1,
    preferredLang?: string,
  ): Promise<{
    videoInfo: VideoInfo;
    subtitles: SubtitleInfo[];
    transcript: SubtitleSegment[] | null;
    selectedLang: string | null;
  }> {
    // 1. 获取视频信息和分P列表
    const [videoInfo, pagelist] = await Promise.all([
      this.getVideoInfo(bvid),
      this.getPagelist(bvid),
    ]);

    // 2. 获取目标分P的 CID
    const targetPage = pagelist.find((p) => p.page === page) || pagelist[0];
    if (!targetPage) {
      throw new Error("视频分P不存在");
    }

    const cid = targetPage.cid;
    videoInfo.cid = cid;
    videoInfo.duration = targetPage.duration;

    // 3. 获取字幕列表
    const subtitles = await this.getSubtitleList(bvid, cid);

    if (subtitles.length === 0) {
      logger.debug(
        { bvid, cid },
        "BilibiliApi: No subtitles available for this video",
      );
      return {
        videoInfo,
        subtitles: [],
        transcript: null,
        selectedLang: null,
      };
    }

    // 4. 选择字幕（优先选择指定语言，否则选择第一个中文字幕）
    let selectedSubtitle = subtitles[0];

    if (preferredLang) {
      const preferred = subtitles.find(
        (s) =>
          s.language.toLowerCase() === preferredLang.toLowerCase() ||
          s.languageLabel.includes(preferredLang),
      );
      if (preferred) {
        selectedSubtitle = preferred;
      }
    } else {
      // 优先选择中文字幕
      const chinese = subtitles.find(
        (s) =>
          s.language.includes("zh") ||
          s.languageLabel.includes("中文") ||
          s.languageLabel.includes("Chinese"),
      );
      if (chinese) {
        selectedSubtitle = chinese;
      }
    }

    // 5. 下载字幕内容
    const transcript = await this.downloadSubtitle(
      selectedSubtitle.subtitleUrl,
    );

    logger.debug(
      {
        bvid,
        cid,
        selectedLang: selectedSubtitle.language,
        segmentCount: transcript.length,
      },
      "BilibiliApi: Subtitle downloaded successfully",
    );

    return {
      videoInfo,
      subtitles,
      transcript,
      selectedLang: selectedSubtitle.language,
    };
  }

  /**
   * 通用 fetch 封装
   */
  private async fetch<T>(url: string): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      this.options.timeout,
    );

    try {
      const headers: Record<string, string> = { ...DEFAULT_HEADERS };
      if (this.options.cookie) {
        headers["Cookie"] = this.options.cookie;
      }

      const response = await fetch(url, {
        headers,
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error("请求超时");
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

// 导出单例
export const bilibiliApi = new BilibiliApi();
