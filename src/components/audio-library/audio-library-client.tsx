/**
 * 我的语音客户端组件
 *
 * 展示 TTS 语音朗读历史，支持：
 * - 按日期分组展示
 * - 播放/暂停控制
 * - 搜索筛选
 * - 删除管理
 *
 * @version 1.0.0
 * @since 2026-01-08
 */

"use client";

import { useState, useMemo } from "react";
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
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

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

// 模拟语音历史数据
const MOCK_AUDIO_HISTORY = [
  {
    id: "1",
    title: "React 18 新特性详解",
    bookmarkId: 101,
    duration: "3:42",
    createdAt: new Date(),
    audioUrl: "#",
  },
  {
    id: "2",
    title: "TypeScript 5.0 装饰器语法",
    bookmarkId: 102,
    duration: "2:18",
    createdAt: new Date(),
    audioUrl: "#",
  },
  {
    id: "3",
    title: "Next.js 14 App Router 完全指南",
    bookmarkId: 103,
    duration: "5:21",
    createdAt: new Date(Date.now() - 86400000), // 昨天
    audioUrl: "#",
  },
  {
    id: "4",
    title: "Tailwind CSS 4.0 新功能一览",
    bookmarkId: 104,
    duration: "1:58",
    createdAt: new Date(Date.now() - 86400000),
    audioUrl: "#",
  },
  {
    id: "5",
    title: "Supabase Edge Functions 实战",
    bookmarkId: 105,
    duration: "4:12",
    createdAt: new Date(Date.now() - 86400000),
    audioUrl: "#",
  },
  {
    id: "6",
    title: "Vue 3.4 性能优化技巧",
    bookmarkId: 106,
    duration: "3:05",
    createdAt: new Date(Date.now() - 3 * 86400000), // 3天前
    audioUrl: "#",
  },
];

// ============================================
// 类型定义
// ============================================

interface AudioItem {
  id: string;
  title: string;
  bookmarkId: number;
  duration: string;
  createdAt: Date;
  audioUrl: string;
}

interface GroupedAudio {
  label: string;
  items: AudioItem[];
}

// ============================================
// 辅助函数
// ============================================

function groupByDate(items: AudioItem[]): GroupedAudio[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const weekAgo = new Date(today.getTime() - 7 * 86400000);

  const groups: Record<string, AudioItem[]> = {
    today: [],
    yesterday: [],
    thisWeek: [],
    earlier: [],
  };

  items.forEach((item) => {
    const itemDate = new Date(
      item.createdAt.getFullYear(),
      item.createdAt.getMonth(),
      item.createdAt.getDate(),
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
  if (groups.today.length > 0) {
    result.push({
      label: AUDIO_LIBRARY.DATE_GROUPS.TODAY,
      items: groups.today,
    });
  }
  if (groups.yesterday.length > 0) {
    result.push({
      label: AUDIO_LIBRARY.DATE_GROUPS.YESTERDAY,
      items: groups.yesterday,
    });
  }
  if (groups.thisWeek.length > 0) {
    result.push({
      label: AUDIO_LIBRARY.DATE_GROUPS.THIS_WEEK,
      items: groups.thisWeek,
    });
  }
  if (groups.earlier.length > 0) {
    result.push({
      label: AUDIO_LIBRARY.DATE_GROUPS.EARLIER,
      items: groups.earlier,
    });
  }

  return result;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("zh-CN", {
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
}: {
  item: AudioItem;
  isPlaying: boolean;
  onPlay: () => void;
  onDelete: () => void;
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
          >
            {isPlaying ? (
              <Pause className="size-4" />
            ) : (
              <Play className="size-4 ml-0.5" />
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
          >
            <Trash2 className="size-4" />
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

// ============================================
// 主组件
// ============================================

export function AudioLibraryClient() {
  const [searchQuery, setSearchQuery] = useState("");
  const [playingId, setPlayingId] = useState<string | null>(null);

  // 过滤和分组
  const groupedItems = useMemo(() => {
    let items = MOCK_AUDIO_HISTORY;

    // 搜索过滤
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      items = items.filter((item) => item.title.toLowerCase().includes(query));
    }

    return groupByDate(items);
  }, [searchQuery]);

  const totalCount = MOCK_AUDIO_HISTORY.length;
  const hasItems = groupedItems.length > 0;

  // 处理播放
  const handlePlay = (id: string) => {
    if (playingId === id) {
      setPlayingId(null);
    } else {
      setPlayingId(id);
      // 实际实现中这里会播放音频
    }
  };

  // 处理删除
  const handleDelete = (_id: string) => {
    // TODO: 实际实现中这里会调用 API 删除
    // 当前为 Mock 数据，暂不实现删除逻辑
  };

  return (
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
          <Badge variant="secondary" className="text-sm">
            共 {totalCount} 条语音
          </Badge>
        </div>
      </div>

      {/* 搜索框 */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
        <Input
          placeholder={AUDIO_LIBRARY.SEARCH_PLACEHOLDER}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* 语音列表 */}
      {!hasItems ? (
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
                    onDelete={() => handleDelete(item.id)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
