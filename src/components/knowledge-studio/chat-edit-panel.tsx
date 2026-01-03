"use client";

/**
 * Chat Edit Panel - 聊天式编辑面板
 * @module components/knowledge-studio
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Check, X } from "lucide-react";
import type { EditMode, ChatTurn, EditDiff } from "@/lib/knowledge-studio/client";
import { EDIT_MODE_CONFIG } from "@/lib/knowledge-studio/client";

interface ChatEditPanelProps {
  paragraphContent: string;
  turns: ChatTurn[];
  onSendMessage: (message: string, mode: EditMode) => Promise<void>;
  onAcceptEdit: (newContent: string) => void;
  onRejectEdit: () => void;
  pendingEdit?: {
    content: string;
    diff: EditDiff;
  };
  isLoading?: boolean;
  className?: string;
}

const EDIT_MODES: EditMode[] = [
  "rewrite",
  "expand",
  "simplify",
  "tone",
  "custom",
];

export function ChatEditPanel({
  paragraphContent,
  turns,
  onSendMessage,
  onAcceptEdit,
  onRejectEdit,
  pendingEdit,
  isLoading = false,
  className,
}: ChatEditPanelProps) {
  const [message, setMessage] = useState("");
  const [selectedMode, setSelectedMode] = useState<EditMode>("custom");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [turns, pendingEdit]);

  const handleSend = useCallback(async () => {
    if (!message.trim() || isLoading) return;

    const currentMessage = message;
    setMessage("");

    await onSendMessage(currentMessage, selectedMode);
  }, [message, selectedMode, isLoading, onSendMessage]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  return (
    <div className={cn("flex h-full flex-col", className)}>
      {/* Current Paragraph Preview */}
      <div className="border-b p-3">
        <div className="text-xs font-medium text-muted-foreground">
          当前段落
        </div>
        <p className="mt-1 text-sm line-clamp-3">{paragraphContent}</p>
      </div>

      {/* Chat History */}
      <ScrollArea className="flex-1 p-3" ref={scrollRef}>
        <div className="space-y-3">
          {turns.map((turn) => (
            <div
              key={turn.id}
              className={cn(
                "flex",
                turn.role === "user" ? "justify-end" : "justify-start",
              )}
            >
              <div
                className={cn(
                  "max-w-[80%] rounded-lg p-3",
                  turn.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted",
                )}
              >
                <p className="text-sm">{turn.content}</p>

                {/* Show edit result if available */}
                {turn.editResult && (
                  <div className="mt-2 rounded border bg-background/50 p-2 text-xs">
                    <div className="text-muted-foreground">修改预览</div>
                    <div className="mt-1 line-through opacity-50">
                      {turn.editResult.before.slice(0, 100)}...
                    </div>
                    <div className="mt-1 text-green-600 dark:text-green-400">
                      {turn.editResult.after.slice(0, 100)}...
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Pending Edit Preview */}
          {pendingEdit && (
            <div className="rounded-lg border-2 border-primary/50 bg-accent p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">修改建议</span>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onAcceptEdit(pendingEdit.content)}
                    className="h-7 text-green-600 hover:text-green-700"
                  >
                    <Check className="mr-1 h-3 w-3" />
                    接受
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={onRejectEdit}
                    className="h-7 text-red-600 hover:text-red-700"
                  >
                    <X className="mr-1 h-3 w-3" />
                    拒绝
                  </Button>
                </div>
              </div>

              {/* Diff View */}
              <div className="mt-2 space-y-1 text-sm">
                {pendingEdit.diff.changes.map((change, index) => (
                  <span
                    key={index}
                    className={cn(
                      change.type === "add" &&
                        "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
                      change.type === "remove" &&
                        "bg-red-100 text-red-800 line-through dark:bg-red-900/30 dark:text-red-300",
                    )}
                  >
                    {change.value}
                  </span>
                ))}
              </div>

              {/* Stats */}
              <div className="mt-2 flex gap-2 text-xs text-muted-foreground">
                <span className="text-green-600">
                  +{pendingEdit.diff.stats.added}
                </span>
                <span className="text-red-600">
                  -{pendingEdit.diff.stats.removed}
                </span>
              </div>
            </div>
          )}

          {/* Loading indicator */}
          {isLoading && (
            <div className="flex justify-start">
              <div className="rounded-lg bg-muted p-3">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 animate-pulse rounded-full bg-primary" />
                  <div className="h-2 w-2 animate-pulse rounded-full bg-primary delay-75" />
                  <div className="h-2 w-2 animate-pulse rounded-full bg-primary delay-150" />
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Edit Mode Selector */}
      <div className="border-t p-2">
        <div className="flex flex-wrap gap-1">
          {EDIT_MODES.map((mode) => {
            const config = EDIT_MODE_CONFIG[mode];
            return (
              <Button
                key={mode}
                size="sm"
                variant={selectedMode === mode ? "default" : "outline"}
                onClick={() => setSelectedMode(mode)}
                className="h-7 text-xs"
              >
                <span className="mr-1">{config.icon}</span>
                {config.name}
              </Button>
            );
          })}
        </div>
      </div>

      {/* Input Area */}
      <div className="border-t p-3">
        <div className="flex gap-2">
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`描述你想如何修改这段内容...`}
            disabled={isLoading}
            className="min-h-[60px] resize-none"
            rows={2}
          />
          <Button
            size="icon"
            onClick={handleSend}
            disabled={!message.trim() || isLoading}
            className="h-auto self-end"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
