/**
 * AudioPlayerCard - 音频播放器卡片组件
 *
 * 用于显示和播放 TTS 生成的音频交付物
 *
 * @version 1.0.0
 * @since 2025-12-27
 */

"use client";

import { useState, useRef, useEffect, useCallback, memo } from "react";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Download,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

// ============================================
// 类型定义
// ============================================

export interface AudioPlayerCardProps {
  /** Base64 编码的音频数据 */
  audioBase64: string;
  /** 音频格式 (mp3, wav) */
  format: string;
  /** 音频时长（秒） */
  duration: number;
  /** 标题 */
  title: string;
  /** 字符数 */
  charCount?: number;
  /** 自定义类名 */
  className?: string;
}

// ============================================
// 工具函数
// ============================================

/**
 * 格式化时间为 mm:ss 格式
 */
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

/**
 * 获取音频 MIME 类型
 */
function getAudioMimeType(format: string): string {
  const mimeTypes: Record<string, string> = {
    mp3: "audio/mpeg",
    wav: "audio/wav",
    pcm: "audio/pcm",
  };
  return mimeTypes[format.toLowerCase()] || "audio/mpeg";
}

// ============================================
// 组件实现
// ============================================

export const AudioPlayerCard = memo(function AudioPlayerCard({
  audioBase64,
  format,
  duration,
  title,
  charCount,
  className,
}: AudioPlayerCardProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isLoaded, setIsLoaded] = useState(false);

  // 创建音频 URL
  const audioUrl = `data:${getAudioMimeType(format)};base64,${audioBase64}`;

  // 初始化音频元素
  useEffect(() => {
    const audio = new Audio(audioUrl);
    audioRef.current = audio;

    const handleLoadedData = () => {
      setIsLoaded(true);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener("loadeddata", handleLoadedData);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("loadeddata", handleLoadedData);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("ended", handleEnded);
      audio.pause();
      audio.src = "";
    };
  }, [audioUrl]);

  // 同步播放速度
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  // 同步静音状态
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.muted = isMuted;
    }
  }, [isMuted]);

  // 播放/暂停
  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    setIsPlaying(!isPlaying);
  }, [isPlaying]);

  // 重播
  const handleReplay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.currentTime = 0;
    audio.play();
    setIsPlaying(true);
  }, []);

  // 跳转到指定位置
  const handleSeek = useCallback((value: number[]) => {
    const audio = audioRef.current;
    if (!audio) return;

    const newTime = value[0];
    audio.currentTime = newTime;
    setCurrentTime(newTime);
  }, []);

  // 切换静音
  const toggleMute = useCallback(() => {
    setIsMuted((prev) => !prev);
  }, []);

  // 切换播放速度
  const cyclePlaybackRate = useCallback(() => {
    const rates = [0.75, 1, 1.25, 1.5, 2];
    const currentIndex = rates.indexOf(playbackRate);
    const nextIndex = (currentIndex + 1) % rates.length;
    setPlaybackRate(rates[nextIndex]);
  }, [playbackRate]);

  // 下载音频
  const handleDownload = useCallback(() => {
    const link = document.createElement("a");
    link.href = audioUrl;
    link.download = `${title}.${format}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [audioUrl, title, format]);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      className={cn(
        "rounded-lg border border-purple-200 bg-gradient-to-br from-purple-50 to-indigo-50 p-4",
        className,
      )}
    >
      {/* 标题和信息 */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-gray-800 truncate">
            {title}
          </h4>
          <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
            <span>{formatTime(duration)} 时长</span>
            {charCount !== undefined && (
              <>
                <span>·</span>
                <span>{charCount} 字</span>
              </>
            )}
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 hover:bg-purple-100"
          onClick={handleDownload}
          title="下载音频"
        >
          <Download className="size-4 text-gray-500" />
        </Button>
      </div>

      {/* 播放控制 */}
      <div className="flex items-center gap-3">
        {/* 播放/暂停按钮 */}
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "size-10 p-0 rounded-full",
            isPlaying
              ? "bg-purple-500 hover:bg-purple-600 text-white"
              : "bg-purple-100 hover:bg-purple-200 text-purple-700",
          )}
          onClick={togglePlay}
          disabled={!isLoaded}
        >
          {isPlaying ? (
            <Pause className="size-5" />
          ) : (
            <Play className="size-5 ml-0.5" />
          )}
        </Button>

        {/* 进度条 */}
        <div className="flex-1 space-y-1">
          <Slider
            value={[currentTime]}
            min={0}
            max={duration}
            step={0.1}
            onValueChange={handleSeek}
            className="cursor-pointer"
            disabled={!isLoaded}
          />
          <div className="flex justify-between text-xs text-gray-500">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* 右侧控制按钮 */}
        <div className="flex items-center gap-1">
          {/* 重播按钮 */}
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 hover:bg-purple-100"
            onClick={handleReplay}
            title="重播"
          >
            <RotateCcw className="size-4 text-gray-500" />
          </Button>

          {/* 播放速度 */}
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 hover:bg-purple-100 text-xs font-medium text-gray-600"
            onClick={cyclePlaybackRate}
            title="播放速度"
          >
            {playbackRate}x
          </Button>

          {/* 静音按钮 */}
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 hover:bg-purple-100"
            onClick={toggleMute}
            title={isMuted ? "取消静音" : "静音"}
          >
            {isMuted ? (
              <VolumeX className="size-4 text-gray-500" />
            ) : (
              <Volume2 className="size-4 text-gray-500" />
            )}
          </Button>
        </div>
      </div>

      {/* 进度背景条 */}
      <div className="mt-2 h-1 rounded-full bg-purple-100 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-purple-400 to-indigo-400 transition-all duration-100"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
});
