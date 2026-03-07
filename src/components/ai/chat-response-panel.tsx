/**
 * 对话回复区
 *
 * 从 ai-bookmark-assistant.tsx 提取
 */

import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AIMarkdown } from "./ai-markdown";

interface ChatResponsePanelProps {
  chatResponse: string | null;
  chatError: string | null;
  chatLoading: boolean;
  onCancel: () => void;
  onClear: () => void;
}

export function ChatResponsePanel({
  chatResponse,
  chatError,
  chatLoading,
  onCancel,
  onClear,
}: ChatResponsePanelProps) {
  if (!chatResponse && !chatError && !chatLoading) return null;

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-1 right-1 size-6"
        onClick={chatLoading ? onCancel : onClear}
      >
        <X className="size-3" />
      </Button>
      <div
        className={cn(
          "p-3 rounded-lg text-sm",
          chatError
            ? "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300"
            : "bg-muted/50",
        )}
      >
        {chatLoading && !chatResponse && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            <span>正在思考...</span>
          </div>
        )}
        {chatError && (
          <div className="flex items-center gap-2">
            <span className="text-red-500">⚠️</span>
            <span>{chatError}</span>
          </div>
        )}
        {chatResponse && (
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <AIMarkdown content={chatResponse} />
          </div>
        )}
        {chatLoading && chatResponse && (
          <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
            <Loader2 className="size-3 animate-spin" />
            <span>继续生成中...</span>
          </div>
        )}
      </div>
    </div>
  );
}
