"use client";

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { BrowserBookmarkImportOptions } from "@/lib/browser-bookmark";

interface ImportOptionsProps {
  options: BrowserBookmarkImportOptions;
  onOptionsChange: (options: BrowserBookmarkImportOptions) => void;
  folders: Array<{ id: number; name: string }>;
  disabled?: boolean;
}

export function ImportOptions({
  options,
  onOptionsChange,
  folders,
  disabled = false,
}: ImportOptionsProps) {
  const updateOption = <K extends keyof BrowserBookmarkImportOptions>(
    key: K,
    value: BrowserBookmarkImportOptions[K],
  ) => {
    onOptionsChange({
      ...options,
      [key]: value,
    });
  };

  return (
    <div className="space-y-6">
      {/* 目标文件夹 */}
      <div className="space-y-2">
        <Label htmlFor="target-folder">目标文件夹</Label>
        <Select
          value={options.targetFolderId?.toString() ?? "root"}
          onValueChange={(value) =>
            updateOption(
              "targetFolderId",
              value === "root" ? null : parseInt(value),
            )
          }
          disabled={disabled}
        >
          <SelectTrigger id="target-folder">
            <SelectValue placeholder="选择目标文件夹" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="root">根目录</SelectItem>
            {folders.map((folder) => (
              <SelectItem key={folder.id} value={folder.id.toString()}>
                {folder.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          选择书签导入后的存放位置
        </p>
      </div>

      {/* 开关选项 */}
      <div className="space-y-4">
        {/* 保持文件夹结构 */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="keep-structure">保持原文件夹结构</Label>
            <p className="text-xs text-muted-foreground">
              保留浏览器书签的原始文件夹层级
            </p>
          </div>
          <Switch
            id="keep-structure"
            checked={options.keepFolderStructure}
            onCheckedChange={(checked) =>
              updateOption("keepFolderStructure", checked)
            }
            disabled={disabled}
          />
        </div>

        {/* 覆盖已存在 */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="overwrite">覆盖已存在的 URL</Label>
            <p className="text-xs text-muted-foreground">
              如果 URL 已存在，更新现有书签信息
            </p>
          </div>
          <Switch
            id="overwrite"
            checked={options.overwriteExisting}
            onCheckedChange={(checked) =>
              updateOption("overwriteExisting", checked)
            }
            disabled={disabled}
          />
        </div>

        {/* 自动创建文件夹 - Phase 2 */}
        <div className="flex items-center justify-between opacity-50">
          <div className="space-y-0.5">
            <Label htmlFor="auto-create" className="flex items-center gap-2">
              自动创建文件夹
              <span className="text-xs bg-muted px-1.5 py-0.5 rounded">
                即将推出
              </span>
            </Label>
            <p className="text-xs text-muted-foreground">
              根据浏览器书签结构自动创建 AnyKeep 文件夹
            </p>
          </div>
          <Switch id="auto-create" checked={false} disabled={true} />
        </div>

        {/* 保留原始时间 - Phase 2 */}
        <div className="flex items-center justify-between opacity-50">
          <div className="space-y-0.5">
            <Label htmlFor="preserve-date" className="flex items-center gap-2">
              保留原始添加时间
              <span className="text-xs bg-muted px-1.5 py-0.5 rounded">
                即将推出
              </span>
            </Label>
            <p className="text-xs text-muted-foreground">
              保留浏览器书签的原始添加日期
            </p>
          </div>
          <Switch id="preserve-date" checked={false} disabled={true} />
        </div>

        {/* AI 分类 - Phase 2 */}
        <div className="flex items-center justify-between opacity-50">
          <div className="space-y-0.5">
            <Label htmlFor="ai-classify" className="flex items-center gap-2">
              启用 AI 智能分类
              <span className="text-xs bg-muted px-1.5 py-0.5 rounded">
                即将推出
              </span>
            </Label>
            <p className="text-xs text-muted-foreground">
              导入后使用 AI 自动分类到合适的文件夹
            </p>
          </div>
          <Switch id="ai-classify" checked={false} disabled={true} />
        </div>
      </div>
    </div>
  );
}
