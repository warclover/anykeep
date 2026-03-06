/**
 * 默认内容渲染 - 支持 Markdown
 */

import { memo } from "react";
import { AIMarkdown } from "../ai-markdown";

export const DefaultContent = memo(function DefaultContent({
  content,
}: {
  content: unknown;
}) {
  // JSON 对象保持格式化显示
  if (typeof content !== "string") {
    return (
      <pre className="whitespace-pre-wrap text-sm text-gray-700 leading-relaxed font-mono bg-gray-50 p-3 rounded-lg overflow-x-auto">
        {JSON.stringify(content, null, 2)}
      </pre>
    );
  }

  // 纯文本使用 Markdown 渲染
  return <AIMarkdown content={content} className="text-sm" />;
});
