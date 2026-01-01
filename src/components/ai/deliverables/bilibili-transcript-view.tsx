/**
 * BilibiliTranscriptView - B站字幕视图组件
 *
 * 用于显示 BilibiliTranscriptSkill 提取的字幕内容，
 * 支持多种格式展示、时间轴浏览和内容复制。
 *
 * @version 1.0.0
 * @since 2025-12-27
 */

"use client";

import { memo, useState, useMemo } from "react";
import {
  Play,
  Clock,
  User,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Download,
  Subtitles,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AIMarkdown } from "../ai-markdown";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Image from "next/image";
import type { BilibiliTranscriptOutput } from "@/lib/ai-skills/skills/bilibili-transcript/types";

// ============================================
// 类型定义
// ============================================

interface BilibiliTranscriptViewProps {
  /** 字幕数据 */
  data: BilibiliTranscriptOutput;
  /** 打开视频链接回调 */
  onOpenVideo?: (bvid: string) => void;
  /** 复制内容回调 */
  onCopyContent?: (content: string) => void;
  /** 下载内容回调 */
  onDownload?: (content: string, filename: string) => void;
  /** 自定义类名 */
  className?: string;
}

// ============================================
// 辅助函数
// ============================================

/**
 * 格式化时间（秒 -> MM:SS）
 */
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

/**
 * 格式化时长
 */
function formatDuration(seconds: number): string {
  if (seconds >= 3600) {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${hours}小时${mins}分钟`;
  }
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  if (mins === 0) {
    return `${secs}秒`;
  }
  return `${mins}分${secs}秒`;
}

// ============================================
// 子组件
// ============================================

/**
 * 视频信息卡片
 */
const VideoInfoCard = memo(function VideoInfoCard({
  videoInfo,
  onOpenVideo,
}: {
  videoInfo: BilibiliTranscriptOutput["videoInfo"];
  onOpenVideo?: (bvid: string) => void;
}) {
  const handleOpenVideo = () => {
    if (onOpenVideo) {
      onOpenVideo(videoInfo.bvid);
    } else {
      window.open(
        `https://www.bilibili.com/video/${videoInfo.bvid}`,
        "_blank",
        "noopener,noreferrer",
      );
    }
  };

  return (
    <div className="flex gap-4 p-4 bg-gradient-to-r from-pink-50 to-rose-50 rounded-xl border border-pink-100">
      {/* 封面 */}
      {videoInfo.coverUrl && (
        <div className="flex-shrink-0 w-32 h-20 rounded-lg overflow-hidden bg-gray-200 relative">
          <Image
            src={videoInfo.coverUrl}
            alt={videoInfo.title}
            fill
            sizes="128px"
            className="object-cover"
            unoptimized
          />
        </div>
      )}

      {/* 信息 */}
      <div className="flex-1 min-w-0">
        <h3 className="font-medium text-gray-800 line-clamp-2">
          {videoInfo.title}
        </h3>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-gray-500">
          <span className="flex items-center gap-1">
            <User className="size-3.5" />
            {videoInfo.uploader}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="size-3.5" />
            {formatDuration(videoInfo.duration)}
          </span>
          <Badge variant="outline" className="text-xs">
            {videoInfo.bvid}
          </Badge>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="mt-2 h-7 text-pink-600 hover:text-pink-700 hover:bg-pink-100"
          onClick={handleOpenVideo}
        >
          <Play className="size-3.5 mr-1" />
          观看视频
          <ExternalLink className="size-3 ml-1" />
        </Button>
      </div>
    </div>
  );
});

/**
 * 字幕统计卡片
 */
const TranscriptStatsCard = memo(function TranscriptStatsCard({
  stats,
  wordCount,
  language,
}: {
  stats: BilibiliTranscriptOutput["stats"];
  wordCount?: number;
  language?: string;
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl border border-indigo-100">
      <div className="text-center">
        <div className="text-2xl font-bold text-indigo-600">
          {stats.segmentCount}
        </div>
        <div className="text-xs text-gray-500">字幕段数</div>
      </div>
      <div className="text-center">
        <div className="text-2xl font-bold text-purple-500">
          {wordCount?.toLocaleString() ?? "-"}
        </div>
        <div className="text-xs text-gray-500">总字数</div>
      </div>
      <div className="text-center">
        <div className="text-2xl font-bold text-pink-500">
          {formatDuration(stats.totalDuration)}
        </div>
        <div className="text-xs text-gray-500">视频时长</div>
      </div>
      <div className="text-center">
        <div className="text-lg font-medium text-gray-600">
          {language ?? "中文"}
        </div>
        <div className="text-xs text-gray-500">字幕语言</div>
      </div>
    </div>
  );
});

/**
 * 字幕时间轴项
 */
const TranscriptSegmentItem = memo(function TranscriptSegmentItem({
  segment,
  _index,
}: {
  segment: { from: number; to: number; content: string };
  _index: number;
}) {
  return (
    <div className="group flex gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors">
      <div className="flex-shrink-0 w-16 text-xs text-gray-400 font-mono">
        {formatTime(segment.from)}
      </div>
      <div className="flex-1 text-sm text-gray-700">{segment.content}</div>
    </div>
  );
});

/**
 * 字幕内容展示
 */
const TranscriptContent = memo(function TranscriptContent({
  transcript,
  onCopyContent,
  onDownload,
}: {
  transcript: NonNullable<BilibiliTranscriptOutput["transcript"]>;
  onCopyContent?: (content: string) => void;
  onDownload?: (content: string, filename: string) => void;
}) {
  const [viewMode, setViewMode] = useState<"timeline" | "fulltext">("timeline");
  const [isExpanded, setIsExpanded] = useState(true);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const content = transcript.fullText;
    if (onCopyContent) {
      onCopyContent(content);
    } else {
      await navigator.clipboard.writeText(content);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const content = transcript.formattedContent || transcript.fullText;
    const filename = `transcript_${Date.now()}.txt`;
    if (onDownload) {
      onDownload(content, filename);
    } else {
      const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  // 预览：仅显示前 20 条
  const previewSegments = useMemo(
    () => transcript.segments.slice(0, 20),
    [transcript.segments],
  );

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      {/* 头部 */}
      <div
        className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-100 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <Subtitles className="size-4 text-indigo-500" />
          <span className="font-medium text-gray-700">字幕内容</span>
          <Badge variant="secondary" className="text-[10px]">
            {transcript.languageLabel}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronUp className="size-4 text-gray-400" />
          ) : (
            <ChevronDown className="size-4 text-gray-400" />
          )}
        </div>
      </div>

      {/* 内容 */}
      {isExpanded && (
        <>
          {/* 工具栏 */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100">
            <div className="flex items-center gap-1">
              <Button
                variant={viewMode === "timeline" ? "secondary" : "ghost"}
                size="sm"
                className="h-7 text-xs"
                onClick={() => setViewMode("timeline")}
              >
                时间轴
              </Button>
              <Button
                variant={viewMode === "fulltext" ? "secondary" : "ghost"}
                size="sm"
                className="h-7 text-xs"
                onClick={() => setViewMode("fulltext")}
              >
                纯文本
              </Button>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={handleCopy}
              >
                {copied ? (
                  <Check className="size-3.5 mr-1 text-green-500" />
                ) : (
                  <Copy className="size-3.5 mr-1" />
                )}
                复制
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={handleDownload}
              >
                <Download className="size-3.5 mr-1" />
                下载
              </Button>
            </div>
          </div>

          {/* 字幕显示 */}
          <div className="p-4 max-h-96 overflow-y-auto">
            {viewMode === "timeline" ? (
              <div className="space-y-1">
                {previewSegments.map((segment, index) => (
                  <TranscriptSegmentItem
                    key={index}
                    segment={segment}
                    _index={index}
                  />
                ))}
                {transcript.segments.length > 20 && (
                  <div className="text-center py-3 text-sm text-gray-400">
                    还有 {transcript.segments.length - 20} 条字幕...
                  </div>
                )}
              </div>
            ) : (
              <AIMarkdown
                content={transcript.formattedContent || transcript.fullText}
                className="text-sm"
              />
            )}
          </div>
        </>
      )}
    </div>
  );
});

/**
 * 无字幕提示
 */
const NoTranscriptNotice = memo(function NoTranscriptNotice() {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center">
      <AlertCircle className="size-10 text-amber-500 mx-auto mb-3" />
      <h4 className="font-medium text-gray-800 mb-2">暂无 CC 字幕</h4>
      <p className="text-sm text-gray-600 max-w-md mx-auto">
        该视频暂无可用的 CC 字幕。并非所有 B站视频都有字幕，
        UP主需要手动上传或开启 AI 字幕功能。
      </p>
      <div className="mt-4 space-y-1 text-xs text-gray-500">
        <p>💡 部分会员专享视频可能需要登录</p>
        <p>💡 直播回放可能不支持字幕</p>
      </div>
    </div>
  );
});

// ============================================
// 主组件
// ============================================

/**
 * B站字幕视图组件
 */
export const BilibiliTranscriptView = memo(function BilibiliTranscriptView({
  data,
  onOpenVideo,
  onCopyContent,
  onDownload,
  className,
}: BilibiliTranscriptViewProps) {
  const hasTranscript =
    data.transcriptStatus === "available" && data.transcript;

  return (
    <div
      className={cn(
        "rounded-xl border border-pink-100 bg-white shadow-sm overflow-hidden",
        className,
      )}
    >
      {/* 头部 */}
      <div className="px-4 py-3 bg-gradient-to-r from-pink-500 to-rose-500 text-white">
        <div className="flex items-center gap-2">
          <Play className="size-5" />
          <h2 className="font-semibold">B站视频字幕</h2>
        </div>
        <p className="mt-1 text-sm text-pink-100">
          {hasTranscript
            ? `共 ${data.stats.segmentCount} 条字幕 · ${data.transcript?.wordCount?.toLocaleString() ?? ""} 字`
            : "字幕信息"}
        </p>
      </div>

      {/* 视频信息 */}
      <div className="p-4 border-b border-gray-100">
        <VideoInfoCard videoInfo={data.videoInfo} onOpenVideo={onOpenVideo} />
      </div>

      {/* 字幕内容或提示 */}
      {hasTranscript ? (
        <>
          {/* 统计信息 */}
          <div className="p-4 border-b border-gray-100">
            <TranscriptStatsCard
              stats={data.stats}
              wordCount={data.transcript?.wordCount}
              language={data.transcript?.languageLabel}
            />
          </div>

          {/* 字幕内容 */}
          <div className="p-4 border-b border-gray-100">
            <TranscriptContent
              transcript={
                data.transcript ??
                ({
                  language: "",
                  languageLabel: "",
                  segments: [],
                  fullText: "",
                  formattedContent: "",
                  wordCount: 0,
                } as NonNullable<BilibiliTranscriptOutput["transcript"]>)
              }
              onCopyContent={onCopyContent}
              onDownload={onDownload}
            />
          </div>

          {/* 保存状态 */}
          {data.savedToBookmark && (
            <div className="px-4 py-2 bg-green-50 border-b border-green-100">
              <p className="text-sm text-green-700 flex items-center gap-2">
                <Check className="size-4" />
                字幕已保存到书签记录
              </p>
            </div>
          )}
        </>
      ) : (
        <div className="p-4">
          <NoTranscriptNotice />
        </div>
      )}

      {/* 页脚 */}
      <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 text-center">
        <span className="text-xs text-gray-400">
          生成于{" "}
          {new Date(data.generatedAt).toLocaleString("zh-CN", {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>
    </div>
  );
});

/**
 * 类型守卫：检查内容是否为 BilibiliTranscriptOutput 数据
 */
export function isBilibiliTranscriptOutput(
  content: unknown,
): content is BilibiliTranscriptOutput {
  if (typeof content !== "object" || content === null) {
    return false;
  }
  const obj = content as Record<string, unknown>;
  return (
    typeof obj.videoInfo === "object" &&
    obj.videoInfo !== null &&
    typeof (obj.videoInfo as Record<string, unknown>).bvid === "string" &&
    typeof obj.transcriptStatus === "string" &&
    typeof obj.stats === "object" &&
    typeof obj.generatedAt === "string"
  );
}

export default BilibiliTranscriptView;
