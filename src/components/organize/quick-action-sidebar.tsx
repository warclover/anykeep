"use client";

import { Sparkles, Copy, FolderOpen, Tag, Archive } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { QuickActionType } from "@/lib/organize/types";

interface QuickActionSidebarProps {
  onAction: (actionType: QuickActionType) => void;
  disabled?: boolean;
}

const SIDEBAR_ACTIONS = [
  { id: "clean-duplicates" as const, icon: Copy, label: "清理重复" },
  { id: "smart-categorize" as const, icon: FolderOpen, label: "智能分类" },
  { id: "auto-tag" as const, icon: Tag, label: "自动打标签" },
  { id: "archive-stale" as const, icon: Archive, label: "归档旧内容" },
];

export function QuickActionSidebar({
  onAction,
  disabled,
}: QuickActionSidebarProps) {
  return (
    <Card className="p-3">
      <div className="space-y-2">
        <Button
          size="sm"
          className="w-full justify-start gap-2 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600"
          onClick={() => onAction("one-click")}
          disabled={disabled}
        >
          <Sparkles className="w-4 h-4" />
          <span>一键智能整理</span>
        </Button>

        <div className="space-y-1">
          {SIDEBAR_ACTIONS.map((action) => (
            <button
              key={action.id}
              onClick={() => !disabled && onAction(action.id)}
              disabled={disabled}
              className={cn(
                "w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs",
                "text-muted-foreground hover:text-foreground hover:bg-muted",
                "transition-colors text-left",
                disabled && "opacity-50 cursor-not-allowed",
              )}
            >
              <action.icon className="w-3.5 h-3.5" />
              {action.label}
            </button>
          ))}
        </div>
      </div>
    </Card>
  );
}
