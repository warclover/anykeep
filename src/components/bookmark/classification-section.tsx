"use client";

import { Tags, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FolderCombobox } from "./folder-combobox";
import { UsageTagSelector } from "./usage-tag-selector";
import type { CustomUsageTag } from "@/types/supabase";

interface ClassificationSectionProps {
  folderId: string;
  setFolderId: (v: string) => void;
  folders: Array<{ id: number; name: string }>;
  selectedUsageTags: string[];
  setSelectedUsageTags: (v: string[]) => void;
  customUsageTags: CustomUsageTag[];
  setCustomUsageTags: (v: CustomUsageTag[]) => void;
  userAddedTags: string[];
  tags: string;
  setTags: (v: string) => void;
  addUserTag: (tag: string) => void;
  removeUserTag: (tag: string) => void;
  isClassificationExpanded: boolean;
  setIsClassificationExpanded: (v: boolean) => void;
  isCustomTagsExpanded: boolean;
  setIsCustomTagsExpanded: (v: boolean) => void;
  isSubmitting: boolean;
  errors: Record<string, string>;
  showExpandedSections: boolean;
}

export function ClassificationSection({
  folderId,
  setFolderId,
  folders,
  selectedUsageTags,
  setSelectedUsageTags,
  customUsageTags,
  setCustomUsageTags,
  userAddedTags,
  tags,
  setTags,
  addUserTag,
  removeUserTag,
  isClassificationExpanded,
  setIsClassificationExpanded,
  isCustomTagsExpanded,
  setIsCustomTagsExpanded,
  isSubmitting,
  errors,
  showExpandedSections,
}: ClassificationSectionProps) {
  return (
    <div
      className={`rounded-lg bg-amber-50/50 transition-all duration-300 ease-out ${
        showExpandedSections
          ? "opacity-100 max-h-[800px]"
          : "opacity-0 max-h-0 overflow-hidden"
      }`}
    >
      <button
        type="button"
        onClick={() => setIsClassificationExpanded(!isClassificationExpanded)}
        className="w-full flex items-center justify-between p-3 text-sm font-medium text-gray-700 hover:bg-amber-100/50 rounded-lg transition-colors"
      >
        <div className="flex items-center gap-2">
          <Tags className="size-4" />
          <span>分类整理</span>
          <span className="text-xs text-muted-foreground font-normal">
            标签与文件夹
          </span>
        </div>
        <ChevronDown
          className={`size-4 transition-transform duration-200 ${
            isClassificationExpanded ? "rotate-180" : ""
          }`}
        />
      </button>

      <div
        className={`px-3 pb-3 space-y-3 transition-all duration-200 ease-out ${
          isClassificationExpanded
            ? "opacity-100 max-h-[600px]"
            : "opacity-0 max-h-0 overflow-hidden"
        }`}
      >
        {folders.length > 0 && (
          <div className="space-y-1.5">
            <Label htmlFor="folder" className="text-gray-600">
              文件夹
            </Label>
            <FolderCombobox
              value={folderId}
              onValueChange={setFolderId}
              folders={folders}
              placeholder="选择文件夹（可选）"
              allowClear={false}
              triggerClassName="bg-white"
            />
          </div>
        )}

        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <Label className="text-gray-600">用途标签</Label>
            <span className="text-xs text-muted-foreground">方便日后筛选</span>
          </div>
          <UsageTagSelector
            selectedTags={selectedUsageTags}
            onSelectedTagsChange={setSelectedUsageTags}
            customUsageTags={customUsageTags}
            onCustomTagsChange={setCustomUsageTags}
            disabled={isSubmitting}
          />
        </div>

        <div className="space-y-1.5">
          {!isCustomTagsExpanded ? (
            <button
              type="button"
              onClick={() => setIsCustomTagsExpanded(true)}
              className="w-full flex items-center justify-between py-2 px-3 text-sm text-gray-500 hover:text-gray-700 hover:bg-amber-100/50 rounded-lg transition-colors border border-dashed border-gray-300 hover:border-gray-400"
            >
              <div className="flex items-center gap-2">
                <span>
                  {userAddedTags.length > 0 ? (
                    <span className="text-gray-700">
                      已添加 {userAddedTags.length} 个标签
                    </span>
                  ) : (
                    "添加自定义标签（可选）"
                  )}
                </span>
              </div>
              <ChevronDown className="size-4" />
            </button>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Label htmlFor="tags" className="text-gray-600">
                    自定义标签
                  </Label>
                  <span className="text-xs text-muted-foreground">
                    可选，保存后自动生成 AI 标签
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCustomTagsExpanded(false)}
                  className="text-xs text-gray-500 hover:text-gray-700"
                >
                  收起
                </button>
              </div>

              {userAddedTags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {userAddedTags.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => removeUserTag(tag)}
                      className="px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-700 border border-blue-300 hover:bg-blue-200 transition-colors flex items-center gap-1"
                    >
                      {tag}
                      <span className="text-blue-500 hover:text-blue-700">
                        ×
                      </span>
                    </button>
                  ))}
                </div>
              )}

              <Input
                id="tags"
                placeholder="输入标签后按回车添加"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const input = e.currentTarget;
                    if (input.value.trim()) {
                      addUserTag(input.value.trim());
                      setTags("");
                    }
                  }
                }}
                className={`bg-white ${errors.userTags ? "border-red-500" : ""}`}
              />
              {errors.userTags && (
                <p className="text-xs text-red-500">{errors.userTags}</p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
