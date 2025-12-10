/**
 * AI 对话面板组件
 * Phase 4.3: 聊天界面，支持流式响应和引用来源
 *
 * @version 1.0.0
 * @since 2025-12-09
 */

"use client";

import { useState, useRef, useEffect } from "react";
import {
  Send,
  StopCircle,
  Trash2,
  ExternalLink,
  Sparkles,
  Folder,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useChat, type Message, type Citation } from "@/hooks/use-chat";

interface ChatPanelProps {
  /** 限制到特定文件夹 */
  folderId?: number;
  /** 限制到特定书签 */
  bookmarkIds?: number[];
  /** 自定义类名 */
  className?: string;
  /** 是否显示关闭按钮 */
  showClose?: boolean;
  /** 关闭回调 */
  onClose?: () => void;
}

/**
 * AI 对话面板
 */
export function ChatPanel({
  folderId,
  bookmarkIds,
  className,
  showClose,
  onClose,
}: ChatPanelProps) {
  const {
    messages,
    isLoading,
    error,
    citations,
    sendMessage,
    clearMessages,
    stopGeneration,
  } = useChat();

  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // 发送消息
  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const query = input.trim();
    setInput("");
    await sendMessage(query, { folderId, bookmarkIds });
  };

  // 处理键盘事件
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div
      className={cn(
        "flex flex-col h-full bg-background border rounded-lg",
        className
      )}
    >
      {/* 头部 */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <Sparkles className="size-5 text-purple-500" />
          <span className="font-medium">AI 助手</span>
          {folderId && (
            <Badge variant="secondary" className="text-xs">
              限定文件夹
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={clearMessages}
            disabled={messages.length === 0}
            title="清空对话"
          >
            <Trash2 className="size-4" />
          </Button>
          {showClose && onClose && (
            <Button variant="ghost" size="sm" onClick={onClose} title="关闭">
              <X className="size-4" />
            </Button>
          )}
        </div>
      </div>

      {/* 消息列表 */}
      <ScrollArea className="flex-1 px-4">
        <div className="py-4 space-y-4">
          {messages.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Sparkles className="size-8 mx-auto mb-3 text-purple-400" />
              <p className="text-sm">
                向我提问关于你收藏内容的任何问题
              </p>
              <p className="text-xs mt-2 text-muted-foreground/70">
                例如：&ldquo;帮我总结最近收藏的 AI 相关文章&rdquo;
              </p>
            </div>
          ) : (
            messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))
          )}

          {/* 错误提示 */}
          {error && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* 引用来源（显示最新的） */}
          {citations.length > 0 && messages.length > 0 && (
            <CitationsPanel citations={citations} />
          )}

          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* 输入区域 */}
      <div className="p-4 border-t">
        <div className="flex gap-2">
          <Textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入问题..."
            className="min-h-[44px] max-h-[120px] resize-none"
            disabled={isLoading}
          />
          {isLoading ? (
            <Button
              variant="outline"
              size="icon"
              onClick={stopGeneration}
              className="shrink-0"
            >
              <StopCircle className="size-4" />
            </Button>
          ) : (
            <Button
              size="icon"
              onClick={handleSend}
              disabled={!input.trim()}
              className="shrink-0"
            >
              <Send className="size-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * 消息气泡
 */
function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-lg px-4 py-2",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted",
          message.isStreaming && "animate-pulse"
        )}
      >
        <div className="text-sm whitespace-pre-wrap break-words">
          {message.content || (
            <span className="text-muted-foreground">思考中...</span>
          )}
        </div>
        {message.citations && message.citations.length > 0 && (
          <div className="mt-2 pt-2 border-t border-muted-foreground/20">
            <div className="flex flex-wrap gap-1">
              {message.citations.map((citation, index) => (
                <Badge
                  key={citation.bookmarkId}
                  variant="outline"
                  className="text-xs cursor-pointer hover:bg-muted"
                  onClick={() =>
                    window.open(citation.url, "_blank", "noopener,noreferrer")
                  }
                >
                  [{index + 1}] {citation.title.slice(0, 20)}
                  {citation.title.length > 20 && "..."}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * 引用来源面板
 */
function CitationsPanel({ citations }: { citations: Citation[] }) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (citations.length === 0) return null;

  return (
    <Card className="bg-purple-50/50 dark:bg-purple-900/10 border-purple-200/50 dark:border-purple-800/50">
      <CardContent className="p-3">
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 w-full text-left"
        >
          <Sparkles className="size-4 text-purple-500" />
          <span className="text-sm font-medium text-purple-700 dark:text-purple-300">
            参考来源 ({citations.length})
          </span>
        </button>

        {isExpanded && (
          <div className="mt-3 space-y-2">
            {citations.map((citation, index) => (
              <div
                key={citation.bookmarkId}
                className="flex items-start gap-2 p-2 rounded bg-white/50 dark:bg-gray-800/50"
              >
                <span className="text-xs font-medium text-purple-600 dark:text-purple-400 shrink-0">
                  [{index + 1}]
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">
                    {citation.title}
                  </div>
                  {citation.folderName && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                      <Folder className="size-3" />
                      {citation.folderName}
                    </div>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 shrink-0"
                  onClick={() =>
                    window.open(citation.url, "_blank", "noopener,noreferrer")
                  }
                >
                  <ExternalLink className="size-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
