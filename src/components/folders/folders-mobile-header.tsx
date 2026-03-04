"use client";

import { Menu, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

interface FoldersMobileHeaderProps {
  onOpenNav: () => void;
  onOpenAIAssistant: () => void;
}

export function FoldersMobileHeader({
  onOpenNav,
  onOpenAIAssistant,
}: FoldersMobileHeaderProps) {
  return (
    <div className="lg:hidden flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
      <Button variant="ghost" size="icon" onClick={onOpenNav}>
        <Menu className="size-5" />
      </Button>
      <h1 className="text-lg font-semibold flex-1">我的分类</h1>
      <Button
        variant="outline"
        size="sm"
        onClick={onOpenAIAssistant}
        className="gap-1.5 text-violet-600 border-violet-200 hover:bg-violet-50 hover:border-violet-300 dark:text-violet-400 dark:border-violet-800 dark:hover:bg-violet-950"
      >
        <Sparkles className="size-4" />
        <span className="hidden sm:inline">AI 助手</span>
      </Button>
    </div>
  );
}
