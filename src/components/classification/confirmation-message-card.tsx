"use client";

/**
 * Confirmation Message Card
 * V4.2 待确认消息卡片组件
 *
 * @description 展示待确认的分类建议
 * - 显示书签信息
 * - 显示建议的文件夹
 * - 提供确认/拒绝/修改操作
 *
 * @version 1.0.0
 * @since 2025-12-11
 */

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Check,
  X,
  Edit2,
  Clock,
  FolderOpen,
  ExternalLink,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 待确认消息
 */
export interface ConfirmationMessage {
  id: number;
  bookmarkId: number;
  bookmarkTitle: string;
  bookmarkUrl: string;
  suggestedFolderId: number;
  suggestedFolderName: string;
  confidence: number;
  reason: string;
  status: "pending" | "confirmed" | "rejected" | "modified" | "expired";
  createdAt: string;
  expiresAt: string;
}

/**
 * 文件夹选项
 */
export interface FolderOption {
  id: number;
  name: string;
}

/**
 * 组件属性
 */
interface ConfirmationMessageCardProps {
  message: ConfirmationMessage;
  folders: FolderOption[];
  onConfirm: (messageId: number) => Promise<void>;
  onReject: (messageId: number) => Promise<void>;
  onModify: (messageId: number, newFolderId: number) => Promise<void>;
  disabled?: boolean;
  className?: string;
}

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 获取置信度颜色
 */
function getConfidenceColor(confidence: number): string {
  if (confidence >= 80) return "text-green-600 dark:text-green-400";
  if (confidence >= 60) return "text-yellow-600 dark:text-yellow-400";
  return "text-red-600 dark:text-red-400";
}

/**
 * 获取置信度等级
 */
function getConfidenceLevel(confidence: number): string {
  if (confidence >= 80) return "高";
  if (confidence >= 60) return "中";
  return "低";
}

/**
 * 计算剩余时间
 */
function getTimeRemaining(expiresAt: string): string {
  const now = new Date();
  const expires = new Date(expiresAt);
  const diffMs = expires.getTime() - now.getTime();

  if (diffMs <= 0) return "已过期";

  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) return `${diffDays} 天后过期`;
  if (diffHours > 0) return `${diffHours} 小时后过期`;
  return "即将过期";
}

/**
 * 格式化 URL 显示
 */
function formatUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname + (urlObj.pathname !== "/" ? urlObj.pathname : "");
  } catch {
    return url;
  }
}

// ============================================================================
// 组件实现
// ============================================================================

/**
 * 确认消息卡片
 */
export function ConfirmationMessageCard({
  message,
  folders,
  onConfirm,
  onReject,
  onModify,
  disabled = false,
  className,
}: ConfirmationMessageCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [selectedFolderId, setSelectedFolderId] = useState<string>(
    String(message.suggestedFolderId),
  );
  const [isLoading, setIsLoading] = useState(false);

  const timeRemaining = getTimeRemaining(message.expiresAt);
  const isExpired = timeRemaining === "已过期";

  // 处理确认
  const handleConfirm = async () => {
    setIsLoading(true);
    try {
      await onConfirm(message.id);
    } finally {
      setIsLoading(false);
    }
  };

  // 处理拒绝
  const handleReject = async () => {
    setIsLoading(true);
    try {
      await onReject(message.id);
    } finally {
      setIsLoading(false);
    }
  };

  // 处理修改
  const handleModify = async () => {
    if (!selectedFolderId) return;
    setIsLoading(true);
    try {
      await onModify(message.id, parseInt(selectedFolderId, 10));
      setIsEditing(false);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card
      className={cn(
        "transition-all duration-200 hover:shadow-md",
        isExpired && "opacity-60",
        className,
      )}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base font-medium truncate">
              {message.bookmarkTitle || "无标题"}
            </CardTitle>
            <CardDescription className="flex items-center gap-1 mt-1">
              <ExternalLink className="w-3 h-3" />
              <a
                href={message.bookmarkUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs hover:underline truncate max-w-[200px]"
              >
                {formatUrl(message.bookmarkUrl)}
              </a>
            </CardDescription>
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Badge
                  variant="outline"
                  className={cn("text-xs", getConfidenceColor(message.confidence))}
                >
                  <Sparkles className="w-3 h-3 mr-1" />
                  {message.confidence}%
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p>AI 置信度: {getConfidenceLevel(message.confidence)}</p>
                <p className="text-xs text-muted-foreground">{message.reason}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardHeader>

      <CardContent className="pb-2">
        {/* 建议文件夹 */}
        <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-md">
          <FolderOpen className="w-4 h-4 text-muted-foreground" />
          {isEditing ? (
            <Select
              value={selectedFolderId}
              onValueChange={setSelectedFolderId}
              disabled={isLoading || disabled}
            >
              <SelectTrigger className="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {folders.map((folder) => (
                  <SelectItem key={folder.id} value={String(folder.id)}>
                    {folder.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <span className="text-sm font-medium">
              {message.suggestedFolderName}
            </span>
          )}
        </div>

        {/* 过期时间 */}
        <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
          <Clock className="w-3 h-3" />
          <span>{timeRemaining}</span>
          {isExpired && <AlertCircle className="w-3 h-3 text-red-500" />}
        </div>
      </CardContent>

      <CardFooter className="pt-2 gap-2">
        {isEditing ? (
          <>
            <Button
              size="sm"
              onClick={handleModify}
              disabled={isLoading || disabled || selectedFolderId === String(message.suggestedFolderId)}
            >
              <Check className="w-4 h-4 mr-1" />
              保存
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setIsEditing(false);
                setSelectedFolderId(String(message.suggestedFolderId));
              }}
              disabled={isLoading}
            >
              取消
            </Button>
          </>
        ) : (
          <>
            <Button
              size="sm"
              onClick={handleConfirm}
              disabled={isLoading || disabled || isExpired}
              className="flex-1"
            >
              <Check className="w-4 h-4 mr-1" />
              确认
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsEditing(true)}
              disabled={isLoading || disabled || isExpired}
            >
              <Edit2 className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleReject}
              disabled={isLoading || disabled || isExpired}
            >
              <X className="w-4 h-4" />
            </Button>
          </>
        )}
      </CardFooter>
    </Card>
  );
}

// ============================================================================
// 批量操作组件
// ============================================================================

interface BatchConfirmationBarProps {
  selectedCount: number;
  onConfirmAll: () => Promise<void>;
  onRejectAll: () => Promise<void>;
  onClearSelection: () => void;
  disabled?: boolean;
}

/**
 * 批量确认操作栏
 */
export function BatchConfirmationBar({
  selectedCount,
  onConfirmAll,
  onRejectAll,
  onClearSelection,
  disabled = false,
}: BatchConfirmationBarProps) {
  const [isLoading, setIsLoading] = useState(false);

  if (selectedCount === 0) return null;

  const handleConfirmAll = async () => {
    setIsLoading(true);
    try {
      await onConfirmAll();
    } finally {
      setIsLoading(false);
    }
  };

  const handleRejectAll = async () => {
    setIsLoading(true);
    try {
      await onRejectAll();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-background border rounded-lg shadow-lg p-3 flex items-center gap-4">
      <span className="text-sm font-medium">
        已选择 {selectedCount} 条
      </span>
      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={handleConfirmAll}
          disabled={isLoading || disabled}
        >
          <Check className="w-4 h-4 mr-1" />
          全部确认
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={handleRejectAll}
          disabled={isLoading || disabled}
        >
          <X className="w-4 h-4 mr-1" />
          全部拒绝
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={onClearSelection}
          disabled={isLoading}
        >
          取消选择
        </Button>
      </div>
    </div>
  );
}
