/**
 * AI 书签对话组件
 *
 * 聚焦当前书签的 AI 对话入口，提供快捷问答功能
 * 可嵌入到书签详情页中，支持预设问题和自由对话
 *
 * @version 1.0.0
 * @since 2025-12-22
 */

"use client";

import { useState, useCallback, useRef } from "react";
import {
  Bot,
  Send,
  Loader2,
  Sparkles,
  FileText,
  Tags,
  Search,
  HelpCircle,
  X,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import type { AgentStreamChunk } from "@/lib/ai-agent";
import { AIMarkdown } from "./ai-markdown";

// ============================================
// 类型定义
// ============================================

export interface AIBookmarkChatProps {
  /** 用户 ID */
  userId: string;
  /** 书签 ID */
  bookmarkId: number;
  /** 书签标题 */
  bookmarkTitle: string;
  /** 书签 URL */
  bookmarkUrl?: string;
  /** 自定义类名 */
  className?: string;
  /** 是否默认展开 */
  defaultExpanded?: boolean;
  /** 点击展开全屏对话 */
  onOpenFullChat?: () => void;
}

interface QuickAction {
  id: string;
  label: string;
  icon: React.ElementType;
  prompt: string;
}

// ============================================
// 常量配置
// ============================================

const QUICK_ACTIONS: QuickAction[] = [
  {
    id: "summarize",
    label: "生成摘要",
    icon: FileText,
    prompt: "请为这篇内容生成一个简洁的摘要",
  },
  {
    id: "tags",
    label: "推荐标签",
    icon: Tags,
    prompt: "请为这篇内容推荐合适的标签",
  },
  {
    id: "similar",
    label: "相似内容",
    icon: Search,
    prompt: "帮我找找我收藏中有没有类似的内容",
  },
  {
    id: "explain",
    label: "解释内容",
    icon: HelpCircle,
    prompt: "请解释一下这篇内容的主要观点",
  },
];

// ============================================
// 组件
// ============================================

/**
 * AI 书签对话组件
 */
export function AIBookmarkChat({
  userId: _userId,
  bookmarkId,
  bookmarkTitle: _bookmarkTitle,
  bookmarkUrl: _bookmarkUrl,
  className,
  defaultExpanded = false,
  onOpenFullChat,
}: AIBookmarkChatProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * 发送消息
   */
  const sendMessage = useCallback(
    async (message: string) => {
      if (!message.trim() || isLoading) return;

      setIsLoading(true);
      setResponse(null);
      setError(null);

      // 创建 AbortController
      abortControllerRef.current = new AbortController();

      try {
        const res = await fetch("/api/agent/unified", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: message,
            bookmarkIds: [bookmarkId],
            options: {
              streaming: true,
              enableUnified: false,
            },
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.error || "请求失败");
        }

        // 处理 SSE 流式响应
        const reader = res.body?.getReader();
        if (!reader) {
          throw new Error("无法获取响应流");
        }

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
                  setResponse(fullContent);
                } else if (chunk.type === "error") {
                  setError(chunk.error || "发生错误");
                }
              } catch {
                // 忽略解析错误
              }
            }
          }
        }

        if (!fullContent) {
          setResponse("AI 没有返回内容，请重试");
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          // 用户取消
          setResponse("已取消");
        } else {
          const errorMessage = err instanceof Error ? err.message : "请求失败";
          setError(errorMessage);
        }
      } finally {
        setIsLoading(false);
        abortControllerRef.current = null;
      }
    },
    [bookmarkId, isLoading],
  );

  /**
   * 处理快捷操作
   */
  const handleQuickAction = useCallback(
    (action: QuickAction) => {
      sendMessage(action.prompt);
    },
    [sendMessage],
  );

  /**
   * 处理自定义输入
   */
  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (input.trim()) {
        sendMessage(input.trim());
        setInput("");
      }
    },
    [input, sendMessage],
  );

  /**
   * 取消请求
   */
  const handleCancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsLoading(false);
  }, []);

  /**
   * 清除响应
   */
  const handleClear = useCallback(() => {
    setResponse(null);
    setError(null);
  }, []);

  return (
    <div className={cn("border rounded-lg overflow-hidden", className)}>
      {/* 头部（可折叠触发器） */}
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="w-full flex items-center justify-between px-4 py-3 bg-gradient-to-r from-primary/5 to-primary/10 hover:from-primary/10 hover:to-primary/15 transition-colors"
          >
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center size-8 rounded-full bg-primary/10">
                <Bot className="size-4 text-primary" />
              </div>
              <div className="text-left">
                <div className="font-medium text-sm">AI 助手</div>
                <div className="text-xs text-muted-foreground">
                  关于此书签的快捷问答
                </div>
              </div>
            </div>
            {isExpanded ? (
              <ChevronUp className="size-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="size-4 text-muted-foreground" />
            )}
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="p-4 space-y-4">
            {/* 快捷操作 */}
            <div className="flex flex-wrap gap-2">
              {QUICK_ACTIONS.map((action) => (
                <Button
                  key={action.id}
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickAction(action)}
                  disabled={isLoading}
                  className="h-8 text-xs"
                >
                  <action.icon className="size-3 mr-1" />
                  {action.label}
                </Button>
              ))}
            </div>

            {/* 自定义输入 */}
            <form onSubmit={handleSubmit} className="flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="输入你的问题..."
                disabled={isLoading}
                className="h-9 text-sm"
              />
              <Button
                type="submit"
                size="sm"
                disabled={isLoading || !input.trim()}
                className="h-9 px-3"
              >
                {isLoading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Send className="size-4" />
                )}
              </Button>
            </form>

            {/* 响应区域 */}
            {(response || error || isLoading) && (
              <div className="relative">
                {/* 清除/取消按钮 */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-1 right-1 size-6"
                  onClick={isLoading ? handleCancel : handleClear}
                >
                  <X className="size-3" />
                </Button>

                <div
                  className={cn(
                    "p-3 rounded-lg text-sm",
                    error
                      ? "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300"
                      : "bg-muted/50",
                  )}
                >
                  {isLoading && !response && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="size-4 animate-spin" />
                      <span>正在思考...</span>
                    </div>
                  )}

                  {error && (
                    <div className="flex items-center gap-2">
                      <span className="text-red-500">⚠️</span>
                      <span>{error}</span>
                    </div>
                  )}

                  {response && (
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <AIMarkdown content={response} />
                    </div>
                  )}

                  {isLoading && response && (
                    <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                      <Loader2 className="size-3 animate-spin" />
                      <span>继续生成中...</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 展开全屏对话 */}
            {onOpenFullChat && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onOpenFullChat}
                className="w-full h-8 text-xs text-muted-foreground"
              >
                <Sparkles className="size-3 mr-1" />
                展开完整对话
              </Button>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

export default AIBookmarkChat;
