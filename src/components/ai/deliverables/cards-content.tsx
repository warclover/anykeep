/**
 * 卡片类型内容
 */

import { memo } from "react";
import { ExternalLink } from "lucide-react";
import { AIMarkdown } from "../ai-markdown";
import { DefaultContent } from "./default-content";

export const CardsContent = memo(function CardsContent({
  content,
}: {
  content: unknown;
}) {
  if (!Array.isArray(content)) {
    return <DefaultContent content={content} />;
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {content.map((card, index) => (
        <div
          key={index}
          className="rounded-lg border border-gray-100 bg-white p-3 shadow-sm hover:shadow-md transition-shadow"
        >
          {typeof card === "object" && card !== null ? (
            <>
              {(card as Record<string, unknown>).title && (
                <h5 className="font-medium text-gray-800 mb-1">
                  {String((card as Record<string, unknown>).title)}
                </h5>
              )}
              {(card as Record<string, unknown>).description && (
                <AIMarkdown
                  content={String(
                    (card as Record<string, unknown>).description,
                  )}
                  className="text-sm text-gray-600"
                />
              )}
              {(card as Record<string, unknown>).url && (
                <a
                  href={String((card as Record<string, unknown>).url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 mt-2 text-xs text-purple-600 hover:text-purple-700"
                >
                  <ExternalLink className="size-3" />
                  <span>查看</span>
                </a>
              )}
            </>
          ) : (
            <span className="text-sm text-gray-700">{String(card)}</span>
          )}
        </div>
      ))}
    </div>
  );
});
