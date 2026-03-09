/**
 * 文档/报告类型内容
 */

import { memo } from "react";
import { AIMarkdown } from "../ai-markdown";
import { clientLogger } from "@/lib/client-logger";
import { ExtractionResultCard } from "./extraction-result-card";
import { WechatDigestView, isWechatDigestOutput } from "./wechat-digest-view";
import {
  BilibiliTranscriptView,
  isBilibiliTranscriptOutput,
} from "./bilibili-transcript-view";
import type {
  KnowledgeExtraction,
  ExtractionFormat,
} from "@/lib/ai-skills/skills/knowledge-extract";

/**
 * 类型守卫：检查内容是否为 KnowledgeExtraction 数据
 */
export function isKnowledgeExtractionData(
  content: unknown,
): content is KnowledgeExtraction {
  if (typeof content !== "object" || content === null) {
    return false;
  }
  const obj = content as Record<string, unknown>;
  return (
    typeof obj.id === "string" &&
    typeof obj.title === "string" &&
    typeof obj.topic === "string" &&
    Array.isArray(obj.keyPoints) &&
    Array.isArray(obj.concepts) &&
    Array.isArray(obj.sources) &&
    typeof obj.conclusion === "string" &&
    typeof obj.metadata === "object"
  );
}

export const DocumentContent = memo(function DocumentContent({
  content,
  metadata,
}: {
  content: unknown;
  metadata?: Record<string, unknown>;
}) {
  // 检测是否为 knowledge_extract skill 的交付物
  const isKnowledgeExtract = metadata?.skillId === "knowledge_extract";

  // 如果是知识萃取结果，使用专门的组件渲染
  if (isKnowledgeExtract && isKnowledgeExtractionData(content)) {
    const extractionFormat = (metadata?.format as ExtractionFormat) || "memo";
    const formattedContent = metadata?.formattedContent as string | undefined;

    const handleOpenSource = (sourceId: number, url: string) => {
      window.open(url, "_blank", "noopener,noreferrer");
    };

    const handleCopyContent = async (text: string) => {
      try {
        await navigator.clipboard.writeText(text);
      } catch (error) {
        clientLogger.error({ error }, "Failed to copy content");
      }
    };

    const handleDownload = (text: string, filename: string) => {
      const blob = new Blob([text], { type: "text/markdown" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    };

    return (
      <ExtractionResultCard
        data={content}
        format={extractionFormat}
        formattedContent={formattedContent}
        onOpenSource={handleOpenSource}
        onCopyContent={handleCopyContent}
        onDownload={handleDownload}
      />
    );
  }

  // 检测是否为 wechat_digest skill 的交付物
  const isWechatDigest = metadata?.skillId === "wechat_digest";

  // 如果是微信阅读摘要，使用专门的组件渲染
  if (isWechatDigest && isWechatDigestOutput(content)) {
    return <WechatDigestView data={content} />;
  }

  // 检测是否为 bilibili_transcript skill 的交付物
  const isBilibiliTranscript = metadata?.skillId === "bilibili_transcript";

  // 如果是B站字幕提取，使用专门的组件渲染
  if (isBilibiliTranscript && isBilibiliTranscriptOutput(content)) {
    return <BilibiliTranscriptView data={content} />;
  }

  const textContent =
    typeof content === "string" ? content : JSON.stringify(content, null, 2);

  return (
    <div className="space-y-3">
      {/* 元数据摘要 */}
      {metadata && Object.keys(metadata).length > 0 && (
        <div className="flex flex-wrap gap-2 pb-3 border-b border-gray-100">
          {Object.entries(metadata).map(([key, value]) => (
            <span
              key={key}
              className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-600"
            >
              <span className="font-medium">{key}:</span>
              <span className="ml-1">{String(value)}</span>
            </span>
          ))}
        </div>
      )}

      {/* 文档内容 - 使用 Markdown 渲染 */}
      <div className="prose prose-sm prose-purple max-w-none">
        <AIMarkdown content={textContent} />
      </div>
    </div>
  );
});
