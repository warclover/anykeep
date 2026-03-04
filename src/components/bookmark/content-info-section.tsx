"use client";

import { FileText, Sparkles, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface ContentInfoSectionProps {
  title: string;
  setTitle: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  isDescriptionExpanded: boolean;
  setIsDescriptionExpanded: (v: boolean) => void;
  autoFilledFields: Set<string>;
  markFieldAsModified: (field: string) => void;
  errors: Record<string, string>;
  showExpandedSections: boolean;
}

export function ContentInfoSection({
  title,
  setTitle,
  description,
  setDescription,
  isDescriptionExpanded,
  setIsDescriptionExpanded,
  autoFilledFields,
  markFieldAsModified,
  errors,
  showExpandedSections,
}: ContentInfoSectionProps) {
  const renderAutoFilledBadge = (field: string) => {
    if (!autoFilledFields.has(field)) return null;
    return (
      <span className="ml-2 text-xs text-green-600 font-normal flex items-center gap-1">
        <Sparkles className="size-3" />
        已自动填充
      </span>
    );
  };

  return (
    <div
      className={`rounded-lg bg-blue-50/50 p-3 space-y-3 transition-all duration-300 ease-out ${
        showExpandedSections
          ? "opacity-100 max-h-[500px]"
          : "opacity-0 max-h-0 overflow-hidden p-0"
      }`}
    >
      <div className="flex items-center gap-2 text-sm font-medium text-gray-700 flex-wrap">
        <FileText className="size-4" />
        <span>标题与内容</span>
        {autoFilledFields.has("title") && (
          <span className="text-xs text-green-600 font-normal flex items-center gap-1">
            <Sparkles className="size-3" />
            已自动填充
          </span>
        )}
        <span className="text-xs text-muted-foreground font-normal">
          留空时自动获取
        </span>
      </div>

      <div className="space-y-1.5">
        <Input
          id="title"
          placeholder="可选，保存后自动获取"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            markFieldAsModified("title");
          }}
          className={`bg-white ${errors.title ? "border-red-500" : ""}`}
        />
        {errors.title && <p className="text-xs text-red-500">{errors.title}</p>}
      </div>

      <div className="space-y-1.5">
        {!isDescriptionExpanded ? (
          <button
            type="button"
            onClick={() => setIsDescriptionExpanded(true)}
            className="w-full flex items-center justify-between py-2 px-3 text-sm text-gray-500 hover:text-gray-700 hover:bg-blue-100/50 rounded-lg transition-colors border border-dashed border-gray-300 hover:border-gray-400"
          >
            <div className="flex items-center gap-2">
              <span>
                {description ? (
                  <span className="text-gray-700 line-clamp-1">
                    {description.length > 50
                      ? description.slice(0, 50) + "..."
                      : description}
                  </span>
                ) : (
                  "添加描述（可选）"
                )}
              </span>
              {autoFilledFields.has("description") && (
                <span className="text-xs text-green-600 flex items-center gap-1">
                  <Sparkles className="size-3" />
                  已自动填充
                </span>
              )}
            </div>
            <ChevronDown className="size-4" />
          </button>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Label
                  htmlFor="description"
                  className="flex items-center text-gray-600"
                >
                  描述
                  {renderAutoFilledBadge("description")}
                </Label>
                <span className="text-xs text-muted-foreground">
                  保存后自动生成 AI 摘要
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsDescriptionExpanded(false)}
                className="text-xs text-gray-500 hover:text-gray-700"
              >
                收起
              </button>
            </div>
            <Textarea
              id="description"
              placeholder="简单描述这篇内容..."
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                markFieldAsModified("description");
              }}
              rows={2}
              className={`bg-white ${errors.description ? "border-red-500" : ""}`}
            />
            {errors.description && (
              <p className="text-xs text-red-500">{errors.description}</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
