/**
 * 过期内容 Tab 组件
 */

"use client";

import { useState } from "react";
import {
  Clock,
  Archive,
  Trash2,
  Star,
  EyeOff,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { useStaleContent, useHealthFix } from "@/hooks/domain/health";
import type { StaleContentItem } from "@/lib/ai-skills/skills/health-check/types";

// ============================================
// 文本常量
// ============================================

const TAB_TEXT = {
  empty: {
    title: "没有过期内容",
    description: "所有内容都保持活跃",
  },
  filter: {
    label: "过期阈值",
    options: {
      30: "30 天未访问",
      60: "60 天未访问",
      90: "90 天未访问",
    },
  },
  actions: {
    archive: "归档选中",
    delete: "删除选中",
    markImportant: "标记重要",
    ignore: "忽略选中",
    selectAll: "全选",
  },
  severity: {
    low: "轻度过期",
    medium: "中度过期",
    high: "严重过期",
  },
};

// ============================================
// 单个过期项组件
// ============================================

interface StaleItemProps {
  item: StaleContentItem;
  selected: boolean;
  onSelect: (id: string, selected: boolean) => void;
}

function StaleItem({ item, selected, onSelect }: StaleItemProps) {
  const severityLabel = TAB_TEXT.severity[item.severity];
  const severityColor = {
    low: "bg-yellow-100 text-yellow-800",
    medium: "bg-orange-100 text-orange-800",
    high: "bg-red-100 text-red-800",
  }[item.severity];

  return (
    <div className="flex items-start gap-3 p-4 border rounded-lg hover:bg-accent/50 transition-colors">
      <Checkbox
        checked={selected}
        onCheckedChange={(checked) =>
          onSelect(item.bookmarkId, checked as boolean)
        }
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h4 className="font-medium truncate">{item.title || "无标题"}</h4>
          <Badge className={severityColor}>{severityLabel}</Badge>
        </div>
        <p className="text-sm text-muted-foreground truncate mt-1">
          {item.url}
        </p>
        <div className="flex gap-4 text-xs text-muted-foreground mt-2">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {item.daysSinceAccess} 天未访问
          </span>
          <span>访问次数：{item.accessCount}</span>
          {item.folderName && <span>文件夹：{item.folderName}</span>}
        </div>
      </div>
    </div>
  );
}

// ============================================
// 主组件
// ============================================

interface StaleContentTabProps {
  onUpdate: () => void;
}

export function StaleContentTab({ onUpdate }: StaleContentTabProps) {
  const [days, setDays] = useState(90);
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);

  const { staleContent, total, isLoading, error, refresh } = useStaleContent(
    days,
    page,
  );
  const { fixStaleContent } = useHealthFix();

  const handleSelect = (id: string, selected: boolean) => {
    const newSelected = new Set(selectedIds);
    if (selected) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedIds(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedIds.size === staleContent.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(staleContent.map((item) => item.bookmarkId)));
    }
  };

  const handleAction = async (action: string) => {
    if (selectedIds.size === 0) {
      toast.error("请先选择要处理的内容");
      return;
    }

    setIsProcessing(true);
    try {
      await fixStaleContent(action, Array.from(selectedIds));
      setSelectedIds(new Set());
      refresh();
      onUpdate();

      const messages: Record<string, string> = {
        archive: "已归档选中的内容",
        delete: "已删除选中的内容",
        mark_important: "已标记为重要",
        ignore: "已忽略选中的内容",
      };
      toast.success(messages[action] || "操作成功");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "操作失败");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDaysChange = (value: string) => {
    setDays(parseInt(value));
    setPage(1);
    setSelectedIds(new Set());
  };

  // 加载状态
  if (isLoading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // 错误状态
  if (error) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <AlertCircle className="mx-auto h-8 w-8 text-red-500" />
          <p className="mt-2 text-sm text-muted-foreground">{error}</p>
        </CardContent>
      </Card>
    );
  }

  // 空状态
  if (staleContent.length === 0) {
    return (
      <div className="space-y-4">
        {/* 过滤器 */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {TAB_TEXT.filter.label}：
          </span>
          <Select value={String(days)} onValueChange={handleDaysChange}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(TAB_TEXT.filter.options).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Card>
          <CardContent className="py-12 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-green-500" />
            <h3 className="mt-4 text-lg font-medium">{TAB_TEXT.empty.title}</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {TAB_TEXT.empty.description}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 过滤器和操作栏 */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {TAB_TEXT.filter.label}：
            </span>
            <Select value={String(days)} onValueChange={handleDaysChange}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(TAB_TEXT.filter.options).map(
                  ([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" size="sm" onClick={handleSelectAll}>
            {selectedIds.size === staleContent.length
              ? "取消全��"
              : TAB_TEXT.actions.selectAll}
          </Button>
          <span className="text-sm text-muted-foreground">
            已选 {selectedIds.size} / {total} 项
          </span>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleAction("mark_important")}
            disabled={selectedIds.size === 0 || isProcessing}
          >
            <Star className="mr-1 h-4 w-4" />
            {TAB_TEXT.actions.markImportant}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleAction("archive")}
            disabled={selectedIds.size === 0 || isProcessing}
          >
            <Archive className="mr-1 h-4 w-4" />
            {TAB_TEXT.actions.archive}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleAction("ignore")}
            disabled={selectedIds.size === 0 || isProcessing}
          >
            <EyeOff className="mr-1 h-4 w-4" />
            {TAB_TEXT.actions.ignore}
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => handleAction("delete")}
            disabled={selectedIds.size === 0 || isProcessing}
          >
            {isProcessing ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="mr-1 h-4 w-4" />
            )}
            {TAB_TEXT.actions.delete}
          </Button>
        </div>
      </div>

      {/* 内容列表 */}
      <div className="space-y-2">
        {staleContent.map((item) => (
          <StaleItem
            key={item.bookmarkId}
            item={item}
            selected={selectedIds.has(item.bookmarkId)}
            onSelect={handleSelect}
          />
        ))}
      </div>

      {/* 分页 */}
      {total > 20 && (
        <div className="flex justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            上一页
          </Button>
          <span className="flex items-center text-sm text-muted-foreground">
            第 {page} 页
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => p + 1)}
            disabled={page * 20 >= total}
          >
            下一页
          </Button>
        </div>
      )}
    </div>
  );
}
