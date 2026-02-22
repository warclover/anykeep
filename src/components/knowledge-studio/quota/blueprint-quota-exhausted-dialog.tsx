/**
 * BlueprintQuotaExhaustedDialog - 配额用尽对话框
 * @module components/knowledge-studio/quota
 *
 * Story 8.3 实现：
 * - 配额用尽时显示升级提示
 * - 展示专业版优势
 * - 引导用户升级
 */

"use client";

import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Crown, Sparkles, Zap, Check } from "lucide-react";
import { KS_QUOTA } from "@/lib/constants/messages";
import { cn } from "@/lib/utils";

// ============================================================================
// Types
// ============================================================================

export interface BlueprintQuotaExhaustedDialogProps {
  /** 是否打开 */
  open: boolean;
  /** 关闭回调 */
  onClose: () => void;
  /** 配额信息 */
  quotaInfo?: {
    used: number;
    limit: number;
    resetAt?: Date;
    creditsCost?: number;
  };
}

// ============================================================================
// Constants
// ============================================================================

const PRO_BENEFITS = [
  { icon: Sparkles, text: "无限模板生成" },
  { icon: Zap, text: "所有高级模板" },
  { icon: Crown, text: "优先客户支持" },
];

// ============================================================================
// Component
// ============================================================================

export function BlueprintQuotaExhaustedDialog({
  open,
  onClose,
  quotaInfo,
}: BlueprintQuotaExhaustedDialogProps) {
  const router = useRouter();

  const handleUpgrade = () => {
    onClose();
    router.push("/settings/subscription");
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-amber-100 to-orange-100">
            <Crown className="h-7 w-7 text-amber-600" />
          </div>
          <DialogTitle className="text-center text-xl">
            {KS_QUOTA.EXHAUSTED_TITLE}
          </DialogTitle>
          <DialogDescription className="text-center">
            {quotaInfo?.creditsCost
              ? KS_QUOTA.WARNING_MESSAGE(
                  quotaInfo.limit - quotaInfo.used,
                  quotaInfo.creditsCost,
                )
              : KS_QUOTA.EXHAUSTED_MESSAGE}
          </DialogDescription>
        </DialogHeader>

        {/* 配额状态 */}
        {quotaInfo && (
          <div className="rounded-lg border border-gray-100 bg-gray-50/50 p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">本月使用</span>
              <span className="font-medium text-gray-900">
                {quotaInfo.used} / {quotaInfo.limit}
              </span>
            </div>
            {quotaInfo.resetAt && (
              <div className="mt-2 flex items-center justify-between text-sm">
                <span className="text-gray-600">重置时间</span>
                <span className="text-gray-500">
                  {quotaInfo.resetAt.toLocaleDateString("zh-CN", {
                    month: "long",
                    day: "numeric",
                  })}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Pro 优势 */}
        <div className="space-y-3 py-2">
          <p className="text-center text-sm font-medium text-gray-700">
            升级专业版，享受更多权益
          </p>
          <div className="space-y-2">
            {PRO_BENEFITS.map((benefit, index) => (
              <div
                key={index}
                className="flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-gray-50"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-100">
                  <benefit.icon className="h-4 w-4 text-purple-600" />
                </div>
                <span className="text-sm text-gray-700">{benefit.text}</span>
                <Check className="ml-auto h-4 w-4 text-emerald-500" />
              </div>
            ))}
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button
            onClick={handleUpgrade}
            className={cn(
              "w-full bg-gradient-to-r from-purple-600 to-blue-600",
              "hover:from-purple-700 hover:to-blue-700",
              "text-white shadow-lg",
            )}
          >
            <Crown className="mr-2 h-4 w-4" />
            {KS_QUOTA.UPGRADE_PRO}
          </Button>
          <Button
            variant="ghost"
            onClick={onClose}
            className="w-full text-gray-500"
          >
            {quotaInfo?.resetAt ? KS_QUOTA.FREE_TRIAL_RESET : KS_QUOTA.CLOSE}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
