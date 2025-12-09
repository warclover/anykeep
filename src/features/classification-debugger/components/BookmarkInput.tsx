"use client";

/**
 * 智能分类调试工具 - 书签输入组件
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { BookmarkPlus } from "lucide-react";
import type { DebugBookmarkInput } from "../types";

interface BookmarkInputProps {
  value: DebugBookmarkInput;
  onChange: (value: DebugBookmarkInput) => void;
  disabled?: boolean;
}

export function BookmarkInput({
  value,
  onChange,
  disabled = false,
}: BookmarkInputProps) {
  const handleChange = (
    field: keyof DebugBookmarkInput,
    fieldValue: string,
  ) => {
    onChange({
      ...value,
      [field]: fieldValue,
    });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <BookmarkPlus className="w-5 h-5" />
          测试书签输入
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="url">URL</Label>
          <Input
            id="url"
            type="url"
            placeholder="https://example.com/article"
            value={value.url}
            onChange={(e) => handleChange("url", e.target.value)}
            disabled={disabled}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="title">标题</Label>
          <Input
            id="title"
            placeholder="文章标题"
            value={value.title}
            onChange={(e) => handleChange("title", e.target.value)}
            disabled={disabled}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">描述（可选）</Label>
          <Textarea
            id="description"
            placeholder="可选的描述信息"
            value={value.description || ""}
            onChange={(e) => handleChange("description", e.target.value)}
            disabled={disabled}
            rows={2}
          />
        </div>
      </CardContent>
    </Card>
  );
}
