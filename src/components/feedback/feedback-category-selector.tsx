"use client";

import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Control } from "react-hook-form";
import type { FeedbackType } from "@/types/user-feedback";

const CATEGORY_OPTIONS: Record<
  FeedbackType,
  { value: string; label: string }[]
> = {
  bug: [
    { value: "ui", label: "界面显示异常" },
    { value: "performance", label: "操作卡顿/慢" },
    { value: "data", label: "数据错误/丢失" },
    { value: "crash", label: "应用崩溃/白屏" },
    { value: "other", label: "其他问题" },
  ],
  complaint: [
    { value: "slow", label: "响应速度太慢" },
    { value: "confusing", label: "操作流程混乱" },
    { value: "missing_feature", label: "缺少必要功能" },
    { value: "quality", label: "内容质量差" },
    { value: "other", label: "其他投诉" },
  ],
  suggestion: [
    { value: "new_feature", label: "新功能提议" },
    { value: "improvement", label: "现有功能改进" },
    { value: "ux", label: "交互体验优化" },
    { value: "integration", label: "第三方集成" },
    { value: "other", label: "其他建议" },
  ],
};

interface FeedbackCategorySelectorProps {
  type: FeedbackType;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  control: Control<any>;
}

export function FeedbackCategorySelector({
  type,
  control,
}: FeedbackCategorySelectorProps) {
  const options = CATEGORY_OPTIONS[type];

  if (!options) return null;

  return (
    <FormField
      control={control}
      name="category"
      render={({ field }) => (
        <FormItem>
          <FormLabel>问题分类</FormLabel>
          <Select onValueChange={field.onChange} defaultValue={field.value}>
            <FormControl>
              <SelectTrigger>
                <SelectValue placeholder="请选择具体分类" />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
