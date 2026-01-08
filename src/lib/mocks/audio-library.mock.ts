/**
 * 语音历史 Mock 数据
 *
 * 用于开发和演示的模拟数据
 *
 * @version 1.0.0
 * @since 2026-01-08
 */

import { TIME_CONSTANTS } from "@/lib/ui/common-styles";

// ============================================
// 类型定义
// ============================================

export interface AudioItem {
  id: string;
  title: string;
  bookmarkId: number;
  duration: string;
  createdAt: Date;
  audioUrl: string;
}

// ============================================
// Mock 数据
// ============================================

export const MOCK_AUDIO_HISTORY: AudioItem[] = [
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
    createdAt: new Date(Date.now() - TIME_CONSTANTS.ONE_DAY_MS), // 昨天
    audioUrl: "#",
  },
  {
    id: "4",
    title: "Tailwind CSS 4.0 新功能一览",
    bookmarkId: 104,
    duration: "1:58",
    createdAt: new Date(Date.now() - TIME_CONSTANTS.ONE_DAY_MS),
    audioUrl: "#",
  },
  {
    id: "5",
    title: "Supabase Edge Functions 实战",
    bookmarkId: 105,
    duration: "4:12",
    createdAt: new Date(Date.now() - TIME_CONSTANTS.ONE_DAY_MS),
    audioUrl: "#",
  },
  {
    id: "6",
    title: "Vue 3.4 性能优化技巧",
    bookmarkId: 106,
    duration: "3:05",
    createdAt: new Date(Date.now() - 3 * TIME_CONSTANTS.ONE_DAY_MS), // 3天前
    audioUrl: "#",
  },
];
