/**
 * 搜索结果内容
 *
 * 使用 SearchResultsList 渲染格式化搜索响应
 */

import { memo } from "react";
import { clientLogger } from "@/lib/client-logger";
import { SearchResultsList } from "../search-results-list";
import { DefaultContent } from "./default-content";
import type {
  FormattedSearchResponse,
  ParsedQuery,
  SearchResultItem,
} from "@/lib/ai-skills/search/types";

export const SearchResultsContent = memo(function SearchResultsContent({
  content,
  metadata,
}: {
  content: unknown;
  metadata?: Record<string, unknown>;
}) {
  // 验证 content 是否为有效的搜索响应
  if (
    typeof content !== "object" ||
    content === null ||
    !("results" in content) ||
    !("meta" in content)
  ) {
    return <DefaultContent content={content} />;
  }

  const searchResponse = content as FormattedSearchResponse;

  // 从 metadata 中提取 parsedQuery（如果有）
  const parsedQuery = metadata?.parsedQuery as ParsedQuery | undefined;

  // 处理结果点击
  const handleResultClick = (result: SearchResultItem) => {
    // 打开书签链接
    window.open(result.url, "_blank", "noopener,noreferrer");
  };

  // 处理建议点击 - 通过事件总线触发新搜索
  const handleSuggestionClick = (suggestion: string) => {
    clientLogger.info({ suggestion }, "Search suggestion clicked");
    // 触发全局搜索事件，由 AI 聊天组件监听处理
    window.dispatchEvent(
      new CustomEvent("ai:search-suggestion", {
        detail: { query: suggestion },
      }),
    );
  };

  return (
    <SearchResultsList
      response={searchResponse}
      parsedQuery={parsedQuery}
      onResultClick={handleResultClick}
      onSuggestionClick={handleSuggestionClick}
      showQueryFeedback={!!parsedQuery}
      initialShowCount={5}
    />
  );
});
