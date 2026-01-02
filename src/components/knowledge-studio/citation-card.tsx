"use client";

/**
 * Citation Card - 引用卡片
 * @module components/knowledge-studio
 * @description 显示单个引用来源信息
 */

import { Badge } from "@/components/ui/badge";
import { ExternalLink } from "lucide-react";
import type { Citation } from "@/lib/knowledge-studio";

interface CitationCardProps {
  /** 引用信息 */
  citation: Citation;
  /** 引用索引（从 0 开始） */
  index: number;
  /** 自定义类名 */
  className?: string;
}

/**
 * 引用卡片组件
 * - 显示引用标题、摘录和来源
 * - 点击跳转到原始链接
 */
export function CitationCard({
  citation,
  index,
  className,
}: CitationCardProps) {
  return (
    <a
      href={citation.url}
      target="_blank"
      rel="noopener noreferrer"
      className={`block rounded-lg border p-2 text-sm transition-colors hover:bg-accent ${className ?? ""}`}
    >
      <div className="flex items-start gap-2">
        <Badge variant="outline" className="shrink-0">
          [{index + 1}]
        </Badge>
        <div className="flex-1 space-y-1">
          <div className="font-medium line-clamp-2">{citation.title}</div>
          {citation.excerpt && (
            <p className="text-xs text-muted-foreground line-clamp-2">
              {citation.excerpt}
            </p>
          )}
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <ExternalLink className="h-3 w-3" />
            <span className="truncate">{safeGetHostname(citation.url)}</span>
          </div>
        </div>
      </div>
    </a>
  );
}

/**
 * 安全获取 URL 的主机名
 */
function safeGetHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}
