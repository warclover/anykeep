/**
 * 智能列表快速保存组件
 * @description 当有活跃筛选条件时，允许用户快速将其保存为智能列表
 * @version 10.0.0
 */

"use client";

import { useState, useCallback } from "react";
import { Save, Loader2, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSmartLists } from "@/hooks/use-smart-lists";
import type { SmartListFilters } from "@/types/smart-list";

// ============================================
// 类型定义
// ============================================

export interface SmartListQuickSaveProps {
  /** 当前活跃的筛选条件 */
  filters: SmartListFilters;
  /** 是否显示（当有活跃筛选时显示） */
  visible?: boolean;
  /** 保存成功后的回调 */
  onSaved?: () => void;
}

// ============================================
// 组件实现
// ============================================

export function SmartListQuickSave({
  filters,
  visible = true,
  onSaved,
}: SmartListQuickSaveProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const { create } = useSmartLists();

  // 检查是否有有效的筛选条件
  const hasActiveFilters = useCallback(() => {
    if (!filters) return false;

    return (
      (filters.platform && filters.platform.length > 0) ||
      (filters.usageTags && filters.usageTags.length > 0) ||
      (filters.aiTags && filters.aiTags.length > 0) ||
      filters.dateRange !== undefined ||
      filters.isRead !== undefined ||
      filters.isStarred !== undefined ||
      filters.isHighValue !== undefined ||
      filters.folderId !== undefined ||
      filters.rating !== undefined ||
      (filters.contentType && filters.contentType.length > 0) ||
      filters.keyword !== undefined
    );
  }, [filters]);

  // 生成默认名称
  const generateDefaultName = useCallback(() => {
    const parts: string[] = [];

    if (filters.usageTags && filters.usageTags.length > 0) {
      parts.push(filters.usageTags[0]);
    }
    if (filters.isStarred) {
      parts.push("星标");
    }
    if (filters.isHighValue) {
      parts.push("高价值");
    }
    if (filters.isRead === false) {
      parts.push("待阅读");
    }
    if (filters.dateRange) {
      if (filters.dateRange.type === "relative" && filters.dateRange.value) {
        const unit =
          filters.dateRange.unit === "day"
            ? "天"
            : filters.dateRange.unit === "week"
              ? "周"
              : filters.dateRange.unit === "month"
                ? "月"
                : "年";
        parts.push(`最近${filters.dateRange.value}${unit}`);
      }
    }

    return parts.length > 0 ? parts.join(" + ") : "我的智能列表";
  }, [filters]);

  // 打开保存对话框
  const handleOpenDialog = useCallback(() => {
    setName(generateDefaultName());
    setIsDialogOpen(true);
  }, [generateDefaultName]);

  // 保存智能列表
  const handleSave = useCallback(async () => {
    if (!name.trim()) {
      toast.error("请输入智能列表名称");
      return;
    }

    setIsSaving(true);
    try {
      await create({
        name: name.trim(),
        filters,
        icon: "filter",
        color: "default",
        sortBy: "created_desc",
      });

      toast.success("智能列表已创建", {
        description: `"${name}" 已添加到侧边栏`,
      });

      setIsDialogOpen(false);
      setName("");
      onSaved?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "创建失败");
    } finally {
      setIsSaving(false);
    }
  }, [name, filters, create, onSaved]);

  // 不显示条件：无筛选条件或 visible=false
  if (!visible || !hasActiveFilters()) {
    return null;
  }

  return (
    <>
      {/* 快速保存按钮 */}
      <Button
        variant="outline"
        size="sm"
        onClick={handleOpenDialog}
        className="gap-1.5 text-xs h-7 px-2.5"
      >
        <Save className="size-3.5" />
        <span className="hidden sm:inline">保存为智能列表</span>
        <span className="sm:hidden">保存</span>
      </Button>

      {/* 保存对话框 */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>保存为智能列表</DialogTitle>
            <DialogDescription>
              将当前筛选条件保存为智能列表，方便下次快速访问
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="smart-list-name">名称</Label>
              <Input
                id="smart-list-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="输入智能列表名称"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !isSaving) {
                    handleSave();
                  }
                }}
              />
            </div>

            {/* 筛选条件预览 */}
            <div className="space-y-2">
              <Label className="text-gray-500">包含的筛选条件</Label>
              <div className="flex flex-wrap gap-1.5">
                {filters.usageTags?.map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded-full"
                  >
                    {tag}
                  </span>
                ))}
                {filters.isStarred && (
                  <span className="px-2 py-0.5 text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 rounded-full">
                    星标
                  </span>
                )}
                {filters.isHighValue && (
                  <span className="px-2 py-0.5 text-xs bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 rounded-full">
                    高价值
                  </span>
                )}
                {filters.isRead === false && (
                  <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-full">
                    待阅读
                  </span>
                )}
                {filters.dateRange && (
                  <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400 rounded-full">
                    时间范围
                  </span>
                )}
                {filters.platform && (
                  <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400 rounded-full">
                    {Array.isArray(filters.platform)
                      ? `${filters.platform.length} 个平台`
                      : "平台筛选"}
                  </span>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
              disabled={isSaving}
            >
              取消
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="size-4 mr-1.5 animate-spin" />
                  保存中...
                </>
              ) : (
                <>
                  <Check className="size-4 mr-1.5" />
                  保存
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default SmartListQuickSave;
