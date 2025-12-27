/**
 * AI 智能摘要组件
 *
 * 显示书签的 AI 生成摘要，支持重新生成和编辑
 *
 * @version 1.0.0
 * @since 2025-12-22
 */

"use client";

import { useState, useCallback } from "react";
import {
  FileText,
  RefreshCw,
  Loader2,
  Check,
  X,
  Edit2,
  Sparkles,
  Copy,
  CheckCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SummaryRenderer } from "@/components/bookmark/summary-renderer";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { AgentStreamChunk } from "@/lib/ai-agent";

// ============================================
// 类型定义
// ============================================

export interface AISmartSummaryProps {
  /** 书签 ID */
  bookmarkId: number;
  /** 现有摘要 */
  existingSummary?: string | null;
  /** 书签标题（用于上下文） */
  bookmarkTitle?: string;
  /** 摘要更新回调 */
  onSummaryUpdate?: (summary: string) => void;
  /** 是否只读 */
  readonly?: boolean;
  /** 自定义类名 */
  className?: string;
}

type SummaryStatus = "idle" | "generating" | "editing" | "saving";

// ============================================
// 组件
// ============================================

export function AISmartSummary({
  bookmarkId,
  existingSummary,
  bookmarkTitle: _bookmarkTitle,
  onSummaryUpdate,
  readonly = false,
  className,
}: AISmartSummaryProps) {
  const [summary, setSummary] = useState(existingSummary || "");
  const [editedSummary, setEditedSummary] = useState("");
  const [status, setStatus] = useState<SummaryStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  /**
   * 生成摘要
   */
  const generateSummary = useCallback(async () => {
    setStatus("generating");
    setError(null);

    try {
      const res = await fetch("/api/agent/unified", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: "请为这篇内容生成一个简洁、专业的摘要，控制在100字以内",
          bookmarkIds: [bookmarkId],
          options: { streaming: true, enableUnified: false },
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "生成失败");
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("无法获取响应流");

      const decoder = new TextDecoder();
      let fullContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value, { stream: true });
        const lines = text.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const chunk: AgentStreamChunk = JSON.parse(line.slice(6));
              if (chunk.type === "text" && chunk.text) {
                fullContent += chunk.text;
                setSummary(fullContent);
              } else if (chunk.type === "error") {
                throw new Error(chunk.error || "生成失败");
              }
            } catch {
              // 忽略解析错误
            }
          }
        }
      }

      if (fullContent) {
        onSummaryUpdate?.(fullContent);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "生成失败";
      setError(message);
    } finally {
      setStatus("idle");
    }
  }, [bookmarkId, onSummaryUpdate]);

  /**
   * 开始编辑
   */
  const startEdit = useCallback(() => {
    setEditedSummary(summary);
    setStatus("editing");
  }, [summary]);

  /**
   * 保存编辑
   */
  const saveEdit = useCallback(() => {
    setSummary(editedSummary);
    onSummaryUpdate?.(editedSummary);
    setStatus("idle");
  }, [editedSummary, onSummaryUpdate]);

  /**
   * 取消编辑
   */
  const cancelEdit = useCallback(() => {
    setEditedSummary("");
    setStatus("idle");
  }, []);

  /**
   * 复制摘要
   */
  const copyToClipboard = useCallback(async () => {
    if (!summary) return;
    await navigator.clipboard.writeText(summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [summary]);

  const hasSummary = Boolean(summary);
  const isGenerating = status === "generating";
  const isEditing = status === "editing";

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center size-8 rounded-full bg-blue-100 dark:bg-blue-900/30">
              <FileText className="size-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <CardTitle className="text-base">AI 摘要</CardTitle>
              <CardDescription className="text-xs">
                智能生成的内容概述
              </CardDescription>
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="flex items-center gap-1">
            {hasSummary && !isEditing && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      onClick={copyToClipboard}
                    >
                      {copied ? (
                        <CheckCheck className="size-4 text-green-500" />
                      ) : (
                        <Copy className="size-4" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>复制摘要</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            {!readonly && !isEditing && (
              <>
                {hasSummary && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          onClick={startEdit}
                          disabled={isGenerating}
                        >
                          <Edit2 className="size-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>编辑摘要</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}

                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        onClick={generateSummary}
                        disabled={isGenerating}
                      >
                        {isGenerating ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <RefreshCw className="size-4" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {hasSummary ? "重新生成" : "生成摘要"}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {error && (
          <div className="mb-3 p-2 bg-red-50 dark:bg-red-900/20 rounded text-sm text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        {isEditing ? (
          <div className="space-y-3">
            <Textarea
              value={editedSummary}
              onChange={(e) => setEditedSummary(e.target.value)}
              placeholder="编辑摘要..."
              className="min-h-[100px] resize-none"
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={cancelEdit}>
                <X className="size-4 mr-1" />
                取消
              </Button>
              <Button size="sm" onClick={saveEdit}>
                <Check className="size-4 mr-1" />
                保存
              </Button>
            </div>
          </div>
        ) : hasSummary ? (
          <SummaryRenderer summary={summary} />
        ) : (
          <div className="text-center py-6">
            <Sparkles className="size-8 mx-auto text-muted-foreground/30 mb-2" />
            <p className="text-sm text-muted-foreground mb-3">
              还没有摘要，让 AI 帮你生成
            </p>
            {!readonly && (
              <Button
                variant="outline"
                size="sm"
                onClick={generateSummary}
                disabled={isGenerating}
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="size-4 mr-1 animate-spin" />
                    生成中...
                  </>
                ) : (
                  <>
                    <Sparkles className="size-4 mr-1" />
                    生成摘要
                  </>
                )}
              </Button>
            )}
          </div>
        )}

        {isGenerating && hasSummary && (
          <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
            <Loader2 className="size-3 animate-spin" />
            <span>正在生成...</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default AISmartSummary;
