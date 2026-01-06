/**
 * Sound Effect Hook - 音效播放 Hook
 * @module hooks/use-sound-effect
 * @description 用于播放 UI 音效，支持成功/失败/通知等场景
 */

"use client";

import { useCallback, useRef, useEffect } from "react";

// ============================================================
// Types
// ============================================================

export type SoundEffectType = "success" | "error" | "notification";

interface SoundEffectOptions {
  /** 音量 0-1，默认 0.5 */
  volume?: number;
  /** 是否启用音效，默认 true */
  enabled?: boolean;
}

// ============================================================
// Constants
// ============================================================

/**
 * 音效配置
 * 使用 Web Audio API 合成简单音效，无需外部音频文件
 */
const SOUND_CONFIGS: Record<
  SoundEffectType,
  {
    frequencies: number[];
    durations: number[];
    type: OscillatorType;
  }
> = {
  // 成功音效：两个上升的音符 (类似 macOS 通知音)
  success: {
    frequencies: [523.25, 659.25], // C5 -> E5
    durations: [0.12, 0.18],
    type: "sine",
  },
  // 错误音效：两个下降的音符
  error: {
    frequencies: [440, 349.23], // A4 -> F4
    durations: [0.15, 0.2],
    type: "sine",
  },
  // 通知音效：单个清脆的音符
  notification: {
    frequencies: [880], // A5
    durations: [0.1],
    type: "sine",
  },
};

// ============================================================
// Hook
// ============================================================

/**
 * 播放音效的 Hook
 * @param options 配置选项
 * @returns play 函数
 */
export function useSoundEffect(options: SoundEffectOptions = {}) {
  const { volume = 0.5, enabled = true } = options;
  const audioContextRef = useRef<AudioContext | null>(null);

  // 清理 AudioContext
  useEffect(() => {
    return () => {
      if (audioContextRef.current) {
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        audioContextRef.current.close().catch(() => {});
      }
    };
  }, []);

  /**
   * 播放指定类型的音效
   */
  const play = useCallback(
    (type: SoundEffectType) => {
      if (!enabled) return;

      // 检查浏览器支持
      if (typeof window === "undefined" || !window.AudioContext) {
        return;
      }

      try {
        // 懒初始化 AudioContext
        if (!audioContextRef.current) {
          audioContextRef.current = new AudioContext();
        }

        const ctx = audioContextRef.current;
        const config = SOUND_CONFIGS[type];
        let startTime = ctx.currentTime;

        // 播放每个音符
        config.frequencies.forEach((freq, index) => {
          const oscillator = ctx.createOscillator();
          const gainNode = ctx.createGain();

          oscillator.type = config.type;
          oscillator.frequency.setValueAtTime(freq, startTime);

          // 音量包络：快速起音，缓慢衰减
          const duration = config.durations[index];
          gainNode.gain.setValueAtTime(0, startTime);
          gainNode.gain.linearRampToValueAtTime(volume, startTime + 0.01);
          gainNode.gain.exponentialRampToValueAtTime(
            0.01,
            startTime + duration,
          );

          oscillator.connect(gainNode);
          gainNode.connect(ctx.destination);

          oscillator.start(startTime);
          oscillator.stop(startTime + duration);

          startTime += duration;
        });
      } catch (error) {
        // 静默处理音频播放错误
        if (process.env.NODE_ENV === "development") {
          // eslint-disable-next-line no-console
          console.debug("[SoundEffect] Failed to play:", error);
        }
      }
    },
    [enabled, volume],
  );

  /**
   * 播放成功音效
   */
  const playSuccess = useCallback(() => play("success"), [play]);

  /**
   * 播放错误音效
   */
  const playError = useCallback(() => play("error"), [play]);

  /**
   * 播放通知音效
   */
  const playNotification = useCallback(() => play("notification"), [play]);

  return {
    play,
    playSuccess,
    playError,
    playNotification,
  };
}

// ============================================================
// Standalone Function (for non-React contexts)
// ============================================================

let sharedAudioContext: AudioContext | null = null;

/**
 * 播放音效（独立函数，可在非 React 上下文中使用）
 * @param type 音效类型
 * @param volume 音量 0-1
 */
export function playSoundEffect(
  type: SoundEffectType,
  volume: number = 0.5,
): void {
  if (typeof window === "undefined" || !window.AudioContext) {
    return;
  }

  try {
    if (!sharedAudioContext) {
      sharedAudioContext = new AudioContext();
    }

    const ctx = sharedAudioContext;
    const config = SOUND_CONFIGS[type];
    let startTime = ctx.currentTime;

    config.frequencies.forEach((freq, index) => {
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.type = config.type;
      oscillator.frequency.setValueAtTime(freq, startTime);

      const duration = config.durations[index];
      gainNode.gain.setValueAtTime(0, startTime);
      gainNode.gain.linearRampToValueAtTime(volume, startTime + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.start(startTime);
      oscillator.stop(startTime + duration);

      startTime += duration;
    });
  } catch {
    // 静默处理
  }
}
