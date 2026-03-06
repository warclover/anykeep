/**
 * 音频类型内容
 *
 * 用于渲染 TTS 语音朗读交付物
 */

import { memo } from "react";
import { AudioPlayerCard } from "@/components/tts";
import { DefaultContent } from "./default-content";

export const AudioContent = memo(function AudioContent({
  content,
  title,
}: {
  content: unknown;
  title: string;
}) {
  // 验证 content 是否为有效的音频数据
  if (
    typeof content !== "object" ||
    content === null ||
    !("audioBase64" in content) ||
    !("format" in content)
  ) {
    return <DefaultContent content={content} />;
  }

  const audioData = content as {
    audioBase64: string;
    format: string;
    durationSec: number;
    charCount?: number;
  };

  return (
    <AudioPlayerCard
      audioBase64={audioData.audioBase64}
      format={audioData.format}
      duration={audioData.durationSec}
      title={title}
      charCount={audioData.charCount}
    />
  );
});
