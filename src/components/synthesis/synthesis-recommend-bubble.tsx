/**
 * 综述推荐气泡组件
 *
 * 非侵入式推荐提示，显示在页面右下角
 * 支持自动消失、永久忽略等功能
 *
 * @version 1.0.0
 * @since 2025-12-29
 */

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Sparkles, BookOpen, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { RecommendedTopic } from "@/lib/synthesis/types/recommend";
import { RECOMMEND_LIMITS } from "@/lib/synthesis/types/recommend";

interface SynthesisRecommendBubbleProps {
  /** 当前推荐 */
  recommend: RecommendedTopic | null;
  /** 是否显示 */
  visible: boolean;
  /** 接受推荐回调 */
  onAccept: (topic: RecommendedTopic) => void;
  /** 忽略推荐回调 */
  onDismiss: (neverShowAgain?: boolean) => void;
  /** 关闭气泡回调 */
  onClose: () => void;
  /** 自定义类名 */
  className?: string;
}

export function SynthesisRecommendBubble({
  recommend,
  visible,
  onAccept,
  onDismiss,
  onClose,
  className,
}: SynthesisRecommendBubbleProps) {
  const [neverShowAgain, setNeverShowAgain] = useState(false);
  const [progress, setProgress] = useState(100);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const progressRef = useRef<NodeJS.Timeout | null>(null);

  // 自动关闭计时器
  useEffect(() => {
    if (visible && recommend) {
      // 重置状态（这是气泡显示时的初始化，不会触发级联渲染）
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setProgress(100);
      setNeverShowAgain(false);

      // 进度条动画
      const startTime = Date.now();
      const duration = RECOMMEND_LIMITS.AUTO_DISMISS_DELAY;

      progressRef.current = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
        setProgress(remaining);
      }, 50);

      // 自动关闭
      timerRef.current = setTimeout(() => {
        onDismiss(false);
      }, duration);

      return () => {
        if (timerRef.current) clearTimeout(timerRef.current);
        if (progressRef.current) clearInterval(progressRef.current);
      };
    }
  }, [visible, recommend, onDismiss]);

  // 暂停自动关闭（鼠标悬停时）
  const handleMouseEnter = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (progressRef.current) {
      clearInterval(progressRef.current);
      progressRef.current = null;
    }
    setProgress(100);
  }, []);

  // 恢复自动关闭
  const handleMouseLeave = useCallback(() => {
    if (!visible || !recommend) return;

    const startTime = Date.now();
    const duration = RECOMMEND_LIMITS.AUTO_DISMISS_DELAY;

    progressRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(remaining);
    }, 50);

    timerRef.current = setTimeout(() => {
      onDismiss(false);
    }, duration);
  }, [visible, recommend, onDismiss]);

  // 接受推荐
  const handleAccept = useCallback(() => {
    if (recommend) {
      onAccept(recommend);
    }
  }, [recommend, onAccept]);

  // 忽略推荐
  const handleDismiss = useCallback(() => {
    onDismiss(neverShowAgain);
  }, [onDismiss, neverShowAgain]);

  if (!recommend) return null;

  // 获取来源类型中文名
  const getSourceTypeName = () => {
    switch (recommend.sourceType) {
      case "folder":
        return "文件夹";
      case "tag":
        return "标签";
      case "selection":
        return "时间范围";
      default:
        return "主题";
    }
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          className={cn(
            "fixed bottom-6 right-6 z-50 w-80",
            "bg-card text-card-foreground rounded-xl border shadow-lg",
            className,
          )}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          {/* 进度条 */}
          <div className="absolute top-0 left-0 right-0 h-1 rounded-t-xl overflow-hidden bg-muted">
            <motion.div
              className="h-full bg-primary/50"
              initial={{ width: "100%" }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.05, ease: "linear" }}
            />
          </div>

          {/* 关闭按钮 */}
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 h-6 w-6"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>

          {/* 内容区域 */}
          <div className="p-4 pt-5">
            {/* 标题 */}
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <span className="font-semibold text-sm">发现相似主题</span>
            </div>

            {/* 推荐描述 */}
            <p className="text-sm text-muted-foreground mb-3">
              {getSourceTypeName()}「{recommend.sourceId || recommend.title}
              」下有{" "}
              <span className="font-semibold text-foreground">
                {recommend.bookmarkCount}
              </span>{" "}
              篇相似内容，要生成综述吗？
            </p>

            {/* 代表书签 */}
            {recommend.sampleBookmarks &&
              recommend.sampleBookmarks.length > 0 && (
                <div className="mb-3 space-y-1.5">
                  {recommend.sampleBookmarks.slice(0, 2).map((bookmark) => (
                    <div
                      key={bookmark.id}
                      className="flex items-center gap-2 text-xs text-muted-foreground"
                    >
                      <BookOpen className="h-3 w-3 flex-shrink-0" />
                      <span className="truncate">{bookmark.title}</span>
                    </div>
                  ))}
                  {recommend.sampleBookmarks.length > 2 && (
                    <div className="text-xs text-muted-foreground pl-5">
                      还有 {recommend.bookmarkCount - 2} 篇...
                    </div>
                  )}
                </div>
              )}

            {/* 操作按钮 */}
            <div className="flex items-center gap-2 mb-3">
              <Button size="sm" className="flex-1" onClick={handleAccept}>
                试试看
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={handleDismiss}
              >
                暂不需要
              </Button>
            </div>

            {/* 永不再显示选项 */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="never-show"
                checked={neverShowAgain}
                onCheckedChange={(checked) =>
                  setNeverShowAgain(checked === true)
                }
              />
              <Label
                htmlFor="never-show"
                className="text-xs text-muted-foreground cursor-pointer"
              >
                不再提示此类推荐
              </Label>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
