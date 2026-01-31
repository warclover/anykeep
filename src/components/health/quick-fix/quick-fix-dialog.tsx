/**
 * 一键修复对话框
 */

"use client";

import { useState } from "react";
import { Wrench, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

import { useHealthFix } from "@/hooks/domain/health";
import type {
  HealthOverview,
  QuickFixStrategy,
} from "@/lib/ai-skills/skills/health-check/types";

// ============================================
// 文本常量
// ============================================

const DIALOG_TEXT = {
  title: "一键修复",
  description: "选择修复策略，批量处理所有健康问题",
  preview: "预览",
  execute: "���行修复",
  cancel: "取消",
  strategies: {
    brokenLinks: {
      label: "失效链接",
      options: {
        delete: "删除",
        ignore: "忽略",
        skip: "跳过",
      },
    },
    duplicates: {
      label: "重复内容",
      options: {
        keep_oldest: "保留最早创建的",
        keep_newest: "保留最新创建的",
        keep_most_complete: "保留最完整的",
        skip: "跳过",
      },
    },
    staleContent: {
      label: "过期内容",
      options: {
        archive: "归档",
        delete: "删除",
        ignore: "忽略",
        skip: "跳过",
      },
    },
  },
  previewResult: {
    toDelete: "将删除",
    toArchive: "将归档",
    toMerge: "将合并",
  },
  result: {
    deleted: "已删除",
    archived: "已归档",
    merged: "已合并",
    ignored: "已忽略",
  },
};

// ============================================
// 主组件
// ============================================

interface QuickFixDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  overview: HealthOverview;
  onComplete: () => void;
}

export function QuickFixDialog({
  open,
  onOpenChange,
  overview,
  onComplete,
}: QuickFixDialogProps) {
  const [strategy, setStrategy] = useState<QuickFixStrategy>({
    brokenLinks: "delete",
    duplicates: "keep_most_complete",
    staleContent: "archive",
  });
  const [preview, setPreview] = useState<{
    toDelete: number;
    toArchive: number;
    toMerge: number;
  } | null>(null);
  const [result, setResult] = useState<{
    deleted: number;
    archived: number;
    merged: number;
    ignored: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<"config" | "preview" | "result">("config");

  const { quickFix } = useHealthFix();

  const handlePreview = async () => {
    setIsLoading(true);
    try {
      const data = await quickFix(
        strategy as unknown as Record<string, string>,
        true,
      );
      setPreview(data.preview);
      setStep("preview");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "预览失败");
    } finally {
      setIsLoading(false);
    }
  };

  const handleExecute = async () => {
    setIsLoading(true);
    try {
      const data = await quickFix(
        strategy as unknown as Record<string, string>,
        false,
      );
      setResult(data);
      setStep("result");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "修复失败");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (step === "result") {
      onComplete();
    }
    onOpenChange(false);
    // 重置状态
    setTimeout(() => {
      setStep("config");
      setPreview(null);
      setResult(null);
    }, 300);
  };

  const updateStrategy = (key: keyof QuickFixStrategy, value: string) => {
    setStrategy((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5" />
            {DIALOG_TEXT.title}
          </DialogTitle>
          <DialogDescription>{DIALOG_TEXT.description}</DialogDescription>
        </DialogHeader>

        {/* 配置步骤 */}
        {step === "config" && (
          <div className="space-y-4">
            {/* 失效链接策略 */}
            {overview.brokenLinks > 0 && (
              <div className="space-y-2">
                <Label>
                  {DIALOG_TEXT.strategies.brokenLinks.label} (
                  {overview.brokenLinks})
                </Label>
                <Select
                  value={strategy.brokenLinks}
                  onValueChange={(v) => updateStrategy("brokenLinks", v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(
                      DIALOG_TEXT.strategies.brokenLinks.options,
                    ).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* 重复内容策略 */}
            {overview.duplicates > 0 && (
              <div className="space-y-2">
                <Label>
                  {DIALOG_TEXT.strategies.duplicates.label} (
                  {overview.duplicates} 组)
                </Label>
                <Select
                  value={strategy.duplicates}
                  onValueChange={(v) =>
                    updateStrategy(
                      "duplicates",
                      v as QuickFixStrategy["duplicates"],
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(
                      DIALOG_TEXT.strategies.duplicates.options,
                    ).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* 过期内容策略 */}
            {overview.staleContent > 0 && (
              <div className="space-y-2">
                <Label>
                  {DIALOG_TEXT.strategies.staleContent.label} (
                  {overview.staleContent})
                </Label>
                <Select
                  value={strategy.staleContent}
                  onValueChange={(v) => updateStrategy("staleContent", v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(
                      DIALOG_TEXT.strategies.staleContent.options,
                    ).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        )}

        {/* 预览步骤 */}
        {step === "preview" && preview && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-yellow-600">
              <AlertTriangle className="h-5 w-5" />
              <span className="font-medium">请确认以下操作</span>
            </div>
            <Separator />
            <div className="space-y-2 text-sm">
              {preview.toDelete > 0 && (
                <p>
                  {DIALOG_TEXT.previewResult.toDelete}：{preview.toDelete} 项
                </p>
              )}
              {preview.toArchive > 0 && (
                <p>
                  {DIALOG_TEXT.previewResult.toArchive}：{preview.toArchive} 项
                </p>
              )}
              {preview.toMerge > 0 && (
                <p>
                  {DIALOG_TEXT.previewResult.toMerge}：{preview.toMerge} 组
                </p>
              )}
            </div>
          </div>
        )}

        {/* 结果步骤 */}
        {step === "result" && result && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="h-5 w-5" />
              <span className="font-medium">修复完成</span>
            </div>
            <Separator />
            <div className="space-y-2 text-sm">
              {result.deleted > 0 && (
                <p>
                  {DIALOG_TEXT.result.deleted}：{result.deleted} 项
                </p>
              )}
              {result.archived > 0 && (
                <p>
                  {DIALOG_TEXT.result.archived}：{result.archived} 项
                </p>
              )}
              {result.merged > 0 && (
                <p>
                  {DIALOG_TEXT.result.merged}：{result.merged} 组
                </p>
              )}
              {result.ignored > 0 && (
                <p>
                  {DIALOG_TEXT.result.ignored}：{result.ignored} 项
                </p>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          {step === "config" && (
            <>
              <Button variant="outline" onClick={handleClose}>
                {DIALOG_TEXT.cancel}
              </Button>
              <Button onClick={handlePreview} disabled={isLoading}>
                {isLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                {DIALOG_TEXT.preview}
              </Button>
            </>
          )}
          {step === "preview" && (
            <>
              <Button variant="outline" onClick={() => setStep("config")}>
                返回
              </Button>
              <Button onClick={handleExecute} disabled={isLoading}>
                {isLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                {DIALOG_TEXT.execute}
              </Button>
            </>
          )}
          {step === "result" && <Button onClick={handleClose}>完成</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
