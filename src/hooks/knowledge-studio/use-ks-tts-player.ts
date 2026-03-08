/**
 * Knowledge Studio TTS 播放器 Hook
 *
 * 简化版本：直接播放文本内容
 *
 * @version 1.0.0
 * @since 2026-01-07
 */

"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { toast } from "sonner";
import { API_KNOWLEDGE_STUDIO } from "@/lib/constants/api-paths";

// ============================================
// 类型定义
// ============================================

export type KSTTSPlayerState =
  | "idle"
  | "loading"
  | "playing"
  | "paused"
  | "error";

export interface KSTTSPlayerStateValue {
  state: KSTTSPlayerState;
  progress: number;
  currentTime: number;
  duration: number;
  error: string | null;
}

// ============================================
// 初始状态
// ============================================

const initialState: KSTTSPlayerStateValue = {
  state: "idle",
  progress: 0,
  currentTime: 0,
  duration: 0,
  error: null,
};

// ============================================
// Hook 实现
// ============================================

/**
 * Knowledge Studio TTS 播放器 Hook
 *
 * @example
 * ```tsx
 * const { state, play, pause, resume, stop } = useKSTTSPlayer();
 *
 * // 播放
 * await play("要朗读的文本内容...");
 *
 * // 暂停/继续
 * pause();
 * resume();
 * ```
 */
export function useKSTTSPlayer() {
  const [playerState, setPlayerState] =
    useState<KSTTSPlayerStateValue>(initialState);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // 清理函数
  const cleanup = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

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
   * 播放文本
   */
  const play = useCallback(
    async (
      text: string,
      options?: { speed?: number; voiceGender?: "male" | "female" },
    ) => {
      if (!text || text.trim().length < 10) {
        toast.error("内容过短，无法朗读");
        return;
      }

      // 清理之前的状态
      cleanup();

      setPlayerState((prev) => ({
        ...prev,
        state: "loading",
        error: null,
        progress: 0,
        currentTime: 0,
      }));

      abortControllerRef.current = new AbortController();

      try {
        const response = await fetch(API_KNOWLEDGE_STUDIO.v2Tts, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include", // 确保 cookies 被传递
          body: JSON.stringify({
            text,
            speed: options?.speed ?? 1.0,
            voiceGender: options?.voiceGender ?? "female",
          }),
          signal: abortControllerRef.current.signal,
        });

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

        const { audioBase64, format, durationSec } = result.data;

        // 创建音频 Blob
        const audioBlob = base64ToBlob(audioBase64, `audio/${format}`);
        const audioUrl = URL.createObjectURL(audioBlob);

        // 创建 Audio 元素
        const audio = new Audio(audioUrl);
        audioRef.current = audio;
        audio.playbackRate = options?.speed ?? 1.0;

        // 监听事件
        audio.onloadedmetadata = () => {
          setPlayerState((prev) => ({
            ...prev,
            duration: audio.duration || durationSec,
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
        }));
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          return;
        }

        const message = error instanceof Error ? error.message : "播放失败";
        setPlayerState((prev) => ({
          ...prev,
          state: "error",
          error: message,
        }));
        toast.error("朗读失败", { description: message });
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
      setPlayerState((prev) => ({ ...prev, state: "paused" }));
    }
  }, [playerState.state]);

  /**
   * 继续播放
   */
  const resume = useCallback(() => {
    if (audioRef.current && playerState.state === "paused") {
      audioRef.current.play();
      setPlayerState((prev) => ({ ...prev, state: "playing" }));
    }
  }, [playerState.state]);

  /**
   * 停止
   */
  const stop = useCallback(() => {
    cleanup();
    setPlayerState(initialState);
  }, [cleanup]);

  return {
    state: playerState,
    isLoading: playerState.state === "loading",
    isPlaying: playerState.state === "playing",
    isPaused: playerState.state === "paused",
    play,
    pause,
    resume,
    stop,
  };
}

// ============================================
// 工具函数
// ============================================

function base64ToBlob(base64: string, mimeType: string): Blob {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
}
