/**
 * 大纲确认面板组件 (Story 2.3)
 * @module knowledge-studio/outline-confirmation-panel
 *
 * 显示生成的大纲并提供确认/编辑/跳过选项：
 * - 展示大纲编辑器
 * - 确认并生成按钮
 * - 自动继续开关
 * - 重新生成按钮
 */

"use client";

import { useState, useCallback, useEffect } from "react";
import { Check, RefreshCw, SkipForward, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { OutlineEditor } from "./outline-editor";
import type { BlueprintOutline } from "@/lib/knowledge-studio/blueprint";

// ============================================================
// Constants
// ============================================================

const STORAGE_KEY = "knowledge-studio:auto-confirm-outline";

// ============================================================
// Types
// ============================================================

export interface OutlineConfirmationPanelProps {
  /** 大纲数据 */
  outline: BlueprintOutline;
  /** 大纲变更回调 */
  onOutlineChange: (outline: BlueprintOutline) => void;
  /** 确认并继续回调 */
  onConfirm: (outline: BlueprintOutline) => void;
  /** 跳过大纲步骤回调（直接使用原大纲） */
  onSkip?: () => void;
  /** 重新生成大纲回调 */
  onRegenerate?: () => void;
  /** 是否正在生成 */
  isGenerating?: boolean;
  /** 是否正在重新生成 */
  isRegenerating?: boolean;
  /** 是否显示跳过按钮 */
  showSkip?: boolean;
  /** 类名 */
  className?: string;
}

// ============================================================
// Utility Functions
// ============================================================

/**
 * 从本地存储读取自动确认设置
 */
function getAutoConfirmSetting(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "true";
  } catch {
    return false;
  }
}

/**
 * 保存自动确认设置到本地存储
 */
function setAutoConfirmSetting(value: boolean): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, String(value));
  } catch {
    // ignore storage errors
  }
}

// ============================================================
// Component
// ============================================================

export function OutlineConfirmationPanel({
  outline,
  onOutlineChange,
  onConfirm,
  onSkip,
  onRegenerate,
  isGenerating = false,
  isRegenerating = false,
  showSkip = true,
  className,
}: OutlineConfirmationPanelProps) {
  // 自动确认开关状态（使用初始化函数避免 effect 中 setState）
  const [autoConfirm, setAutoConfirm] = useState(() => getAutoConfirmSetting());

  // 已修改标记
  const [isModified, setIsModified] = useState(false);

  // 自动确认逻辑
  useEffect(() => {
    if (
      autoConfirm &&
      !isGenerating &&
      !isRegenerating &&
      outline.nodes.length > 0
    ) {
      // 延迟一小段时间让用户看到大纲，然后自动确认
      const timer = setTimeout(() => {
        onConfirm(outline);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [autoConfirm, isGenerating, isRegenerating, outline, onConfirm]);

  // 处理大纲变更
  const handleOutlineChange = useCallback(
    (newOutline: BlueprintOutline) => {
      setIsModified(true);
      onOutlineChange(newOutline);
    },
    [onOutlineChange],
  );

  // 处理自动确认开关
  const handleAutoConfirmChange = useCallback((checked: boolean) => {
    setAutoConfirm(checked);
    setAutoConfirmSetting(checked);
  }, []);

  // 处理确认
  const handleConfirm = useCallback(() => {
    onConfirm(outline);
  }, [outline, onConfirm]);

  // 处理跳过
  const handleSkip = useCallback(() => {
    onSkip?.();
  }, [onSkip]);

  // 处理重新生成
  const handleRegenerate = useCallback(() => {
    setIsModified(false);
    onRegenerate?.();
  }, [onRegenerate]);

  const isLoading = isGenerating || isRegenerating;

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl">确认大纲</CardTitle>
            <CardDescription className="mt-1">
              {autoConfirm
                ? "自动继续已开启，大纲将自动确认并开始生成内容..."
                : "请检查并编辑大纲，满意后点击确认继续"}
            </CardDescription>
          </div>

          {/* 自动确认开关 */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-2">
                  <Switch
                    id="auto-confirm"
                    checked={autoConfirm}
                    onCheckedChange={handleAutoConfirmChange}
                    disabled={isLoading}
                    aria-label="自动继续"
                  />
                  <Label
                    htmlFor="auto-confirm"
                    className="text-sm font-medium cursor-pointer"
                  >
                    自动继续
                  </Label>
                  <Settings2 className="size-4 text-muted-foreground" />
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>开启后，大纲生成完成后自动开始内容生成</p>
                <p className="text-xs text-muted-foreground">
                  此设置会保存到浏览器
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* 修改提示 */}
        {isModified && (
          <div className="mt-2 text-sm text-amber-600 dark:text-amber-400">
            大纲已被修改，请确认后继续
          </div>
        )}

        {/* 自动确认进度提示 */}
        {autoConfirm && !isLoading && (
          <div className="mt-2 flex items-center gap-2 text-sm text-primary">
            <div className="size-2 rounded-full bg-primary animate-pulse" />
            即将自动确认并开始生成...
          </div>
        )}
      </CardHeader>

      <CardContent className="pb-4">
        <OutlineEditor
          outline={outline}
          onChange={handleOutlineChange}
          readOnly={isLoading}
          maxHeight="400px"
          showPreview={true}
        />
      </CardContent>

      <CardFooter className="flex justify-between border-t pt-4">
        <div className="flex gap-2">
          {/* 重新生成按钮 */}
          {onRegenerate && (
            <Button
              variant="outline"
              onClick={handleRegenerate}
              disabled={isLoading}
            >
              <RefreshCw
                className={cn("size-4 mr-2", isRegenerating && "animate-spin")}
              />
              重新生成
            </Button>
          )}

          {/* 跳过按钮 */}
          {showSkip && onSkip && (
            <Button variant="ghost" onClick={handleSkip} disabled={isLoading}>
              <SkipForward className="size-4 mr-2" />
              跳过编辑
            </Button>
          )}
        </div>

        {/* 确认按钮 */}
        <Button
          onClick={handleConfirm}
          disabled={isLoading || outline.nodes.length === 0}
          className="min-w-32"
        >
          <Check className="size-4 mr-2" />
          {isGenerating ? "生成中..." : "确认并生成"}
        </Button>
      </CardFooter>
    </Card>
  );
}
