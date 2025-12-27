/**
 * B站 API 响应类型定义
 * @version 1.0.0
 */

// ============================================
// pagelist API 响应
// ============================================

export interface PagelistResponse {
  code: number;
  message: string;
  data: Array<{
    cid: number;
    page: number;
    from: string;
    part: string;
    duration: number;
    dimension: { width: number; height: number };
  }>;
}

// ============================================
// player/v2 API 响应
// ============================================

export interface PlayerV2Response {
  code: number;
  message: string;
  data: {
    aid: number;
    bvid: string;
    cid: number;
    subtitle: {
      allow_submit: boolean;
      subtitles: Array<{
        id: number;
        lan: string;
        lan_doc: string;
        is_lock: boolean;
        subtitle_url: string;
        ai_type?: number;
        ai_status?: number;
      }>;
    };
  };
}

// ============================================
// 视频详情 API 响应
// ============================================

export interface VideoViewResponse {
  code: number;
  message: string;
  data: {
    bvid: string;
    aid: number;
    title: string;
    desc: string;
    duration: number;
    pic: string;
    pubdate: number;
    owner: {
      mid: number;
      name: string;
    };
    pages: Array<{
      cid: number;
      page: number;
      part: string;
      duration: number;
    }>;
  };
}

// ============================================
// 字幕内容响应
// ============================================

export interface SubtitleContentResponse {
  font_size: number;
  font_color: string;
  background_alpha: number;
  background_color: string;
  stroke: string;
  body: Array<{
    from: number;
    to: number;
    sid: number;
    location: number;
    content: string;
  }>;
}
