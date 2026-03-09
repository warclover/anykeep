/**
 * 文档/报告类型内容
 */

import { memo } from "react";
import { AIMarkdown } from "../ai-markdown";
import { WechatDigestView, isWechatDigestOutput } from "./wechat-digest-view";

export const DocumentContent = memo(function DocumentContent({
  content,
  metadata,
}: {
  content: unknown;
  metadata?: Record<string, unknown>;
}) {
  // 检测是否为 wechat_digest skill 的交付物
  const isWechatDigest = metadata?.skillId === "wechat_digest";

  // 如果是微信阅读摘要，使用专门的组件渲染
  if (isWechatDigest && isWechatDigestOutput(content)) {
    return <WechatDigestView data={content} />;
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
