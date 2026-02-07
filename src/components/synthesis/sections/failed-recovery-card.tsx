/**
 * Failed Recovery Card 组件
 *
 * 失败/取消状态恢复卡片
 *
 * @version 1.0.0
 * @since 2026-02-07
 */

"use client";

import { memo } from "react";
import { AlertCircle, XCircle, RefreshCcw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface FailedRecoveryCardProps {
  status: "failed" | "cancelled";
  errorMessage?: string | null;
  onRetry: () => void;
  isRetrying: boolean;
}

/**
 * 失败/取消状态恢复卡片
 */
export const FailedRecoveryCard = memo(function FailedRecoveryCard({
  status,
  errorMessage,
  onRetry,
  isRetrying,
}: FailedRecoveryCardProps) {
  const isFailed = status === "failed";

  return (
    <Card
      className={cn(
        "border-2",
        isFailed ? "border-destructive/50" : "border-muted",
      )}
    >
      <CardContent className="pt-6">
        <div className="flex flex-col items-center text-center space-y-4">
          {isFailed ? (
            <div className="rounded-full bg-destructive/10 p-4">
              <AlertCircle className="h-8 w-8 text-destructive" />
            </div>
          ) : (
            <div className="rounded-full bg-muted p-4">
              <XCircle className="h-8 w-8 text-muted-foreground" />
            </div>
          )}

          <div className="space-y-2">
            <h3 className="text-lg font-semibold">
              {isFailed ? "生成失败" : "生成已取消"}
            </h3>
            <p className="text-sm text-muted-foreground max-w-md">
              {isFailed
                ? errorMessage || "综述生成过程中发生错误，请重新尝试。"
                : "综述生成已被取消。您可以重新开始生成。"}
            </p>
          </div>

          <Button onClick={onRetry} disabled={isRetrying}>
            {isRetrying ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                正在重新生成...
              </>
            ) : (
              <>
                <RefreshCcw className="mr-2 h-4 w-4" />
                重新生成
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
});
