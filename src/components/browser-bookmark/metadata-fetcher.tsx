/**
 * 元数据抓取组件
 * 批量抓取书签的网页元数据
 */

"use client";

import { useState, useCallback, useRef } from "react";
import { Globe, Download, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import type { PageMetadata } from "@/lib/browser-bookmark";
import { clientLogger } from "@/lib/client-logger";
import { API_BROWSER_BOOKMARK } from "@/lib/constants/api-paths";

// ============================================
// 类型定义
// ============================================

interface BookmarkWithMetadata {
  id: string;
  url: string;
  title?: string;
  metadata?: PageMetadata;
}

interface MetadataFetcherProps {
  /** 书签列表 */
  bookmarks: Array<{ id: string; url: string; title?: string }>;
  /** 完成回调 */
  onComplete?: (
    bookmarksWithMetadata: BookmarkWithMetadata[],
    stats: { successful: number; failed: number },
  ) => void;
  /** 自定义类名 */
  className?: string;
}

// ============================================
// 主组件
// ============================================

export function MetadataFetcher({
  bookmarks,
  onComplete,
  className,
}: MetadataFetcherProps) {
  // 状态
  const [isFetching, setIsFetching] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<Map<string, PageMetadata>>(new Map());
  const [errors, setErrors] = useState<Set<string>>(new Set());

  // 取消控制
  const abortControllerRef = useRef<AbortController | null>(null);

  // 开始抓取
  const startFetching = useCallback(async () => {
    if (isFetching || bookmarks.length === 0) return;

    setIsFetching(true);
    setProgress(0);
    setResults(new Map());
    setErrors(new Set());

    // 创建 AbortController
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      // 准备 URL 列表
      const urls = bookmarks.map((b) => b.url);

      // 调用 API（分批处理，每批 20 个）
      const BATCH_SIZE = 20;
      let completed = 0;
      const newResults = new Map<string, PageMetadata>();
      const newErrors = new Set<string>();

      for (let i = 0; i < urls.length; i += BATCH_SIZE) {
        if (controller.signal.aborted) break;

        const batchUrls = urls.slice(i, Math.min(i + BATCH_SIZE, urls.length));

        const response = await fetch(API_BROWSER_BOOKMARK.fetchMetadata, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            urls: batchUrls,
            timeout: 10000,
            concurrency: 5,
            fetchFavicon: true,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("抓取失败");
        }

        const data = await response.json();
        const items = data.data?.items || [];

        // 处理结果
        for (const item of items) {
          if (item.success && item.metadata) {
            newResults.set(item.url, item.metadata);
          } else {
            newErrors.add(item.url);
          }
        }

        completed += batchUrls.length;
        setProgress(Math.round((completed / urls.length) * 100));
        setResults(new Map(newResults));
        setErrors(new Set(newErrors));
      }

      // 完成
      const successful = newResults.size;
      const failed = newErrors.size;

      // 构建带元数据的书签列表
      const bookmarksWithMetadata: BookmarkWithMetadata[] = bookmarks.map(
        (b) => ({
          id: b.id,
          url: b.url,
          title: b.title,
          metadata: newResults.get(b.url),
        }),
      );

      onComplete?.(bookmarksWithMetadata, { successful, failed });
    } catch (error) {
      if (error instanceof Error && error.name !== "AbortError") {
        clientLogger.error({ error }, "抓取元数据失败");
      }
    } finally {
      setIsFetching(false);
      abortControllerRef.current = null;
    }
  }, [bookmarks, isFetching, onComplete]);

  // 取消抓取
  const cancelFetching = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsFetching(false);
  }, []);

  // 计算成功率
  const successRate =
    results.size + errors.size > 0
      ? Math.round((results.size / (results.size + errors.size)) * 100)
      : 0;

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Globe className="h-5 w-5" />
          元数据抓取
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 说明 */}
        <div className="text-sm text-muted-foreground">
          自动从网页抓取标题、描述、封面图等元数据，提升书签质量。
        </div>

        {/* 统计信息 */}
        <div className="flex items-center gap-4 text-sm">
          <span>
            待抓取: <span className="font-medium">{bookmarks.length}</span>
          </span>
          {(results.size > 0 || errors.size > 0) && (
            <>
              <span className="text-green-600">
                成功: <span className="font-medium">{results.size}</span>
              </span>
              <span className="text-red-600">
                失败: <span className="font-medium">{errors.size}</span>
              </span>
              <Badge variant="outline">{successRate}% 成功率</Badge>
            </>
          )}
        </div>

        {/* 进度条 */}
        {isFetching && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                正在抓取... (
                {Math.round(
                  ((results.size + errors.size) / bookmarks.length) * 100,
                )}
                %)
              </span>
              <span className="font-medium">
                {results.size + errors.size} / {bookmarks.length}
              </span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        {/* 操作按钮 */}
        <div className="flex gap-2">
          {!isFetching ? (
            <Button onClick={startFetching} disabled={bookmarks.length === 0}>
              <Download className="mr-2 h-4 w-4" />
              开始抓取
            </Button>
          ) : (
            <Button variant="destructive" onClick={cancelFetching}>
              取消抓取
            </Button>
          )}
        </div>

        {/* 抓取结果预览 */}
        {!isFetching && (results.size > 0 || errors.size > 0) && (
          <div className="rounded-md border p-3 space-y-2">
            <div className="text-sm font-medium">抓取结果预览</div>
            <div className="space-y-1 max-h-[200px] overflow-y-auto">
              {Array.from(results.entries())
                .slice(0, 5)
                .map(([url, metadata]) => (
                  <div
                    key={url}
                    className="flex items-start gap-2 text-xs p-2 bg-green-50 rounded"
                  >
                    <CheckCircle className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">
                        {metadata.title || "无标题"}
                      </div>
                      <div className="text-muted-foreground truncate">
                        {url}
                      </div>
                    </div>
                  </div>
                ))}
              {Array.from(errors)
                .slice(0, 3)
                .map((url) => (
                  <div
                    key={url}
                    className="flex items-start gap-2 text-xs p-2 bg-red-50 rounded"
                  >
                    <XCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <div className="text-red-700 truncate">{url}</div>
                      <div className="text-red-600">抓取失败</div>
                    </div>
                  </div>
                ))}
              {results.size + errors.size > 8 && (
                <div className="text-xs text-muted-foreground text-center py-1">
                  还有 {results.size + errors.size - 8} 条结果...
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default MetadataFetcher;
