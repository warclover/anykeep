"use client";

/**
 * DrawerCard
 * 抽屉内卡片组件
 *
 * @description
 * - 在侧边抽屉内显示的单条确认消息
 * - 更详细的信息展示
 * - 带操作按钮
 *
 * @version 2.0.0
 * @since 2025-12-14
 */

import { useState } from "react";
import {
  Check,
  X,
  Edit2,
  FolderOpen,
  ExternalLink,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ConfidenceBadge } from "../shared/ConfidenceBadge";
import type { ConfirmationMessage, FolderOption } from "../types";

// ============================================================================
// 辅助函数
// ============================================================================

function formatUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch {
    return url;
  }
}

// ============================================================================
// 类型
// ============================================================================

interface DrawerCardProps {
  message: ConfirmationMessage;
  folders: FolderOption[];
  onConfirm: () => Promise<void>;
  onReject: () => Promise<void>;
  onModify: (newFolderId: number) => Promise<void>;
}

// ============================================================================
// 组件
// ============================================================================

export function DrawerCard({
  message,
  folders,
  onConfirm,
  onReject,
  onModify,
}: DrawerCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [selectedFolderId, setSelectedFolderId] = useState<string>(
    String(message.suggestedFolderId),
  );
  const [isLoading, setIsLoading] = useState(false);

  const handleConfirm = async () => {
    setIsLoading(true);
    try {
      await onConfirm();
    } finally {
      setIsLoading(false);
    }
  };

  const handleReject = async () => {
    setIsLoading(true);
    try {
      await onReject();
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveModify = async () => {
    const newFolderId = parseInt(selectedFolderId, 10);
    if (newFolderId === message.suggestedFolderId) {
      setIsEditing(false);
      return;
    }

    setIsLoading(true);
    try {
      await onModify(newFolderId);
    } finally {
      setIsLoading(false);
      setIsEditing(false);
    }
  };

  return (
    <Card className="border-violet-100 dark:border-violet-900/50 hover:border-violet-200 dark:hover:border-violet-800 transition-colors">
      <CardContent className="p-4">
        {/* 标题行 */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-sm truncate">
              {message.bookmarkTitle || "无标题"}
            </h4>
            <a
              href={message.bookmarkUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-violet-600 dark:hover:text-violet-400 mt-0.5"
            >
              <ExternalLink className="w-3 h-3" />
              {formatUrl(message.bookmarkUrl)}
            </a>
          </div>
          <ConfidenceBadge confidence={message.confidence} size="sm" />
        </div>

        {/* 文件夹建议 */}
        <div className="flex items-center gap-2 mb-3 p-2 bg-violet-50 dark:bg-violet-950/30 rounded-md">
          <ArrowRight className="w-4 h-4 text-violet-400 flex-shrink-0" />
          {isEditing ? (
            <Select
              value={selectedFolderId}
              onValueChange={setSelectedFolderId}
              disabled={isLoading}
            >
              <SelectTrigger className="h-8 flex-1">
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
            <div className="flex items-center gap-1.5 text-sm">
              <FolderOpen className="w-4 h-4 text-violet-500" />
              <span className="font-medium">{message.suggestedFolderName}</span>
            </div>
          )}
        </div>

        {/* 操作按钮 */}
        <div className="flex items-center gap-2">
          {isEditing ? (
            <>
              <Button
                size="sm"
                onClick={handleSaveModify}
                disabled={isLoading}
                className="flex-1 bg-violet-600 hover:bg-violet-700"
              >
                <Check className="w-4 h-4 mr-1" />
                保存
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setSelectedFolderId(String(message.suggestedFolderId));
                  setIsEditing(false);
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
                disabled={isLoading}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
              >
                <Check className="w-4 h-4 mr-1" />
                确认
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsEditing(true)}
                disabled={isLoading}
              >
                <Edit2 className="w-4 h-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleReject}
                disabled={isLoading}
                className="text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
              >
                <X className="w-4 h-4" />
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
