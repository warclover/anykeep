/**
 * 失效链接 Tab 组件
 */

"use client";

import { useState } from "react";
import {
  ExternalLink,
  Trash2,
  EyeOff,
  Archive,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";

import { useBrokenLinks, useHealthFix } from "@/hooks/domain/health";
import type { BrokenLinkIssue } from "@/lib/ai-skills/skills/health-check/types";

// ============================================
// 文本常量
// ============================================

const TAB_TEXT = {
  empty: {
    title: "没有失效链接",
    description: "所有链接都正常可访问",
  },
  actions: {
    delete: "删除选中",
    ignore: "忽略选中",
    selectAll: "全选",
  },
  errorTypes: {
    http_error: "HTTP 错误",
    timeout: "请求超时",
    dns_error: "域名无法解析",
    ssl_error: "SSL 证书错误",
    connection_refused: "连接被拒绝",
    unknown: "未知错误",
  },
};

// ============================================
// 单个链接项组件
// ============================================

interface BrokenLinkItemProps {
  item: BrokenLinkIssue;
  selected: boolean;
  onSelect: (id: string, selected: boolean) => void;
}

function BrokenLinkItem({ item, selected, onSelect }: BrokenLinkItemProps) {
  const errorLabel =
    TAB_TEXT.errorTypes[item.errorType] || TAB_TEXT.errorTypes.unknown;

  return (
    <div className="flex items-start gap-3 p-4 border rounded-lg hover:bg-accent/50 transition-colors">
      <Checkbox
        checked={selected}
        onCheckedChange={(checked) => onSelect(item.id, checked as boolean)}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h4 className="font-medium truncate">{item.title || "无标题"}</h4>
          <Badge variant="destructive" className="text-xs">
            {errorLabel}
          </Badge>
          {item.httpStatus && (
            <Badge variant="outline" className="text-xs">
              {item.httpStatus}
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground truncate mt-1">
          {item.url}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          检测时间：
          {item.detectedAt
            ? new Date(item.detectedAt).toLocaleString("zh-CN")
            : "未知"}
        </p>
      </div>
      <div className="flex gap-1">
        {item.waybackUrl && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => window.open(item.waybackUrl, "_blank")}
            title="查看归档版本"
          >
            <Archive className="h-4 w-4" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => window.open(item.url, "_blank")}
          title="尝试打开链接"
        >
          <ExternalLink className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ============================================
// 主组件
// ============================================

interface BrokenLinksTabProps {
  onUpdate: () => void;
}

export function BrokenLinksTab({ onUpdate }: BrokenLinksTabProps) {
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);

  const { brokenLinks, total, isLoading, error, refresh } =
    useBrokenLinks(page);
  const { fixBrokenLinks } = useHealthFix();

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
    if (selectedIds.size === brokenLinks.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(brokenLinks.map((item) => item.id)));
    }
  };

  const handleAction = async (action: "delete" | "ignore") => {
    if (selectedIds.size === 0) {
      toast.error("请先选择要处理的链接");
      return;
    }

    setIsProcessing(true);
    try {
      await fixBrokenLinks(action, Array.from(selectedIds));
      setSelectedIds(new Set());
      refresh();
      onUpdate();
      toast.success(
        action === "delete" ? "已删除选中的书签" : "已忽略选中的链接",
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "操作失败");
    } finally {
      setIsProcessing(false);
    }
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
  if (brokenLinks.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-green-500" />
          <h3 className="mt-4 text-lg font-medium">{TAB_TEXT.empty.title}</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            {TAB_TEXT.empty.description}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* 操作栏 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleSelectAll}>
            {selectedIds.size === brokenLinks.length
              ? "取消全选"
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

      {/* 链接列表 */}
      <div className="space-y-2">
        {brokenLinks.map((item) => (
          <BrokenLinkItem
            key={item.id}
            item={item}
            selected={selectedIds.has(item.id)}
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
