/**
 * Condense Slider - 精简字数滑块组件
 * @module knowledge-studio/v2
 *
 * P2-2: 自定义精简字数
 * 将固定的 800/1500/2000 按钮改为滑块输入
 */

"use client";

import { useState, useCallback } from "react";
import { Scissors } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

// ============================================================
// Types
// ============================================================

interface CondenseSliderProps {
  /** 当前内容字数 */
  currentWords: number;
  /** 精简回调 */
  onCondense: (targetWords: number) => void;
  /** 是否正在精简 */
  isCondensing?: boolean;
  /** 是否禁用 */
  disabled?: boolean;
  /** 类名 */
  className?: string;
}

// ============================================================
// Constants
// ============================================================

/** 预设快捷选项 */
const PRESET_OPTIONS = [
  { value: 500, label: "极简" },
  { value: 800, label: "精简" },
  { value: 1500, label: "中等" },
  { value: 2000, label: "详细" },
] as const;

/** 滑块范围 */
const MIN_WORDS = 300;
const MAX_WORDS = 3000;
const STEP = 100;

// ============================================================
// Component
// ============================================================

export function CondenseSlider({
  currentWords,
  onCondense,
  isCondensing = false,
  disabled = false,
  className,
}: CondenseSliderProps) {
  const [open, setOpen] = useState(false);
  const [targetWords, setTargetWords] = useState(1500);

  // 计算有效的最大值（不超过当前字数）
  const effectiveMax = Math.min(MAX_WORDS, currentWords - 100);
  const effectiveMin = Math.max(MIN_WORDS, Math.round(currentWords * 0.1));

  // 处理精简
  const handleCondense = useCallback(() => {
    onCondense(targetWords);
    setOpen(false);
  }, [targetWords, onCondense]);

  // 处理滑块变化
  const handleSliderChange = useCallback((values: number[]) => {
    setTargetWords(values[0]);
  }, []);

  // 选择预设
  const handlePresetSelect = useCallback((value: number) => {
    setTargetWords(value);
  }, []);

  // 计算压缩比例
  const compressionRatio = Math.round((1 - targetWords / currentWords) * 100);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled || isCondensing}
          className={cn("gap-1.5", className)}
        >
          <Scissors className="h-4 w-4" />
          精简
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <div className="space-y-4">
          {/* 标题 */}
          <div className="space-y-1">
            <h4 className="font-medium text-sm">自定义精简字数</h4>
            <p className="text-xs text-muted-foreground">
              当前内容约 {currentWords.toLocaleString()} 字
            </p>
          </div>

          {/* 快捷预设 */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">快捷选项</Label>
            <div className="flex flex-wrap gap-2">
              {PRESET_OPTIONS.filter((opt) => opt.value < currentWords).map(
                (option) => (
                  <Button
                    key={option.value}
                    variant={
                      targetWords === option.value ? "default" : "outline"
                    }
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => handlePresetSelect(option.value)}
                  >
                    {option.label} ({option.value})
                  </Button>
                ),
              )}
            </div>
          </div>

          {/* 滑块 */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">目标字数</Label>
              <Badge variant="secondary" className="text-xs">
                {targetWords.toLocaleString()} 字
              </Badge>
            </div>
            <Slider
              value={[targetWords]}
              min={effectiveMin}
              max={effectiveMax}
              step={STEP}
              onValueChange={handleSliderChange}
              className="py-2"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{effectiveMin}</span>
              <span className="text-primary font-medium">
                压缩 {compressionRatio}%
              </span>
              <span>{effectiveMax}</span>
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
              取消
            </Button>
            <Button
              size="sm"
              onClick={handleCondense}
              disabled={targetWords >= currentWords || isCondensing}
            >
              {isCondensing ? "精简中..." : "开始精简"}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default CondenseSlider;
