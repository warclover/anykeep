/**
 * TTS 组件导出
 *
 * @version 1.2.0
 * @since 2025-12-27
 * @updated 2025-01-05 - 添加 TTSPlayerProvider 全局 Context
 */

export { TTSPlayerButton } from "./tts-player-button";
export type {
  TTSPlayerButtonProps,
  TTSPlayerButtonVariant,
  TTSPlayerButtonSize,
} from "./tts-player-button";

export { AudioPlayerCard } from "./audio-player-card";
export type { AudioPlayerCardProps } from "./audio-player-card";

// V4.2.27: 全局 TTS Context
export { TTSPlayerProvider, useTTSPlayerContext } from "./tts-player-context";
export type { TTSPlayerState, TTSPlayerOptions } from "./tts-player-context";
