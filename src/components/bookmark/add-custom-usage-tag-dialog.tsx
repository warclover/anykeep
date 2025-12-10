/**
 * 添加自定义用途标签弹窗组件
 * 支持输入标签名和选择颜色
 */

"use client";

import { useState, useCallback } from "react";
import { Loader2, Check } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { CUSTOM_TAG_COLOR_LIST } from "@/types/supabase";
import type { CustomUsageTag, CustomTagColor } from "@/types/supabase";
import { CUSTOM_USAGE_TAG_LIMIT } from "@/types/supabase";
import {
  validateCustomTagValue,
  getColorDisplayName,
  CUSTOM_TAG_COLOR_STYLES,
  COLOR_PICKER_BUTTON_STYLES,
} from "@/lib/constants/usage-tags";

interface AddCustomUsageTagDialogProps {
  /** 是否打开 */
  open: boolean;
  /** 打开状态变化回调 */
  onOpenChange: (open: boolean) => void;
  /** 现有的自定义标签列表 */
  existingTags: CustomUsageTag[];
  /** 创建成功回调 */
  onSuccess: (newTag: CustomUsageTag, allTags: CustomUsageTag[]) => void;
}

export function AddCustomUsageTagDialog({
  open,
  onOpenChange,
  existingTags,
  onSuccess,
}: AddCustomUsageTagDialogProps) {
  const [value, setValue] = useState("");
  const [color, setColor] = useState<CustomTagColor>("blue");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string>("");

  // 检查是否达到数量限制
  const isLimitReached = existingTags.length >= CUSTOM_USAGE_TAG_LIMIT;
  const remainingSlots = CUSTOM_USAGE_TAG_LIMIT - existingTags.length;

  /**
   * 重置表单
   */
  const resetForm = useCallback(() => {
    setValue("");
    setColor("blue");
    setError("");
  }, []);

  /**
   * 处理输入变化
   */
  const handleValueChange = (newValue: string) => {
    setValue(newValue);
    // 实时验证
    if (newValue.trim()) {
      const validation = validateCustomTagValue(newValue, existingTags);
      setError(validation.valid ? "" : validation.error || "");
    } else {
      setError("");
    }
  };

  /**
   * 提交创建
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 最终验证
    const validation = validateCustomTagValue(value, existingTags);
    if (!validation.valid) {
      setError(validation.error || "标签值无效");
      return;
    }

    if (isLimitReached) {
      setError(`已达到最大数量限制（${CUSTOM_USAGE_TAG_LIMIT}个）`);
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/settings/usage-tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: value.trim(), color }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || "创建失败");
      }

      toast.success(`已创建用途标签「${value.trim()}」`);
      onSuccess(data.data.tag, data.data.customUsageTags);
      resetForm();
    } catch (err) {
      const message = err instanceof Error ? err.message : "创建失败";
      setError(message);
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * 关闭弹窗
   */
  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>添加自定义用途标签</DialogTitle>
          <DialogDescription>
            创建属于你自己的用途标签，帮助更好地管理收藏
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* 标签名称输入 */}
          <div className="space-y-2">
            <Label htmlFor="tagValue">
              标签名称 <span className="text-red-500">*</span>
            </Label>
            <Input
              id="tagValue"
              placeholder="例如：写作素材、学习资料..."
              value={value}
              onChange={(e) => handleValueChange(e.target.value)}
              disabled={isSubmitting || isLimitReached}
              maxLength={20}
              className={error ? "border-red-500" : ""}
            />
            <div className="flex justify-between text-xs">
              <span className={error ? "text-red-500" : "text-gray-500"}>
                {error || `最多 20 个字符`}
              </span>
              <span className="text-gray-400">{value.length}/20</span>
            </div>
          </div>

          {/* 颜色选择 */}
          <div className="space-y-2">
            <Label>标签颜色</Label>
            <div className="flex flex-wrap gap-2">
              {CUSTOM_TAG_COLOR_LIST.map((c) => {
                const isSelected = color === c;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    disabled={isSubmitting}
                    className={cn(
                      "relative w-8 h-8 rounded-full transition-all duration-200",
                      "focus:outline-none focus:ring-2 focus:ring-offset-2",
                      COLOR_PICKER_BUTTON_STYLES[c],
                      isSelected && "ring-2 ring-offset-2 ring-gray-400",
                      "hover:scale-110",
                    )}
                    title={getColorDisplayName(c)}
                  >
                    {isSelected && (
                      <Check className="absolute inset-0 m-auto size-4 text-white" />
                    )}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-gray-500">
              选择颜色：{getColorDisplayName(color)}
            </p>
          </div>

          {/* 预览 */}
          {value.trim() && (
            <div className="space-y-2">
              <Label>预览效果</Label>
              <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                <PreviewTag value={value.trim()} color={color} />
              </div>
            </div>
          )}

          {/* 数量限制提示 */}
          <div className="text-xs text-gray-500">
            {isLimitReached ? (
              <span className="text-amber-600">
                已达到最大数量限制（{CUSTOM_USAGE_TAG_LIMIT}个）
              </span>
            ) : (
              <span>
                还可创建 {remainingSlots} 个自定义标签（上限{" "}
                {CUSTOM_USAGE_TAG_LIMIT} 个）
              </span>
            )}
          </div>
        </form>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={isSubmitting}
          >
            取消
          </Button>
          <Button
            type="submit"
            onClick={handleSubmit}
            disabled={
              isSubmitting || !value.trim() || !!error || isLimitReached
            }
          >
            {isSubmitting ? (
              <>
                <Loader2 className="size-4 mr-2 animate-spin" />
                创建中...
              </>
            ) : (
              "创建标签"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * 标签预览组件
 */
function PreviewTag({
  value,
  color,
}: {
  value: string;
  color: CustomTagColor;
}) {
  const style = CUSTOM_TAG_COLOR_STYLES[color] || CUSTOM_TAG_COLOR_STYLES.blue!;

  return (
    <span
      className={cn(
        "inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium",
        "border transition-all",
        style.bgLight,
        style.bgDark,
        style.borderLight,
        style.borderDark,
        style.textLight,
        style.textDark,
      )}
    >
      {value}
    </span>
  );
}
