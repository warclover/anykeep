"use client";

import { Sparkles, Trash2, X, Brain } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AIPanelHeaderProps {
  title: string;
  showMemoryHint: boolean;
  hasMessages: boolean;
  showCloseButton: boolean;
  onClear: () => void;
  onClose?: () => void;
}

export function AIPanelHeader({
  title,
  showMemoryHint,
  hasMessages,
  showCloseButton,
  onClear,
  onClose,
}: AIPanelHeaderProps) {
  return (
    <div className="relative px-3 py-1.5 bg-gradient-to-r from-pink-400 via-purple-400 to-indigo-400 text-white flex-shrink-0">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="relative">
            <div
              className="absolute inset-0 bg-white/30 rounded-full animate-ping opacity-75"
              style={{ animationDuration: "2s" }}
            />
            <div className="relative w-7 h-7 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm border border-white/40 shadow-md">
              <Sparkles className="size-3.5 text-white" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-semibold text-white">{title}</h3>
            <span className="text-[10px] text-white/80 flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-green-300 rounded-full animate-pulse" />
              在线
              {showMemoryHint && (
                <span className="ml-1 px-1.5 py-0.5 bg-white/20 rounded-full text-white/90 flex items-center gap-0.5 animate-fade-in">
                  <Brain className="size-2.5" />
                  记住了
                </span>
              )}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {hasMessages && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onClear}
              title="清除对话"
              className="text-white/80 hover:text-white hover:bg-white/20"
            >
              <Trash2 className="size-4" />
            </Button>
          )}
          {showCloseButton && onClose && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onClose}
              title="关闭"
              className="text-white/80 hover:text-white hover:bg-white/20"
            >
              <X className="size-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
