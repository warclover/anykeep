"use client";

/**
 * Zero Takeover 确认卡片组件
 *
 * 用于显示高风险操作（如删除）的确认请求
 * 包含预览数据显示，帮助用户了解受影响的内容
 *
 * @version 1.0.0 - Phase 1: 风险确认预览
 * @since 2026-01-10
 */

import { useState, useEffect, useCallback, memo } from "react";
import { AlertTriangle, Trash2, Clock, Loader2, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { ZeroTakeoverConfirmInfo } from "./types";

// ============================================
// 常量定义
// ============================================

const STRINGS = {
  previewTitle: "将受影响的书签：",
  moreItems: (count: number) => `...等共 ${count} 个书签`,
  confirmButton: "确认执行",
  confirmingButton: "执行中...",
  cancelButton: "取消",
  timeoutWarning: (seconds: number) => `此确认将在 ${seconds} 秒后过期`,
  operationTypes: {
    delete: "删除操作",
    batch_delete: "批量删除",
    irreversible: "不可逆操作",
  },
} as const;

// ============================================
// 类型定义
// ============================================

export interface ZeroTakeoverConfirmCardProps {
  /** 确认信息 */
  confirmation: ZeroTakeoverConfirmInfo;
  /** 确认回调 */
  onConfirm: (confirmId: string) => void;
  /** 取消回调 */
  onCancel: (confirmId: string) => void;
  /** 是否正在执行 */
  isLoading?: boolean;
  /** 自定义类名 */
  className?: string;
}

// ============================================
// 组件实现
// ============================================

export const ZeroTakeoverConfirmCard = memo(function ZeroTakeoverConfirmCard({
  confirmation,
  onConfirm,
  onCancel,
  isLoading = false,
  className,
}: ZeroTakeoverConfirmCardProps) {
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);

  // 计算剩余时间
  useEffect(() => {
    if (!confirmation.timeout) return;

    const timeoutMs = confirmation.timeout;
    const startTime = Date.now();

    const updateRemaining = () => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, Math.ceil((timeoutMs - elapsed) / 1000));
      setRemainingSeconds(remaining);

      if (remaining === 0) {
        // 超时自动取消
        onCancel(confirmation.id);
      }
    };

    updateRemaining();
    const interval = setInterval(updateRemaining, 1000);

    return () => clearInterval(interval);
  }, [confirmation.id, confirmation.timeout, onCancel]);

  const handleConfirm = useCallback(() => {
    onConfirm(confirmation.id);
  }, [confirmation.id, onConfirm]);

  const handleCancel = useCallback(() => {
    onCancel(confirmation.id);
  }, [confirmation.id, onCancel]);

  const operationLabel =
    STRINGS.operationTypes[confirmation.operationType] ||
    STRINGS.operationTypes.irreversible;

  const hasPreview = confirmation.preview && confirmation.preview.length > 0;
  const totalCount =
    confirmation.totalAffectedCount ||
    confirmation.affectedBookmarkIds?.length ||
    0;
  const showMoreCount =
    hasPreview && totalCount > (confirmation.preview?.length || 0);

  return (
    <div
      className={cn(
        "border-2 border-red-200 rounded-xl p-4 space-y-3",
        "bg-gradient-to-r from-red-50 to-rose-50",
        "shadow-sm",
        className,
      )}
    >
      {/* 标题栏 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {confirmation.operationType === "delete" ||
          confirmation.operationType === "batch_delete" ? (
            <Trash2 className="size-5 text-red-500" />
          ) : (
            <AlertTriangle className="size-5 text-red-500" />
          )}
          <span className="text-sm font-semibold text-red-700">
            {confirmation.title || operationLabel}
          </span>
        </div>
        <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-600 font-medium">
          {operationLabel}
        </span>
      </div>

      {/* 确认消息 */}
      <p className="text-sm text-gray-700">{confirmation.message}</p>

      {/* Phase 1: 预览数据 */}
      {hasPreview && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-500">
            {STRINGS.previewTitle}
          </p>
          <div className="space-y-1">
            {confirmation.preview?.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-2 text-sm py-1.5 px-3 rounded-lg bg-white/60 border border-red-100"
                title={item.title}
              >
                <span className="truncate flex-1 text-gray-700">
                  {item.title}
                </span>
                {item.platform && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 shrink-0">
                    {item.platform}
                  </span>
                )}
              </div>
            ))}
          </div>
          {showMoreCount && (
            <p className="text-xs text-gray-500 italic">
              {STRINGS.moreItems(totalCount)}
            </p>
          )}
        </div>
      )}

      {/* 超时提醒 */}
      {remainingSeconds !== null && remainingSeconds > 0 && (
        <div className="flex items-center gap-1.5 text-xs text-amber-600">
          <Clock className="size-3" />
          <span>{STRINGS.timeoutWarning(remainingSeconds)}</span>
        </div>
      )}

      {/* 操作按钮 */}
      <div className="flex gap-2 pt-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleCancel}
          disabled={isLoading}
          className="flex-1 border-gray-300 hover:bg-gray-100"
        >
          <X className="size-4 mr-1" />
          {STRINGS.cancelButton}
        </Button>
        <Button
          variant="destructive"
          size="sm"
          onClick={handleConfirm}
          disabled={isLoading}
          className="flex-1 bg-red-600 hover:bg-red-700"
        >
          {isLoading ? (
            <>
              <Loader2 className="size-4 mr-1 animate-spin" />
              {STRINGS.confirmingButton}
            </>
          ) : (
            <>
              <Check className="size-4 mr-1" />
              {STRINGS.confirmButton}
            </>
          )}
        </Button>
      </div>
    </div>
  );
});

export default ZeroTakeoverConfirmCard;
