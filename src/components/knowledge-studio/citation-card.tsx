"use client";

/**
 * Citation Card - 引用卡片
 * @module components/knowledge-studio
 * @description 显示单个引用来源信息
 */

import { Badge } from "@/components/ui/badge";
import { ExternalLink } from "lucide-react";
import type { Citation } from "@/lib/knowledge-studio/client";

interface CitationCardProps {
  /** 引用信息 */
  citation: Citation;
  /** 引用索引（从 0 开始） */
  index: number;
  /** 自定义类名 */
  className?: string;
}

/**
 * 检查 URL 是否使用安全协议
 */
function isSafeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ["http:", "https:"].includes(parsed.protocol);
  } catch {
    return false;
  }
}

/**
 * 安全获取 URL 的主机名
 * 仅允许 http/https 协议，防止 XSS
 */
function safeGetHostname(url: string): string {
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return "(不支持的协议)";
    }
    return parsed.hostname;
  } catch {
    return "(无效链接)";
  }
}

/**
 * 引用卡片组件
 * - 显示引用标题、摘录和来源
 * - 点击跳转到原始链接
 * - URL 安全检查：仅允许 http/https 协议
 */
export function CitationCard({
  citation,
  index,
  className,
}: CitationCardProps) {
  const safeUrl = isSafeUrl(citation.url) ? citation.url : undefined;

  return (
    <a
      href={safeUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={`block rounded-lg border p-2 text-sm transition-colors hover:bg-accent ${className ?? ""}`}
      onClick={safeUrl ? undefined : (e) => e.preventDefault()}
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
