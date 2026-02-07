/**
 * TTS 播放器 Hook
 *
 * 管理 TTS 音频播放状态和控制
 *
 * @version 1.0.0
 * @since 2025-12-27
 */

"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import type { TTSContentType, TTSVoiceGender, TTSAPIResponse } from "@/lib/tts";

// ============================================
// 类型定义
// ============================================

/**
 * 播放器状态
 */
export type TTSPlayerState =
  | "idle" // 空闲
  | "loading" // 加载中
  | "playing" // 播放中
  | "paused" // 暂停
  | "error"; // 错误

/**
 * 播放器选项
 */
export interface TTSPlayerOptions {
  /** 书签 ID */
  bookmarkId: number;
  /** 内容类型 */
  contentType?: TTSContentType;
  /** 语速 (0.5-2.0) */
  speed?: number;
  /** 语音性别 */
  voiceGender?: TTSVoiceGender;
  /** 指定语音 ID */
  voice?: string;
}

/**
 * 播放器状态值
 */
export interface TTSPlayerStateValue {
  /** 当前状态 */
  state: TTSPlayerState;
  /** 播放进度 (0-1) */
  progress: number;
  /** 当前时间（秒） */
  currentTime: number;
  /** 总时长（秒） */
  duration: number;
  /** 语速 */
  speed: number;
  /** 错误信息 */
  error: string | null;
  /** 书签标题 */
  bookmarkTitle: string | null;
  /** 当前播放的书签 ID */
  currentBookmarkId: number | null;
  /** 是否来自缓存 */
  cached: boolean;
}

/**
 * 播放器控制方法
 */
export interface TTSPlayerControls {
  /** 播放 */
  play: (options: TTSPlayerOptions) => Promise<void>;
  /** 暂停 */
  pause: () => void;
  /** 继续 */
  resume: () => void;
  /** 停止 */
  stop: () => void;
  /** 设置语速 */
  setSpeed: (speed: number) => void;
  /** 跳转到指定时间 */
  seek: (time: number) => void;
  /** 检查是否正在播放指定书签 */
  isPlayingBookmark: (bookmarkId: number) => boolean;
}

/**
 * Hook 返回值
 */
export interface UseTTSPlayerReturn {
  /** 状态 */
  state: TTSPlayerStateValue;
  /** 控制方法 */
  controls: TTSPlayerControls;
}

// ============================================
// 初始状态
// ============================================

const initialState: TTSPlayerStateValue = {
  state: "idle",
  progress: 0,
  currentTime: 0,
  duration: 0,
  speed: 1.0,
  error: null,
  bookmarkTitle: null,
  currentBookmarkId: null,
  cached: false,
};

// ============================================
// Hook 实现
// ============================================

/**
 * TTS 播放器 Hook
 *
 * @example
 * ```tsx
 * const { state, controls } = useTTSPlayer();
 *
 * // 播放
 * await controls.play({ bookmarkId: 123, contentType: "summary" });
 *
 * // 暂停/继续
 * controls.pause();
 * controls.resume();
 *
 * // 调整语速
 * controls.setSpeed(1.5);
 * ```
 */
export function useTTSPlayer(): UseTTSPlayerReturn {
  // 状态
  const [playerState, setPlayerState] =
    useState<TTSPlayerStateValue>(initialState);

  // Audio 元素引用
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // 请求取消控制器
  const abortControllerRef = useRef<AbortController | null>(null);

  // 清理函数
  const cleanup = useCallback(() => {
    // 取消进行中的请求
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    // 停止音频播放
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
  }, []);

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  /**
   * 播放
   */
  const play = useCallback(
    async (options: TTSPlayerOptions) => {
      const {
        bookmarkId,
        contentType = "summary",
        speed,
        voiceGender,
        voice,
      } = options;

      // 清理之前的状态
      cleanup();

      // 更新状态为加载中
      setPlayerState((prev) => ({
        ...prev,
        state: "loading",
        error: null,
        currentBookmarkId: bookmarkId,
        progress: 0,
        currentTime: 0,
      }));

      // 创建取消控制器
      abortControllerRef.current = new AbortController();

      try {
        // 调用 TTS API
        const response = await fetch("/api/tts", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            bookmarkId,
            contentType,
            speed,
            voiceGender,
            voice,
          }),
          signal: abortControllerRef.current.signal,
        });

        // 检查响应
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(
            errorData.error?.message || `请求失败: ${response.status}`,
          );
        }

        const result = await response.json();

        if (!result.success || !result.data) {
          throw new Error(result.error?.message || "未知错误");
        }

        const data = result.data as TTSAPIResponse;
        const isCached = result.cached === true;

        // 创建音频 Blob
        const audioBlob = base64ToBlob(
          data.audioBase64,
          `audio/${data.format}`,
        );
        const audioUrl = URL.createObjectURL(audioBlob);

        // 创建 Audio 元素
        const audio = new Audio(audioUrl);
        audioRef.current = audio;

        // 设置语速
        audio.playbackRate = speed || 1.0;

        // 监听事件
        audio.onloadedmetadata = () => {
          setPlayerState((prev) => ({
            ...prev,
            duration: audio.duration || data.durationSec,
            bookmarkTitle: data.bookmarkTitle,
          }));
        };

        audio.ontimeupdate = () => {
          if (audio.duration) {
            setPlayerState((prev) => ({
              ...prev,
              currentTime: audio.currentTime,
              progress: audio.currentTime / audio.duration,
            }));
          }
        };

        audio.onended = () => {
          setPlayerState((prev) => ({
            ...prev,
            state: "idle",
            progress: 1,
            currentTime: prev.duration,
          }));
          // 释放 URL
          URL.revokeObjectURL(audioUrl);
        };

        audio.onerror = () => {
          setPlayerState((prev) => ({
            ...prev,
            state: "error",
            error: "音频播放失败",
          }));
          URL.revokeObjectURL(audioUrl);
        };

        // 开始播放
        await audio.play();

        setPlayerState((prev) => ({
          ...prev,
          state: "playing",
          speed: speed || 1.0,
          cached: isCached,
        }));
      } catch (error) {
        // 忽略取消错误
        if (error instanceof Error && error.name === "AbortError") {
          return;
        }

        setPlayerState((prev) => ({
          ...prev,
          state: "error",
          error: error instanceof Error ? error.message : "播放失败",
        }));
      }
    },
    [cleanup],
  );

  /**
   * 暂停
   */
  const pause = useCallback(() => {
    if (audioRef.current && playerState.state === "playing") {
      audioRef.current.pause();
      setPlayerState((prev) => ({
        ...prev,
        state: "paused",
      }));
    }
  }, [playerState.state]);

  /**
   * 继续播放
   */
  const resume = useCallback(() => {
    if (audioRef.current && playerState.state === "paused") {
      audioRef.current.play();
      setPlayerState((prev) => ({
        ...prev,
        state: "playing",
      }));
    }
  }, [playerState.state]);

  /**
   * 停止
   */
  const stop = useCallback(() => {
    cleanup();
    setPlayerState(initialState);
  }, [cleanup]);

  /**
   * 设置语速
   */
  const setSpeed = useCallback((speed: number) => {
    const clampedSpeed = Math.max(0.5, Math.min(2.0, speed));
    if (audioRef.current) {
      audioRef.current.playbackRate = clampedSpeed;
    }
    setPlayerState((prev) => ({
      ...prev,
      speed: clampedSpeed,
    }));
  }, []);

  /**
   * 跳转
   */
  const seek = useCallback((time: number) => {
    if (audioRef.current) {
      const clampedTime = Math.max(
        0,
        Math.min(time, audioRef.current.duration),
      );
      audioRef.current.currentTime = clampedTime;
      setPlayerState((prev) => ({
        ...prev,
        currentTime: clampedTime,
        progress: audioRef.current
          ? clampedTime / audioRef.current.duration
          : 0,
      }));
    }
  }, []);

  /**
   * 检查是否正在播放指定书签
   */
  const isPlayingBookmark = useCallback(
    (bookmarkId: number) => {
      return (
        playerState.currentBookmarkId === bookmarkId &&
        (playerState.state === "playing" || playerState.state === "loading")
      );
    },
    [playerState.currentBookmarkId, playerState.state],
  );

  return {
    state: playerState,
    controls: {
      play,
      pause,
      resume,
      stop,
      setSpeed,
      seek,
      isPlayingBookmark,
    },
  };
}

// ============================================
// 工具函数
// ============================================

/**
 * Base64 转 Blob
 */
function base64ToBlob(base64: string, mimeType: string): Blob {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
}
