"use client";

import { useState, useCallback, useRef } from "react";
import {
  Loader2,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  Link,
  Play,
  Square,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import type {
  LinkValidationResult,
  BatchValidationResult,
  LinkStatus,
} from "@/lib/browser-bookmark/link-validator";

// ============================================
// 类型
// ============================================

interface BookmarkToValidate {
  id: string;
  url: string;
  title: string;
}

interface LinkValidatorProps {
  /** 要验证的书签列表 */
  bookmarks: BookmarkToValidate[];
  /** 验证完成回调 */
  onComplete?: (
    result: BatchValidationResult,
    excludedIds: Set<string>,
  ) => void;
  /** 是否显示跳过失效链接选项 */
  showSkipOption?: boolean;
  /** 自定义类名 */
  className?: string;
}

// ============================================
// 状态图标映射
// ============================================

const STATUS_CONFIG: Record<
  LinkStatus,
  { icon: typeof CheckCircle; color: string; label: string }
> = {
  valid: { icon: CheckCircle, color: "text-green-500", label: "有效" },
  invalid: { icon: XCircle, color: "text-destructive", label: "无效" },
  timeout: { icon: Clock, color: "text-amber-500", label: "超时" },
  error: { icon: AlertTriangle, color: "text-destructive", label: "错误" },
  pending: { icon: Loader2, color: "text-muted-foreground", label: "等待中" },
};

// ============================================
// 组件
// ============================================

export function LinkValidator({
  bookmarks,
  onComplete,
  showSkipOption = true,
  className,
}: LinkValidatorProps) {
  // 状态
  const [isValidating, setIsValidating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<Map<string, LinkValidationResult>>(
    new Map(),
  );
  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set());
  const [showDetails, setShowDetails] = useState(false);

  // 取消控制
  const abortControllerRef = useRef<AbortController | null>(null);

  // 开始验证
  const startValidation = useCallback(async () => {
    if (bookmarks.length === 0) return;

    setIsValidating(true);
    setProgress(0);
    setResults(new Map());

    abortControllerRef.current = new AbortController();

    try {
      // 分批发送到 API
      const BATCH_SIZE = 50;
      const allResults: LinkValidationResult[] = [];
      let completed = 0;

      for (let i = 0; i < bookmarks.length; i += BATCH_SIZE) {
        if (abortControllerRef.current?.signal.aborted) break;

        const batch = bookmarks.slice(i, i + BATCH_SIZE);
        const response = await fetch("/api/browser-bookmark/validate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bookmarks: batch.map((b) => ({ id: b.id, url: b.url })),
            options: { timeout: 5000, concurrency: 10 },
          }),
          signal: abortControllerRef.current?.signal,
        });

        if (!response.ok) {
          throw new Error("验证请求失败");
        }

        const data = await response.json();
        const batchResults: LinkValidationResult[] = data.data?.results || [];

        // 更新结果
        setResults((prev) => {
          const newMap = new Map(prev);
          for (const r of batchResults) {
            newMap.set(r.id, r);
          }
          return newMap;
        });

        allResults.push(...batchResults);
        completed += batch.length;
        setProgress(Math.round((completed / bookmarks.length) * 100));
      }

      // 自动选中无效链接
      if (showSkipOption) {
        const invalidIds = new Set(
          allResults
            .filter(
              (r) =>
                r.status === "invalid" ||
                r.status === "timeout" ||
                r.status === "error",
            )
            .map((r) => r.id),
        );
        setExcludedIds(invalidIds);
      }

      // 计算统计
      const stats = allResults.reduce(
        (acc, r) => {
          acc[r.status]++;
          return acc;
        },
        { valid: 0, invalid: 0, timeout: 0, error: 0, pending: 0 },
      );

      const finalResult: BatchValidationResult = {
        total: bookmarks.length,
        valid: stats.valid,
        invalid: stats.invalid,
        timeout: stats.timeout,
        error: stats.error,
        results: allResults,
        durationMs: 0, // API 已包含
      };

      onComplete?.(finalResult, excludedIds);
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        console.error("验证失败:", error);
      }
    } finally {
      setIsValidating(false);
      abortControllerRef.current = null;
    }
  }, [bookmarks, showSkipOption, onComplete, excludedIds]);

  // 停止验证
  const stopValidation = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  // 切换排除状态
  const toggleExclude = useCallback((id: string) => {
    setExcludedIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  }, []);

  // 全选/取消全选无效链接
  const toggleAllInvalid = useCallback(
    (exclude: boolean) => {
      const invalidIds = Array.from(results.values())
        .filter(
          (r) =>
            r.status === "invalid" ||
            r.status === "timeout" ||
            r.status === "error",
        )
        .map((r) => r.id);

      setExcludedIds((prev) => {
        const newSet = new Set(prev);
        for (const id of invalidIds) {
          if (exclude) {
            newSet.add(id);
          } else {
            newSet.delete(id);
          }
        }
        return newSet;
      });
    },
    [results],
  );

  // 计算统计
  const validCount = Array.from(results.values()).filter(
    (r) => r.status === "valid",
  ).length;
  const invalidCount = Array.from(results.values()).filter(
    (r) =>
      r.status === "invalid" || r.status === "timeout" || r.status === "error",
  ).length;

  // 获取书签标题
  const getBookmarkTitle = (id: string) =>
    bookmarks.find((b) => b.id === id)?.title || "未知";

  return (
    <div className={cn("space-y-4", className)}>
      {/* 标题和操作 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">链接有效性检测</span>
          <span className="text-xs text-muted-foreground">
            ({bookmarks.length} 个链接)
          </span>
        </div>

        {!isValidating ? (
          <Button
            size="sm"
            variant="outline"
            onClick={startValidation}
            disabled={bookmarks.length === 0}
          >
            <Play className="h-3.5 w-3.5 mr-1" />
            开始检测
          </Button>
        ) : (
          <Button size="sm" variant="outline" onClick={stopValidation}>
            <Square className="h-3.5 w-3.5 mr-1" />
            停止
          </Button>
        )}
      </div>

      {/* 进度条 */}
      {isValidating && (
        <div className="space-y-2">
          <Progress value={progress} className="h-2" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>正在检测...</span>
            <span>{progress}%</span>
          </div>
        </div>
      )}

      {/* 结果统计 */}
      {results.size > 0 && !isValidating && (
        <div className="flex items-center gap-4 text-sm">
          <span className="flex items-center gap-1 text-green-600">
            <CheckCircle className="h-4 w-4" />
            有效: {validCount}
          </span>
          <span className="flex items-center gap-1 text-destructive">
            <XCircle className="h-4 w-4" />
            问题: {invalidCount}
          </span>
          {excludedIds.size > 0 && showSkipOption && (
            <span className="text-muted-foreground">
              已选择跳过: {excludedIds.size}
            </span>
          )}
        </div>
      )}

      {/* 问题链接详情 */}
      {invalidCount > 0 && !isValidating && (
        <Collapsible open={showDetails} onOpenChange={setShowDetails}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full justify-start">
              <AlertTriangle className="h-4 w-4 mr-2 text-amber-500" />
              查看 {invalidCount} 个问题链接
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-2 border rounded-md">
              {/* 批量操作 */}
              {showSkipOption && (
                <div className="px-3 py-2 border-b bg-muted/50 flex items-center gap-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleAllInvalid(true)}
                  >
                    全部跳过
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleAllInvalid(false)}
                  >
                    取消跳过
                  </Button>
                </div>
              )}

              <ScrollArea className="h-[200px]">
                <div className="divide-y">
                  {Array.from(results.values())
                    .filter(
                      (r) =>
                        r.status === "invalid" ||
                        r.status === "timeout" ||
                        r.status === "error",
                    )
                    .map((result) => {
                      const config = STATUS_CONFIG[result.status];
                      const Icon = config.icon;
                      const isExcluded = excludedIds.has(result.id);

                      return (
                        <div
                          key={result.id}
                          className={cn(
                            "px-3 py-2 flex items-center gap-3",
                            isExcluded && "bg-muted/30",
                          )}
                        >
                          {showSkipOption && (
                            <Checkbox
                              checked={isExcluded}
                              onCheckedChange={() => toggleExclude(result.id)}
                            />
                          )}
                          <Icon
                            className={cn("h-4 w-4 shrink-0", config.color)}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {getBookmarkTitle(result.id)}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {result.url}
                            </p>
                          </div>
                          <span className="text-xs text-muted-foreground shrink-0">
                            {result.error || config.label}
                          </span>
                        </div>
                      );
                    })}
                </div>
              </ScrollArea>
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}
