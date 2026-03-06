/**
 * 列表类型内容
 */

import { memo } from "react";
import { AIMarkdown } from "../ai-markdown";
import { DefaultContent } from "./default-content";

export const ListContent = memo(function ListContent({
  content,
}: {
  content: unknown;
}) {
  if (!Array.isArray(content)) {
    return <DefaultContent content={content} />;
  }

  return (
    <ul className="space-y-2">
      {content.map((item, index) => (
        <li key={index} className="flex items-start gap-2">
          <span className="flex-shrink-0 size-5 flex items-center justify-center rounded-full bg-purple-100 text-purple-600 text-xs font-medium">
            {index + 1}
          </span>
          <span className="text-sm text-gray-700 flex-1">
            {typeof item === "string" ? (
              <AIMarkdown content={item} />
            ) : (
              JSON.stringify(item)
            )}
          </span>
        </li>
      ))}
    </ul>
  );
});
