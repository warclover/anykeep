/**
 * 撤销提示组件
 *
 * 显示 24 小时撤销窗口倒计时
 *
 * @module components/batch-classification/undo-banner
 * @version 1.0.0
 * @since 2026-02-01
 */

"use client";

import { useEffect, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Clock, Undo2, CheckCircle2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================
// Props
// ============================================

interface UndoBannerProps {
  transactionId: string;
  confirmedAt: Date;
  undoDeadline: Date;
  bookmarkCount: number;
  onUndo: () => Promise<void>;
  className?: string;
}

// ============================================
// 组件
// ============================================

export function UndoBanner({
  transactionId,
  confirmedAt,
  undoDeadline,
  bookmarkCount,
  onUndo,
  className,
}: UndoBannerProps) {
  const [timeRemaining, setTimeRemaining] = useState<string>("");
  const [isExpired, setIsExpired] = useState(false);
  const [isUndoing, setIsUndoing] = useState(false);
  const [undoSuccess, setUndoSuccess] = useState(false);

  // 更新倒计时
  useEffect(() => {
    const updateTimer = () => {
      const now = new Date();
      const deadline = new Date(undoDeadline);
      const diff = deadline.getTime() - now.getTime();

      if (diff <= 0) {
        setIsExpired(true);
        setTimeRemaining("已过期");
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeRemaining(`${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [undoDeadline]);

  // 处理撤销
  const handleUndo = async () => {
    setIsUndoing(true);
    try {
      await onUndo();
      setUndoSuccess(true);
    } catch (error) {
      console.error("Undo failed:", error);
    } finally {
      setIsUndoing(false);
    }
  };

  // 撤销成功状态
  if (undoSuccess) {
    return (
      <Alert className={cn("border-green-500 bg-green-50", className)}>
        <CheckCircle2 className="h-4 w-4 text-green-600" />
        <AlertTitle className="text-green-800">撤销成功</AlertTitle>
        <AlertDescription className="text-green-700">
          已恢复 {bookmarkCount} 个书签到原始状态
        </AlertDescription>
      </Alert>
    );
  }

  // 已过期状态
  if (isExpired) {
    return (
      <Alert variant="default" className={cn("bg-muted", className)}>
        <Clock className="h-4 w-4" />
        <AlertTitle>撤销窗口已关闭</AlertTitle>
        <AlertDescription>
          分类操作已于 {formatDate(confirmedAt)} 确认，撤销窗口已过期
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert className={cn("border-blue-500 bg-blue-50", className)}>
      <CheckCircle2 className="h-4 w-4 text-blue-600" />
      <AlertTitle className="text-blue-800 flex items-center gap-2">
        已确认 {bookmarkCount} 个书签的分类
      </AlertTitle>
      <AlertDescription className="text-blue-700">
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            <span>
              您可以在 <span className="font-mono font-bold">{timeRemaining}</span> 内撤销此操作
            </span>
          </div>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="border-blue-300 text-blue-700 hover:bg-blue-100"
                disabled={isUndoing}
              >
                <Undo2 className="h-4 w-4 mr-1" />
                {isUndoing ? "撤销中..." : "撤销全部分类"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                  确认撤销分类？
                </AlertDialogTitle>
                <AlertDialogDescription>
                  此操作将：
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    <li>恢复 {bookmarkCount} 个书签到原始状态</li>
                    <li>���除本次创建的新文件夹</li>
                    <li>此操作不可逆</li>
                  </ul>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>取消</AlertDialogCancel>
                <AlertDialogAction onClick={handleUndo} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  确认撤销
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </AlertDescription>
    </Alert>
  );
}

// ============================================
// 辅助函数
// ============================================

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}
