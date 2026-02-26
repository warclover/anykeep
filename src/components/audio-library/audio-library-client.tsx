/**
 * 我的语音客户端组件
 *
 * 展示 TTS 语音朗读历史，支持：
 * - 按日期分组展示
 * - 播放/暂停控制
 * - 搜索筛选
 * - 删除管理
 *
 * 数据隔离：通过 /api/audio-library 获取当前登录用户的专属语音记录
 *
 * @version 2.0.0
 * @since 2026-02-26
 */

"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import {
  Volume2,
  Search,
  Play,
  Pause,
  Trash2,
  ArrowLeft,
  Calendar,
  Clock,
  Mic,
  Loader2,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { TIME_CONSTANTS } from "@/lib/ui/common-styles";
import type { AudioHistoryItem } from "@/app/api/audio-library/route";

// ============================================
// 常量定义
// ============================================

const AUDIO_LIBRARY = {
  TITLE: "我的语音",
  DESCRIPTION: "管理和回放 TTS 语音朗读历史",
  SEARCH_PLACEHOLDER: "搜索语音...",
  EMPTY: {
    TITLE: "暂无语音记录",
    DESCRIPTION: "使用 TTS 朗读功能后，语音记录会显示在这里",
    ACTION: "去试试 TTS 朗读",
  },
  DATE_GROUPS: {
    TODAY: "今天",
    YESTERDAY: "昨天",
    THIS_WEEK: "本周更早",
    EARLIER: "更早",
  },
};

// ============================================
// 类型定义
// ============================================

interface GroupedAudio {
  label: string;
  items: AudioHistoryItem[];
}

// ============================================
// 辅助函数
// ============================================

function groupByDate(items: AudioHistoryItem[]): GroupedAudio[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - TIME_CONSTANTS.ONE_DAY_MS);
  const weekAgo = new Date(today.getTime() - TIME_CONSTANTS.ONE_WEEK_MS);

  const groups: Record<string, AudioHistoryItem[]> = {
    today: [],
    yesterday: [],
    thisWeek: [],
    earlier: [],
  };

  items.forEach((item) => {
    const createdAt = new Date(item.createdAt);
    const itemDate = new Date(
      createdAt.getFullYear(),
      createdAt.getMonth(),
      createdAt.getDate(),
    );

    if (itemDate.getTime() === today.getTime()) {
      groups.today.push(item);
    } else if (itemDate.getTime() === yesterday.getTime()) {
      groups.yesterday.push(item);
    } else if (itemDate.getTime() > weekAgo.getTime()) {
      groups.thisWeek.push(item);
    } else {
      groups.earlier.push(item);
    }
  });

  const result: GroupedAudio[] = [];
  if (groups.today.length > 0)
    result.push({
      label: AUDIO_LIBRARY.DATE_GROUPS.TODAY,
      items: groups.today,
    });
  if (groups.yesterday.length > 0)
    result.push({
      label: AUDIO_LIBRARY.DATE_GROUPS.YESTERDAY,
      items: groups.yesterday,
    });
  if (groups.thisWeek.length > 0)
    result.push({
      label: AUDIO_LIBRARY.DATE_GROUPS.THIS_WEEK,
      items: groups.thisWeek,
    });
  if (groups.earlier.length > 0)
    result.push({
      label: AUDIO_LIBRARY.DATE_GROUPS.EARLIER,
      items: groups.earlier,
    });

  return result;
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ============================================
// 子组件
// ============================================

function AudioItemCard({
  item,
  isPlaying,
  onPlay,
  onDelete,
  isDeleting,
}: {
  item: AudioHistoryItem;
  isPlaying: boolean;
  onPlay: () => void;
  onDelete: () => void;
  isDeleting: boolean;
}) {
  return (
    <Card
      className={cn(
        "transition-all duration-200",
        "hover:shadow-sm hover:border-gray-300 dark:hover:border-gray-600",
        isPlaying && "border-primary bg-primary/5",
      )}
    >
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          {/* 播放按钮 */}
          <Button
            size="icon"
            variant={isPlaying ? "default" : "outline"}
            className="shrink-0"
            onClick={onPlay}
            aria-label={isPlaying ? "暂停播放" : "开始播放"}
          >
            {isPlaying ? (
              <Pause className="size-4" aria-hidden="true" />
            ) : (
              <Play className="size-4 ml-0.5" aria-hidden="true" />
            )}
          </Button>

          {/* 内容 */}
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-gray-900 dark:text-white truncate">
              {item.title}
            </h4>
            <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mt-1">
              <span className="flex items-center gap-1">
                <Clock className="size-3" />
                {item.duration}
              </span>
              <span>{formatTime(item.createdAt)}</span>
            </div>
          </div>

          {/* 删除按钮 */}
          <Button
            size="icon"
            variant="ghost"
            className="shrink-0 text-gray-400 hover:text-red-500"
            onClick={onDelete}
            disabled={isDeleting}
            aria-label="删除语音"
          >
            {isDeleting ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Trash2 className="size-4" aria-hidden="true" />
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-12">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 mb-4">
        <Mic className="size-8 text-gray-400" />
      </div>
      <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300">
        {AUDIO_LIBRARY.EMPTY.TITLE}
      </h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 mb-4">
        {AUDIO_LIBRARY.EMPTY.DESCRIPTION}
      </p>
      <Link href="/home">
        <Button variant="outline" className="gap-2">
          <Volume2 className="size-4" />
          {AUDIO_LIBRARY.EMPTY.ACTION}
        </Button>
      </Link>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex items-center justify-center py-16 gap-3 text-gray-500">
      <Loader2 className="size-5 animate-spin" />
      <span>加载语音记录...</span>
    </div>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="text-center py-12">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-50 dark:bg-red-950 mb-4">
        <AlertCircle className="size-8 text-red-400" />
      </div>
      <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300">
        加载失败
      </h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 mb-4">
        无法获取语音历史，请检查网络后重试
      </p>
      <Button variant="outline" className="gap-2" onClick={onRetry}>
        <RefreshCw className="size-4" />
        重新加载
      </Button>
    </div>
  );
}

// ============================================
// 主组件
// ============================================

export function AudioLibraryClient() {
  const [audioItems, setAudioItems] = useState<AudioHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // 获取语音历史
  const fetchAudioHistory = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/audio-library");
      if (!response.ok) {
        throw new Error("获取失败");
      }
      const result: { success: boolean; data: AudioHistoryItem[] } =
        await response.json();
      if (!result.success) {
        throw new Error("获取失败");
      }
      setAudioItems(result.data);
    } catch {
      setError("加载语音历史失败");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAudioHistory();
  }, [fetchAudioHistory]);

  // 过滤和分组
  const groupedItems = useMemo(() => {
    let items = audioItems;
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      items = items.filter((item) => item.title.toLowerCase().includes(query));
    }
    return groupByDate(items);
  }, [audioItems, searchQuery]);

  const totalCount = audioItems.length;
  const hasItems = groupedItems.length > 0;

  // 处理播放
  const handlePlay = (id: string) => {
    setPlayingId((prev) => (prev === id ? null : id));
    // 实际播放逻辑预留（通过 audioPath 获取签名 URL 后播放）
  };

  // 处理删除
  const handleDelete = async (item: AudioHistoryItem) => {
    setDeletingId(item.id);
    try {
      const response = await fetch("/api/audio-library", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audioPath: item.audioPath }),
      });
      if (response.ok) {
        setAudioItems((prev) => prev.filter((a) => a.id !== item.id));
        if (playingId === item.id) setPlayingId(null);
      }
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="container mx-auto p-4 lg:p-8 max-w-4xl space-y-6">
          {/* 标题区域 */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Link href="/home">
                <Button variant="ghost" size="sm" className="gap-1">
                  <ArrowLeft className="h-4 w-4" />
                  返回首页
                </Button>
              </Link>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                  <Volume2 className="size-7 text-blue-500" />
                  {AUDIO_LIBRARY.TITLE}
                </h1>
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                  {AUDIO_LIBRARY.DESCRIPTION}
                </p>
              </div>
              {!isLoading && !error && (
                <Badge variant="secondary" className="text-sm">
                  共 {totalCount} 条语音
                </Badge>
              )}
            </div>
          </div>

          {/* 搜索框 */}
          {!isLoading && !error && totalCount > 0 && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
              <Input
                placeholder={AUDIO_LIBRARY.SEARCH_PLACEHOLDER}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          )}

          {/* 内容区域 */}
          {isLoading ? (
            <LoadingState />
          ) : error ? (
            <ErrorState onRetry={fetchAudioHistory} />
          ) : !hasItems ? (
            <EmptyState />
          ) : (
            <div className="space-y-6">
              {groupedItems.map((group) => (
                <div key={group.label}>
                  <div className="flex items-center gap-2 mb-3">
                    <Calendar className="size-4 text-gray-400" />
                    <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      {group.label}
                    </h3>
                  </div>
                  <div className="space-y-2">
                    {group.items.map((item) => (
                      <AudioItemCard
                        key={item.id}
                        item={item}
                        isPlaying={playingId === item.id}
                        onPlay={() => handlePlay(item.id)}
                        onDelete={() => handleDelete(item)}
                        isDeleting={deletingId === item.id}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
