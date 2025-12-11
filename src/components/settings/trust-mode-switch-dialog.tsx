/**
 * Trust Mode Switch Confirmation Dialog
 * V4.2 托管模式切换确认对话框
 *
 * @description 在用户切换托管模式时显示确认对话框
 * - 显示模式变化影响
 * - 提供迁移选项
 * - 确认后执行切换
 *
 * @version 1.0.0
 * @since 2025-12-11
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
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Zap,
  UserCheck,
  Hand,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { TrustMode } from "@/types/trust-mode";

// ============================================================================
// 类型定义
// ============================================================================

interface TrustModeSwitchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentMode: TrustMode;
  targetMode: TrustMode;
  pendingConfirmationsCount?: number;
  onConfirm: (options: SwitchOptions) => Promise<void>;
}

interface SwitchOptions {
  processPendingAs: "keep" | "auto_execute" | "discard";
  preserveLearning: boolean;
}

// ============================================================================
// 模式配置
// ============================================================================

const MODE_INFO: Record<
  TrustMode,
  {
    label: string;
    icon: React.ElementType;
    iconColor: string;
    description: string;
  }
> = {
  full_auto: {
    label: "全自动",
    icon: Zap,
    iconColor: "text-green-500",
    description: "AI 全权处理所有分类决策",
  },
  semi_auto: {
    label: "半自动",
    icon: UserCheck,
    iconColor: "text-blue-500",
    description: "低置信度需确认，高置信度自动处理",
  },
  manual: {
    label: "手动",
    icon: Hand,
    iconColor: "text-orange-500",
    description: "仅整理到待整理，不自动分类",
  },
};

// ============================================================================
// 迁移影响分析
// ============================================================================

interface MigrationImpact {
  type: "positive" | "negative" | "neutral";
  message: string;
}

function getMigrationImpacts(
  from: TrustMode,
  to: TrustMode,
): MigrationImpact[] {
  const impacts: MigrationImpact[] = [];

  // full_auto -> semi_auto
  if (from === "full_auto" && to === "semi_auto") {
    impacts.push({
      type: "neutral",
      message: "低置信度分类将发送确认消息，等待你的决定",
    });
    impacts.push({
      type: "positive",
      message: "你将对不确定的分类有更多控制权",
    });
    impacts.push({
      type: "negative",
      message: "需要定期处理确认消息，否则 7 天后自动执行",
    });
  }

  // full_auto -> manual
  if (from === "full_auto" && to === "manual") {
    impacts.push({
      type: "neutral",
      message: "新收藏将直接进入待整理，不再自动分类",
    });
    impacts.push({
      type: "positive",
      message: "完全掌控所有分类决策",
    });
    impacts.push({
      type: "negative",
      message: "需要手动整理所有书签",
    });
  }

  // semi_auto -> full_auto
  if (from === "semi_auto" && to === "full_auto") {
    impacts.push({
      type: "positive",
      message: "AI 将自动处理所有分类，无需手动确认",
    });
    impacts.push({
      type: "neutral",
      message: "低置信度内容将进入待整理，后台聚类处理",
    });
    impacts.push({
      type: "neutral",
      message: "待确认消息需要选择处理方式",
    });
  }

  // semi_auto -> manual
  if (from === "semi_auto" && to === "manual") {
    impacts.push({
      type: "neutral",
      message: "新收藏将直接进入待整理",
    });
    impacts.push({
      type: "neutral",
      message: "待确认消息需要选择处理方式",
    });
    impacts.push({
      type: "positive",
      message: "完全掌控所有分类决策",
    });
  }

  // manual -> full_auto
  if (from === "manual" && to === "full_auto") {
    impacts.push({
      type: "positive",
      message: "AI 将自动处理所有分类，解放双手",
    });
    impacts.push({
      type: "neutral",
      message: "现有待整理内容不会自动处理，需手动操作或等待聚类",
    });
  }

  // manual -> semi_auto
  if (from === "manual" && to === "semi_auto") {
    impacts.push({
      type: "positive",
      message: "高置信度分类将自动处理",
    });
    impacts.push({
      type: "neutral",
      message: "低置信度分类会发送确认消息",
    });
  }

  return impacts;
}

// ============================================================================
// 组件实现
// ============================================================================

export function TrustModeSwitchDialog({
  open,
  onOpenChange,
  currentMode,
  targetMode,
  pendingConfirmationsCount = 0,
  onConfirm,
}: TrustModeSwitchDialogProps) {
  const [options, setOptions] = useState<SwitchOptions>({
    processPendingAs: "keep",
    preserveLearning: true,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fromInfo = MODE_INFO[currentMode];
  const toInfo = MODE_INFO[targetMode];
  const impacts = getMigrationImpacts(currentMode, targetMode);

  const FromIcon = fromInfo.icon;
  const ToIcon = toInfo.icon;

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      await onConfirm(options);
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to switch trust mode:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 是否有待确认消息需要处理
  const hasPendingConfirmations =
    pendingConfirmationsCount > 0 &&
    (currentMode === "semi_auto" || targetMode !== "semi_auto");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>切换托管模式</DialogTitle>
          <DialogDescription>
            确认从 "{fromInfo.label}" 切换到 "{toInfo.label}"
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* ════════════════════════════════════════════════════════════════ */}
          {/* 模式切换可视化 */}
          {/* ════════════════════════════════════════════════════════════════ */}
          <div className="flex items-center justify-center gap-4">
            <div className="flex flex-col items-center gap-2 p-4 rounded-lg border bg-muted/50">
              <FromIcon className={cn("size-8", fromInfo.iconColor)} />
              <span className="text-sm font-medium">{fromInfo.label}</span>
            </div>
            <ArrowRight className="size-6 text-muted-foreground" />
            <div className="flex flex-col items-center gap-2 p-4 rounded-lg border border-primary bg-primary/5">
              <ToIcon className={cn("size-8", toInfo.iconColor)} />
              <span className="text-sm font-medium">{toInfo.label}</span>
              <Badge variant="outline" className="text-xs">
                新模式
              </Badge>
            </div>
          </div>

          {/* ════════════════════════════════════════════════════════════════ */}
          {/* 影响说明 */}
          {/* ════════════════════════════════════════════════════════════════ */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-muted-foreground">
              切换影响
            </Label>
            <div className="space-y-2">
              {impacts.map((impact, index) => (
                <div
                  key={index}
                  className="flex items-start gap-2 text-sm"
                >
                  {impact.type === "positive" ? (
                    <CheckCircle2 className="size-4 text-green-500 mt-0.5 flex-shrink-0" />
                  ) : impact.type === "negative" ? (
                    <XCircle className="size-4 text-red-500 mt-0.5 flex-shrink-0" />
                  ) : (
                    <AlertTriangle className="size-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                  )}
                  <span
                    className={cn(
                      impact.type === "positive" && "text-green-600 dark:text-green-400",
                      impact.type === "negative" && "text-red-600 dark:text-red-400",
                    )}
                  >
                    {impact.message}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* ════════════════════════════════════════════════════════════════ */}
          {/* 待确认消息处理 */}
          {/* ════════════════════════════════════════════════════════════════ */}
          {hasPendingConfirmations && (
            <div className="space-y-3">
              <Label className="text-sm font-medium text-muted-foreground">
                待确认消息处理（{pendingConfirmationsCount} 条）
              </Label>
              <div className="space-y-2">
                <label
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                    options.processPendingAs === "keep"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50",
                  )}
                  onClick={() =>
                    setOptions({ ...options, processPendingAs: "keep" })
                  }
                >
                  <input
                    type="radio"
                    name="processPending"
                    checked={options.processPendingAs === "keep"}
                    onChange={() =>
                      setOptions({ ...options, processPendingAs: "keep" })
                    }
                    className="sr-only"
                  />
                  <div
                    className={cn(
                      "size-4 rounded-full border-2 flex items-center justify-center",
                      options.processPendingAs === "keep"
                        ? "border-primary"
                        : "border-muted-foreground",
                    )}
                  >
                    {options.processPendingAs === "keep" && (
                      <div className="size-2 rounded-full bg-primary" />
                    )}
                  </div>
                  <div>
                    <div className="text-sm font-medium">保留消息</div>
                    <div className="text-xs text-muted-foreground">
                      消息保留在消息中心，可稍后处理
                    </div>
                  </div>
                </label>

                <label
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                    options.processPendingAs === "auto_execute"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50",
                  )}
                  onClick={() =>
                    setOptions({ ...options, processPendingAs: "auto_execute" })
                  }
                >
                  <input
                    type="radio"
                    name="processPending"
                    checked={options.processPendingAs === "auto_execute"}
                    onChange={() =>
                      setOptions({ ...options, processPendingAs: "auto_execute" })
                    }
                    className="sr-only"
                  />
                  <div
                    className={cn(
                      "size-4 rounded-full border-2 flex items-center justify-center",
                      options.processPendingAs === "auto_execute"
                        ? "border-primary"
                        : "border-muted-foreground",
                    )}
                  >
                    {options.processPendingAs === "auto_execute" && (
                      <div className="size-2 rounded-full bg-primary" />
                    )}
                  </div>
                  <div>
                    <div className="text-sm font-medium">按建议执行</div>
                    <div className="text-xs text-muted-foreground">
                      立即按 AI 建议执行所有待确认分类
                    </div>
                  </div>
                </label>

                <label
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                    options.processPendingAs === "discard"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50",
                  )}
                  onClick={() =>
                    setOptions({ ...options, processPendingAs: "discard" })
                  }
                >
                  <input
                    type="radio"
                    name="processPending"
                    checked={options.processPendingAs === "discard"}
                    onChange={() =>
                      setOptions({ ...options, processPendingAs: "discard" })
                    }
                    className="sr-only"
                  />
                  <div
                    className={cn(
                      "size-4 rounded-full border-2 flex items-center justify-center",
                      options.processPendingAs === "discard"
                        ? "border-primary"
                        : "border-muted-foreground",
                    )}
                  >
                    {options.processPendingAs === "discard" && (
                      <div className="size-2 rounded-full bg-primary" />
                    )}
                  </div>
                  <div>
                    <div className="text-sm font-medium">移至待整理</div>
                    <div className="text-xs text-muted-foreground">
                      丢弃建议，相关书签移至待整理
                    </div>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════ */}
          {/* 学习数据保留 */}
          {/* ════════════════════════════════════════════════════════════════ */}
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">保留学习数据</Label>
              <p className="text-xs text-muted-foreground">
                保留来源画像和用户偏好，便于后续切换回来
              </p>
            </div>
            <Switch
              checked={options.preserveLearning}
              onCheckedChange={(checked) =>
                setOptions({ ...options, preserveLearning: checked })
              }
            />
          </div>

          {/* ════════════════════════════════════════════════════════════════ */}
          {/* 警告提示 */}
          {/* ════════════════════════════════════════════════════════════════ */}
          {targetMode === "manual" && (
            <Alert variant="default" className="border-orange-200 dark:border-orange-800">
              <AlertTriangle className="size-4 text-orange-500" />
              <AlertDescription className="text-sm">
                切换到手动模式后，AI 将不再自动分类。
                你可以随时在设置中切换回自动模式。
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            取消
          </Button>
          <Button onClick={handleConfirm} disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="size-4 mr-2 animate-spin" />
                切换中...
              </>
            ) : (
              "确认切换"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default TrustModeSwitchDialog;
