/**
 * 链接修复操作对话框
 * 提供删除、归档、更新URL、忽略等修复选项
 */

"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Trash2,
  Archive,
  Link2,
  EyeOff,
  AlertTriangle,
  ExternalLink,
} from "lucide-react";
import type {
  LinkCheckResult,
  FixAction,
} from "@/lib/ai-skills/skills/link-health-check/types";

interface LinkHealthFixDialogProps {
  /** 是否打开 */
  open: boolean;
  /** 打开状态变更回调 */
  onOpenChange: (open: boolean) => void;
  /** 问题链接 */
  problem: LinkCheckResult | null;
  /** 修复操作回调 */
  onFix: (action: FixAction, newUrl?: string) => void;
}

/** 修复选项配置 */
const FIX_OPTIONS: Array<{
  value: FixAction;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  danger?: boolean;
}> = [
  {
    value: "delete",
    label: "删除书签",
    description: "永久删除此书签",
    icon: Trash2,
    danger: true,
  },
  {
    value: "archive",
    label: "归档书签",
    description: "移至归档文件夹，保留记录",
    icon: Archive,
  },
  {
    value: "update_url",
    label: "更新链接",
    description: "替换为新的有效链接",
    icon: Link2,
  },
  {
    value: "ignore",
    label: "忽略问题",
    description: "标记为已忽略，下次检测跳过",
    icon: EyeOff,
  },
];

export function LinkHealthFixDialog({
  open,
  onOpenChange,
  problem,
  onFix,
}: LinkHealthFixDialogProps) {
  const [selectedAction, setSelectedAction] = useState<FixAction>("archive");
  const [newUrl, setNewUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 重置状态
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setSelectedAction("archive");
      setNewUrl("");
      setIsSubmitting(false);
    }
    onOpenChange(open);
  };

  // 提交修复
  const handleSubmit = async () => {
    if (selectedAction === "update_url" && !newUrl.trim()) {
      return;
    }

    setIsSubmitting(true);
    try {
      await onFix(
        selectedAction,
        selectedAction === "update_url" ? newUrl.trim() : undefined,
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // 使用归档链接
  const handleUseWayback = () => {
    if (problem?.waybackUrl) {
      setNewUrl(problem.waybackUrl);
      setSelectedAction("update_url");
    }
  };

  if (!problem) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="size-5 text-amber-500" />
            修复问题链接
          </DialogTitle>
          <DialogDescription>选择如何处理这个失效的链接</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* 问题链接信息 */}
          <div className="p-3 rounded-lg bg-muted/50 space-y-2">
            <Label className="text-xs text-muted-foreground">问题链接</Label>
            <a
              href={problem.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium hover:underline flex items-center gap-1 break-all"
            >
              {problem.url}
              <ExternalLink className="size-3 flex-shrink-0" />
            </a>
            {problem.errorMessage && (
              <p className="text-xs text-red-500">{problem.errorMessage}</p>
            )}
          </div>

          {/* Wayback 归档提示 */}
          {problem.waybackUrl && (
            <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800">
              <p className="text-sm text-blue-700 dark:text-blue-300 mb-2">
                📚 发现该链接的归档版本
              </p>
              <div className="flex items-center gap-2">
                <a
                  href={problem.waybackUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-500 hover:underline truncate flex-1"
                >
                  {problem.waybackUrl}
                </a>
                <Button variant="outline" size="sm" onClick={handleUseWayback}>
                  使用此链接
                </Button>
              </div>
            </div>
          )}

          {/* 修复选项 */}
          <div className="space-y-3">
            <Label>选择修复方式</Label>
            <RadioGroup
              value={selectedAction}
              onValueChange={(v) => setSelectedAction(v as FixAction)}
              className="space-y-2"
            >
              {FIX_OPTIONS.map((option) => {
                const Icon = option.icon;
                return (
                  <div
                    key={option.value}
                    className={`flex items-start space-x-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedAction === option.value
                        ? "border-primary bg-primary/5"
                        : "border-muted hover:border-muted-foreground/30"
                    }`}
                    onClick={() => setSelectedAction(option.value)}
                  >
                    <RadioGroupItem
                      value={option.value}
                      id={option.value}
                      className="mt-0.5"
                    />
                    <div className="flex-1">
                      <Label
                        htmlFor={option.value}
                        className={`flex items-center gap-2 cursor-pointer ${
                          option.danger ? "text-red-600" : ""
                        }`}
                      >
                        <Icon className="size-4" />
                        {option.label}
                      </Label>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {option.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </RadioGroup>
          </div>

          {/* 新链接输入 */}
          {selectedAction === "update_url" && (
            <div className="space-y-2">
              <Label htmlFor="new-url">新链接地址</Label>
              <Input
                id="new-url"
                type="url"
                placeholder="https://..."
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isSubmitting}
          >
            取消
          </Button>
          <Button
            variant={selectedAction === "delete" ? "destructive" : "default"}
            onClick={handleSubmit}
            disabled={
              isSubmitting ||
              (selectedAction === "update_url" && !newUrl.trim())
            }
          >
            {isSubmitting ? "处理中..." : "确认修复"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
