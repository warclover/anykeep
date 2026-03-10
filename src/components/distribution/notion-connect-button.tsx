/**
 * Notion 连接按钮组件
 *
 * @description 用于授权/断开 Notion 连接
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Unlink,
} from "lucide-react";
import { toast } from "sonner";
import { clientLogger } from "@/lib/client-logger";
import { API_DISTRIBUTION } from "@/lib/constants/api-paths";

interface NotionStatus {
  connected: boolean;
  workspace?: {
    id: string;
    name: string;
    icon: string | null;
  };
  connectedAt?: string;
}

interface NotionConnectButtonProps {
  /** 连接成功后的回调 */
  onConnected?: () => void;
  /** 断开连接后的回调 */
  onDisconnected?: () => void;
  /** 是否显示为卡片形式 */
  showCard?: boolean;
}

/**
 * Notion 图标 SVG
 */
function NotionIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 2.02c-.466-.373-.989-.746-2.109-.653L2.792 2.559c-.466.047-.56.28-.373.466l2.04 1.183Zm.793 3.172v13.87c0 .747.373 1.026 1.213.98l14.483-.84c.84-.046.933-.56.933-1.166V6.354c0-.607-.233-.933-.746-.886l-15.137.84c-.56.046-.746.326-.746.886v.186Zm14.297-.654c.093.42 0 .84-.42.89l-.7.14v10.264c-.607.327-1.166.514-1.633.514-.746 0-.933-.234-1.493-.934l-4.571-7.186v6.952l1.446.327s0 .84-1.166.84l-3.218.186c-.094-.186 0-.653.327-.7l.84-.233V9.854L7.46 9.62c-.093-.42.14-1.026.793-1.073l3.45-.233 4.758 7.28v-6.44l-1.213-.14c-.093-.513.28-.886.746-.933l3.218-.186Z" />
    </svg>
  );
}

export function NotionConnectButton({
  onConnected,
  onDisconnected,
  showCard = true,
}: NotionConnectButtonProps) {
  const [status, setStatus] = useState<NotionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);
  const [showDisconnectDialog, setShowDisconnectDialog] = useState(false);

  // 检查连接状态
  const checkStatus = useCallback(async () => {
    try {
      const response = await fetch(API_DISTRIBUTION.notionStatus);
      const data = await response.json();
      setStatus(data);
    } catch (error) {
      clientLogger.error({ error }, "Failed to check Notion status:");
      setStatus({ connected: false });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkStatus();

    // 检查 URL 参数
    const urlParams = new URLSearchParams(window.location.search);
    const success = urlParams.get("success");
    const errorMsg = urlParams.get("error");
    const workspace = urlParams.get("workspace");

    if (success === "notion") {
      toast.success(`已连接到 ${workspace || "Notion"}`);
      onConnected?.();
      // 清除 URL 参数
      window.history.replaceState({}, "", window.location.pathname);
      checkStatus();
    } else if (errorMsg) {
      toast.error(decodeURIComponent(errorMsg));
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [checkStatus, onConnected]);

  // 发起 OAuth 授权
  const handleConnect = () => {
    window.location.href = "/api/distribution/notion/auth";
  };

  // 断开连接
  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      const response = await fetch(API_DISTRIBUTION.notionStatus, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("断开连接失败");
      }

      setStatus({ connected: false });
      toast.success("已断开 Notion 连接");
      onDisconnected?.();
    } catch (error) {
      clientLogger.error({ error }, "Failed to disconnect Notion:");
      toast.error("断开连接失败");
    } finally {
      setDisconnecting(false);
      setShowDisconnectDialog(false);
    }
  };

  // 简单按钮模式
  if (!showCard) {
    if (loading) {
      return (
        <Button disabled variant="outline">
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          检查中...
        </Button>
      );
    }

    if (status?.connected) {
      return (
        <Button
          variant="outline"
          onClick={() => setShowDisconnectDialog(true)}
          disabled={disconnecting}
        >
          {disconnecting ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />
          )}
          {status.workspace?.name || "已连接"}
        </Button>
      );
    }

    return (
      <Button onClick={handleConnect}>
        <NotionIcon className="h-4 w-4 mr-2" />
        连接 Notion
      </Button>
    );
  }

  // 卡片模式
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <NotionIcon className="h-5 w-5" />
            Notion
          </CardTitle>
          <CardDescription>
            将收藏同步到 Notion Database，支持自定义属性映射
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              检查连接状态...
            </div>
          ) : status?.connected ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {status.workspace?.icon ? (
                    <Image
                      src={status.workspace.icon}
                      alt=""
                      width={24}
                      height={24}
                      className="rounded"
                      unoptimized
                    />
                  ) : (
                    <NotionIcon className="h-6 w-6" />
                  )}
                  <div>
                    <p className="font-medium">{status.workspace?.name}</p>
                    <p className="text-sm text-muted-foreground">已连接</p>
                  </div>
                </div>
                <Badge variant="secondary" className="text-green-600">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  已授权
                </Badge>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowDisconnectDialog(true)}
                  disabled={disconnecting}
                >
                  {disconnecting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Unlink className="h-4 w-4 mr-2" />
                  )}
                  断开连接
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <a
                    href={`https://www.notion.so/${status.workspace?.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    打开 Workspace
                  </a>
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <XCircle className="h-4 w-4" />
                未连接 Notion
              </div>

              <Button onClick={handleConnect} className="w-full">
                <NotionIcon className="h-4 w-4 mr-2" />
                连接 Notion
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 断开连接确认对话框 */}
      <AlertDialog
        open={showDisconnectDialog}
        onOpenChange={setShowDisconnectDialog}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>断开 Notion 连接？</AlertDialogTitle>
            <AlertDialogDescription>
              断开后，已配置的 Notion 同步目标将停止工作。你可以随时重新连接。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDisconnect}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {disconnecting && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              断开连接
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
