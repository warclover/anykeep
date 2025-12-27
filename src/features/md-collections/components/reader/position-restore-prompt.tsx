/**
 * MD 阅读位置恢复提示组件
 * Spec: md-reader-upgrade / REQ-5
 */

"use client";

import { useEffect, useState } from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { MD_READER } from "@/lib/constants/messages";
import type { ReadingPosition } from "../../types/reader";

/**
 * PositionRestorePrompt 组件 Props
 */
export interface PositionRestorePromptProps {
  /** 保存的阅读位置（如果存在） */
  savedPosition: ReadingPosition | null;
  /** 恢复到保存的位置 */
  onRestore: () => void;
  /** 从头开始（清除保存位置） */
  onStartOver: () => void;
  /** 是否自动显示（默认 true） */
  autoShow?: boolean;
}

/**
 * 位置恢复提示组件
 *
 * 当用户打开已有阅读记录的文档时，显示提示对话框，
 * 让用户选择是继续上次阅读还是从头开始。
 *
 * @example
 * ```tsx
 * function Reader({ collectionId }) {
 *   const { savedPosition, restorePosition, clearPosition } = useReadingPosition({
 *     collectionId,
 *     contentRef,
 *     readingTimeMinutes: 10,
 *   });
 *
 *   return (
 *     <>
 *       <PositionRestorePrompt
 *         savedPosition={savedPosition}
 *         onRestore={restorePosition}
 *         onStartOver={clearPosition}
 *       />
 *       <div ref={contentRef}>{content}</div>
 *     </>
 *   );
 * }
 * ```
 */
export function PositionRestorePrompt({
  savedPosition,
  onRestore,
  onStartOver,
  autoShow = true,
}: PositionRestorePromptProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [hasShown, setHasShown] = useState(false);

  // 当有保存位置且尚未显示过时，自动打开对话框
  useEffect(() => {
    if (autoShow && savedPosition && !hasShown && savedPosition.progress > 5) {
      // 只有在进度超过 5% 时才显示恢复提示
      // 延迟显示，让页面先渲染完成
      const timer = setTimeout(() => {
        setIsOpen(true);
        setHasShown(true);
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [savedPosition, autoShow, hasShown]);

  // 处理继续阅读
  const handleRestore = () => {
    setIsOpen(false);
    onRestore();
  };

  // 处理从头开始
  const handleStartOver = () => {
    setIsOpen(false);
    onStartOver();
  };

  // 格式化上次阅读时间 - 使用 useState 存储计算结果
  const [formattedLastReadTime, setFormattedLastReadTime] =
    useState<string>("");

  // 当 savedPosition 变化时计算时间差
  useEffect(() => {
    if (!savedPosition) {
      requestAnimationFrame(() => {
        setFormattedLastReadTime("");
      });
      return;
    }

    const timestamp = savedPosition.timestamp;
    const now = Date.now();
    const diff = now - timestamp;

    // 转换为更友好的时间描述
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    let timeStr: string;
    if (minutes < 1) {
      timeStr = MD_READER.POSITION.JUST_NOW;
    } else if (minutes < 60) {
      timeStr = MD_READER.POSITION.MINUTES_AGO(minutes);
    } else if (hours < 24) {
      timeStr = MD_READER.POSITION.HOURS_AGO(hours);
    } else if (days < 30) {
      timeStr = MD_READER.POSITION.DAYS_AGO(days);
    } else {
      // 超过 30 天显示具体日期
      timeStr = new Date(timestamp).toLocaleDateString("zh-CN", {
        month: "long",
        day: "numeric",
      });
    }

    requestAnimationFrame(() => {
      setFormattedLastReadTime(timeStr);
    });
  }, [savedPosition]);

  // 如果没有保存位置，不渲染任何内容
  if (!savedPosition) {
    return null;
  }

  // 格式化进度百分比
  const progressPercent = Math.round(savedPosition.progress);

  return (
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <AlertDialogContent className="max-w-sm">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <svg
              className="h-5 w-5 text-primary"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
              />
            </svg>
            {MD_READER.POSITION.DIALOG_TITLE}
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <p>
              {MD_READER.POSITION.DIALOG_READ_TO}{" "}
              <span className="font-semibold text-foreground">
                {progressPercent}%
              </span>
              <span className="text-muted-foreground ml-1">
                ({formattedLastReadTime})
              </span>
            </p>
            <p className="text-xs text-muted-foreground">
              {MD_READER.POSITION.DIALOG_CONFIRM}
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-row gap-2 sm:flex-row">
          <AlertDialogCancel onClick={handleStartOver} className="flex-1 mt-0">
            {MD_READER.POSITION.START_OVER}
          </AlertDialogCancel>
          <AlertDialogAction onClick={handleRestore} className="flex-1">
            {MD_READER.POSITION.CONTINUE}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default PositionRestorePrompt;
