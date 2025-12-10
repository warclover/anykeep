/**
 * v3对比v4 - 测试输入卡片
 */

"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BookmarkPlus, X, Plus } from "lucide-react";
import { useState } from "react";
import type { TestBookmarkInput } from "../types";

interface TestInputCardProps {
  value: TestBookmarkInput;
  onChange: (value: TestBookmarkInput) => void;
  disabled?: boolean;
}

export function TestInputCard({
  value,
  onChange,
  disabled = false,
}: TestInputCardProps) {
  const [tagInput, setTagInput] = useState("");

  const handleChange = (
    field: keyof TestBookmarkInput,
    fieldValue: string | string[],
  ) => {
    onChange({
      ...value,
      [field]: fieldValue,
    });
  };

  const addTag = () => {
    const tag = tagInput.trim();
    if (tag && !value.tags?.includes(tag)) {
      handleChange("tags", [...(value.tags || []), tag]);
      setTagInput("");
    }
  };

  const removeTag = (tagToRemove: string) => {
    handleChange(
      "tags",
      (value.tags || []).filter((t) => t !== tagToRemove),
    );
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <BookmarkPlus className="w-4 h-4" />
          测试输入
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="url">URL *</Label>
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
            <Label htmlFor="title">标题 *</Label>
            <Input
              id="title"
              placeholder="文章标题"
              value={value.title}
              onChange={(e) => handleChange("title", e.target.value)}
              disabled={disabled}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">描述</Label>
          <Textarea
            id="description"
            placeholder="文章摘要或描述信息"
            value={value.description || ""}
            onChange={(e) => handleChange("description", e.target.value)}
            disabled={disabled}
            rows={2}
          />
        </div>

        <div className="space-y-2">
          <Label>标签</Label>
          <div className="flex gap-2">
            <Input
              placeholder="添加标签"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) =>
                e.key === "Enter" && (e.preventDefault(), addTag())
              }
              disabled={disabled}
              className="flex-1"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={addTag}
              disabled={disabled || !tagInput.trim()}
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>
          {value.tags && value.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {value.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="gap-1">
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    disabled={disabled}
                    className="hover:text-destructive"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
