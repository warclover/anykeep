/**
 * 综述详情 - 精简对话框组件
 */

"use client";

import { Scissors, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
/**
 * 精简预设类型（从已移除的 knowledge-studio/refinement 内联）
 */
export type CondensePreset = "brief" | "standard" | "detailed";

export const CONDENSE_PRESETS: Record<
  CondensePreset,
  { label: string; targetWords: number; description: string }
> = {
  brief: {
    label: "极简版",
    targetWords: 500,
    description: "保留核心结论，删除所有细节",
  },
  standard: {
    label: "标准版",
    targetWords: 1500,
    description: "保留主要论点和关键证据",
  },
  detailed: {
    label: "详细版",
    targetWords: 3000,
    description: "保留完整论证，精简冗余表述",
  },
};

interface CondenseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  wordCount: number;
  isCondensing: boolean;
  condenseProgress: number;
  condensedPreview: string;
  onCondense: (preset: CondensePreset) => void;
}

export function CondenseDialog({
  open,
  onOpenChange,
  wordCount,
  isCondensing,
  condenseProgress,
  condensedPreview,
  onCondense,
}: CondenseDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Scissors className="mr-2 h-4 w-4" />
          精简
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>一键精简内容</DialogTitle>
          <DialogDescription>
            当前字数：{wordCount.toLocaleString()} 字，选择目标字数进行精简
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-4">
          {isCondensing ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">正在精简...</span>
              </div>
              <Progress value={condenseProgress} className="h-2" />
              {condensedPreview && (
                <div className="max-h-[200px] overflow-y-auto rounded border p-3 text-sm">
                  <pre className="whitespace-pre-wrap">
                    {condensedPreview.slice(0, 500)}...
                  </pre>
                </div>
              )}
            </div>
          ) : (
            <div className="grid gap-2">
              {(Object.keys(CONDENSE_PRESETS) as CondensePreset[]).map(
                (preset) => {
                  const config = CONDENSE_PRESETS[preset];
                  const isDisabled = wordCount <= config.targetWords * 1.1;
                  return (
                    <Button
                      key={preset}
                      variant="outline"
                      className="justify-start h-auto py-3"
                      disabled={isDisabled}
                      onClick={() => onCondense(preset)}
                    >
                      <div className="flex flex-col items-start">
                        <span className="font-medium">
                          {config.label}（约{" "}
                          {config.targetWords.toLocaleString()} 字）
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {config.description}
                          {isDisabled && " · 已低于目标字数"}
                        </span>
                      </div>
                    </Button>
                  );
                },
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
