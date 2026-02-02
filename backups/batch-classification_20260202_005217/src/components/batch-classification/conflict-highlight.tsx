/**
 * 冲突高亮组件
 *
 * 显示 AI 建议与原始路径的差异
 *
 * @module components/batch-classification/conflict-highlight
 * @version 1.0.0
 * @since 2026-02-01
 */

"use client";

import { AlertTriangle, ArrowRight, Check, FolderTree } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { ClassificationConflict, ConflictType } from "@/lib/classification/services/batch-classification";

// ============================================
// Props
// ============================================

interface ConflictHighlightProps {
  conflict: ClassificationConflict;
  onResolve: (resolution: "keep_original" | "use_ai" | "custom") => void;
  onCustomPath?: () => void;
  className?: string;
}

// ============================================
// 常量
// ============================================

const CONFLICT_DESCRIPTIONS: Record<ConflictType, string> = {
  none: "",
  path_mismatch: "AI 建议的分类路径与您原始的浏览器书签结构不同",
  folder_rename: "AI 建议将文件夹重命名为更合适的名称",
  ambiguous: "此书签可能属于多个分类，AI 不确定最佳选择",
  merge_suggestion: "AI 建议将多个相似的文件夹合并",
};

// ============================================
// 组件
// ============================================

export function ConflictHighlight({
  conflict,
  onResolve,
  onCustomPath: _onCustomPath,
  className,
}: ConflictHighlightProps) {
  return (
    <Card className={cn("border-amber-300 bg-amber-50/50", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-amber-800">
          <AlertTriangle className="h-5 w-5" />
          路径冲突
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 冲突说明 */}
        <p className="text-sm text-amber-700">
          {CONFLICT_DESCRIPTIONS[conflict.conflictType]}
        </p>

        {/* 路径对比 */}
        <div className="flex items-center gap-4 p-4 bg-white rounded-lg border">
          <div className="flex-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <FolderTree className="h-4 w-4" />
              原始路径
            </div>
            <p className="font-medium truncate">{conflict.originalPath}</p>
          </div>

          <ArrowRight className="h-5 w-5 text-muted-foreground shrink-0" />

          <div className="flex-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <FolderTree className="h-4 w-4 text-primary" />
              AI 建议
            </div>
            <p className="font-medium text-primary truncate">{conflict.suggestedPath}</p>
          </div>
        </div>

        {/* 置信度 */}
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">AI 置信度:</span>
          <span className={cn(
            "font-medium",
            conflict.confidence > 0.7 ? "text-green-600" :
            conflict.confidence > 0.5 ? "text-amber-600" : "text-red-600"
          )}>
            {Math.round(conflict.confidence * 100)}%
          </span>
        </div>

        {/* 解决选项 */}
        <RadioGroup
          defaultValue="use_ai"
          onValueChange={(v) => onResolve(v as "keep_original" | "use_ai" | "custom")}
          className="space-y-2"
        >
          <div className="flex items-center space-x-2 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer">
            <RadioGroupItem value="keep_original" id="keep_original" />
            <Label htmlFor="keep_original" className="flex-1 cursor-pointer">
              <span className="font-medium">保留原结构</span>
              <span className="block text-sm text-muted-foreground">
                使用浏览器中的原始文件夹结构
              </span>
            </Label>
          </div>

          <div className="flex items-center space-x-2 p-3 rounded-lg border border-primary/50 bg-primary/5 hover:bg-primary/10 cursor-pointer">
            <RadioGroupItem value="use_ai" id="use_ai" />
            <Label htmlFor="use_ai" className="flex-1 cursor-pointer">
              <span className="font-medium text-primary">采用 AI 建议</span>
              <span className="block text-sm text-muted-foreground">
                使用 AI 推荐的更优分类
              </span>
            </Label>
            <Check className="h-4 w-4 text-primary" />
          </div>

          <div className="flex items-center space-x-2 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer">
            <RadioGroupItem value="custom" id="custom" />
            <Label htmlFor="custom" className="flex-1 cursor-pointer">
              <span className="font-medium">手动指定</span>
              <span className="block text-sm text-muted-foreground">
                选择其他文件夹
              </span>
            </Label>
          </div>
        </RadioGroup>
      </CardContent>
    </Card>
  );
}

// ============================================
// 全局设置组件
// ============================================

interface GlobalConflictSettingsProps {
  preference: "keep_original" | "use_ai" | "ask_each";
  onPreferenceChange: (preference: "keep_original" | "use_ai" | "ask_each") => void;
  className?: string;
}

export function GlobalConflictSettings({
  preference,
  onPreferenceChange,
  className,
}: GlobalConflictSettingsProps) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-base">全局冲突处理设置</CardTitle>
      </CardHeader>
      <CardContent>
        <RadioGroup
          value={preference}
          onValueChange={(v) => onPreferenceChange(v as typeof preference)}
          className="space-y-2"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="keep_original" id="global_keep" />
            <Label htmlFor="global_keep">优先保留原始文件夹结构</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="use_ai" id="global_ai" />
            <Label htmlFor="global_ai">优先应用 AI 优化结构</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="ask_each" id="global_ask" />
            <Label htmlFor="global_ask">每个冲突单独询问</Label>
          </div>
        </RadioGroup>
      </CardContent>
    </Card>
  );
}
