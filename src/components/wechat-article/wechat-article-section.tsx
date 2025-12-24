/**
 * 微信文章区块组件
 *
 * @module wechat-article
 * @description 集成到详情页的微信文章展示区块
 *
 * 功能：
 * - 自动获取 snapshot ID
 * - 无快照时显示获取按钮
 * - 懒加载优化
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, Download, Loader2, AlertCircle } from "lucide-react";
import { WechatArticleViewer } from "./wechat-article-viewer";
import { clientLogger } from "@/lib/client-logger";

// =============================================================================
// 类型定义
// =============================================================================

export interface WechatArticleSectionProps {
  /** 书签 ID */
  bookmarkId: number;
  /** 书签 URL */
  bookmarkUrl: string;
  /** 是否默认展开 */
  defaultExpanded?: boolean;
  /** 自定义类名 */
  className?: string;
}

interface SnapshotInfo {
  id: number;
  status: string;
}

// =============================================================================
// 组件实现
// =============================================================================

/**
 * 微信文章区块
 *
 * 自动获取关联的 snapshot ID，然后渲染 WechatArticleViewer
 * 无快照时显示获取文章内容的按钮
 */
export function WechatArticleSection({
  bookmarkId,
  bookmarkUrl,
  defaultExpanded: _defaultExpanded = false,
  className,
}: WechatArticleSectionProps) {
  const [snapshot, setSnapshot] = useState<SnapshotInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFetching, setIsFetching] = useState(false);

  // 获取 snapshot 信息
  const fetchSnapshot = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`/api/snapshots?bookmarkId=${bookmarkId}`);

      // V4.2.27: 检查响应类型，防止 JSON 解析错误
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        // 服务器返回了非 JSON 响应（可能是热更新导致）
        clientLogger.error(
          { status: response.status, contentType },
          "[WechatArticleSection] Non-JSON response",
        );
        // 静默处理，不显示错误（可能是临时的编译状态）
        setSnapshot(null);
        return;
      }

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error?.message || "获取快照失败");
      }

      // API 返回 { success: true, data: null } 表示没有快照
      if (result.success && result.data && result.data.id) {
        setSnapshot({
          id: result.data.id,
          status: result.data.status || "pending",
        });
      } else {
        setSnapshot(null);
      }
    } catch (err) {
      clientLogger.error(
        { error: err },
        "[WechatArticleSection] Failed to fetch snapshot",
      );
      // V4.2.27: 对 JSON 解析错误静默处理（热更新期间可能发生）
      const errorMessage = err instanceof Error ? err.message : "获取快照失败";
      if (errorMessage.includes("Unexpected token")) {
        clientLogger.error(
          { error: err },
          "[WechatArticleSection] JSON parse error, likely hot reload",
        );
        setSnapshot(null);
        return;
      }
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [bookmarkId]);

  useEffect(() => {
    fetchSnapshot();
  }, [fetchSnapshot]);

  // 创建快照（抓取文章内容）
  const handleFetchArticle = async () => {
    try {
      setIsFetching(true);
      setError(null);

      // 调用微信文章创建 API（简化版，不走任务队列）
      const response = await fetch("/api/wechat-article/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookmarkId }),
      });

      // V4.2.27: 检查响应类型，防止 JSON 解析错误
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        clientLogger.error(
          { status: response.status, contentType },
          "[WechatArticleSection] Non-JSON response on create",
        );
        throw new Error("服务器响应异常，请稍后重试");
      }

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error?.message || "创建快照失败");
      }

      // 直接使用返回的 snapshot 信息
      if (result.data?.snapshotId) {
        setSnapshot({
          id: result.data.snapshotId,
          status: result.data.status || "processing",
        });
      } else {
        // 如果没有返回 snapshotId，重新获取
        await fetchSnapshot();
      }
    } catch (err) {
      clientLogger.error(
        { error: err },
        "[WechatArticleSection] Failed to create snapshot",
      );
      setError(err instanceof Error ? err.message : "创建快照失败");
    } finally {
      setIsFetching(false);
    }
  };

  // 加载中
  if (isLoading) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="space-y-3">
            <Skeleton className="h-4 w-1/4" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // 没有快照，显示获取按钮
  if (!snapshot) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="size-4" />
            微信文章内容
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <div className="rounded-full bg-muted p-3">
              <FileText className="size-6 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">
                尚未获取文章完整内容
              </p>
              <p className="text-xs text-muted-foreground">
                获取后可离线阅读、查看图片
              </p>
            </div>
            {error && (
              <div className="flex items-center gap-2 text-sm text-red-500">
                <AlertCircle className="size-4" />
                {error}
              </div>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleFetchArticle}
              disabled={isFetching}
            >
              {isFetching ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  获取中...
                </>
              ) : (
                <>
                  <Download className="mr-2 size-4" />
                  获取文章内容
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // 快照处理中
  if (snapshot.status === "pending" || snapshot.status === "processing") {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="size-4" />
            微信文章内容
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex items-center gap-3 py-4">
            <Loader2 className="size-5 animate-spin text-blue-500" />
            <span className="text-sm text-muted-foreground">
              正在获取文章内容...
            </span>
          </div>
        </CardContent>
      </Card>
    );
  }

  // 快照失败
  if (snapshot.status === "failed") {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="size-4" />
            微信文章内容
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <div className="rounded-full bg-red-100 dark:bg-red-900/30 p-3">
              <AlertCircle className="size-6 text-red-500" />
            </div>
            <div className="space-y-1">
              <p className="text-sm text-red-500">获取文章内容失败</p>
              <p className="text-xs text-muted-foreground">
                可能是网络问题或文章已被删除
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleFetchArticle}
              disabled={isFetching}
            >
              {isFetching ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  重试中...
                </>
              ) : (
                <>
                  <Download className="mr-2 size-4" />
                  重新获取
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // 快照完成，渲染微信文章阅读器
  return (
    <WechatArticleViewer
      snapshotId={snapshot.id}
      bookmarkId={bookmarkId}
      originalUrl={bookmarkUrl}
      autoFetch={false}
      className={className}
      onDeleted={() => {
        // 删除成功后重置状态，显示重新获取按钮
        setSnapshot(null);
      }}
    />
  );
}

export default WechatArticleSection;
