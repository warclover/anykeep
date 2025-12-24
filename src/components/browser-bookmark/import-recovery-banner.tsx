"use client";

import { useState, useEffect } from "react";
import { AlertCircle, Play, Trash2, X, Clock, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  getPendingSession,
  deleteImportSession,
  type ImportSession,
} from "@/lib/browser-bookmark/import-cache";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { clientLogger } from "@/lib/client-logger";

interface ImportRecoveryBannerProps {
  /** 用户 ID */
  userId: string;
  /** 点击恢复导入 */
  onResume: (session: ImportSession) => void;
  /** 横幅关闭回调 */
  onDismiss?: () => void;
  /** 自定义类名 */
  className?: string;
}

/**
 * 导入恢复提示横幅
 * 在检测到未完成的导入会话时显示
 */
export function ImportRecoveryBanner({
  userId,
  onResume,
  onDismiss,
  className,
}: ImportRecoveryBannerProps) {
  const [session, setSession] = useState<ImportSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDiscarding, setIsDiscarding] = useState(false);

  // 检查待恢复的会话
  useEffect(() => {
    async function checkSession() {
      try {
        const pendingSession = await getPendingSession(userId);
        setSession(pendingSession ?? null);
      } catch (error) {
        clientLogger.error({ error }, "检查待恢复会话失败");
      } finally {
        setIsLoading(false);
      }
    }
    checkSession();
  }, [userId]);

  // 丢弃会话
  const handleDiscard = async () => {
    if (!session) return;
    setIsDiscarding(true);
    try {
      await deleteImportSession(session.id);
      setSession(null);
      onDismiss?.();
    } catch (error) {
      clientLogger.error({ error }, "丢弃会话失败");
    } finally {
      setIsDiscarding(false);
    }
  };

  // 恢复导入
  const handleResume = () => {
    if (session) {
      onResume(session);
    }
  };

  // 加载中或无待恢复会话时不显示
  if (isLoading || !session) {
    return null;
  }

  // 计算进度
  const progress = Math.round(
    (session.completedBatches / session.totalBatches) * 100,
  );
  const remainingBookmarks =
    session.progress.totalBookmarks - session.progress.totalSuccess;

  // 格式化时间
  const timeAgo = formatDistanceToNow(session.createdAt, {
    addSuffix: true,
    locale: zhCN,
  });

  return (
    <Alert className={className} variant="default">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle className="flex items-center justify-between">
        <span>有未完成的书签导入</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 -mr-2"
          onClick={() => {
            setSession(null);
            onDismiss?.();
          }}
        >
          <X className="h-4 w-4" />
        </Button>
      </AlertTitle>
      <AlertDescription className="mt-2">
        <div className="space-y-3">
          {/* 会话信息 */}
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {timeAgo}
            </span>
            <span className="flex items-center gap-1">
              <FileText className="h-3.5 w-3.5" />
              来源: {session.browserSource}
            </span>
          </div>

          {/* 进度信息 */}
          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span>
                已导入 {session.progress.totalSuccess} 条，剩余{" "}
                {remainingBookmarks} 条
              </span>
              <span className="font-medium">{progress}%</span>
            </div>
            <div className="h-2 bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="flex gap-2 pt-1">
            <Button size="sm" onClick={handleResume}>
              <Play className="h-4 w-4 mr-1" />
              继续导入
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleDiscard}
              disabled={isDiscarding}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              {isDiscarding ? "丢弃中..." : "丢弃"}
            </Button>
          </div>
        </div>
      </AlertDescription>
    </Alert>
  );
}
